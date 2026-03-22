<template>
  <div class="relative h-full overflow-hidden">
    <TopBar :showBack="true" :plan-count="favStore.favouriteCount" />
    <!-- Dimmed card behind -->
    <div ref="bgCardEl" class="absolute inset-0 pointer-events-none fade-overlay" style="opacity: 0">
      <div class="px-4 pt-16">
        <SwipeCard v-if="venue" :venue="venue" />
      </div>
    </div>

    <!-- Dim overlay -->
    <div ref="dimEl" class="absolute inset-0 bg-bg-base/60 fade-overlay" style="opacity: 0" />

    <!-- Bottom sheet -->
    <BottomSheet ref="sheetRef" @dismiss="onDismiss">
      <div v-if="venue" class="px-5 pb-8">

        <!-- Venue name + description -->
        <div class="mb-4 mt-2">
          <h2 class="text-[28px] font-display font-light text-text-primary leading-tight">{{ venue.name }}</h2>
          <p class="text-[14px] font-display italic text-text-secondary mt-1">{{ venue.description }}</p>
        </div>

        <!-- Tags row -->
        <div class="flex flex-wrap gap-2 mb-4">
          <VenueTag
            v-for="(tag, i) in venue.tags"
            :key="tag.label"
            :label="tag.label"
            :variant="tag.variant"
            :index="i"
          />
        </div>

        <!-- Distance + hours -->
        <div class="flex items-center gap-4 mb-4">
          <DistanceDot :minutes="venue.distance_minutes ?? 8" mode="walk" />
          <span class="text-[13px] text-text-secondary">
            Open until {{ venue.open_until ?? 'late' }}
          </span>
        </div>

        <!-- Busy indicator -->
        <div v-if="venue.current_busy" class="detail-busy mb-4">
          <span
            class="detail-busy-dot"
            :class="venue.current_busy.level === 'busy' ? 'dot-green' : 'dot-muted'"
          />
          <span class="detail-busy-text">{{ venue.current_busy.description }}</span>
        </div>

        <!-- Link pills -->
        <div v-if="venue.website || mapsUrl" class="flex gap-2 mb-4">
          <a
            v-if="venue.website"
            :href="venue.website"
            target="_blank"
            rel="noopener"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-bg-elevated border border-border-subtle text-[13px] text-text-secondary hover:border-amber/30 hover:text-text-primary transition-colors"
          >
            <Globe :size="13" />
            Website
          </a>
          <a
            v-if="mapsUrl"
            :href="mapsUrl"
            target="_blank"
            rel="noopener"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-bg-elevated border border-border-subtle text-[13px] text-text-secondary hover:border-amber/30 hover:text-text-primary transition-colors"
          >
            <MapPin :size="13" />
            Google Maps
          </a>
        </div>

        <!-- Rating row -->
        <div v-if="venue.rating" class="flex items-center gap-2 mb-5">
          <span class="text-[15px] font-medium text-text-primary tabular-nums">{{ venue.rating.toFixed(1) }}</span>
          <div class="flex items-center gap-0.5">
            <span
              v-for="n in 5"
              :key="n"
              class="text-[13px]"
              :class="n <= Math.round(venue.rating) ? 'text-amber' : 'text-text-muted'"
            >●</span>
          </div>
          <span v-if="venue.rating_count" class="text-[13px] text-text-muted">
            {{ formatCount(venue.rating_count) }} reviews
          </span>
        </div>

        <!-- Photo strips -->
        <div class="flex gap-2 mb-5 h-24">
          <template v-if="venue.photos?.length">
            <img
              v-for="(url, i) in venue.photos.slice(0, 3)"
              :key="i"
              :src="url"
              class="flex-1 rounded-card object-cover"
            />
          </template>
          <template v-else>
            <div
              v-for="strip in photoStrips"
              :key="strip.id"
              class="flex-1 rounded-card"
              :style="`background: linear-gradient(135deg, ${strip.from}, ${strip.to})`"
            />
          </template>
        </div>

        <!-- Picked because -->
        <div class="rounded-card bg-bg-card border border-border-subtle p-4 mb-5">
          <p class="text-[11px] font-medium tracking-widest uppercase text-text-muted mb-1">Picked because</p>
          <p class="text-[15px] font-display italic text-text-secondary leading-relaxed">
            "{{ venue.vibe_reason || 'Worth checking out.' }}"
          </p>
        </div>

        <!-- Reviews -->
        <div v-if="visibleReviews.length" class="mb-5">
          <div class="flex flex-col gap-3">
            <div
              v-for="review in visibleReviews"
              :key="review.author + review.time"
              class="rounded-card bg-bg-card border border-border-subtle px-4 pt-3 pb-3.5"
            >
              <div class="flex items-baseline justify-between mb-1.5">
                <span class="text-[13px] font-medium text-text-primary">{{ review.author }}</span>
                <span class="text-[11px] text-text-muted">{{ review.time }}</span>
              </div>
              <p class="text-[13px] text-text-secondary leading-relaxed">"{{ review.text }}"</p>
            </div>
          </div>

          <button
            v-if="hiddenReviewCount > 0"
            class="mt-3 w-full text-[13px] text-text-muted hover:text-text-secondary transition-colors text-center py-1"
            @click="showAllReviews = true"
          >
            See {{ hiddenReviewCount }} more {{ hiddenReviewCount === 1 ? 'review' : 'reviews' }}
          </button>
        </div>

        <!-- Primary action -->
        <a
          :href="mapsUrl"
          target="_blank"
          rel="noopener"
          class="w-full rounded-btn bg-amber text-bg-base font-semibold text-[16px] mb-3 flex items-center justify-center gap-2 shadow-lg shadow-amber/20 hover:bg-amber/90 transition-colors"
          style="height: 52px"
        >
          <Navigation :size="18" />
          Navigate
        </a>

        <!-- Secondary actions -->
        <div class="flex gap-3">
          <!-- Star / Save -->
          <button
            ref="starBtnEl"
            class="flex-1 h-12 rounded-btn bg-bg-elevated border text-[14px] font-medium flex items-center justify-center gap-2 transition-colors"
            :class="starred
              ? 'border-amber/50 text-amber'
              : 'border-border-subtle text-text-secondary hover:border-amber/30'"
            @click="onStarTap"
          >
            <Star :size="16" :fill="starred ? 'currentColor' : 'none'" />
            {{ starred ? 'Saved ★' : 'Save + Plan' }}
          </button>
          <!-- Remove -->
          <button
            class="flex-1 h-12 rounded-btn bg-bg-elevated border border-border-subtle text-text-secondary text-[14px] font-medium flex items-center justify-center gap-2 hover:border-red-400/30 transition-colors"
            @click="onDismiss"
          >
            <X :size="16" />
            Remove
          </button>
        </div>

      </div>
    </BottomSheet>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import gsap from 'gsap'  // kept for onStarTap interaction
