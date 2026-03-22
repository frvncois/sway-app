import axios       from 'axios'
import { Router }   from 'express'
import NodeCache    from 'node-cache'
import { getNearbyVenues, getPlaceDetails, searchByQuery, searchByName } from '../services/google.js'
import { enrichVenue, enrichFromRaw, enrichVenuesBatch }                 from '../services/enrichVenue.js'
import { generateVenueNames }                                            from '../services/openai.js'

const router     = Router()
const cache      = new NodeCache({ stdTTL: 1800 }) // 30 min — full enriched results
const rawCache   = new NodeCache({ stdTTL: 300  }) // 5 min  — raw Google results
const enrichCache= new NodeCache({ stdTTL: 600  }) // 10 min — enrich-only results

async function batchEnrich(venues, vibe, scene = null, enrichFn = enrichVenue, batchSize = 4) {
  const results = []
  for (let i = 0; i < venues.length; i += batchSize) {
    const batchIndex = Math.floor(i / batchSize)
    console.time(`BATCH_${batchIndex}`)
    const batch    = venues.slice(i, i + batchSize)
    const enriched = await Promise.all(batch.map(v => enrichFn(v, vibe, scene)))
    results.push(...enriched.filter(Boolean))
    console.log(`Batch ${batchIndex} complete`)
    console.timeEnd(`BATCH_${batchIndex}`)
  }
  return results
}

async function getNeighborhood(lat, lng) {
  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          latlng:      `${lat},${lng}`,
          key:         process.env.GOOGLE_PLACES_API_KEY,
          result_type: 'neighborhood|sublocality',
        },
      },
    )
    const components = response.data.results?.[0]?.address_components ?? []
    const neighborhood = components.find(c =>
      c.types.includes('neighborhood') || c.types.includes('sublocality_level_1')
    )
    return neighborhood?.long_name ?? 'the area'
  } catch {
    return 'the area'
  }
}

// ── GET / — full enrichment fallback (Nearby Search + OpenAI) ────────────────

const intentTypeMap = {
  dinner: [
    { type: 'restaurant', keyword: null },
    { type: 'cafe',       keyword: null },
  ],
  drinks: [
    { type: 'bar',        keyword: null },
    { type: 'restaurant', keyword: 'bar brasserie pub' },
    { type: 'night_club', keyword: null },
  ],
  explore: [
    { type: 'store',   keyword: 'vintage friperie' },
    { type: 'store',   keyword: 'thrift boutique marche' },
    { type: 'museum',  keyword: null },
  ],
  late_eats: [
    { type: 'restaurant', keyword: 'late night' },
    { type: 'bar',        keyword: 'food' },
  ],
  party: [
    { type: 'night_club', keyword: null },
    { type: 'bar',        keyword: 'club dj music' },
  ],
}

async function fetchAllTypes(searches, lat, lng, radius) {
  const allRaw  = await Promise.all(
    searches.map(({ type, keyword }) => getNearbyVenues(lat, lng, type, radius, keyword))
  )
  const merged  = allRaw.flat()
  const seen    = new Set()
  const deduped = merged.filter(v => {
    if (seen.has(v.place_id)) return false
    seen.add(v.place_id)
    return true
  })
  console.log(`[venues] ${merged.length} total → ${deduped.length} after dedup`)
  return deduped
}

router.get('/', async (req, res) => {
  const { lat, lng, intent = 'dinner', radius = 1000, vibe } = req.query

  console.log(`\n--- NEW REQUEST ---`)
  console.log(`Intent: ${intent}, Lat: ${lat}, Lng: ${lng}`)
  console.log(`Radius: ${radius}, Vibe: ${vibe ?? 'any'}`)
  console.time('TOTAL_REQUEST')

  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng are required' })
  }

  const userLat  = parseFloat(lat)
  const userLng  = parseFloat(lng)
  const r        = parseInt(radius)
  const cacheKey = `${userLat.toFixed(3)}_${userLng.toFixed(3)}_${intent}_${r}_${vibe ?? 'any'}`
  const cached   = cache.get(cacheKey)
  if (cached) {
    console.log('Cache hit — returning cached data')
    console.timeEnd('TOTAL_REQUEST')
    return res.json({ venues: cached })
  }
  console.log('Cache miss — fetching fresh data')

  const searches = intentTypeMap[intent] ?? [{ type: 'establishment', keyword: null }]

  try {
    const deduped = await fetchAllTypes(searches, userLat, userLng, r)

    const detailsLabel = `GOOGLE_DETAILS_${Date.now()}`
    console.time(detailsLabel)
    const detailed = await Promise.all(
      deduped.map(async raw => {
        try {
          const details = await getPlaceDetails(raw.place_id, userLat, userLng)
          return { ...raw, ...details }
        } catch {
          return { ...raw }
        }
      })
    )
    console.timeEnd(detailsLabel)

    const withinRadius = detailed.filter(v => (v.distance_meters ?? Infinity) <= r)
    console.log(`Google returned ${withinRadius.length} venues within ${r}m`)

    console.time('enrich-batch')
    const venues = await batchEnrich(withinRadius, vibe, null, enrichVenue)
    console.timeEnd('enrich-batch')

    console.log(`Returning ${venues.length} enriched venues`)
    console.timeEnd('TOTAL_REQUEST')

    cache.set(cacheKey, venues)
    res.json({ venues })
  } catch (err) {
    console.error('[venues] request failed:', err)
    res.status(500).json({ error: 'Failed to fetch venues' })
  }
})

