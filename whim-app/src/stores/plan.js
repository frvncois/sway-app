import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const usePlanStore = defineStore('plan', () => {

  const selectedVenues = ref([])
  const plan           = ref(null)
  const isBuilding     = ref(false)
  const error          = ref(null)
  const isOpen         = ref(false)

  const hasVenues = computed(() => selectedVenues.value.length > 0)
  const count     = computed(() => selectedVenues.value.length)

  function addVenue(venue) {
    if (selectedVenues.value.find(v => v.google_place_id === venue.google_place_id)) return
    selectedVenues.value.push(venue)
    console.log(`[plan] added: ${venue.name} (${count.value} total)`)
  }

  function removeVenue(placeId) {
    selectedVenues.value = selectedVenues.value.filter(v => v.google_place_id !== placeId)
    plan.value = null
  }

  function clearPlan() {
    selectedVenues.value = []
    plan.value           = null
    error.value          = null
    isOpen.value         = false
  }

  function openSheet()  { isOpen.value = true  }
  function closeSheet() { isOpen.value = false  }

  async function buildPlan() {
    if (!selectedVenues.value.length) return
    isBuilding.value = true
    error.value      = null
    plan.value       = null

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/api/plan/build`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            venues: selectedVenues.value.map(v => ({
              name:             v.name,
              google_place_id:  v.google_place_id,
              distance_minutes: v.distance_minutes,
              distance_meters:  v.distance_meters,
              open_until:       v.open_until,
              open_now:         v.open_now,
              vibe_reason:      v.vibe_reason,
              tags:             v.tags,
              website:          v.website,
            })),
            currentTime: new Date().toLocaleTimeString('en-US', {
              hour:   '2-digit',
              minute: '2-digit',
              hour12: false,
            }),
            transportMode: 'walking_transit',
          }),
        },
      )

      if (!response.ok) throw new Error('Plan build failed')
      const data = await response.json()
      plan.value = data.plan
      console.log('[plan] built:', plan.value)
    } catch (e) {
      error.value = 'Could not build your plan.'
      console.log('[plan] failed:', e.message)
    } finally {
      isBuilding.value = false
    }
  }

  return {
    selectedVenues, plan, isBuilding, error, isOpen,
    hasVenues, count,
    addVenue, removeVenue, clearPlan,
    openSheet, closeSheet, buildPlan,
  }
})
