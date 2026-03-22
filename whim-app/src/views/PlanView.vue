<template>
  <div class="plan-page">
    <div class="plan-scroll">

    <!-- Handle bar -->
    <div class="drag-handle" />

    <!-- Header -->
    <div class="plan-header">
      <div class="plan-header-left">
        <span class="plan-title">Tonight's plan</span>
        <span class="plan-count">{{ activeStops.length }} stops</span>
      </div>
      <button @click="router.push('/swipe')" class="close-btn">Done</button>
    </div>

    <!-- Summary -->
    <p v-if="plan?.summary && !isBuilding" class="plan-summary">
      {{ plan.summary }}
    </p>

    <!-- Building indicator -->
    <div v-if="isBuilding" class="plan-building">
      <div class="building-dots">
        <span /><span /><span />
      </div>
      <span class="building-text">Updating your plan...</span>
    </div>

    <!-- Empty state -->
    <div v-else-if="!store.planVenues.length" class="plan-empty">
      Swipe right on places to add them here
    </div>

    <!-- Need one more -->
    <div v-else-if="store.planVenues.length === 1 && !isBuilding" class="plan-hint-row">
      Add one more place to build a plan
    </div>

    <!-- Active stops -->
    <template v-else-if="activeStops.length">
      <div class="section-label">Up next</div>

      <VueDraggable
        v-model="draggableStops"
        handle=".drag-icon"
        :animation="200"
        @end="onReorder"
        tag="div"
        class="stops-list"
      >
        <div
          v-for="(stop, i) in draggableStops"
          :key="stop.name"
          class="stop-wrapper"
        >
          <div class="stop-card">
            <!-- Time row -->
            <div class="stop-time-row">
              <span class="stop-time">{{ stop.time }}</span>
              <div class="stop-time-line" />
            </div>

            <!-- Horizontal venue card -->
            <div class="stop-venue-card">
              <div class="stop-photo" :style="getPhotoStyle(stop)" />

              <div class="stop-info">
                <div class="stop-name">{{ stop.name }}</div>
                <div v-if="getVenueAddress(stop)" class="stop-address">
                  {{ getVenueAddress(stop) }}
                </div>
                <div class="stop-tags">
                  <span
                    v-for="tag in getVenueTags(stop)"
                    :key="tag.label ?? tag"
                    class="stop-tag"
                    :class="`stop-tag--${tag.variant ?? 'amber'}`"
                  >{{ tag.label ?? tag }}</span>
                </div>
                <div v-if="stop.description" class="stop-desc">
                  {{ stop.description }}
                </div>
              </div>

              <div class="stop-actions">
                <button
                  class="remove-btn"
                  @click="store.removeFromPlan(stop.name)"
                  title="Remove"
                >✕</button>
                <div class="drag-icon">≡</div>
              </div>
            </div>

            <!-- Transition to next -->
            <div v-if="draggableStops[i + 1]" class="stop-transition">
              <div class="stop-transition-line" />
              <span class="stop-transition-text">
                {{ stop.transition || getTransition(stop, draggableStops[i + 1]) }}
              </span>
            </div>
          </div>
        </div>
      </VueDraggable>
    </template>

    <!-- Past places -->
    <template v-if="pastStops.length">
      <div class="section-label section-label--past">Earlier today</div>
      <div class="past-list">
        <div v-for="stop in pastStops" :key="stop.name" class="past-card">
          <div class="past-photo" :style="getPhotoStyle(stop)" />
          <div class="past-info">
            <div class="past-name">{{ stop.name }}</div>
            <div class="past-time">Visited at {{ stop.time }}</div>
          </div>
        </div>
      </div>
    </template>

    <!-- Error -->
    <div v-if="store.planError" class="plan-error">
      <span>Couldn't build plan</span>
      <button @click="store.rebuildPlan()">Try again</button>
    </div>

    <!-- CTA -->
    <button
      v-if="activeStops.length >= 1 && !isBuilding"
      @click="router.push('/swipe')"
      class="build-btn"
    >
      Let's go →
    </button>

    <!-- Clear -->
    <button v-if="store.planVenues.length" @click="store.clearPlan()" class="clear-btn">
      Clear plan
    </button>

    </div><!-- end plan-scroll -->
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { VueDraggable } from 'vue-draggable-plus'
import { useVenuesStore } from '@/stores/venues.js'

const store  = useVenuesStore()
const router = useRouter()

const plan       = computed(() => store.currentPlan)
const isBuilding = computed(() => store.planBuilding)

// ── Active vs Past ────────────────────────────────────────────

const now = ref(new Date())
const _nowTimer = setInterval(() => { now.value = new Date() }, 60000)
onUnmounted(() => clearInterval(_nowTimer))

