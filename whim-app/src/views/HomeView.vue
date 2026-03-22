<template>
  <div class="home-view">

    <!-- TopBar -->
    <TopBar
      :show-back="false"
      :show-star="true"
      :plan-count="favStore.favouriteCount"
    />

    <!-- City cover image -->
    <div class="cover-wrap" :class="{ 'cover-wrap--compact': hasPlan }">
      <div
        class="cover-img"
        :style="coverStyle"
      />
      <div class="cover-gradient" />
      <div class="cover-city">
        <span class="cover-city-dot" />
        <span class="cover-city-name">{{ store.city ?? 'Nearby' }}</span>
      </div>
    </div>

    <!-- Scrollable content below cover -->
    <div class="home-content">

      <!-- Greeting -->
      <div class="greeting">
        <div class="greeting-time">{{ greeting }}</div>
        <div class="greeting-name">François</div>
      </div>

      <!-- Intent label -->
      <div class="section-micro">What do you feel like?</div>

      <!-- Intent pills with icons -->
      <div class="intent-pills">
        <button
          v-for="intent in INTENTS"
          :key="intent.value"
          class="intent-pill"
          :class="`intent-pill--${intent.color}`"
          @click="openModal(intent.value)"
        >
          <component
            :is="intent.icon"
            :size="15"
            :stroke-width="1.5"
          />
          <span>{{ intent.label }}</span>
        </button>
      </div>

      <!-- Plan section -->
      <template v-if="hasPlan">

        <div class="section-micro" style="margin-top: 4px;">
          Tonight's plan
        </div>

        <!-- NEXT STOP — hero card -->
        <div
          v-if="nextStop"
          class="next-stop-card"
          @click="openStop(nextStop)"
        >
          <!-- Cover photo -->
          <div
            class="next-stop-cover"
            :style="stopCoverStyle(nextStop)"
          >
            <div class="next-stop-badge">
              NEXT · {{ nextStop.time }}
            </div>
            <div class="next-stop-drag drag-icon">≡</div>
            <div class="next-stop-cover-gradient" />
          </div>
          <!-- Info -->
          <div class="next-stop-info">
            <div class="next-stop-name">{{ nextStop.name }}</div>
            <div class="next-stop-meta">
              {{ getVenueAddress(nextStop) }}
              <span v-if="getWalkTime(nextStop)">
                · {{ getWalkTime(nextStop) }} min walk
              </span>
            </div>
            <div class="next-stop-tags">
              <span
                v-for="tag in getVenueTags(nextStop)"
                :key="tag.label ?? tag"
                class="stop-tag"
                :class="`stop-tag--${tag.variant ?? 'amber'}`"
              >{{ tag.label ?? tag }}</span>
            </div>
          </div>
        </div>

        <!-- Transition line after hero card -->
        <div
          v-if="remainingStops.length"
          class="stop-connector"
        >
          <div class="stop-connector-line" />
          <span class="stop-connector-text">
            {{ getTransitionText(nextStop, remainingStops[0]) }}
          </span>
        </div>

        <!-- REMAINING STOPS — draggable compact cards -->
        <VueDraggable
          v-model="draggableRemaining"
          handle=".drag-icon"
          :animation="200"
          @end="onReorder"
          tag="div"
          class="remaining-stops"
        >
          <template v-for="(stop, i) in draggableRemaining" :key="stop.name">

            <div
              class="compact-stop-card"
              @click="openStop(stop)"
            >
              <!-- Photo thumb -->
              <div
                class="compact-stop-photo"
                :style="stopThumbStyle(stop)"
              />

              <!-- Info -->
              <div class="compact-stop-info">
                <div class="compact-stop-name">{{ stop.name }}</div>
                <div class="compact-stop-meta">
                  {{ stop.time }}
                  <span v-if="getWalkTime(stop)">
                    · {{ getWalkTime(stop) }} min walk
                  </span>
                </div>
              </div>

              <!-- Actions -->
              <div class="compact-stop-actions">
                <button
                  class="stop-delete-btn"
                  @click.stop="deleteStop(stop)"
                >✕</button>
                <div class="drag-icon stop-drag">≡</div>
              </div>
            </div>

            <!-- Connector between remaining stops -->
            <div
              v-if="i < draggableRemaining.length - 1"
              class="stop-connector"
            >
              <div class="stop-connector-line" />
              <span class="stop-connector-text">
                {{ getTransitionText(stop, draggableRemaining[i + 1]) }}
              </span>
            </div>

          </template>
        </VueDraggable>

      </template>

      <!-- No plan hint -->
      <div v-else class="no-plan-hint">
        Swipe right on places to build your night
      </div>

    </div><!-- end home-content -->

    <!-- Intent + Scene Modal -->
    <Transition name="modal-overlay">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <Transition name="modal-sheet" appear>
          <div class="modal-sheet">
            <div class="modal-handle" />
            <Transition name="step-fade" mode="out-in">

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
                    <component
                      :is="intent.icon"
                      :size="18"
                      :stroke-width="1.5"
                      class="modal-intent-icon"
                      :class="`modal-intent-icon--${intent.color}`"
                    />
                    <div class="modal-intent-label">{{ intent.label }}</div>
                  </div>
                </div>
              </div>

              <div v-else-if="modalStep === 'scene'" key="scene">
                <div class="modal-scene-header">
                  <button class="modal-back" @click="modalStep = 'intent'">←</button>
                  <div class="modal-title">
                    What kind of {{ selectedIntentLabel }}?
                  </div>
                </div>
                <div class="modal-scene-pills">
                  <button
                    v-for="scene in currentScenes"
                    :key="scene.label"
                    class="modal-scene-pill"
                    :class="`modal-scene-pill--${scene.color}`"
                    @click="selectScene(scene)"
                  >{{ scene.label }}</button>
                  <button
                    class="modal-scene-pill modal-scene-pill--muted"
                    @click="selectScene({
                      label: 'Any',
                      query: selectedIntent,
                      color: 'amber'
                    })"
                  >Any</button>
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
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { VueDraggable } from 'vue-draggable-plus'
import {
  Flame, GlassWater, ShoppingBag, Music, Globe, Clock
} from 'lucide-vue-next'
import TopBar from '@/components/app/TopBar.vue'
import { useVenuesStore }     from '@/stores/venues.js'
import { usePlanStore }       from '@/stores/plan.js'
import { useFavouritesStore } from '@/stores/favourites.js'
import { SCENES }             from '@/data/scenes.js'

