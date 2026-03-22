<template>
  <div
    ref="sheetEl"
    class="absolute inset-x-0 bottom-0 rounded-t-sheet bg-bg-elevated border-t border-border-subtle overflow-hidden"
    style="z-index: 20"
  >
    <!-- Drag handle -->
    <div
      class="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none"
      @pointerdown="onHandlePointerDown"
    >
      <div class="w-10 h-1 rounded-full bg-border-subtle" />
    </div>
    <!-- Content -->
    <div class="overflow-y-auto" style="max-height: calc(100vh - 200px)">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import gsap from 'gsap'

const emit = defineEmits(['dismiss'])

const sheetEl = ref(null)
defineExpose({ sheetEl })

const DISMISS_THRESHOLD = 120

let startY = 0
let currentY = 0
let isDragging = false

function onHandlePointerDown(e) {
  startY   = e.clientY
  currentY = 0
  isDragging = true
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup',   onPointerUp)
}

function onPointerMove(e) {
  if (!isDragging) return
  const dy = e.clientY - startY
  if (dy < 0) return // prevent dragging up
  currentY = dy
  gsap.set(sheetEl.value, { y: dy })
}

function onPointerUp() {
  if (!isDragging) return
  isDragging = false
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup',   onPointerUp)

  if (currentY > DISMISS_THRESHOLD) {
    // Dismiss
    gsap.to(sheetEl.value, {
      y: sheetEl.value.offsetHeight + 40,
      duration: 0.26,
      ease: 'power2.in',
      onComplete: () => emit('dismiss'),
    })
  } else {
    // Snap back up
    gsap.to(sheetEl.value, { y: 0, duration: 0.3, ease: 'back.out(1.5)' })
  }
}

onUnmounted(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup',   onPointerUp)
})
</script>
