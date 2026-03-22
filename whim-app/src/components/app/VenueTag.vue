<template>
  <span
    :class="['inline-flex items-center px-3 py-1 rounded-pill text-[13px] font-medium leading-none tag-fade', variantClass]"
    :style="{ animationDelay: `${index * 40}ms` }"
  >
    {{ label }}
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  variant: {
    type: String,
    default: 'amber',
    validator: v => ['amber', 'blue', 'purple', 'green'].includes(v),
  },
  index: { type: Number, default: 0 },
})

const variantClass = computed(() => ({
  amber:  'bg-amber/15 text-amber border border-amber/20',
  blue:   'bg-blue/15 text-blue border border-blue/20',
  purple: 'bg-purple/15 text-purple border border-purple/20',
  green:  'bg-green/15 text-green border border-green/20',
}[props.variant]))
</script>

<style scoped>
.tag-fade {
  animation: tagFadeIn 0.2s ease both;
}
@keyframes tagFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
</style>
