<template>
  <div class="relative w-full h-full select-none">
    <!-- Ghost card 2 (furthest back) -->
    <div
      ref="ghost2El"
      class="absolute inset-x-4 top-4 bottom-0 rounded-card bg-bg-elevated border border-border-subtle"
      style="z-index: 1;"
    />
    <!-- Ghost card 1 -->
    <div
      ref="ghost1El"
      class="absolute inset-x-2 top-2 bottom-0 rounded-card bg-bg-card border border-border-subtle"
      style="z-index: 2;"
    />

    <!-- Main card -->
    <div
      ref="cardEl"
      class="absolute inset-0 rounded-card overflow-hidden border border-border-subtle bg-bg-card"
      :class="isDragging ? 'cursor-grabbing' : 'cursor-pointer'"
      style="z-index: 3; will-change: transform;"
      @pointerdown="onPointerDown"
    >
      <!-- Starred indicator dot -->
      <div
        v-if="isStarredVenue"
        class="starred-indicator"
        title="You've starred this place before"
      />

      <!-- Right tint (green) -->
      <div
        ref="rightTintEl"
        class="absolute inset-0 rounded-card pointer-events-none"
        style="background: rgba(123,198,126,0.18); opacity: 0; z-index: 10;"
      />
      <!-- Left tint (red) -->
      <div
        ref="leftTintEl"
        class="absolute inset-0 rounded-card pointer-events-none"
        style="background: rgba(248,113,113,0.18); opacity: 0; z-index: 10;"
      />

      <!-- Right label -->
      <div
        ref="rightLabelEl"
        class="absolute top-5 right-5 pointer-events-none"
        style="opacity: 0; z-index: 20;"
      >
        <span class="text-amber font-semibold text-[15px] tracking-wide">Let's go →</span>
      </div>
      <!-- Left label -->
      <div
        ref="leftLabelEl"
        class="absolute top-5 left-5 pointer-events-none"
        style="opacity: 0; z-index: 20;"
      >
        <span class="text-text-secondary font-semibold text-[15px] tracking-wide">← Not now</span>
      </div>

      <!-- Photo area — real image when available, gradient fallback -->
      <div
        class="absolute aspect-square w-full bg-cover bg-center"
        :style="photoAreaStyle"
      >
        <span class="absolute top-4 left-4 px-3 py-1 rounded-pill bg-black/40 text-text-primary text-[12px] font-medium backdrop-blur-sm border border-white/10">
          {{ neighborhood }}
        </span>
        <span class="absolute top-4 right-4 px-3 py-1 rounded-pill bg-black/40 text-green text-[12px] font-medium backdrop-blur-sm border border-green/20">
          Open until {{ openUntil || 'late' }}
        </span>
        <div class="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-bg-card to-transparent" />
      </div>

      <!-- Card content -->
      <div class="absolute bottom-0 px-5 pb-5 pt-3 flex flex-col w-full gap-3">
        <div>
          <h2 class="text-[26px] font-display font-light text-text-primary leading-tight">{{ name }}</h2>
          <p class="text-[14px] font-display italic text-text-secondary mt-1 leading-snug">{{ description }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <VenueTag
            v-for="(tag, i) in tags"
            :key="tag.label"
            :label="tag.label"
            :variant="tag.variant"
            :index="i"
          />
        </div>
        <div class="flex items-center justify-between">
          <DistanceDot :minutes="distanceMinutes" mode="walk" />
          <span v-if="priceStr" class="text-[13px] font-medium text-text-secondary">{{ priceStr }}</span>
        </div>
        <div
          v-if="venue.current_busy"
          class="busy-indicator"
          :class="`busy-indicator--${venue.current_busy.level}`"
        >
          <span class="busy-dot" />
          <span class="busy-text">{{ venue.current_busy.description }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import gsap from 'gsap'
import VenueTag    from './VenueTag.vue'
import DistanceDot from './DistanceDot.vue'
import { usePriceLevel } from '@/composables/usePriceLevel.js'

const props = defineProps({
  venue:          { type: Object,  required: true },
  isStarredVenue: { type: Boolean, default: false },
})

const emit = defineEmits(['tap', 'swipe-right', 'swipe-left'])

const { priceLabel } = usePriceLevel()
const priceStr = computed(() => priceLabel(props.venue?.price_level))

const name            = computed(() => props.venue?.name ?? '')
const tags            = computed(() => props.venue?.tags ?? [])
const description     = computed(() => props.venue?.description ?? '')
const neighborhood    = computed(() => props.venue?.neighborhood ?? '')
const distanceMinutes = computed(() => props.venue?.distance_minutes ?? 0)
const openUntil       = computed(() => props.venue?.open_until ?? '')
const gradientFrom    = computed(() => props.venue?.gradient_from ?? '#1A1028')
const gradientTo      = computed(() => props.venue?.gradient_to ?? '#0E1820')

const photoAreaStyle = computed(() => {
  const photo = props.venue?.photos?.[0]
  if (photo) {
    return `background-image: url('${photo}'); background-size: cover; background-position: center;`
  }
  return `background: linear-gradient(160deg, ${gradientFrom.value} 0%, ${gradientTo.value} 100%)`
})

const cardEl       = ref(null)
const ghost1El     = ref(null)
const ghost2El     = ref(null)
const rightTintEl  = ref(null)
const leftTintEl   = ref(null)
const rightLabelEl = ref(null)
const leftLabelEl  = ref(null)
const isDragging   = ref(false)

const THRESHOLD    = 80
const MAX_ROTATION = 8

let startX = 0
let currentX = 0
let didDrag = false

// ── ghost helpers ────────────────────────────────────────────────────────────

function initGhosts() {
  gsap.set(ghost1El.value, { scale: 0.97, y: -6 })
  gsap.set(ghost2El.value, { scale: 0.94, y: -12 })
}

function setGhostProgress(progress) {
  const p = Math.min(progress, 1)
  gsap.set(ghost1El.value, { scale: 0.97 + 0.03 * p, y: -6 + 6 * p })
  gsap.set(ghost2El.value, { scale: 0.94 + 0.06 * p, y: -12 + 12 * p })
}

function animateGhostsToFront() {
  gsap.to(ghost1El.value, { scale: 1, y: 0,  duration: 0.2, ease: 'power2.out' })
  gsap.to(ghost2El.value, { scale: 1, y: 0,  duration: 0.2, ease: 'power2.out' })
}

function animateGhostsBack() {
  gsap.to(ghost1El.value, { scale: 0.97, y: -6,  duration: 0.3, ease: 'power2.out' })
  gsap.to(ghost2El.value, { scale: 0.94, y: -12, duration: 0.3, ease: 'power2.out' })
}

// ── overlay helpers ──────────────────────────────────────────────────────────

function clearOverlays(animated = false) {
  const els = [rightTintEl.value, leftTintEl.value, rightLabelEl.value, leftLabelEl.value]
  if (animated) gsap.to(els, { opacity: 0, duration: 0.2 })
  else gsap.set(els, { opacity: 0 })
}

// ── pointer events ───────────────────────────────────────────────────────────

function onPointerDown(e) {
  if (e.button && e.button !== 0) return
  startX   = e.clientX
  currentX = 0
  didDrag  = false
  isDragging.value = true

  cardEl.value.setPointerCapture(e.pointerId)
  cardEl.value.addEventListener('pointermove',   onPointerMove)
  cardEl.value.addEventListener('pointerup',     onPointerUp)
  cardEl.value.addEventListener('pointercancel', onPointerUp)
}

function onPointerMove(e) {
  const dx = e.clientX - startX
  if (!didDrag && Math.abs(dx) < 4) return
  didDrag  = true
  currentX = dx

  const rotation = Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, (dx / 300) * MAX_ROTATION))
  gsap.set(cardEl.value, { x: dx, rotation, transformOrigin: 'bottom center' })

  const progress = Math.abs(dx) / THRESHOLD
  if (dx > 0) {
    gsap.set(rightTintEl.value,  { opacity: Math.min(progress * 0.9, 0.9) })
    gsap.set(leftTintEl.value,   { opacity: 0 })
    gsap.set(rightLabelEl.value, { opacity: Math.min(progress, 1) })
    gsap.set(leftLabelEl.value,  { opacity: 0 })
  } else if (dx < 0) {
    gsap.set(leftTintEl.value,   { opacity: Math.min(progress * 0.9, 0.9) })
    gsap.set(rightTintEl.value,  { opacity: 0 })
    gsap.set(leftLabelEl.value,  { opacity: Math.min(progress, 1) })
    gsap.set(rightLabelEl.value, { opacity: 0 })
  } else {
    clearOverlays()
  }

  setGhostProgress(progress)
}