// ── Session store — server-side dedup across rounds ──────────────────────────

const sessionStore = new Map()

function getSessionKey(lat, lng, intent, scene) {
  return `${Number(lat).toFixed(3)}_${Number(lng).toFixed(3)}_${intent}_${scene ?? ''}`
}

function getShownVenues(sessionKey) {
  const session = sessionStore.get(sessionKey)
  if (!session) return new Set()
  if (Date.now() - session.createdAt > 30 * 60 * 1000) {
    sessionStore.delete(sessionKey)
    return new Set()
  }
  return session.shown
}

function markVenuesShown(sessionKey, placeIds) {
  if (!sessionStore.has(sessionKey)) {
    sessionStore.set(sessionKey, { shown: new Set(), createdAt: Date.now() })
  }
  placeIds.forEach(id => sessionStore.get(sessionKey).shown.add(id))
}

// ── GET /raw — GPT-first pipeline ────────────────────────────────────────────

function buildGoogleQueries(intent, scene, neighborhood, city) {
  if (!scene) return [`${intent} ${neighborhood} ${city}`]
  return [
    `${scene} ${neighborhood} ${city}`,
    `${scene} ${city}`,
  ]
}

const INTENT_ALLOWED_TYPES = {
  dinner:    ['restaurant', 'cafe', 'bakery', 'food', 'meal_takeaway', 'meal_delivery'],
  drinks:    ['bar', 'night_club', 'restaurant'],
  late_eats: ['restaurant', 'bar', 'cafe', 'meal_takeaway'],
  party:     ['night_club', 'bar', 'music', 'casino'],
  shop: [
    'store', 'clothing_store', 'book_store', 'shopping_mall',
    'home_goods_store', 'shoe_store', 'jewelry_store', 'florist',
    'bicycle_store', 'electronics_store', 'furniture_store',
    'hardware_store', 'pet_store', 'sporting_goods_store',
    'toy_store', 'art_gallery',
  ],
  visit: [
    'museum', 'art_gallery', 'park', 'tourist_attraction',
    'place_of_worship', 'zoo', 'aquarium', 'amusement_park',
    'stadium', 'cemetery', 'library', 'city_hall', 'courthouse',
    'natural_feature', 'point_of_interest',
  ],
}

const ALWAYS_EXCLUDE = [
  'health', 'doctor', 'hospital', 'pharmacy', 'physiotherapist', 'dentist',
  'veterinary_care', 'real_estate_agency', 'insurance_agency', 'lawyer',
  'accounting', 'bank', 'atm', 'finance', 'gas_station', 'car_repair',
  'car_dealer', 'parking', 'locksmith', 'plumber', 'electrician',
  'laundry', 'storage', 'moving_company', 'funeral_home',
]

function isRelevantForScene(venue, intent, scene) {
  if (!scene) return true
  const types      = venue.types ?? []
  const sceneLower = scene.toLowerCase()

  if (sceneLower.includes('record') || sceneLower.includes('vinyl')) {
    return types.some(t => ['store', 'music_store', 'electronics_store', 'home_goods_store'].includes(t)) &&
      !types.some(t => ['restaurant', 'cafe', 'bar', 'bakery', 'food', 'meal_takeaway', 'night_club'].includes(t))
  }

  if (sceneLower.includes('vintage') || sceneLower.includes('thrift') || sceneLower.includes('friperie')) {
    return types.some(t => ['store', 'clothing_store', 'second_hand_store', 'home_goods_store'].includes(t)) &&
      !types.some(t => ['restaurant', 'cafe', 'bar', 'bakery', 'food', 'night_club'].includes(t))
  }

  if (sceneLower.includes('gallery') || sceneLower.includes('galerie')) {
    return types.some(t => ['art_gallery', 'museum', 'store', 'point_of_interest'].includes(t)) &&
      !types.some(t => ['restaurant', 'cafe', 'bar', 'bakery', 'food', 'night_club', 'clothing_store', 'home_goods_store'].includes(t))
  }

  if (sceneLower.includes('book') || sceneLower.includes('librair')) {
    return types.some(t => ['book_store', 'store'].includes(t)) &&
      !types.some(t => ['restaurant', 'cafe', 'bar', 'bakery', 'food', 'night_club'].includes(t))
  }

  // Shop intent — exclude food and nightlife
  if (intent === 'shop') {
    const nonShopTypes = ['restaurant', 'cafe', 'bar', 'bakery', 'food', 'night_club', 'meal_takeaway']
    if (
      types.some(t => nonShopTypes.includes(t)) &&
      !types.some(t => ['store', 'clothing_store', 'book_store', 'home_goods_store'].includes(t))
    ) return false
  }

  // Visit intent — exclude shops and nightlife
  if (intent === 'visit') {
    const nonVisitTypes = [
      'store', 'clothing_store', 'bar', 'night_club', 'restaurant',
      'cafe', 'meal_takeaway', 'beauty_salon', 'gym',
    ]
    if (
      types.some(t => nonVisitTypes.includes(t)) &&
      !types.some(t => ['museum', 'art_gallery', 'park', 'tourist_attraction',
        'zoo', 'aquarium', 'point_of_interest', 'library'].includes(t))
    ) return false
  }

  return true
}

