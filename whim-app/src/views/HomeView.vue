<template>
  <div class="home-view">

    <!-- Top icons -->
    <div class="home-topbar">
      <div />
      <div class="flex items-center gap-4">
        <div class="relative">
          <button class="topbar-icon" @click="router.push('/favourites')">
            <Star :size="20" :stroke-width="1.5" />
          </button>
          <span v-if="store.favourites.length > 0" class="topbar-dot">
            {{ store.favourites.length >= 2 ? store.favourites.length : '' }}
          </span>
        </div>
        <button
          class="topbar-avatar"
          @click="router.push('/profile')"
        >M</button>
      </div>
    </div>

    <!-- Greeting -->
    <div class="home-greeting">
      <div class="home-time">{{ greeting }}</div>
      <div class="home-question">What do you<br>feel like?</div>
    </div>

    <!-- BENTO — no plan -->
    <div v-if="!hasPlan" class="intent-bento">
      <div
        v-for="intent in INTENTS"
        :key="intent.value"
        class="bento-card"
        :class="[`bento-card--${intent.color}`, intent.wide ? 'bento-card--wide' : '']"
        @click="openModal(intent.value)"
      >
        <div class="bento-dot" :class="`bento-dot--${intent.color}`" />
        <div class="bento-label">{{ intent.label }}</div>
        <div v-if="intent.wide" class="bento-arrow">→</div>
      </div>
    </div>

    <!-- PILLS — has plan -->
    <div v-else class="intent-pills">
      <button
        v-for="intent in INTENTS"
        :key="intent.value"
        class="intent-pill"
        :class="`intent-pill--${intent.color}`"
        @click="openModal(intent.value)"
      >
        {{ intent.label }}
      </button>
    </div>

    <!-- Plan section -->
    <div v-if="hasPlan" class="plan-section">

      <div class="plan-section-header">
        <span class="plan-section-label">Tonight's plan</span>
        <button class="plan-edit-btn" @click="router.push('/plan')">Edit</button>
      </div>

      <div class="plan-stops">
        <div
          v-for="(stop, i) in planStops"
          :key="stop.name"
          class="plan-stop-row"
        >
          <div class="plan-stop-time-col">
            <span class="plan-stop-time">{{ stop.time }}</span>
            <div v-if="i < planStops.length - 1" class="plan-stop-line" />
          </div>
          <div class="plan-stop-card">
            <div class="plan-stop-photo" :style="getPhotoStyle(stop)" />
            <div class="plan-stop-info">
              <div class="plan-stop-name">{{ stop.name }}</div>
              <div class="plan-stop-meta">{{ getStopMeta(stop) }}</div>
            </div>
          </div>
        </div>
      </div>

      <button class="lets-go-btn" @click="router.push('/swipe')">Let's go →</button>

    </div>

    <!-- Empty plan hint -->
    <div v-else class="plan-empty-hint">
      Swipe right on places to build your night
    </div>

    <!-- Intent + Scene Modal -->
    <Transition name="modal-overlay">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <Transition name="modal-sheet" appear>
          <div class="modal-sheet">

            <div class="modal-handle" />

            <Transition name="step-fade" mode="out-in">

              <!-- Step 1: Intent -->
              <div v-if="modalStep === 'intent'" key="intent">
                <div class="modal-title">What do you feel like?</div>
                <div class="modal-intent-grid">
                  <div
                    v-for="intent in INTENTS"
                    :key="intent.value"
                    class="modal-intent-card"
                    :class="`modal-intent-card--${intent.color}`"
                    @click="selectIntent(intent.value)"
                  >
                    <div class="modal-intent-dot" :class="`modal-intent-dot--${intent.color}`" />
                    <div class="modal-intent-label">{{ intent.label }}</div>
                  </div>
                </div>
              </div>

              <!-- Step 2: Scene -->
              <div v-else-if="modalStep === 'scene'" key="scene">
                <div class="modal-scene-header">
                  <button class="modal-back" @click="modalStep = 'intent'">←</button>
                  <div class="modal-title">What kind of {{ selectedIntentLabel }}?</div>
                </div>
                <div class="modal-scene-pills">
                  <button
                    v-for="scene in currentScenes"
                    :key="scene.label"
                    class="modal-scene-pill"
                    :class="`modal-scene-pill--${scene.color}`"
                    @click="selectScene(scene)"
                  >
                    {{ scene.label }}
                  </button>
                  <button
                    class="modal-scene-pill modal-scene-pill--muted"
                    @click="selectScene({ label: 'Any', query: selectedIntent, color: 'amber' })"
                  >
                    Any
                  </button>
                </div>
              </div>

            </Transition>

            <button class="modal-cancel" @click="closeModal">Cancel</button>

          </div>
        </Transition>
      </div>
    </Transition>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Star } from 'lucide-vue-next'