import { Star, Navigation, X, Globe, MapPin } from 'lucide-vue-next'
import SwipeCard   from '@/components/app/SwipeCard.vue'
import BottomSheet from '@/components/app/BottomSheet.vue'
import TopBar      from '@/components/app/TopBar.vue'
import VenueTag    from '@/components/app/VenueTag.vue'
import DistanceDot from '@/components/app/DistanceDot.vue'
import { useVenuesStore }    from '@/stores/venues.js'
import { usePlanStore }       from '@/stores/plan.js'
import { useFavouritesStore } from '@/stores/favourites.js'

const router    = useRouter()
const store     = useVenuesStore()
const planStore = usePlanStore()
const favStore  = useFavouritesStore()
const sheetRef = ref(null)
const bgCardEl = ref(null)
const dimEl    = ref(null)
const starBtnEl    = ref(null)
const showAllReviews = ref(false)

const venue   = computed(() => store.currentVenue)
const starred = computed(() => favStore.isStarred(venue.value))

const mapsUrl = computed(() => {
  const id = venue.value?.google_place_id
  return id ? `https://www.google.com/maps/search/?api=1&query_place_id=${id}` : null
})

const allReviews = computed(() => venue.value?.reviews ?? [])

const PREVIEW_COUNT = 2
const visibleReviews = computed(() =>
  showAllReviews.value ? allReviews.value : allReviews.value.slice(0, PREVIEW_COUNT)
)
const hiddenReviewCount = computed(() =>
  showAllReviews.value ? 0 : Math.max(0, allReviews.value.length - PREVIEW_COUNT)
)

function formatCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const photoStrips = computed(() => {
  const from = venue.value?.gradient_from || '#2D1B4E'
  const to   = venue.value?.gradient_to   || '#1A0F2E'
  return [
    { id: 1, from, to },
    { id: 2, from: '#1A2D1B', to: '#0F1A10' },
    { id: 3, from: '#1B1A2D', to: '#0F0E1A' },
  ]
})

function onStarTap() {
  if (!venue.value) return
  if (starred.value) {
    favStore.unstarVenue(venue.value.name)
    planStore.removeFromPlan(venue.value.name)
  } else {
    favStore.starVenue(venue.value)
    planStore.addToPlan(venue.value)
  }
  gsap.fromTo(starBtnEl.value, { scale: 1 }, {
    scale: 1.12,
    duration: 0.12,
    ease: 'power2.out',
    yoyo: true,
    repeat: 1,
  })
}

onMounted(() => {
  showAllReviews.value = false

  const sheetEl = sheetRef.value?.sheetEl
  if (sheetEl) {
    sheetEl.style.transition = 'opacity 0.25s ease'
    sheetEl.style.opacity = '0'
    requestAnimationFrame(() => { sheetEl.style.opacity = '1' })
  }

  requestAnimationFrame(() => {
    bgCardEl.value.style.opacity = '0.4'
    dimEl.value.style.opacity    = '1'
  })
})

function onDismiss() {
  const sheetEl = sheetRef.value?.sheetEl
  if (sheetEl) sheetEl.style.opacity = '0'
  bgCardEl.value.style.opacity = '0'
  dimEl.value.style.opacity    = '0'
  setTimeout(() => router.push('/swipe'), 250)
}
</script>

<style scoped>
.fade-overlay { transition: opacity 0.25s ease; }
@keyframes star-pulse {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.15); }
  100% { transform: scale(1); }
}
.star-pulse { animation: star-pulse 0.4s ease; }
.detail-busy {
  display: flex;
  align-items: center;
  gap: 6px;
}
.detail-busy-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-green { background: #7BC67E; }
.dot-muted { background: rgba(255,255,255,0.15); }
.detail-busy-text {
  font-size: 12px;
  color: rgba(255,255,255,0.4);
  font-family: 'DM Sans', sans-serif;
}
</style>
