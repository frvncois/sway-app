<template>
  <div
    :class="[
      'rounded-card border p-5',
      accent
        ? 'bg-amber/5 border-amber/15'
        : 'bg-bg-elevated border-border-subtle',
    ]"
  >
    <slot />
  </div>
</template>

<script setup>
defineProps({
  accent: { type: Boolean, default: false },
})
</script>