import { useVenuesStore } from '@/stores/venues'
import { SCENES } from '@/data/scenes.js'

const router = useRouter()
const store  = useVenuesStore()

// ── Greeting ──────────────────────────────────────────────────────────────────

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return 'Good morning'
  if (h >= 12 && h < 18) return 'Good afternoon'
  if (h >= 18 && h < 22) return 'Good evening'
  return 'Good night'
})

// ── Intents ───────────────────────────────────────────────────────────────────

const INTENTS = [
  { label: 'Dinner',    value: 'dinner',    color: 'amber',  wide: false },
  { label: 'Drinks',    value: 'drinks',    color: 'blue',   wide: false },
  { label: 'Shop',      value: 'shop',      color: 'green',  wide: true  },
  { label: 'Visit',     value: 'visit',     color: 'blue',   wide: false },
  { label: 'Party',     value: 'party',     color: 'purple', wide: false },
  { label: 'Late Eats', value: 'late_eats', color: 'purple', wide: false },
]

// ── Plan preview ──────────────────────────────────────────────────────────────

const hasPlan = computed(() => store.planVenues.length > 0)

const planStops = computed(() => {
  if (store.currentPlan?.stops?.length) {
    return store.currentPlan.stops.filter(s => !s.skipped)
  }
  return store.planVenues.map(v => ({
    name:             v.name,
    time:             'TBD',
    photos:           v.photos,
    gradient_from:    v.gradient_from,
    gradient_to:      v.gradient_to,
    distance_minutes: v.distance_minutes,
    open_until:       v.open_until,
  }))
})

