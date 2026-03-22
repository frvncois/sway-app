<template>
  <div class="relative flex flex-col h-full overflow-y-auto" style="background: #0C0B0A">
    <TopBar :showBack="true" :plan-count="store.planVenues.length" />

    <!-- No plan guard -->
    <div
      v-if="!store.builtPlan"
      class="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center"
    >
      <p class="text-[20px] font-display font-light text-text-primary">No plan yet</p>
      <button
        class="mt-4 px-6 py-3 rounded-btn border border-border-subtle text-text-secondary text-[14px] hover:border-amber/30 transition-colors"
        @click="router.push('/plan')"
      >
        Build a plan
      </button>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="px-5 pt-12 pb-6">
        <p class="text-[13px] font-medium tracking-widest uppercase text-text-muted mb-1">Tonight</p>
        <h1 class="text-[28px] font-display font-light text-text-primary leading-tight">
          {{ store.builtPlan.summary }}
        </h1>
      </div>

      <!-- Timeline -->
      <div class="px-5 pb-8 flex flex-col">
        <div
          v-for="(stop, i) in store.builtPlan.stops"
          :key="i"
          class="flex gap-4"
        >
          <!-- Spine -->
          <div class="flex flex-col items-center" style="width: 52px; flex-shrink: 0">
            <div class="stop-dot" />
            <div v-if="i < store.builtPlan.stops.length - 1" class="stop-line" />
          </div>

          <!-- Card -->
          <div class="flex-1 pb-5">
            <div class="flex items-baseline justify-between mb-1">
              <span class="text-[15px] font-medium text-text-primary">{{ stop.name }}</span>
              <span class="text-[12px] text-amber tabular-nums ml-3 flex-shrink-0">{{ stop.time }}</span>
            </div>
            <p class="text-[13px] font-display italic text-text-secondary leading-relaxed">{{ stop.description }}</p>
            <p v-if="stop.transition" class="text-[11px] text-text-muted mt-2">{{ stop.transition }}</p>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex flex-col gap-3 mt-4">
          <button
            class="w-full h-14 rounded-btn bg-amber text-bg-base font-semibold text-[16px] flex items-center justify-center gap-2 shadow-lg shadow-amber/20 hover:bg-amber/90 transition-colors"
            @click="router.push('/swipe')"
          >
            Let's go
          </button>
          <button
            class="w-full text-[13px] text-text-muted hover:text-text-secondary transition-colors text-center py-2"
            @click="router.push('/plan')"
          >
            Rebuild plan
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useVenuesStore } from '@/stores/venues.js'
import TopBar from '@/components/app/TopBar.vue'

const store  = useVenuesStore()
const router = useRouter()
</script>

<style scoped>
.stop-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #E8935A;
  margin-top: 14px;
  flex-shrink: 0;
}
.stop-line {
  width: 1px;
  flex: 1;
  background: rgba(255,255,255,0.08);
  margin-top: 4px;
  margin-bottom: 4px;
  min-height: 16px;
}
</style>