function parseStopTime(timeStr) {
  if (!timeStr || timeStr === 'TBD') return null
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!match) return null
  let h = parseInt(match[1])
  const m = parseInt(match[2])
  const p = match[3].toUpperCase()
  if (p === 'PM' && h !== 12) h += 12
  if (p === 'AM' && h === 12) h = 0
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d
}

function isStopPast(stop) {
  const t = parseStopTime(stop.time)
  if (!t) return false
  return now.value > new Date(t.getTime() + 30 * 60000)
}

const fallbackStops = computed(() =>
  store.planVenues.map(v => ({
    name: v.name, time: 'TBD', tags: v.tags,
    neighborhood: v.neighborhood, distance_minutes: v.distance_minutes,
  }))
)

const allStops = computed(() => plan.value?.stops ?? fallbackStops.value)

const activeStops = computed(() => allStops.value.filter(s => !isStopPast(s)))
const pastStops   = computed(() => allStops.value.filter(s => isStopPast(s)))

// ── Draggable ─────────────────────────────────────────────────

const draggableStops = ref([])
watch(activeStops, stops => { draggableStops.value = [...stops] }, { immediate: true })

function onReorder() {
  store.rebuildPlanWithOrder(draggableStops.value.map(s => s.name))
}

// ── Helpers ───────────────────────────────────────────────────