function onPointerUp() {
  isDragging.value = false
  cardEl.value.removeEventListener('pointermove',   onPointerMove)
  cardEl.value.removeEventListener('pointerup',     onPointerUp)
  cardEl.value.removeEventListener('pointercancel', onPointerUp)

  if (!didDrag) {
    emit('tap')
    return
  }

  const dx = currentX

  if (dx > THRESHOLD) {
    clearOverlays()
    gsap.to(cardEl.value, {
      x: window.innerWidth + 150,
      rotation: MAX_ROTATION,
      opacity: 0,
      duration: 0.25,
      ease: 'power2.in',
      onComplete: () => emit('swipe-right'),
    })
    animateGhostsToFront()
  } else if (dx < -THRESHOLD) {
    clearOverlays()
    gsap.to(cardEl.value, {
      x: -(window.innerWidth + 150),
      rotation: -MAX_ROTATION,
      opacity: 0,
      duration: 0.25,
      ease: 'power2.in',
      onComplete: () => emit('swipe-left'),
    })
    animateGhostsToFront()
  } else {
    gsap.to(cardEl.value, {
      x: 0,
      rotation: 0,
      duration: 0.3,
      ease: 'back.out(1.7)',
      transformOrigin: 'bottom center',
    })
    clearOverlays(true)
    animateGhostsBack()
  }
}

// ── lifecycle ────────────────────────────────────────────────────────────────

onMounted(initGhosts)

onUnmounted(() => {
  if (cardEl.value) {
    cardEl.value.removeEventListener('pointermove',   onPointerMove)
    cardEl.value.removeEventListener('pointerup',     onPointerUp)
    cardEl.value.removeEventListener('pointercancel', onPointerUp)
  }
})
</script>

<style scoped>
.busy-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
}
.busy-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}
.busy-indicator--busy .busy-dot    { background: #7BC67E; }
.busy-indicator--quiet .busy-dot   { background: rgba(255,255,255,0.2); }
.busy-text {
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0.02em;
  font-family: 'DM Sans', sans-serif;
}
.busy-indicator--busy .busy-text   { color: rgba(123,198,126,0.75); }
.busy-indicator--quiet .busy-text  { color: rgba(255,255,255,0.2); }
.starred-indicator {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #E8935A;
  opacity: 0.8;
  z-index: 5;
}
</style>