function isRelevantVenue(venue, intent) {
  const types = venue.types ?? []

  if (types.some(t => ALWAYS_EXCLUDE.includes(t))) return false

  if (intent === 'drinks') {
    const nonBarTypes = [
      'furniture_store', 'home_goods_store', 'hardware_store',
      'electronics_store', 'clothing_store', 'book_store',
      'art_gallery', 'museum', 'grocery_or_supermarket',
    ]
    if (
      types.some(t => nonBarTypes.includes(t)) &&
      !types.includes('bar') &&
      !types.includes('night_club') &&
      !types.includes('restaurant')
    ) return false
  }

  const allowedTypes = INTENT_ALLOWED_TYPES[intent] ?? []
  if (!allowedTypes.length) return true
  return types.some(t => allowedTypes.includes(t))
}

function scoreVenueForToday(venue) {
  const dayIdx    = new Date().getDay()
  const isWeekend = dayIdx === 0 || dayIdx === 5 || dayIdx === 6

  // Busy score — real today data preferred, fallback to day-type avg, then neutral
  let busyScore = 0.5
  if (venue.today_busy_level != null) {
    busyScore = venue.today_busy_level
  } else if (venue.weekend_avg_busy != null || venue.weeknight_avg_busy != null) {
    busyScore = isWeekend
      ? (venue.weekend_avg_busy ?? venue.weeknight_avg_busy ?? 0.5)
      : (venue.weeknight_avg_busy ?? venue.weekend_avg_busy ?? 0.5)
  }

  const ratingScore = Math.min(Math.max(((venue.rating ?? 3.5) - 2) / 3, 0), 1)
  const distScore   = 1 - Math.min((venue.distance_meters ?? 1000) / 2000, 1)

  return busyScore * 0.55 + ratingScore * 0.25 + distScore * 0.20
}

const SPARSE_CATEGORIES = {
  dinner:    2000,
  drinks:    2000,
  late_eats: 2000,
  party:     2500,
  shop:      2000,
  visit:     3000,
}

