<template>
  <div class="relative flex flex-col h-full overflow-y-auto">
    <TopBar :showBack="true" />
    <!-- Header -->
    <div class="px-5 pt-12 pb-6">
      <p class="text-[13px] font-medium tracking-widest uppercase text-text-muted mb-1">You</p>
      <h1 class="text-[28px] font-display font-light text-text-primary">Your taste</h1>
    </div>

    <!-- Section cards -->
    <div class="px-4 flex flex-col gap-3">

      <!-- 1. Location -->
      <SectionCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-[11px] font-medium tracking-widest uppercase text-text-muted mb-1">Location</p>
            <div class="flex items-center gap-2">
              <MapPin :size="16" class="text-amber" />
              <span v-if="store.city" class="text-[18px] font-display font-light text-text-primary">
                {{ store.city }}
              </span>
              <span v-else-if="store.userLocation" class="h-5 w-20 rounded-full bg-bg-elevated animate-pulse inline-block" />
              <span v-else class="text-[18px] font-display font-light text-text-primary">Nearby</span>
            </div>
          </div>
          <button
            class="px-3 py-1.5 rounded-pill bg-bg-base border border-border-subtle text-text-secondary text-[13px] hover:border-amber/30 transition-colors"
            @click="requestNewLocation"
          >
            Change
          </button>
        </div>
      </SectionCard>

      <!-- 2. I like... -->
      <SectionCard>
        <p class="text-[11px] font-medium tracking-widest uppercase text-text-muted mb-3">I like...</p>
        <div class="flex flex-wrap gap-2">
          <VenueTag v-for="tag in likes" :key="tag.label" :label="tag.label" :variant="tag.variant" />
          <button class="inline-flex items-center px-3 py-1 rounded-pill text-[13px] font-medium border border-dashed border-border-subtle text-text-muted hover:border-amber/30 hover:text-text-secondary transition-colors">
            + Add
          </button>
        </div>
      </SectionCard>

      <!-- 3. Vibe so far (accent) — driven by tasteProfile -->
      <SectionCard :accent="true">
        <p class="text-[11px] font-medium tracking-widest uppercase text-amber/60 mb-3">Vibe so far</p>
        <div v-if="vibeTags.length" class="flex flex-wrap gap-2">
          <VenueTag v-for="tag in vibeTags" :key="tag.label" :label="tag.label" :variant="tag.variant" />
        </div>
        <p v-else class="text-[13px] font-display italic text-text-muted">
          Star places you love to build this
        </p>
        <p v-if="vibeTags.length" class="text-[12px] font-display italic text-text-muted mt-3">
          Based on {{ planStore.planVenues.length }} saved place{{ planStore.planVenues.length === 1 ? '' : 's' }}
        </p>
      </SectionCard>

      <!-- 4. Getting around -->
      <SectionCard>
        <p class="text-[11px] font-medium tracking-widest uppercase text-text-muted mb-2">Getting around</p>
        <div class="divide-y divide-border-subtle">
          <TransportToggle
            v-for="t in transportRows"
            :key="t.key"
            :label="t.label"
            :model-value="store.transport[t.key]"
            :color="t.color"
            @update:model-value="val => store.setTransport(t.key, val)"
          />
        </div>
      </SectionCard>

    </div>

    <div class="h-4" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { MapPin } from 'lucide-vue-next'
import TopBar         from '@/components/app/TopBar.vue'
import SectionCard     from '@/components/app/SectionCard.vue'
import VenueTag        from '@/components/app/VenueTag.vue'
import TransportToggle from '@/components/app/TransportToggle.vue'
import { useVenuesStore }    from '@/stores/venues.js'
import { usePlanStore }       from '@/stores/plan.js'
import { useFavouritesStore } from '@/stores/favourites.js'
import { useGeolocation }     from '@/composables/useGeolocation.js'
import { fetchCity }          from '@/services/api.js'

const store     = useVenuesStore()
const planStore = usePlanStore()
const favStore  = useFavouritesStore()
const geo       = useGeolocation()

const VARIANT_MAP = {
  amber:  ['cozy', 'local', 'quiet', 'chill', 'hidden gem', 'romantic'],
  blue:   ['lively', 'trendy', 'loud', 'late night'],
  purple: ['underground', 'raw', 'fancy', 'curated'],
  green:  ['cheap', 'touristy'],
}

function getVariant(label) {
  for (const [variant, tags] of Object.entries(VARIANT_MAP)) {
    if (tags.includes(label)) return variant
  }
  return 'amber'
}

const vibeTags = computed(() =>
  Object.entries(favStore.tasteProfile)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label]) => ({ label, variant: getVariant(label) }))
)

const likes = [
  { label: 'Cocktail bars', variant: 'amber' },
  { label: 'Hidden gems',   variant: 'purple' },
  { label: 'Late nights',   variant: 'blue' },
  { label: 'No tourists',   variant: 'green' },
]

const transportRows = [
  { key: 'walk',    label: 'Walking', color: 'green' },
  { key: 'transit', label: 'Transit', color: 'blue' },
  { key: 'car',     label: 'Car',     color: 'amber' },
  { key: 'uber',    label: 'Uber',    color: 'amber' },
]

async function requestNewLocation() {
  try {
    const { lat, lng } = await geo.requestLocation()
    store.setLocation(lat, lng)
    store.setCity(null)
    const name = await fetchCity({ lat, lng })
    store.setCity(name)
  } catch {
    // denied — do nothing
  }
}
</script>
