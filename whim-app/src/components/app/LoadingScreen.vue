<template>
  <div class="loading-screen">

    <!-- Grid background -->
    <div class="grid-bg" />

    <!-- Radar -->
    <div class="radar-wrap">
      <svg width="180" height="180" viewBox="0 0 180 180">

        <!-- Rings -->
        <circle cx="90" cy="90" r="80"
          fill="none" stroke="#E8935A" stroke-width="0.5"
          class="ring ring-3" />
        <circle cx="90" cy="90" r="60"
          fill="none" stroke="#E8935A" stroke-width="0.5"
          class="ring ring-2" />
        <circle cx="90" cy="90" r="40"
          fill="none" stroke="#E8935A" stroke-width="0.8"
          class="ring ring-1" />

        <!-- Center dot -->
        <circle cx="90" cy="90" r="3" fill="#E8935A" opacity="0.9" />

        <!-- Radar sweep -->
        <g class="radar-sweep">
          <path
            d="M90 90 L170 90 A80 80 0 0 0 90 10 Z"
            fill="#E8935A" opacity="0.1"
          />
          <line x1="90" y1="90" x2="90" y2="10"
            stroke="#E8935A" stroke-width="1" opacity="0.8" />
        </g>

        <!-- Static venue dots -->
        <circle cx="45"  cy="65"  r="2.5" fill="#6B8EFF" opacity="0.7" />
        <circle cx="130" cy="110" r="2"   fill="#E8935A" opacity="0.6" />
        <circle cx="110" cy="55"  r="2"   fill="#7BC67E" opacity="0.5" />
        <circle cx="60"  cy="125" r="2.5" fill="#E8935A" opacity="0.8" />
        <circle cx="140" cy="70"  r="1.5" fill="#B06BFF" opacity="0.6" />
        <circle cx="75"  cy="45"  r="2"   fill="#6B8EFF" opacity="0.5" />

      </svg>
    </div>

    <!-- Neighborhood label -->
    <div class="neighborhood">{{ neighborhood ?? 'Nearby' }}</div>

    <!-- Main message — transitions on stage change -->
    <Transition name="msg-fade" mode="out-in">
      <div class="main-msg" :key="currentStage">
        {{ currentMessage }}
      </div>
    </Transition>

    <!-- Found venues list -->
    <div class="venue-list">
      <TransitionGroup name="venue-item" tag="div">
        <div
          v-for="(name, i) in displayedVenues"
          :key="name"
          class="venue-row"
          :class="{ 'venue-row--checking': i === displayedVenues.length - 1 && !isDone }"
        >
          <div
            class="venue-dot"
            :class="i === displayedVenues.length - 1 && !isDone
              ? 'venue-dot--checking'
              : 'venue-dot--found'"
          />
          <span class="venue-name">
            {{ i === displayedVenues.length - 1 && !isDone
              ? `Checking ${name}...`
              : `Found ${name}` }}
          </span>
        </div>
      </TransitionGroup>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  intent:       String,
  scene:        String,
  neighborhood: String,
  foundVenues:  { type: Array, default: () => [] },
})

const currentStage    = ref(0)
const displayedVenues = ref([])
const isDone          = ref(false)

const messages = computed(() => [
  `Asking locals about ${props.scene ?? props.intent}...`,
  'Filtering out the tourist traps...',
  "Checking who's open right now...",
  'Finding the hidden gems...',
])

const currentMessage = computed(() =>
  messages.value[currentStage.value] ?? messages.value[messages.value.length - 1]
)

let stageTimer = null
onMounted(() => {
  stageTimer = setInterval(() => {
    if (currentStage.value < messages.value.length - 1) {
      currentStage.value++
    }
  }, 2500)
})

onUnmounted(() => {
  clearInterval(stageTimer)
})

watch(() => props.foundVenues, (names) => {
  if (!names.length) return
  names.forEach((name, i) => {
    if (!displayedVenues.value.includes(name)) {
      setTimeout(() => {
        displayedVenues.value.push(name)
        if (displayedVenues.value.length > 3) {
          displayedVenues.value.shift()
        }
      }, i * 300)
    }
  })
}, { deep: true })
</script>

<style scoped>
.loading-screen {
  position: relative;
  width: 100%;
  height: 100%;
  background: #0C0B0A;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  overflow: hidden;
}

.grid-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.03;
  background-image:
    linear-gradient(rgba(232,147,90,1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(232,147,90,1) 1px, transparent 1px);
  background-size: 60px 60px;
}

.radar-wrap {
  position: relative;
  width: 180px;
  height: 180px;
  margin-bottom: 36px;
  flex-shrink: 0;
}

.radar-sweep {
  transform-origin: 90px 90px;
  animation: radar-spin 3s linear infinite;
}

@keyframes radar-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.ring {
  animation: ring-pulse 2.5s ease-in-out infinite;
}
.ring-2 { animation-delay: 0.5s; }
.ring-3 { animation-delay: 1s; }

@keyframes ring-pulse {
  0%, 100% { opacity: 0.2; }
  50%       { opacity: 0.5; }
}

.neighborhood {
  font-family: 'DM Sans', sans-serif;
  font-size: 10px;
  color: rgba(255,255,255,0.25);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 500;
  margin-bottom: 12px;
}

.main-msg {
  font-family: 'Fraunces', serif;
  font-weight: 300;
  font-size: 26px;
  color: rgba(255,255,255,0.92);
  letter-spacing: -0.02em;
  line-height: 1.2;
  text-align: center;
  margin-bottom: 28px;
}

.msg-fade-enter-active,
.msg-fade-leave-active {
  transition: all 0.3s ease;
}
.msg-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.msg-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.venue-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.venue-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  background: rgba(255,255,255,0.04);
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.06);
}

.venue-row--checking {
  background: rgba(255,255,255,0.02);
  border-color: rgba(255,255,255,0.04);
}

.venue-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}

.venue-dot--found    { background: #7BC67E; }
.venue-dot--checking {
  background: #E8935A;
  animation: dot-blink 1.2s ease-in-out infinite;
}

@keyframes dot-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}

.venue-name {
  font-family: 'DM Sans', sans-serif;
  font-size: 12px;
  color: rgba(255,255,255,0.45);
  font-weight: 300;
}

.venue-row--checking .venue-name {
  color: rgba(255,255,255,0.25);
}

.venue-item-enter-active {
  transition: all 0.4s ease;
}
.venue-item-enter-from {
  opacity: 0;
  transform: translateX(-8px);
}
.venue-item-leave-active {
  transition: all 0.3s ease;
  position: absolute;
}
.venue-item-leave-to {
  opacity: 0;
  transform: translateX(8px);
}
</style>
