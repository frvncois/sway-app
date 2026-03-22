<template>
  <div ref="rootEl" class="relative flex flex-col h-full overflow-y-auto fade-page" style="opacity: 0">
    <TopBar :showBack="true" />
    <!-- Header -->
    <div class="px-5 pt-12 pb-6">
      <p class="text-[13px] font-medium tracking-widest uppercase text-text-muted mb-1">Step 3</p>
      <h1 class="text-[32px] font-display font-light text-text-primary leading-tight">
        How far will<br>
        <span class="italic text-amber">you go</span>?
      </h1>
    </div>

    <!-- Chips grid -->
    <div class="px-4 grid grid-cols-2 gap-3">
      <div
        v-for="chip in chips"
        :key="chip.effort"
        :class="[store.effort === chip.effort ? ringClass[chip.color] : '', 'rounded-card', chip.wide ? 'col-span-1' : '']"
      >
        <IntentCard
          :label="chip.label"
          :icon="chip.icon"
          :color="chip.color"
          @click="onChipClick(chip)"
        />
      </div>
    </div>

    <div class="h-4" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Footprints, Bus, Car, Navigation } from 'lucide-vue-next'
import IntentCard from '@/components/app/IntentCard.vue'
import TopBar     from '@/components/app/TopBar.vue'
import { useVenuesStore } from '@/stores/venues.js'

const router = useRouter()
const store  = useVenuesStore()

const rootEl = ref(null)

const chips = [
  { label: 'Walk',        effort: 'walk',     color: 'green',  wide: false, radius: 1000, icon: Footprints  },
  { label: 'Transit',     effort: 'transit',  color: 'blue',   wide: false, radius: 2000, icon: Bus         },
  { label: 'Taxi / Uber', effort: 'taxi',     color: 'amber',  wide: false, radius: 5000, icon: Car         },
  { label: 'Anywhere',    effort: 'anywhere', color: 'purple', wide: true,  radius: 3000, icon: Navigation  },
]

const ringClass = {
  amber:  'ring-1 ring-amber/40',
  blue:   'ring-1 ring-blue/40',
  purple: 'ring-1 ring-purple/40',
  green:  'ring-1 ring-green/40',
}

function onChipClick(chip) {
  store.setEffort(chip.effort)
  store.setRadius(chip.radius)
  store.startEnrichment()
  router.push('/swipe')
}

onMounted(() => {
  requestAnimationFrame(() => {
    rootEl.value.style.opacity = '1'
  })
})
</script>

<style scoped>
.fade-page { transition: opacity 0.25s ease; }
</style>
