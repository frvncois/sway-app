import { inferVibeTags, inferVibeTagsBatch } from './openai.js'
import { gradientForTags, tagsWithVariants } from '../utils/mapVibe.js'

// ── helpers ──────────────────────────────────────────────────────────────────

function priceLevel(googleLevel) {
  if (!googleLevel) return 2
  if (googleLevel <= 1) return 1
  if (googleLevel >= 3) return 3
  return 2
}

function distanceMinutes(meters) {
  return Math.round((meters || 0) / 80) || 1
}

function neighborhood(formattedAddress = '') {
  // Take second comma-separated segment as neighborhood, fallback to city
  const parts = formattedAddress.split(',')
  return parts[1]?.trim() || parts[0]?.trim() || ''
}

function openUntilString(openingHours) {
  if (!openingHours?.periods) return null
  const now  = new Date()
  const day  = now.getDay()
  const today = openingHours.periods.find(p => p.open?.day === day)
  if (!today?.close?.time) return null
  const t = today.close.time
  const h = parseInt(t.slice(0, 2), 10)
  const m = t.slice(2)
  const suffix = h >= 12 ? (h === 12 ? 'pm' : `${h - 12}:${m}`) : `${h}:${m}`
  return h >= 12 ? `${h === 12 ? 12 : h - 12}:${m}` : `${h}:${m}`
}

function getIntentType(types = []) {
  if (types.some(t => ['restaurant', 'cafe', 'food', 'bakery'].includes(t)))  return 'dinner'
  if (types.some(t => ['bar', 'night_club'].includes(t)))                      return 'drinks'
  if (types.some(t => ['store', 'clothing_store', 'book_store'].includes(t))) return 'shop'
  if (types.some(t => ['museum', 'art_gallery', 'park', 'tourist_attraction'].includes(t))) return 'visit'
  return 'other'
}

function photoUrl(ref) {
  if (!ref) return null
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ref}&key=${process.env.GOOGLE_PLACES_API_KEY}`
}

// ── main ─────────────────────────────────────────────────────────────────────

export async function enrichVenue(googleVenue, vibe, scene = null) {
  const {
    place_id,
    name,
    types = [],
    price_level: gPrice,
    rating,
    editorial_summary,
    reviews = [],
    opening_hours,
    formatted_address = '',
    photos = [],
  } = googleVenue

  // Build OpenAI input from Google data
  const openaiInput = {
    name,
    type: types[0] || '',
    price_level:      gPrice,
    editorial_summary:editorial_summary?.overview || '',
    reviews:          reviews.slice(0, 3).map(r => r.text),
  }

  console.time(`ENRICH_${name}`)
  console.log(`[enrich] starting "${name}"`)

  const vibeResult = await inferVibeTags(openaiInput, vibe, scene)

  // ── assemble ────────────────────────────────────────────────────────────────

  const { tags: vibeTags, vibe_reason } = vibeResult
  const gradient = gradientForTags(vibeTags)
  const tags     = tagsWithVariants(vibeTags)

  const distMeters = googleVenue.distance_meters ?? googleVenue.distance ?? null
  const photoRefs  = photos.slice(0, 3).map(p => photoUrl(p.photo_reference)).filter(Boolean)

  console.log(`[enrich] done "${name}" — tags: [${vibeResult.tags?.join(', ')}]`)
  console.timeEnd(`ENRICH_${name}`)

  return {
    id:               place_id,
    name,
    description:      editorial_summary?.overview || '',
    neighborhood:     neighborhood(formatted_address),
    distance_minutes: distanceMinutes(distMeters),
    distance_meters:  distMeters,
    open_now:         opening_hours?.open_now ?? true,
    open_until:       openUntilString(opening_hours),
    opening_hours:    opening_hours ?? null,
    price_level:      priceLevel(gPrice),
    rating:           rating || null,
    tags,
    vibe_reason,
    gradient_from:    gradient.gradient_from,
    gradient_to:      gradient.gradient_to,
    photos:           photoRefs,
    google_place_id:  place_id,
    intent_type:      getIntentType(types),
    types:            types.slice(0, 3),
  }
}

// Alias: venues from /raw already have Google data — same enrichment pipeline
export { enrichVenue as enrichFromRaw }

// ── batch enrichment — one OpenAI call for all venues ─────────────────────────

export async function enrichVenuesBatch(rawVenues, vibe, scene = null) {
  if (!rawVenues.length) return []

  console.log(`[enrich] batch enriching ${rawVenues.length} venues`)
  console.time('ENRICH_BATCH_TOTAL')

  // One OpenAI call for all venues
  const tagged = await inferVibeTagsBatch(rawVenues, vibe, scene)

  // Transform to app format
  const final = tagged.map(v => {
    const distMeters = v.distance_meters ?? v.distance ?? null
    const photoRefs  = (v.photos ?? []).slice(0, 3)
      .map(p => photoUrl(p.photo_reference)).filter(Boolean)
    const tagLabels  = v.tags?.map(t => t.label ?? t) ?? []
    const gradient   = gradientForTags(tagLabels)

    return {
      id:               v.place_id,
      name:             v.name,
      description:      v.editorial_summary?.overview || '',
      neighborhood:     neighborhood(v.formatted_address ?? ''),
      distance_minutes: distanceMinutes(distMeters),
      distance_meters:  distMeters,
      open_now:         v.opening_hours?.open_now ?? true,
      open_until:       openUntilString(v.opening_hours),
      opening_hours:    v.opening_hours ?? null,
      price_level:      priceLevel(v.price_level),
      rating:           v.rating || null,
      rating_count:     v.user_ratings_total ?? null,
      website:          v.website ?? null,
      reviews:          (v.reviews ?? []).slice(0, 5).map(r => ({
        author: r.author_name,
        text:   r.text,
        time:   r.relative_time_description,
        rating: r.rating,
      })),
      tags:             v.tags,
      vibe_reason:      v.vibe_reason,
      gradient_from:    gradient.gradient_from,
      gradient_to:      gradient.gradient_to,
      photos:           photoRefs,
      google_place_id:  v.place_id,
      intent_type:      getIntentType(v.types ?? []),
      types:            (v.types ?? []).slice(0, 3),
      peak_hours:       v.peak_hours ?? null,
      current_busy:     v.current_busy ?? null,
      peak_hour:        v.peak_hour ?? null,
      peak_description: v.peak_description ?? null,
      peak_estimated:   v.peak_estimated ?? false,
      open_today:       v.open_today ?? true,
      open_time_mins:   v.open_time_mins ?? null,
      close_time_mins:  v.close_time_mins ?? null,
      day_of_week:      v.day_of_week ?? new Date().getDay(),
      is_weekend:          v.is_weekend ?? false,
      is_friday:           v.is_friday ?? false,
      is_weeknight:        v.is_weeknight ?? false,
      day_name:            v.day_name ?? null,
      today_busy_level:    v.today_busy_level    ?? null,
      today_busy_text:     v.today_busy_text     ?? null,
      weekend_avg_busy:    v.weekend_avg_busy    ?? null,
      weeknight_avg_busy:  v.weeknight_avg_busy  ?? null,
      is_weekend_venue:    v.is_weekend_venue    ?? false,
      is_weekday_venue:    v.is_weekday_venue    ?? false,
    }
  })

  console.timeEnd('ENRICH_BATCH_TOTAL')
  return final
}
