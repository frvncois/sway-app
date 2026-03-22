<template>
  <Transition name="tray">
    <div
      v-if="plan.hasVenues"
      class="absolute inset-x-0 bottom-0 px-4 pb-6 pointer-events-none"
      style="z-index: 30"
    >
      <button
        class="w-full h-14 rounded-btn bg-bg-elevated border border-border-subtle flex items-center justify-between px-5 pointer-events-auto shadow-lg"
        @click="plan.openSheet()"
      >
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1">
            <span
              v-for="v in plan.selectedVenues.slice(0, 4)"
              :key="v.google_place_id"
              class="w-2 h-2 rounded-full bg-amber"
            />
          </div>
          <span class="text-[14px] text-text-primary font-medium">
            {{ plan.count }} {{ plan.count === 1 ? 'place' : 'places' }} added
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[13px] text-amber font-medium">Build plan</span>
          <ArrowRight :size="15" class="text-amber" />
        </div>
      </button>
    </div>
  </Transition>
</template>

<script setup>
import { ArrowRight } from 'lucide-vue-next'
import { usePlanStore } from '@/stores/plan.js'

const plan = usePlanStore()
</script>

<style scoped>
.tray-enter-active,
.tray-leave-active {
  transition: all 0.25s ease;
}
.tray-enter-from,
.tray-leave-to {
  opacity: 0;
  transform: translateY(16px);
}
</style>
