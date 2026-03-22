<template>
  <div class="inline-flex items-center gap-1.5">
    <span :class="['w-2 h-2 rounded-full flex-shrink-0', dotColor]" />
    <span class="text-[13px] font-medium text-text-secondary">
      {{ minutes }}min {{ mode === 'transit' ? 'by transit' : 'walk' }}
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  minutes: { type: Number, required: true },
  mode: { type: String, default: 'walk' },
})

const dotColor = computed(() => {
  if (props.minutes < 10) return 'bg-green'
  if (props.minutes <= 20) return 'bg-amber'
  return 'bg-red-400'
})
</script>
