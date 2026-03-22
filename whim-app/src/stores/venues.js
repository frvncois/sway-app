import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { fetchVenues, fetchRawVenues, enrichVenues as enrichVenuesApi, buildNightPlan } from '@/services/api.js'
import { requestGeolocation } from '@/composables/useGeolocation.js'

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback)) }
  catch { return fallback }
}

export const useVenuesStore = defineStore('venues', () => {
  const venues           = ref([])
  const currentIndex     = ref(0)
  const loading          = ref(false)
  const error            = ref(null)
  const userLocation     = ref(null)
  const currentIntent    = ref('dinner')
  const city             = ref(null)
  const rawGoogleVenues  = ref([])
  const isEnriching      = ref(false)
  const firstBatchReady  = ref(false)
  const shownVenueIds    = ref(new Set())
  const skippedVenues    = ref([])
  const searchRound      = ref(1)

  // ── phase system ──────────────────────────────────────────────────────────

  const phase       = ref('discovery') // 'discovery' | 'running-low' | 'best-of' | 'reset'
  const sessionPool = ref([])          // ALL venues fetched this session
  const bestOfShown = ref(false)

  // ── vibe ──────────────────────────────────────────────────────────────────

  const vibe   = ref(localStorage.getItem('whim_vibe') ?? null)
  const radius = ref(2000)

  let _sceneInit = null
  try { _sceneInit = JSON.parse(localStorage.getItem('whim_scene') ?? 'null') } catch {}
  const scene = ref(_sceneInit)

  const transport = ref({
    walk:    true,
    transit: true,
    car:     false,
    uber:    true,
  })

  // ── plan + taste ─────────────────────────────────────────────────────────

  const planVenues   = ref(load('whim_plan', []))
  const tasteProfile = ref(load('whim_taste', {}))
  const favourites   = ref(load('whim_favourites', []))
  const builtPlan    = ref(null)
  const currentPlan  = ref(null)
  const planBuilding = ref(false)
  const planError    = ref(null)
  const showPlan     = ref(false)
  let   rebuildTimer = null

  watch(tasteProfile, val => localStorage.setItem('whim_taste', JSON.stringify(val)), { deep: true })
  watch(favourites,   val => localStorage.setItem('whim_favourites', JSON.stringify(val)), { deep: true })

  function schedulePlanRebuild() {
    if (rebuildTimer) clearTimeout(rebuildTimer)
    if (planVenues.value.length < 2) {
      currentPlan.value  = null
      planBuilding.value = false
      return
    }
    planBuilding.value = true
    rebuildTimer = setTimeout(() => rebuildPlan(), 1500)
  }

  async function rebuildPlan() {
    if (planVenues.value.length < 2) {
      currentPlan.value  = null
      planBuilding.value = false
      return
    }
    planBuilding.value = true
    planError.value    = null
    console.log('[plan] rebuilding for', planVenues.value.map(v => v.name))
    try {
      const plan = await buildNightPlan({
        venues: planVenues.value,
        intent: currentIntent.value,
        vibe:   vibe.value,
      })

      // Inject any venues GPT dropped so all saved places always appear
      const plannedNames = plan.stops.map(s => s.name.toLowerCase())
      const missing = planVenues.value.filter(v =>
        !plannedNames.some(n =>
          n.includes(v.name.toLowerCase()) || v.name.toLowerCase().includes(n)
        )
      )
      if (missing.length) {
        console.log('[plan] injecting missing venues:', missing.map(v => v.name))
        missing.forEach(venue => {
          plan.stops.push({
            name:        venue.name,
            time:        'TBD',
            description: venue.vibe_reason ?? 'Worth checking out.',
            transition:  venue.distance_minutes ? `${venue.distance_minutes} min walk` : null,
          })
        })
      }

      currentPlan.value = plan
      console.log('[plan] rebuilt:', plan.stops?.map(s => `${s.time} ${s.name}`))
    } catch (e) {
      planError.value = 'Could not build plan'
      console.log('[plan] rebuild failed:', e.message)
    } finally {
      planBuilding.value = false
    }
  }

  function formatMins(totalMins) {
    let hh  = Math.floor(totalMins / 60) % 24
    let mm  = totalMins % 60
    const p = hh >= 12 ? 'PM' : 'AM'
    if (hh > 12) hh -= 12
    if (hh === 0) hh = 12
    return `${hh}:${String(mm).padStart(2, '0')} ${p}`
  }

  function rebuildPlanWithOrder(nameOrder) {
    if (!currentPlan.value?.stops) return

    const now  = new Date()
    let cursor = now.getHours() * 60 + now.getMinutes()

    const DURATIONS = { daytime: 60, dinner: 75, drinks: 60, club: 120 }

    const reordered = nameOrder
      .map(name => {
        const stop  = currentPlan.value.stops.find(s => s.name === name)
        const venue = planVenues.value.find(v => v.name === name)
        return stop ?? { name, time: 'TBD', category: 'drinks', tags: venue?.tags ?? [] }
      })
      .filter(Boolean)

    const recalculated = reordered.map(stop => {
      const venue    = planVenues.value.find(v => v.name === stop.name)
      const category = stop.category ?? 'drinks'
      const duration = DURATIONS[category] ?? 60
      const peakH    = venue?.peak_hour ?? null
      const ideal    = peakH ? (peakH * 60) - 30 : cursor
      const start    = Math.max(ideal, cursor)
      cursor = start + duration
      return { ...stop, time: formatMins(start) }
    })

    currentPlan.value = { ...currentPlan.value, stops: recalculated }

    const reorderedVenues = nameOrder
      .map(name => planVenues.value.find(v => v.name === name))
      .filter(Boolean)
    const remaining = planVenues.value.filter(v => !nameOrder.includes(v.name))
    planVenues.value = [...reorderedVenues, ...remaining]
    localStorage.setItem('whim_plan', JSON.stringify(planVenues.value))

    console.log('[plan] reordered instantly:', recalculated.map(s => `${s.time} ${s.name}`))
  }

  function addToPlan(venue) {
    if (!planVenues.value.find(v => v.id === venue.id || v.name === venue.name)) {
      planVenues.value.push(venue)
      localStorage.setItem('whim_plan', JSON.stringify(planVenues.value))
      schedulePlanRebuild()
    }
  }

  function removeFromPlan(venueId) {
    planVenues.value = planVenues.value.filter(
      v => v.id !== venueId && v.name !== venueId
    )
    localStorage.setItem('whim_plan', JSON.stringify(planVenues.value))
    schedulePlanRebuild()
  }

  function isInPlan(venue) {
    return planVenues.value.some(
      v => v.id === venue?.id || v.name === venue?.name
    )
  }

  function clearPlan() {
    planVenues.value   = []
    currentPlan.value  = null
    planBuilding.value = false
    planError.value    = null
    if (rebuildTimer) clearTimeout(rebuildTimer)
    localStorage.removeItem('whim_plan')
  }

  function starVenue(venue) {
    addToPlan(venue)
    venue.tags?.forEach(tag => {
      tasteProfile.value[tag.label ?? tag] =
        (tasteProfile.value[tag.label ?? tag] ?? 0) + 1
    })
  }

  // Restore plan from previous session
  if (planVenues.value.length >= 2) {
    setTimeout(() => rebuildPlan(), 500)
  }

  // ── computed ─────────────────────────────────────────────────────────────

  const currentVenue = computed(() => venues.value[currentIndex.value] ?? null)
  const hasMore      = computed(() => currentIndex.value < venues.value.length)

  // ── actions ──────────────────────────────────────────────────────────────

  function setLocation(lat, lng) { userLocation.value = { lat, lng } }
  function setCity(name)         { city.value = name }

  function setIntent(intent) {
    currentIntent.value   = intent
    venues.value          = []
    currentIndex.value    = 0
    rawGoogleVenues.value = []
    shownVenueIds.value   = new Set()
    skippedVenues.value   = []
    searchRound.value     = 1
    sessionPool.value     = []
    bestOfShown.value     = false
    phase.value           = 'discovery'
    error.value           = null
    firstBatchReady.value = false
    console.log('[store] intent changed — full reset')
  }

  function setTransport(key, val) { transport.value[key] = val }

  function setVibe(v) {
    vibe.value = v
    localStorage.setItem('whim_vibe', v)
  }

  function setScene(s) {
    scene.value           = s
    venues.value          = []
    currentIndex.value    = 0
    rawGoogleVenues.value = []
    shownVenueIds.value   = new Set()
    skippedVenues.value   = []
    searchRound.value     = 1
    sessionPool.value     = []
    bestOfShown.value     = false
    phase.value           = 'discovery'
    error.value           = null
    firstBatchReady.value = false
    localStorage.setItem('whim_scene', JSON.stringify(s))
    console.log('[store] scene changed — full reset')
  }


  // ── main enrichment pipeline ──────────────────────────────────────────────

  async function startEnrichment() {
    venues.value          = []
    currentIndex.value    = 0
    shownVenueIds.value   = new Set()
    skippedVenues.value   = []
    searchRound.value     = 1
    sessionPool.value     = []
    bestOfShown.value     = false
    phase.value           = 'discovery'
    firstBatchReady.value = false
    error.value           = null
    loading.value         = true

    if (!userLocation.value) {
      try {
        const { lat, lng } = await requestGeolocation()
        setLocation(lat, lng)
      } catch (e) {
        error.value   = 'Location required.'
        loading.value = false
        return
      }
    }

    console.log(`[prefetch] radius: ${radius.value}m, intent: ${currentIntent.value}`)
    let raw = []
    try {
      raw = await fetchRawVenues({
        lat:    userLocation.value.lat,
        lng:    userLocation.value.lng,
        intent: currentIntent.value,
        radius: radius.value,
        vibe:   vibe.value ?? 'any',
        scene:  scene.value?.query ?? null,
        city:   city.value ?? null,
        round:  1,
      })
    } catch (e) {
      error.value   = 'Could not load places.'
      loading.value = false
      return
    }

    if (!raw.length) {
      error.value   = 'No places found nearby.'
      loading.value = false
      return
    }

    // Cap to 30 max — enough for a good session
    const capped     = raw.slice(0, 30)
    const firstBatch = capped.slice(0, 4)
    const restBatch  = capped.slice(4)

    console.time('FIRST_BATCH')
    try {
      const enriched = await enrichVenuesApi({
        venues: firstBatch,
        vibe:   vibe.value,
        scene:  scene.value?.label ?? null,
        intent: currentIntent.value,
      })
      const openEnriched = enriched.filter(v => {
        if (v.open_today === false) {
          console.log(`[store] filtering closed venue: ${v.name}`)
          return false
        }
        return true
      })
      venues.value          = openEnriched
      sessionPool.value     = [...openEnriched]
      firstBatchReady.value = true
      currentIndex.value    = 0
      openEnriched.forEach(v => shownVenueIds.value.add(v.google_place_id ?? v.name))
      console.timeEnd('FIRST_BATCH')
    } catch (e) {
      error.value = 'Could not load places.'
    } finally {
      loading.value = false
    }

    if (restBatch.length) {
      enrichRestAll(restBatch)
    }

    rawGoogleVenues.value = []
  }

  async function enrichRestAll(batch) {
    isEnriching.value = true
    console.log(`[enrich] enriching remaining ${batch.length} venues in background`)

    for (let i = 0; i < batch.length; i += 4) {
      const chunk = batch.slice(i, i + 4)
      try {
        const enriched = await enrichVenuesApi({
          venues: chunk,
          vibe:   vibe.value,
          scene:  scene.value?.label ?? null,
          intent: currentIntent.value,
        })
        const openEnriched = enriched.filter(v => v.open_today !== false)
        const fresh = openEnriched.filter(v =>
          !shownVenueIds.value.has(v.google_place_id ?? v.name)
        )
        fresh.forEach(v => shownVenueIds.value.add(v.google_place_id ?? v.name))
        venues.value      = [...venues.value, ...fresh]
        sessionPool.value = [...sessionPool.value, ...fresh]
        console.log(`[enrich] +${fresh.length} venues (total: ${venues.value.length})`)
      } catch (e) {
        console.log('[enrich] chunk failed silently:', e.message)
      }
    }

    isEnriching.value = false
    console.log(`[enrich] all done. Session pool: ${sessionPool.value.length} venues`)
    boostStarredVenues()
  }

  async function loadVenues() {
    if (!userLocation.value) return
    loading.value = true
    error.value   = null
    try {
      venues.value       = await fetchVenues({
        lat:    userLocation.value.lat,
        lng:    userLocation.value.lng,
        intent: currentIntent.value,
        radius: radius.value,
        vibe:   vibe.value,
      })
      currentIndex.value = 0
    } catch {
      error.value = 'Could not load places.'
    } finally {
      loading.value = false
    }
  }

  function nextVenue() {
    currentIndex.value++
    console.log(`[swipe] index: ${currentIndex.value} / ${venues.value.length}`)
  }

  function swipeRight() {
    console.log('[whim] go →', currentVenue.value?.name)
    if (currentVenue.value) addToPlan(currentVenue.value)
    nextVenue()
    maybeLoadMore()
  }

  function swipeLeft() {
    console.log('[whim] skip ←', currentVenue.value?.name)
    if (currentVenue.value) skippedVenues.value.push(currentVenue.value)
    nextVenue()
    maybeLoadMore()
  }

  function maybeLoadMore() {
    const remaining = venues.value.length - currentIndex.value - 1
    console.log(`[phase: ${phase.value}] ${remaining} cards remaining`)

    // Phase 2: fire round 2 when 3 cards left
    if (
      remaining <= 3 &&
      phase.value === 'discovery' &&
      !isEnriching.value &&
      !loading.value
    ) {
      phase.value = 'running-low'
      console.log('[phase] → running-low, fetching round 2')
      fetchRound2()
      return
    }

    // Phase 3: show best-of when on last card
    if (
      remaining <= 0 &&
      !isEnriching.value &&
      !loading.value &&
      !bestOfShown.value &&
      sessionPool.value.length > 0
    ) {
      console.log('[phase] → best-of')
      showBestOf()
      return
    }
  }

  async function fetchRound2() {
    if (isEnriching.value) return
    isEnriching.value = true
    console.log('[round 2] fetching hidden gems...')

    try {
      const raw = await fetchRawVenues({
        lat:    userLocation.value.lat,
        lng:    userLocation.value.lng,
        intent: currentIntent.value,
        radius: Math.min(radius.value * 1.5, 5000),
        vibe:   vibe.value ?? 'any',
        scene:  scene.value?.query ?? null,
        city:   city.value ?? null,
        round:  2,
      })

      const fresh = raw.filter(v =>
        !shownVenueIds.value.has(v.google_place_id ?? v.name)
      )

      if (!fresh.length) {
        console.log('[round 2] no fresh venues')
        isEnriching.value = false
        return
      }

      const enriched = await enrichVenuesApi({
        venues: fresh.slice(0, 8),
        vibe:   vibe.value,
        scene:  scene.value?.label ?? null,
        intent: currentIntent.value,
      })

      const openEnriched = enriched.filter(v => v.open_today !== false)
      openEnriched.forEach(v => shownVenueIds.value.add(v.google_place_id ?? v.name))
      venues.value      = [...venues.value, ...openEnriched]
      sessionPool.value = [...sessionPool.value, ...openEnriched]
      console.log(`[round 2] added ${openEnriched.length} venues`)
    } catch (e) {
      console.log('[round 2] failed:', e.message)
    } finally {
      isEnriching.value = false
    }
  }

  function showBestOf() {
    if (bestOfShown.value) return
    bestOfShown.value = true
    phase.value = 'best-of'
    console.log('[best-of] selecting top picks from session pool')

    const selectedVibe  = vibe.value?.toLowerCase() ?? ''
    const selectedScene = scene.value?.label?.toLowerCase() ?? ''

    const scored = sessionPool.value.map(venue => {
      const tags = venue.tags?.map(t =>
        typeof t === 'string' ? t : (t.label ?? '')
      ).map(t => t.toLowerCase()) ?? []

      const vibeMatch  = tags.some(t => t.includes(selectedVibe)) ? 2 : 0
      const sceneWords = selectedScene.split(' ')
      const sceneMatch = tags.some(t =>
        sceneWords.some(w => w.length > 2 && t.includes(w))
      ) ? 1 : 0
      const rating = (venue.rating ?? 3) / 5

      return { venue, score: vibeMatch + sceneMatch + rating }
    })

    const bestOf = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(s => ({ ...s.venue, isBestOf: true }))

    console.log('[best-of] picks:', bestOf.map(v => v.name))

    venues.value = [...venues.value, ...bestOf]
  }

  function resetSession() {
    bestOfShown.value   = false
    shownVenueIds.value = new Set()

    const shuffled = [...sessionPool.value]
      .sort(() => Math.random() - 0.5)
      .map(v => ({ ...v, isBestOf: false }))

    venues.value       = shuffled
    currentIndex.value = 0
    phase.value        = 'discovery'
    console.log(`[reset] replaying ${shuffled.length} venues in new order`)
  }

  // ── favourites ────────────────────────────────────────────────────────────

  function starVenue(venue) {
    if (!favourites.value.find(v =>
      v.name === venue.name || v.google_place_id === venue.google_place_id
    )) {
      favourites.value.push({ ...venue, starred_at: new Date().toISOString() })
      console.log('[star] added:', venue.name)
    }
    // Strengthen taste profile — 2x weight vs swipe right
    venue.tags?.forEach(tag => {
      const label = tag.label ?? tag
      tasteProfile.value[label] = (tasteProfile.value[label] ?? 0) + 2
    })
    localStorage.setItem('whim_taste', JSON.stringify(tasteProfile.value))
  }

  function unstarVenue(venueName) {
    favourites.value = favourites.value.filter(
      v => v.name !== venueName && v.google_place_id !== venueName
    )
    console.log('[star] removed:', venueName)
  }

  function isStarred(venue) {
    return favourites.value.some(
      v => v.name === venue?.name || v.google_place_id === venue?.google_place_id
    )
  }

  function boostStarredVenues() {
    if (!favourites.value.length) return
    const currentIdx = currentIndex.value
    const seen       = venues.value.slice(0, currentIdx + 1)
    const remaining  = venues.value.slice(currentIdx + 1)

    const withBoost  = remaining.map(v => ({ ...v, isStarredVenue: isStarred(v) }))
    const starred    = withBoost.filter(v => v.isStarredVenue)
    const nonStarred = withBoost.filter(v => !v.isStarredVenue)

    // Mix one starred in every 5 cards naturally
    const mixed = []
    let si = 0
    nonStarred.forEach((v, i) => {
      mixed.push(v)
      if ((i + 1) % 5 === 0 && si < starred.length) mixed.push(starred[si++])
    })
    while (si < starred.length) mixed.push(starred[si++])

    venues.value = [...seen, ...mixed]
    console.log('[boost] mixed in', starred.length, 'starred venues')
  }

  function resurfaceSkipped() {
    if (skippedVenues.value.length < 4) return false
    const shuffled = [...skippedVenues.value]
      .sort(() => Math.random() - 0.5)
      .slice(0, 2)
    skippedVenues.value = skippedVenues.value.filter(v => !shuffled.includes(v))
    venues.value = [...venues.value, ...shuffled]
    return true
  }

  return {
    venues, currentIndex, loading, error, userLocation, currentIntent, city, transport,
    vibe, radius, scene,
    isEnriching, firstBatchReady, shownVenueIds, skippedVenues, searchRound,
    phase, sessionPool, bestOfShown,
    planVenues, tasteProfile, builtPlan,
    currentVenue, hasMore,
    setLocation, setCity, setIntent, setTransport,
    setVibe, setScene,
    startEnrichment, loadVenues,
    nextVenue, swipeRight, swipeLeft, maybeLoadMore,
    fetchRound2, showBestOf, resetSession, resurfaceSkipped,
    currentPlan, planBuilding, planError, showPlan,
    schedulePlanRebuild, rebuildPlan, rebuildPlanWithOrder,
    addToPlan, removeFromPlan, isInPlan, clearPlan,
    favourites, starVenue, unstarVenue, isStarred, boostStarredVenues,
  }
})
