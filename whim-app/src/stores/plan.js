import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { buildNightPlan } from '@/services/api.js'

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback)) }
  catch { return fallback }
}

function formatMins(totalMins) {
  let hh  = Math.floor(totalMins / 60) % 24
  let mm  = totalMins % 60
  const p = hh >= 12 ? 'PM' : 'AM'
  if (hh > 12) hh -= 12
  if (hh === 0) hh = 12
  return `${hh}:${String(mm).padStart(2, '0')} ${p}`
}

export const usePlanStore = defineStore('plan', () => {

  const planVenues   = ref(load('whim_plan', []))
  const currentPlan  = ref(null)
  const planBuilding = ref(false)
  const planError    = ref(null)
  const showPlan     = ref(false)
  let   rebuildTimer = null

  const hasPlan   = computed(() => planVenues.value.length > 0)
  const planCount = computed(() => planVenues.value.length)

  function addToPlan(venue) {
    if (!planVenues.value.find(v =>
      v.id === venue.id || v.name === venue.name
    )) {
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

  function schedulePlanRebuild() {
    if (rebuildTimer) clearTimeout(rebuildTimer)
    if (planVenues.value.length < 2) {
      currentPlan.value  = null
      planBuilding.value = false
      return
    }
    rebuildTimer = setTimeout(() => rebuildPlan(), 1500)
  }

  async function rebuildPlan(intent, vibe) {
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
        intent: intent ?? 'drinks',
        vibe:   vibe   ?? null,
      })

      // Inject any venues GPT dropped
      const plannedNames = plan.stops.map(s => s.name.toLowerCase())
      const missing = planVenues.value.filter(v =>
        !plannedNames.some(n =>
          n.includes(v.name.toLowerCase()) ||
          v.name.toLowerCase().includes(n)
        )
      )
      if (missing.length) {
        missing.forEach(venue => {
          plan.stops.push({
            name:        venue.name,
            time:        'TBD',
            description: venue.vibe_reason ?? 'Worth checking out.',
            transition:  venue.distance_minutes
              ? `${venue.distance_minutes} min walk`
              : null,
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

  function rebuildPlanWithOrder(nameOrder, intent, vibe) {
    if (!currentPlan.value?.stops) return

    const now  = new Date()
    let cursor = now.getHours() * 60 + now.getMinutes()

    const DURATIONS = { daytime: 60, dinner: 75, drinks: 60, club: 120 }

    const reordered = nameOrder
      .map(name => {
        const stop  = currentPlan.value.stops.find(s => s.name === name)
        const venue = planVenues.value.find(v => v.name === name)
        return stop ?? {
          name, time: 'TBD', category: 'drinks', tags: venue?.tags ?? []
        }
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
    const remaining = planVenues.value.filter(
      v => !nameOrder.includes(v.name)
    )
    planVenues.value = [...reorderedVenues, ...remaining]
    localStorage.setItem('whim_plan', JSON.stringify(planVenues.value))

    console.log('[plan] reordered:',
      recalculated.map(s => `${s.time} ${s.name}`)
    )
  }

  // Restore plan on app boot
  if (planVenues.value.length >= 2) {
    setTimeout(() => rebuildPlan(), 500)
  }

  return {
    planVenues, currentPlan, planBuilding, planError, showPlan,
    hasPlan, planCount,
    addToPlan, removeFromPlan, isInPlan, clearPlan,
    schedulePlanRebuild, rebuildPlan, rebuildPlanWithOrder,
  }
})