const router    = useRouter()
const store     = useVenuesStore()
const planStore = usePlanStore()
const favStore  = useFavouritesStore()

// ── City cover photo (Unsplash) ───────────────────────────────

const coverUrl = ref(null)

async function fetchCoverPhoto(city) {
  if (!city) return
  const key = import.meta.env.VITE_UNSPLASH_ACCESS_KEY
  if (!key) return
  try {
    const res  = await fetch(
      `https://api.unsplash.com/search/photos` +
      `?query=${encodeURIComponent(city + ' city night')}&orientation=landscape&per_page=1`,
      { headers: { Authorization: `Client-ID ${key}` } }
    )
    const data = await res.json()
    const url  = data.results?.[0]?.urls?.regular
    if (url) coverUrl.value = url
  } catch (e) {
    console.log('[cover] unsplash fetch failed:', e.message)
  }
}

watch(
  () => store.city,
  (city) => { if (city) fetchCoverPhoto(city) },
  { immediate: true }
)

const coverStyle = computed(() => {
  if (coverUrl.value) {
    return {
      backgroundImage:    `url(${coverUrl.value})`,
      backgroundSize:     'cover',
      backgroundPosition: 'center',
    }
  }
  // Fallback gradient while loading or if no key
  return {
    background: 'linear-gradient(160deg, #0D1B2A 0%, #1A0E2A 50%, #0A1A12 100%)',
  }
})

