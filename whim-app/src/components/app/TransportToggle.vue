<template>
  <div class="flex items-center justify-between py-2">
    <span class="text-[15px] text-text-primary font-medium">{{ label }}</span>
    <button
      :class="[
        'relative w-12 h-6 rounded-full transition-colors duration-200 border',
        modelValue ? activeColor : 'bg-bg-base border-border-subtle',
      ]"
      @click="$emit('update:modelValue', !modelValue)"
    >
      <span
        :class="[
          'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
          modelValue ? 'translate-x-6' : 'translate-x-0.5',
        ]"
      />
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  modelValue: { type: Boolean, default: false },
  color: { type: String, default: 'amber' },
})

defineEmits(['update:modelValue'])

const activeColor = computed(() => ({
  amber: 'bg-amber/30 border-amber/40',
  blue: 'bg-blue/30 border-blue/40',
  green: 'bg-green/30 border-green/40',
}[props.color] ?? 'bg-amber/30 border-amber/40'))
</script>
