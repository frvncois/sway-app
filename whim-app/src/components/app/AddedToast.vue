<template>
  <Transition name="toast-slide">
    <div v-if="show" class="toast-wrap">

      <!-- Progress bar -->
      <div class="toast-progress">
        <div
          :key="progressKey"
          class="toast-progress-bar"
          :class="{ 'toast-progress-bar--running': step === 'intents' }"
        />
      </div>

      <!-- Step 1: Intent selection -->
      <div v-if="step === 'intents'" class="toast-body">

        <div class="toast-confirm">
          <div class="toast-dot toast-dot--green" />
          <span class="toast-venue-name">{{ venueName }} added</span>
          <span v-if="peakHour" class="toast-peak">
            {{ formatPeakHour(peakHour) }} peak
          </span>
        </div>

        <div class="toast-label">Add another stop</div>

        <div class="toast-pills">
          <button
            v-for="intent in INTENTS"
            :key="intent.value"
            class="toast-pill"
            :class="`toast-pill--${intent.color}`"
            @click="onIntentTap(intent.value)"
          >
            {{ intent.label }}
          </button>

          <button
            class="toast-pill toast-pill--muted"
            @click="onSeePlan"
          >
            See plan
          </button>
        </div>

      </div>

      <!-- Step 2: Scene selection -->
      <div v-else-if="step === 'scenes'" class="toast-body">

        <div class="toast-scene-header">
          <button class="toast-back" @click="onBack">←</button>
          <span class="toast-scene-title">
            What kind of {{ selectedIntent }}?
          </span>
        </div>

        <div class="toast-pills toast-pills--scenes">
          <button
            v-for="scene in scenes.slice(0, 6)"
            :key="scene.label"
            class="toast-pill"
            :class="`toast-pill--${scene.color}`"
            @click="onSceneTap(scene)"
          >
            {{ scene.label }}
          </button>

          <button
            class="toast-pill toast-pill--muted"
            @click="onSceneTap({ label: 'Any', query: selectedIntent, color: 'amber' })"
          >
            Any
          </button>
        </div>

      </div>

    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { SCENES } from '@/data/scenes.js'
import { useRouter } from 'vue-router'

const props = defineProps({
  venueName: String,
  peakHour:  { type: Number, default: null },
  show:      Boolean,
})

const emit   = defineEmits(['dismiss', 'switch-intent'])
const router = useRouter()

const step           = ref('intents')
const selectedIntent = ref(null)
const progressKey    = ref(0)
let   autoTimer      = null

const INTENTS = [
  { label: 'Dinner', value: 'dinner', color: 'amber' },
  { label: 'Drinks', value: 'drinks', color: 'blue'  },
  { label: 'Shop',   value: 'shop',   color: 'green' },
  { label: 'Visit',  value: 'visit',  color: 'blue'  },
]

const scenes = computed(() =>
  selectedIntent.value ? (SCENES[selectedIntent.value] ?? []) : []
)

function startTimer() {
  clearTimeout(autoTimer)
  autoTimer = setTimeout(() => emit('dismiss'), 4000)
}

function formatPeakHour(hour) {
  const h   = hour > 12 ? hour - 12 : hour
  const per = hour >= 12 ? 'pm' : 'am'
  return `${h}${per}`
}

watch(() => props.show, (val) => {
  if (val) {
    step.value           = 'intents'
    selectedIntent.value = null
    progressKey.value++
    startTimer()
  } else {
    clearTimeout(autoTimer)
  }
})

function onIntentTap(intent) {
  clearTimeout(autoTimer)
  selectedIntent.value = intent
  step.value           = 'scenes'
}

function onSceneTap(scene) {
  emit('switch-intent', selectedIntent.value, scene)
  emit('dismiss')
}

function onBack() {
  step.value           = 'intents'
  selectedIntent.value = null
  progressKey.value++
  startTimer()
}

function onSeePlan() {
  emit('dismiss')
  router.push('/plan')
}

onUnmounted(() => clearTimeout(autoTimer))
</script>

<style scoped>
.toast-wrap {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  background: #111009;
  border-radius: 24px 24px 0 0;
  padding: 10px 18px 36px;
  border-top: 1px solid rgba(255,255,255,0.07);
  z-index: 50;
}
.toast-progress {
  width: 100%; height: 2px;
  background: rgba(255,255,255,0.05);
  border-radius: 1px;
  margin-bottom: 14px;
  overflow: hidden;
}
.toast-progress-bar {
  height: 100%;
  background: #E8935A;
  border-radius: 1px;
  width: 0%;
}
.toast-progress-bar--running {
  width: 100%;
  animation: progress-drain 4s linear forwards;
}
@keyframes progress-drain {
  from { width: 100%; }
  to   { width: 0%; }
}
.toast-body { display: flex; flex-direction: column; gap: 12px; }
.toast-confirm {
  display: flex; align-items: center; gap: 8px;
}
.toast-dot {
  width: 6px; height: 6px;
  border-radius: 50%; flex-shrink: 0;
}
.toast-dot--green { background: #7BC67E; }
.toast-venue-name {
  font-size: 13px; font-weight: 500;
  color: rgba(255,255,255,0.85);
  font-family: 'DM Sans', sans-serif;
}
.toast-peak {
  font-size: 11px;
  color: rgba(255,255,255,0.25);
  font-family: 'DM Sans', sans-serif;
  margin-left: auto;
}
.toast-label {
  font-size: 9.5px;
  color: rgba(255,255,255,0.22);
  letter-spacing: 0.09em;
  text-transform: uppercase;
  font-weight: 600;
  font-family: 'DM Sans', sans-serif;
}
.toast-pills {
  display: flex; gap: 6px; flex-wrap: wrap;
}
.toast-pill {
  padding: 7px 14px;
  border-radius: 100px;
  font-size: 12px; font-weight: 500;
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  transition: all 0.15s;
  border: 1px solid transparent;
  background: transparent;
}
.toast-pill--amber {
  border-color: rgba(232,147,90,0.25);
  background: rgba(232,147,90,0.08);
  color: rgba(232,147,90,0.8);
}
.toast-pill--blue {
  border-color: rgba(107,142,255,0.2);
  background: rgba(107,142,255,0.06);
  color: rgba(107,142,255,0.7);
}
.toast-pill--green {
  border-color: rgba(123,198,126,0.2);
  background: rgba(123,198,126,0.06);
  color: rgba(123,198,126,0.7);
}
.toast-pill--purple {
  border-color: rgba(176,107,255,0.2);
  background: rgba(176,107,255,0.06);
  color: rgba(176,107,255,0.7);
}
.toast-pill--muted {
  border-color: rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
  color: rgba(255,255,255,0.3);
}
.toast-scene-header {
  display: flex; align-items: center; gap: 10px;
}
.toast-back {
  background: none; border: none;
  color: rgba(255,255,255,0.3);
  font-size: 16px; cursor: pointer;
  padding: 0; line-height: 1;
  font-family: 'DM Sans', sans-serif;
}
.toast-scene-title {
  font-size: 13px; font-weight: 500;
  color: rgba(255,255,255,0.85);
  font-family: 'DM Sans', sans-serif;
}
.toast-slide-enter-active {
  transition: transform 0.32s cubic-bezier(0.32, 0.72, 0, 1);
}
.toast-slide-leave-active {
  transition: transform 0.25s ease-in;
}
.toast-slide-enter-from,
.toast-slide-leave-to {
  transform: translateY(100%);
}
</style>