// ── Greeting ──────────────────────────────────────────────────

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return 'Good morning'
  if (h >= 12 && h < 18) return 'Good afternoon'
  if (h >= 18 && h < 22) return 'Good evening'
  return 'Good night'
})

// TODO: replace with real username when auth exists
const userName = computed(() => store.city ?? 'there')

// ── Intents ───────────────────────────────────────────────────

const INTENTS = [
  { label: 'Dinner',    value: 'dinner',    color: 'amber',  icon: Flame       },
  { label: 'Drinks',    value: 'drinks',    color: 'blue',   icon: GlassWater  },
  { label: 'Shop',      value: 'shop',      color: 'green',  icon: ShoppingBag },
  { label: 'Party',     value: 'party',     color: 'purple', icon: Music       },
  { label: 'Visit',     value: 'visit',     color: 'teal',   icon: Globe       },
  { label: 'Late eats', value: 'late_eats', color: 'red',    icon: Clock       },
]

// ── Plan display ──────────────────────────────────────────────

const hasPlan = computed(() => planStore.planVenues.length > 0)

const allStops = computed(() => {
  if (planStore.currentPlan?.stops?.length) {
    return planStore.currentPlan.stops.filter(s => !s.skipped)
  }
  return planStore.planVenues.map(v => ({
    name:          v.name,
    time:          'TBD',
    photos:        v.photos,
    gradient_from: v.gradient_from,
    gradient_to:   v.gradient_to,
  }))
})

const nextStop       = computed(() => allStops.value[0] ?? null)
const remainingStops = computed(() => allStops.value.slice(1))

// Draggable remaining stops
const draggableRemaining = ref([])
watch(remainingStops, stops => {
  draggableRemaining.value = [...stops]
}, { immediate: true })

function onReorder() {
  const newOrder = [
    ...(nextStop.value ? [nextStop.value.name] : []),
    ...draggableRemaining.value.map(s => s.name),
  ]
  planStore.rebuildPlanWithOrder(newOrder, store.currentIntent, store.vibe)
}

function deleteStop(stop) {
  planStore.removeFromPlan(stop.name)
}

function openStop(stop) {
  const venue = planStore.planVenues.find(v => v.name === stop.name)
  if (venue) {
    store.venues = [venue, ...store.venues.filter(v => v.name !== venue.name)]
    store.currentIndex = 0
    router.push('/detail')
  }
}

// ── Stop helpers ──────────────────────────────────────────────

function stopCoverStyle(stop) {
  const venue = planStore.planVenues.find(v => v.name === stop.name)
  const url   = venue?.photos?.[0]
  if (url) {
    return {
      backgroundImage:    `url(${url})`,
      backgroundSize:     'cover',
      backgroundPosition: 'center',
    }
  }
  const from = venue?.gradient_from ?? stop.gradient_from ?? '#2D1B69'
  const to   = venue?.gradient_to   ?? stop.gradient_to   ?? '#0F2A20'
  return { background: `linear-gradient(135deg, ${from}, ${to})` }
}

function stopThumbStyle(stop) {
  const venue = planStore.planVenues.find(v => v.name === stop.name)
  const url   = venue?.photos?.[0]
  if (url) {
    return {
      backgroundImage:    `url(${url})`,
      backgroundSize:     'cover',
      backgroundPosition: 'center',
    }
  }
  const from = venue?.gradient_from ?? '#1A1028'
  const to   = venue?.gradient_to   ?? '#0E1820'
  return { background: `linear-gradient(135deg, ${from}, ${to})` }
}

function getVenueAddress(stop) {
  const v = planStore.planVenues.find(v => v.name === stop.name)
  return v?.neighborhood ?? null
}

function getWalkTime(stop) {
  const v = planStore.planVenues.find(v => v.name === stop.name)
  return v?.distance_minutes ?? null
}