function getPhotoStyle(stop) {
  const venue = store.planVenues.find(v => v.name === stop.name)
  const photos = venue?.photos
  if (photos?.length) {
    return { backgroundImage: `url(${photos[0]})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  const from = venue?.gradient_from ?? '#1A1028'
  const to   = venue?.gradient_to   ?? '#0E1820'
  return { background: `linear-gradient(135deg, ${from}, ${to})` }
}

function getVenueAddress(stop) {
  const v = store.planVenues.find(v => v.name === stop.name)
  return v?.neighborhood ?? null
}

function getVenueTags(stop) {
  const v = store.planVenues.find(v => v.name === stop.name)
  return v?.tags?.slice(0, 2) ?? []
}

function getTransition(stop, nextStop) {
  const v = store.planVenues.find(v => v.name === nextStop?.name)
  if (v?.distance_minutes) return `${v.distance_minutes} min walk`
  return null
}
</script>

<style scoped>
.plan-page {
  position: absolute;
  inset: 0;
  background: #111009;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.plan-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px 60px;
  -webkit-overflow-scrolling: touch;
}
.drag-handle {
  width: 32px; height: 3px;
  background: rgba(255,255,255,0.12);
  border-radius: 100px;
  margin: 0 auto 16px;
}
.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.plan-header-left {
  display: flex; align-items: baseline; gap: 8px;
}
.plan-title {
  font-family: 'Fraunces', serif;
  font-size: 20px; font-weight: 300;
  color: rgba(255,255,255,0.92);
  letter-spacing: -0.01em;
}
.plan-count {
  font-size: 11px;
  color: rgba(255,255,255,0.2);
  font-family: 'DM Sans', sans-serif;
}
.close-btn {
  background: none; border: none;
  color: rgba(255,255,255,0.3);
  font-size: 13px; cursor: pointer;
  font-family: 'DM Sans', sans-serif;
}
.plan-summary {
  font-family: 'Fraunces', serif;
  font-size: 12px; font-style: italic;
  color: rgba(255,255,255,0.3);
  margin: 0 0 16px;
  line-height: 1.55;
}
.plan-building {
  display: flex; align-items: center;
  gap: 10px; padding: 16px 0;
  justify-content: center;
}
.building-dots { display: flex; gap: 5px; }
.building-dots span {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: #E8935A;
  animation: dot-bounce 1.2s ease-in-out infinite;
}
.building-dots span:nth-child(2) { animation-delay: 0.2s; }
.building-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes dot-bounce {
  0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
  40%           { opacity: 1;   transform: scale(1.2); }
}
.building-text {
  font-size: 12px;
  color: rgba(255,255,255,0.3);
  font-family: 'DM Sans', sans-serif;
}
.plan-empty, .plan-hint-row {
  text-align: center;
  padding: 28px 0;
  font-size: 13px;
  color: rgba(255,255,255,0.2);
  font-family: 'DM Sans', sans-serif;
}
.section-label {
  font-size: 9px;
  color: rgba(255,255,255,0.2);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 600;
  font-family: 'DM Sans', sans-serif;
  margin-bottom: 10px;
}
.section-label--past {
  color: rgba(255,255,255,0.1);
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(255,255,255,0.05);
}
.stops-list { display: flex; flex-direction: column; }
.stop-wrapper { position: relative; }
.stop-card { padding-bottom: 4px; }
.stop-time-row {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 6px;
}
.stop-time {
  font-size: 11px; font-weight: 600;
  color: #E8935A;
  width: 52px; flex-shrink: 0;
  font-family: 'DM Sans', sans-serif;
}
.stop-time-line {
  flex: 1; height: 1px;
  background: rgba(255,255,255,0.06);
}
.stop-venue-card {
  display: flex; gap: 10px;
  background: rgba(255,255,255,0.04);
  border-radius: 16px; padding: 10px;
  border: 1px solid rgba(255,255,255,0.06);
  align-items: flex-start;
}
.stop-photo {
  width: 52px; height: 52px;
  border-radius: 10px; flex-shrink: 0;
}
.stop-info {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 3px;
}
.stop-name {
  font-size: 13px; font-weight: 500;
  color: rgba(255,255,255,0.88);
  font-family: 'DM Sans', sans-serif;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.stop-address {
  font-size: 10px;
  color: rgba(255,255,255,0.28);
  font-family: 'DM Sans', sans-serif;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.stop-tags { display: flex; gap: 4px; flex-wrap: wrap; }
.stop-tag {
  display: inline-block;
  padding: 2px 7px; border-radius: 100px;
  font-size: 9px; font-weight: 500;
  font-family: 'DM Sans', sans-serif;
  border: 1px solid transparent;
}
.stop-tag--amber  { background: rgba(232,147,90,0.1);  color: rgba(232,147,90,0.7);  border-color: rgba(232,147,90,0.18); }
.stop-tag--blue   { background: rgba(107,142,255,0.1); color: rgba(107,142,255,0.7); border-color: rgba(107,142,255,0.18); }
.stop-tag--purple { background: rgba(176,107,255,0.1); color: rgba(176,107,255,0.7); border-color: rgba(176,107,255,0.18); }
.stop-tag--green  { background: rgba(123,198,126,0.1); color: rgba(123,198,126,0.7); border-color: rgba(123,198,126,0.18); }
.stop-desc {
  font-size: 10px;
  color: rgba(255,255,255,0.2);
  font-family: 'Fraunces', serif; font-style: italic;
  line-height: 1.4;
}
.stop-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  align-self: center;
}
.remove-btn {
  background: none; border: none;
  color: rgba(255,255,255,0.18);
  font-size: 12px; cursor: pointer;
  padding: 2px 4px;
  line-height: 1;
  transition: color 0.15s;
}
.remove-btn:hover { color: rgba(255,100,100,0.7); }
.drag-icon {
  color: rgba(255,255,255,0.12);
  font-size: 14px; cursor: grab; flex-shrink: 0;
  padding: 2px 4px; user-select: none;
}
.stop-transition {
  display: flex; align-items: center;
  gap: 8px; padding: 5px 0 5px 14px;
}
.stop-transition-line {
  width: 1px; height: 14px;
  background: rgba(255,255,255,0.07); flex-shrink: 0;
}
.stop-transition-text {
  font-size: 10px;
  color: rgba(255,255,255,0.15);
  font-family: 'DM Sans', sans-serif;
}
.past-list { display: flex; flex-direction: column; gap: 8px; }
.past-card {
  display: flex; gap: 10px;
  background: rgba(255,255,255,0.02);
  border-radius: 14px; padding: 10px;
  border: 1px solid rgba(255,255,255,0.04);
  opacity: 0.5;
}
.past-photo {
  width: 40px; height: 40px;
  border-radius: 8px; flex-shrink: 0;
  background: rgba(255,255,255,0.05);
  filter: grayscale(1);
}
.past-info { display: flex; flex-direction: column; gap: 2px; }
.past-name {
  font-size: 12px; font-weight: 500;
  color: rgba(255,255,255,0.4);
  font-family: 'DM Sans', sans-serif;
  text-decoration: line-through;
  text-decoration-color: rgba(255,255,255,0.15);
}
.past-time {
  font-size: 10px;
  color: rgba(255,255,255,0.18);
  font-family: 'DM Sans', sans-serif;
}
.plan-error {
  padding: 12px 0;
  display: flex; flex-direction: column;
  gap: 6px; text-align: center;
}
.plan-error span {
  font-size: 12px;
  color: rgba(255,255,255,0.25);
  font-family: 'DM Sans', sans-serif;
}
.plan-error button {
  background: none; border: none;
  color: rgba(232,147,90,0.6);
  font-size: 12px; cursor: pointer;
  font-family: 'DM Sans', sans-serif;
}
.build-btn {
  display: block; width: 100%;
  padding: 14px; margin-top: 18px;
  border-radius: 16px;
  background: #E8935A; border: none;
  color: #1a0800; font-weight: 600;
  font-size: 14px; cursor: pointer;
  font-family: 'DM Sans', sans-serif;
}
.clear-btn {
  display: block; width: 100%;
  background: none; border: none;
  color: rgba(255,255,255,0.15);
  font-size: 12px; cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  text-align: center; padding: 10px 0 0;
}
</style>
