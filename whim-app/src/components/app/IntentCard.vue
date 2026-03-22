<template>
  <button
    :class="[
      'relative flex flex-col items-center justify-center w-full rounded-card border overflow-hidden transition-transform active:scale-95 aspect-square',
      colorConfig.bg,
      colorConfig.border,
    ]"
    @click="$emit('click')"
  >
    <component v-if="icon" :is="icon" :size="24" :stroke-width="1.5" :class="colorConfig.text" />
    <span :class="['mt-2 text-[13px] font-display font-light leading-tight', colorConfig.text]">{{ label }}</span>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  color: {
    type: String,
    default: 'amber',
    validator: v => ['amber', 'blue', 'green', 'purple'].includes(v),
  },
  icon: { type: [Object, Function], default: null },
})

defineEmits(['click'])

const colorConfig = computed(() => ({
  amber: {
    bg:     'bg-amber/5',
    border: 'border-amber/15',
    text:   'text-amber',
  },
  blue: {
    bg:     'bg-blue/5',
    border: 'border-blue/15',
    text:   'text-blue',
  },
  green: {
    bg:     'bg-green/5',
    border: 'border-green/15',
    text:   'text-green',
  },
  purple: {
    bg:     'bg-purple/5',
    border: 'border-purple/15',
    text:   'text-purple',
  },
}[props.color]))
</script>