function getVenueTags(stop) {
  const v = planStore.planVenues.find(v => v.name === stop.name)
  return v?.tags?.slice(0, 2) ?? []
}

function getTransitionText(_from, to) {
  const v = planStore.planVenues.find(v => v.name === to?.name)
  if (v?.distance_minutes) return `${v.distance_minutes} min walk`
  return null
}

// ── Modal ──────────────────────────────────────────────────────

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
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Cover */
.cover-wrap {
  position: relative;
  height: 210px;
  flex-shrink: 0;
  transition: height 0.3s ease;
}
.cover-wrap--compact { height: 160px; }
.cover-img {
  position: absolute;
  inset: 0;
  background: linear-gradient(160deg,#0D1B2A,#1A0E2A 50%,#0A1A12);
}
.cover-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom,
    rgba(12,11,10,0.2) 0%,
    rgba(12,11,10,0.0) 40%,
    rgba(12,11,10,0.95) 100%
  );
}
.cover-city {
  position: absolute;
  bottom: 16px;
  left: 18px;
  display: flex;
  align-items: center;
  gap: 7px;
}
.cover-city-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #E8935A;
  flex-shrink: 0;
}
.cover-city-name {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255,255,255,0.75);
  font-family: 'DM Sans', sans-serif;
  letter-spacing: 0.02em;
}