router.get('/raw', async (req, res) => {
  const { lat, lng, intent, vibe = 'any', scene = null, city = null } = req.query
  const radiusNum = parseInt(req.query.radius) || 1000
  const roundNum  = parseInt(req.query.round) || 1

  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng required' })
  }

  const userLat       = parseFloat(lat)
  const userLng       = parseFloat(lng)
  const minRadius     = SPARSE_CATEGORIES[intent] ?? 1000
  const effectiveRadius = Math.max(radiusNum, minRadius)
  const cacheKey      = `raw_${intent}_${scene}_${roundNum}_${userLat.toFixed(3)}_${userLng.toFixed(3)}_${effectiveRadius}`
  const cached        = rawCache.get(cacheKey)
  if (cached) {
    console.log('[raw] cache hit')
    return res.json({ venues: cached })
  }

  console.log(`[raw] intent: ${intent}, requested: ${radiusNum}m, effective: ${effectiveRadius}m`)
  console.time('RAW_TOTAL')

  try {
    // Step 1: Reverse geocode neighborhood
    const neighborhood = await getNeighborhood(userLat, userLng)
    const resolvedCity = city ?? 'Montreal'
    console.log(`[raw] neighborhood: ${neighborhood}`)

    const sessionKey  = getSessionKey(lat, lng, intent, scene)
    const shownVenues = getShownVenues(sessionKey)

    // Step 2: GPT names + Google text search — fire simultaneously
    const [venueNames, googleResults] = await Promise.all([
      generateVenueNames(intent, vibe, scene, neighborhood, resolvedCity, roundNum),
      (async () => {
        const queries = buildGoogleQueries(intent, scene, neighborhood, resolvedCity)
        const results = await Promise.all(
          queries.map(q => searchByQuery(q, userLat, userLng, effectiveRadius))
        )
        return results.flat()
      })(),
    ])

    console.log(`[raw] GPT: ${venueNames.length} names, Google: ${googleResults.length} results`)

    if (!venueNames.length && !googleResults.length) {
      return res.status(500).json({ error: 'Could not find venues' })
    }

    // Step 3: Resolve GPT names via Google Name Search
    const nameResults = await Promise.all(
      venueNames.map(name => searchByName(name, userLat, userLng, effectiveRadius))
    )

    // Step 4: Merge both pools and deduplicate
    const allResults = [...nameResults.flat(), ...googleResults]
    const seen    = new Set()
    const deduped = allResults.filter(v => {
      if (!v?.place_id) return false
      if (seen.has(v.place_id)) return false
      seen.add(v.place_id)
      return true
    })
    console.log(`[raw] merged: ${allResults.length} → ${deduped.length} unique`)

    // Step 5: Fetch Place Details for all in parallel
    console.time('GOOGLE_DETAILS_ALL')
    const detailed = await Promise.all(
      deduped.map(async r => {
        try {
          const details = await getPlaceDetails(r.place_id, userLat, userLng)
          return { ...r, ...details }
        } catch {
          return { ...r }
        }
      })
    )
    console.timeEnd('GOOGLE_DETAILS_ALL')

    // Step 6: Filter by relevance, scene match, distance, and sort by rating
    const relevant      = detailed.filter(v => v && isRelevantVenue(v, intent))
    const sceneFiltered = relevant.filter(v => isRelevantForScene(v, intent, scene))
    const withinRadius  = sceneFiltered
      .filter(v => (v.distance_meters ?? Infinity) <= effectiveRadius * 2)
      .sort((a, b) => scoreVenueForToday(b) - scoreVenueForToday(a))

    console.log(`[raw] ${detailed.length} total → ${relevant.length} relevant → ${sceneFiltered.length} scene-matched → ${withinRadius.length} within radius`)

    // Step 6b: Hard filter — remove venues closed today
    const openVenues = withinRadius.filter(v => {
      if (v.open_today === false) {
        console.log(`[filter] removing closed venue: ${v.name}`)
        return false
      }
      return true
    })
    console.log(`[raw] ${withinRadius.length} venues → ${openVenues.length} open today (${withinRadius.length - openVenues.length} closed)`)

    // Step 7: Remove already-shown venues (server-side dedup)
    const fresh = openVenues.filter(v => !shownVenues.has(v.place_id))
    console.log(`[raw] ${withinRadius.length} within radius → ${fresh.length} fresh (${shownVenues.size} already shown)`)
    if (fresh.length < 5) {
      console.log(`[raw] only ${fresh.length} fresh venues — niche scene, this is expected`)
    }

    // Step 8: Cap and mark as shown
    const capped = fresh.slice(0, 30)
    markVenuesShown(sessionKey, capped.map(v => v.place_id).filter(Boolean))
    console.log(`[raw] returning ${capped.length} venues (capped at 30)`)
    console.timeEnd('RAW_TOTAL')

    // Only cache round 1 — later rounds must always be fresh
    if (roundNum === 1) rawCache.set(cacheKey, capped, 300)
    return res.json({ venues: capped })
  } catch (e) {
    console.error('[raw] pipeline failed:', e.message)
    return res.status(500).json({ error: 'Failed to fetch venues' })
  }
})

// ── POST /enrich — OpenAI only, venues already have Google data ───────────────

router.post('/enrich', async (req, res) => {
  const { venues: rawVenues = [], vibe, intent, scene = null } = req.body

  if (!rawVenues.length) {
    return res.status(400).json({ error: 'venues array is required' })
  }

  const cacheKey = `enrich_${intent}_${scene}_${vibe ?? 'any'}_${rawVenues.map(v => (v.place_id ?? '').slice(-6)).join('')}`
  const cached   = enrichCache.get(cacheKey)

  if (cached) {
    console.log('[enrich] cache hit')
    return res.json({ venues: cached })
  }

  console.log(`[enrich] enriching ${rawVenues.length} venues — vibe: ${vibe ?? 'any'}`)

  try {
    const venues = await enrichVenuesBatch(rawVenues, vibe, scene)
    console.log(`[enrich] returning ${venues.length} enriched venues`)

    enrichCache.set(cacheKey, venues)
    res.json({ venues })
  } catch (err) {
    console.error('[enrich] request failed:', err)
    res.status(500).json({ error: 'Failed to enrich venues' })
  }
})

export default router