function getPhotoStyle(stop) {
  const venue = store.planVenues.find(v => v.name === stop.name)
  const url   = venue?.photos?.[0] ?? stop.photos?.[0]
  if (url) {
    return { backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  const from = venue?.gradient_from ?? stop.gradient_from ?? '#1A1028'
  const to   = venue?.gradient_to   ?? stop.gradient_to   ?? '#0E1820'
  return { background: `linear-gradient(135deg, ${from}, ${to})` }
}

function getStopMeta(stop) {
  const venue = store.planVenues.find(v => v.name === stop.name)
  const parts = []
  if (venue?.distance_minutes) parts.push(`${venue.distance_minutes} min walk`)
  if (venue?.open_until)       parts.push(`until ${venue.open_until}`)
  return parts.join(' · ')
}

// ── Modal ─────────────────────────────────────────────────────────────────────

const showModal      = ref(false)
const modalStep      = ref('intent')
const selectedIntent = ref(null)

const selectedIntentLabel = computed(() =>
  INTENTS.find(i => i.value === selectedIntent.value)?.label?.toLowerCase() ?? ''
)

const currentScenes = computed(() =>
  selectedIntent.value ? (SCENES[selectedIntent.value] ?? []) : []
)

function openModal(intent = null) {
  showModal.value = true
  if (intent) {
    selectedIntent.value = intent
    modalStep.value      = 'scene'
  } else {
    modalStep.value = 'intent'
  }
}

function closeModal() {
  showModal.value = false
  setTimeout(() => {
    modalStep.value      = 'intent'
    selectedIntent.value = null
  }, 300)
}

function selectIntent(intent) {
  selectedIntent.value = intent
  modalStep.value      = 'scene'
}

function selectScene(scene) {
  closeModal()
  store.setIntent(selectedIntent.value)
  store.setScene(scene)
  store.setVibe(scene.label)
  router.push('/swipe')
  store.startEnrichment()
}
</script>

<style scoped>
.home-view {
  height: 100%;
  background: #0C0B0A;
  padding: 16px 18px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Top bar */
.home-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}
.topbar-icon {
  color: rgba(255,255,255,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}
.topbar-dot {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  border-radius: 100px;
  background: #E8935A;
  color: #1a0800;
  font-size: 9px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  font-family: 'DM Sans', sans-serif;
  pointer-events: none;
}
.topbar-avatar {
  width: 28px;
  height: 28px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 50%;
  color: rgba(255,255,255,0.5);
  font-size: 11px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
}

/* Greeting */
.home-time {
  font-size: 10px;
  color: rgba(255,255,255,0.25);
  letter-spacing: 0.06em;
  font-weight: 500;
  font-family: 'DM Sans', sans-serif;
  margin-bottom: 4px;
}
.home-question {
  font-family: 'Fraunces', serif;
  font-size: 30px;
  font-weight: 300;
  color: rgba(255,255,255,0.92);
  letter-spacing: -0.025em;
  line-height: 1.1;
}

/* Bento grid */
.intent-bento {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.bento-card {
  padding: 14px;
  border-radius: 18px;
  cursor: pointer;
  transition: opacity 0.15s;
  display: flex;
  flex-direction: column;
  min-height: 90px;
}
.bento-card:active { opacity: 0.75; }
.bento-card--wide  { grid-column: 1 / 3; flex-direction: row; align-items: center; min-height: auto; }
.bento-card--amber  { background: #1A0E0A; border: 1px solid #3A2218; }
.bento-card--blue   { background: #0A0E1A; border: 1px solid #18243A; }
.bento-card--green  { background: #0E1A0E; border: 1px solid #1A2E1A; }
.bento-card--purple { background: #130A1A; border: 1px solid #261438; }
.bento-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  margin-bottom: 18px;
  flex-shrink: 0;
}
.bento-card--wide .bento-dot { margin-bottom: 0; margin-right: 12px; }
.bento-dot--amber  { background: #E8935A; }
.bento-dot--blue   { background: #6B8EFF; }
.bento-dot--green  { background: #7BC67E; }
.bento-dot--purple { background: #B06BFF; }
.bento-label {
  font-size: 13px; font-weight: 600;
  color: rgba(255,255,255,0.88);
  font-family: 'DM Sans', sans-serif;
  flex: 1;
}
.bento-arrow {
  font-size: 16px;
  color: rgba(255,255,255,0.15);
}

/* Pill row */
.intent-pills {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.intent-pill {
  padding: 7px 14px;
  border-radius: 100px;
  font-size: 12px; font-weight: 500;
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  transition: opacity 0.15s;
  border: 1px solid transparent;
  background: transparent;
}
.intent-pill:active { opacity: 0.7; }
.intent-pill--amber  { background: rgba(232,147,90,0.08);  border-color: rgba(232,147,90,0.22);  color: rgba(232,147,90,0.82); }
.intent-pill--blue   { background: rgba(107,142,255,0.08); border-color: rgba(107,142,255,0.2);  color: rgba(107,142,255,0.75); }
.intent-pill--green  { background: rgba(123,198,126,0.08); border-color: rgba(123,198,126,0.2);  color: rgba(123,198,126,0.75); }
.intent-pill--purple { background: rgba(176,107,255,0.08); border-color: rgba(176,107,255,0.2);  color: rgba(176,107,255,0.75); }

/* Plan section */
.plan-section { display: flex; flex-direction: column; gap: 12px; }
.plan-section-header { display: flex; justify-content: space-between; align-items: center; }
.plan-section-label {
  font-size: 9px;
  color: rgba(255,255,255,0.2);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 600;
  font-family: 'DM Sans', sans-serif;
}
.plan-edit-btn {
  background: none; border: none;
  font-size: 11px;
  color: rgba(255,255,255,0.25);
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
}
.plan-stops { display: flex; flex-direction: column; }
.plan-stop-row { display: flex; gap: 10px; padding-bottom: 6px; }
.plan-stop-time-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 48px;
  flex-shrink: 0;
}
.plan-stop-time {
  font-size: 10px; font-weight: 600;
  color: #E8935A;
  font-family: 'DM Sans', sans-serif;
  white-space: nowrap;
}
.plan-stop-line {
  width: 1px; flex: 1;
  background: rgba(255,255,255,0.07);
  margin-top: 5px;
  min-height: 16px;
}
.plan-stop-card {
  flex: 1;
  display: flex;
  gap: 8px;
  background: rgba(255,255,255,0.04);
  border-radius: 14px;
  padding: 9px;
  border: 1px solid rgba(255,255,255,0.06);
  min-width: 0;
}
.plan-stop-photo {
  width: 40px; height: 40px;
  border-radius: 8px; flex-shrink: 0;
  background: linear-gradient(135deg, #1A1028, #0E1820);
}
.plan-stop-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.plan-stop-name {
  font-size: 12px; font-weight: 500;
  color: rgba(255,255,255,0.85);
  font-family: 'DM Sans', sans-serif;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.plan-stop-meta {
  font-size: 10px;
  color: rgba(255,255,255,0.25);
  font-family: 'DM Sans', sans-serif;
}
.lets-go-btn {
  display: block; width: 100%;
  padding: 13px;
  border-radius: 14px;
  background: #E8935A; border: none;
  color: #1a0800; font-weight: 600;
  font-size: 13px; cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  transition: opacity 0.15s;
}
.lets-go-btn:active { opacity: 0.85; }
.plan-empty-hint {
  text-align: center;
  font-size: 12px;
  color: rgba(255,255,255,0.15);
  font-family: 'DM Sans', sans-serif;
  padding: 16px 0;
}

/* Modal overlay */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.65);
  z-index: 80;
  display: flex;
  align-items: flex-end;
}
.modal-sheet {
  width: 100%; max-width: 390px;
  margin: 0 auto;
  background: #111009;
  border-radius: 26px 26px 0 0;
  padding: 12px 20px 40px;
  border-top: 1px solid rgba(255,255,255,0.07);
}
.modal-handle {
  width: 32px; height: 3px;
  background: rgba(255,255,255,0.12);
  border-radius: 100px;
  margin: 0 auto 18px;
}
.modal-title {
  font-family: 'Fraunces', serif;
  font-size: 20px; font-weight: 300;
  color: rgba(255,255,255,0.9);
  margin-bottom: 16px;
  letter-spacing: -0.01em;
}
.modal-intent-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.modal-intent-card {
  padding: 14px;
  border-radius: 16px;
  cursor: pointer;
  transition: opacity 0.15s;
}
.modal-intent-card:active { opacity: 0.7; }
.modal-intent-card--amber  { background: #1A0E0A; border: 1px solid rgba(232,147,90,0.2); }
.modal-intent-card--blue   { background: #0A0E1A; border: 1px solid rgba(107,142,255,0.15); }
.modal-intent-card--green  { background: #0E1A0E; border: 1px solid rgba(123,198,126,0.15); }
.modal-intent-card--purple { background: #130A1A; border: 1px solid rgba(176,107,255,0.15); }
.modal-intent-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  margin-bottom: 16px;
}
.modal-intent-dot--amber  { background: #E8935A; }
.modal-intent-dot--blue   { background: #6B8EFF; }
.modal-intent-dot--green  { background: #7BC67E; }
.modal-intent-dot--purple { background: #B06BFF; }
.modal-intent-label {
  font-size: 13px; font-weight: 600;
  color: rgba(255,255,255,0.85);
  font-family: 'DM Sans', sans-serif;
}
.modal-scene-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 0;
}
.modal-back {
  background: none; border: none;
  color: rgba(255,255,255,0.3);
  font-size: 16px; cursor: pointer;
  padding: 0; line-height: 1;
  font-family: 'DM Sans', sans-serif;
}
.modal-scene-pills {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 4px;
}
.modal-scene-pill {
  padding: 8px 14px;
  border-radius: 100px;
  font-size: 12px; font-weight: 500;
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  transition: opacity 0.15s;
  border: 1px solid transparent;
  background: none;
}
.modal-scene-pill:active { opacity: 0.7; }
.modal-scene-pill--amber  { background: rgba(232,147,90,0.08);  border-color: rgba(232,147,90,0.22);  color: rgba(232,147,90,0.82); }
.modal-scene-pill--blue   { background: rgba(107,142,255,0.08); border-color: rgba(107,142,255,0.2);  color: rgba(107,142,255,0.75); }
.modal-scene-pill--green  { background: rgba(123,198,126,0.08); border-color: rgba(123,198,126,0.2);  color: rgba(123,198,126,0.75); }
.modal-scene-pill--purple { background: rgba(176,107,255,0.08); border-color: rgba(176,107,255,0.2);  color: rgba(176,107,255,0.75); }
.modal-scene-pill--muted  { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.08); color: rgba(255,255,255,0.3); }
.modal-cancel {
  display: block; width: 100%;
  margin-top: 14px;
  background: none; border: none;
  color: rgba(255,255,255,0.2);
  font-size: 12px; cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  padding: 8px 0;
}

/* Transitions */
.modal-overlay-enter-active,
.modal-overlay-leave-active { transition: background 0.25s ease; }
.modal-overlay-enter-from,
.modal-overlay-leave-to { background: rgba(0,0,0,0); }
.modal-sheet-enter-active,
.modal-sheet-leave-active { transition: transform 0.32s cubic-bezier(0.32,0.72,0,1); }
.modal-sheet-enter-from,
.modal-sheet-leave-to { transform: translateY(100%); }
.step-fade-enter-active,
.step-fade-leave-active { transition: all 0.2s ease; }
.step-fade-enter-from { opacity: 0; transform: translateX(12px); }
.step-fade-leave-to   { opacity: 0; transform: translateX(-12px); }
</style>