/* Content */
.home-content {
  flex: 1;
  padding: 16px 16px 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Greeting */
.greeting-time {
  font-size: 10px;
  color: rgba(255,255,255,0.25);
  letter-spacing: 0.06em;
  font-weight: 500;
  font-family: 'DM Sans', sans-serif;
  margin-bottom: 3px;
}
.greeting-name {
  font-family: 'Fraunces', serif;
  font-size: 28px;
  font-weight: 300;
  color: rgba(255,255,255,0.92);
  letter-spacing: -0.025em;
  line-height: 1.1;
}

/* Section label */
.section-micro {
  font-size: 9px;
  color: rgba(255,255,255,0.2);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 600;
  font-family: 'DM Sans', sans-serif;
}

/* Intent pills */
.intent-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.intent-pill {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 14px;
  border-radius: 100px;
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 500;
  transition: opacity 0.15s;
  border: 1px solid transparent;
  background: transparent;
}
.intent-pill:active { opacity: 0.7; }
.intent-pill--amber  {
  background: rgba(232,147,90,0.08);
  border-color: rgba(232,147,90,0.25);
  color: rgba(232,147,90,0.85);
}
.intent-pill--blue   {
  background: rgba(107,142,255,0.08);
  border-color: rgba(107,142,255,0.2);
  color: rgba(107,142,255,0.8);
}
.intent-pill--green  {
  background: rgba(123,198,126,0.08);
  border-color: rgba(123,198,126,0.2);
  color: rgba(123,198,126,0.8);
}
.intent-pill--purple {
  background: rgba(176,107,255,0.08);
  border-color: rgba(176,107,255,0.2);
  color: rgba(176,107,255,0.8);
}
.intent-pill--teal {
  background: rgba(45,185,140,0.08);
  border-color: rgba(45,185,140,0.22);
  color: rgba(45,185,140,0.85);
}
.intent-pill--red {
  background: rgba(255,107,107,0.08);
  border-color: rgba(255,107,107,0.22);
  color: rgba(255,107,107,0.85);
}

/* Next stop hero card */
.next-stop-card {
  border-radius: 18px;
  overflow: hidden;
  background: #141210;
  border: 1px solid rgba(255,255,255,0.07);
  cursor: pointer;
  transition: opacity 0.15s;
}
.next-stop-card:active { opacity: 0.85; }
.next-stop-cover {
  height: 120px;
  position: relative;
}
.next-stop-badge {
  position: absolute;
  top: 10px; left: 10px;
  padding: 4px 10px;
  border-radius: 100px;
  background: rgba(0,0,0,0.5);
  font-size: 9px;
  font-weight: 700;
  color: #E8935A;
  font-family: 'DM Sans', sans-serif;
  letter-spacing: 0.06em;
}
.next-stop-drag {
  position: absolute;
  top: 10px; right: 10px;
  color: rgba(255,255,255,0.25);
  font-size: 14px;
  cursor: grab;
  padding: 4px;
  user-select: none;
}
.next-stop-cover-gradient {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 60px;
  background: linear-gradient(to top, rgba(20,18,16,0.95), transparent);
}
.next-stop-info {
  padding: 10px 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.next-stop-name {
  font-size: 16px;
  font-weight: 500;
  color: rgba(255,255,255,0.92);
  font-family: 'DM Sans', sans-serif;
}
.next-stop-meta {
  font-size: 11px;
  color: rgba(255,255,255,0.3);
  font-family: 'DM Sans', sans-serif;
}
.next-stop-tags {
  display: flex;
  gap: 4px;
  margin-top: 2px;
}

/* Tags */
.stop-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 100px;
  font-size: 9px;
  font-weight: 500;
  font-family: 'DM Sans', sans-serif;
  border: 1px solid transparent;
}
.stop-tag--amber  {
  background: rgba(232,147,90,0.1);
  color: rgba(232,147,90,0.7);
  border-color: rgba(232,147,90,0.18);
}
.stop-tag--blue   {
  background: rgba(107,142,255,0.1);
  color: rgba(107,142,255,0.7);
  border-color: rgba(107,142,255,0.18);
}
.stop-tag--purple {
  background: rgba(176,107,255,0.1);
  color: rgba(176,107,255,0.7);
  border-color: rgba(176,107,255,0.18);
}
.stop-tag--green  {
  background: rgba(123,198,126,0.1);
  color: rgba(123,198,126,0.7);
  border-color: rgba(123,198,126,0.18);
}
.stop-tag--teal {
  background: rgba(45,185,140,0.1);
  color: rgba(45,185,140,0.7);
  border-color: rgba(45,185,140,0.18);
}
.stop-tag--gold {
  background: rgba(220,176,120,0.1);
  color: rgba(220,176,120,0.7);
  border-color: rgba(220,176,120,0.18);
}
.stop-tag--red {
  background: rgba(255,107,107,0.1);
  color: rgba(255,107,107,0.7);
  border-color: rgba(255,107,107,0.18);
}

/* Connector */
.stop-connector {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0 3px 14px;
}
.stop-connector-line {
  width: 1px; height: 14px;
  background: rgba(255,255,255,0.07);
  flex-shrink: 0;
}
.stop-connector-text {
  font-size: 10px;
  color: rgba(255,255,255,0.15);
  font-family: 'DM Sans', sans-serif;
}

/* Remaining stops */
.remaining-stops {
  display: flex;
  flex-direction: column;
}
.compact-stop-card {
  display: flex;
  gap: 10px;
  background: rgba(255,255,255,0.04);
  border-radius: 14px;
  padding: 9px 10px;
  border: 1px solid rgba(255,255,255,0.06);
  cursor: pointer;
  align-items: center;
  transition: opacity 0.15s;
}
.compact-stop-card:active { opacity: 0.7; }
.compact-stop-photo {
  width: 38px; height: 38px;
  border-radius: 8px; flex-shrink: 0;
  background: linear-gradient(135deg, #1A1028, #0E1820);
}
.compact-stop-info {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 2px;
}
.compact-stop-name {
  font-size: 13px; font-weight: 500;
  color: rgba(255,255,255,0.85);
  font-family: 'DM Sans', sans-serif;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.compact-stop-meta {
  font-size: 10px;
  color: rgba(255,255,255,0.25);
  font-family: 'DM Sans', sans-serif;
}
.compact-stop-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.stop-delete-btn {
  background: none; border: none;
  color: rgba(255,255,255,0.18);
  font-size: 11px; cursor: pointer;
  padding: 2px 4px; line-height: 1;
  transition: color 0.15s;
}
.stop-delete-btn:hover { color: rgba(255,100,100,0.7); }
.drag-icon {
  color: rgba(255,255,255,0.12);
  font-size: 13px;
  cursor: grab;
  padding: 2px 4px;
  user-select: none;
}

/* No plan hint */
.no-plan-hint {
  text-align: center;
  padding: 24px 0;
  font-size: 12px;
  color: rgba(255,255,255,0.15);
  font-family: 'DM Sans', sans-serif;
  line-height: 1.7;
}

/* Modal */
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
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.modal-intent-card:active { opacity: 0.7; }
.modal-intent-card--amber  { background:#1A0E0A; border:1px solid rgba(232,147,90,0.2); }
.modal-intent-card--blue   { background:#0A0E1A; border:1px solid rgba(107,142,255,0.15); }
.modal-intent-card--green  { background:#0E1A0E; border:1px solid rgba(123,198,126,0.15); }
.modal-intent-card--purple { background:#130A1A; border:1px solid rgba(176,107,255,0.15); }
.modal-intent-card--teal   { background:#071A14; border:1px solid rgba(45,185,140,0.2);   }
.modal-intent-card--red    { background:#1A0A0A; border:1px solid rgba(255,107,107,0.2);  }
.modal-intent-icon--amber  { color: #E8935A; }
.modal-intent-icon--blue   { color: #6B8EFF; }
.modal-intent-icon--green  { color: #7BC67E; }
.modal-intent-icon--purple { color: #B06BFF; }
.modal-intent-icon--teal   { color: #2DB98C; }
.modal-intent-icon--red    { color: #FF6B6B; }
.modal-intent-label {
  font-size: 13px; font-weight: 600;
  color: rgba(255,255,255,0.85);
  font-family: 'DM Sans', sans-serif;
}
.modal-scene-header {
  display: flex; align-items: center; gap: 10px; margin-bottom: 0;
}
.modal-back {
  background: none; border: none;
  color: rgba(255,255,255,0.3);
  font-size: 16px; cursor: pointer;
  padding: 0; line-height: 1;
}
.modal-scene-pills {
  display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px;
}
.modal-scene-pill {
  padding: 8px 14px; border-radius: 100px;
  font-size: 12px; font-weight: 500;
  cursor: pointer; font-family: 'DM Sans', sans-serif;
  transition: opacity 0.15s; border: 1px solid transparent; background: none;
}
.modal-scene-pill:active { opacity: 0.7; }
.modal-scene-pill--amber  { background:rgba(232,147,90,0.08); border-color:rgba(232,147,90,0.22); color:rgba(232,147,90,0.82); }
.modal-scene-pill--blue   { background:rgba(107,142,255,0.08); border-color:rgba(107,142,255,0.2); color:rgba(107,142,255,0.75); }
.modal-scene-pill--green  { background:rgba(123,198,126,0.08); border-color:rgba(123,198,126,0.2); color:rgba(123,198,126,0.75); }
.modal-scene-pill--purple { background:rgba(176,107,255,0.08); border-color:rgba(176,107,255,0.2); color:rgba(176,107,255,0.75); }
.modal-scene-pill--muted  { background:rgba(255,255,255,0.04); border-color:rgba(255,255,255,0.08); color:rgba(255,255,255,0.3); }
.modal-scene-pill--teal { background:rgba(45,185,140,0.08); border-color:rgba(45,185,140,0.22); color:rgba(45,185,140,0.82); }
.modal-scene-pill--red  { background:rgba(255,107,107,0.08); border-color:rgba(255,107,107,0.22); color:rgba(255,107,107,0.82); }
.modal-cancel {
  display: block; width: 100%; margin-top: 14px;
  background: none; border: none; color: rgba(255,255,255,0.2);
  font-size: 12px; cursor: pointer; font-family: 'DM Sans', sans-serif; padding: 8px 0;
}
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
