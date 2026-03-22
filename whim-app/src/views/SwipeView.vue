<template>
  <div class="relative flex flex-col h-full">
    <TopBar :showBack="true" :plan-count="favStore.favouriteCount" />
    <!-- Header -->
    <div class="px-5 pt-12 pb-4">
      <p class="text-[13px] font-medium tracking-widest uppercase text-text-muted">
        {{ intentLabel }} · {{ currentVenue?.neighborhood || store.city || 'Nearby' }}
      </p>
    </div>

    <!-- 1. Initial loading screen -->
    <LoadingScreen
      v-if="isLoading"
      :intent="store.currentIntent"
      :scene="store.scene?.label"
      :neighborhood="store.city"
      :found-venues="foundVenues"
    />

    <!-- 2. Error state -->
    <div v-else-if="store.error" class="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
      <p class="text-[22px] font-display font-light text-text-primary">Couldn't load places</p>
      <p class="text-[14px] text-text-secondary">Check your connection</p>
      <button
        class="mt-4 px-6 py-3 rounded-btn border border-border-subtle text-text-secondary text-[14px] hover:border-amber/30 transition-colors"
        @click="store.loadVenues()"
      >
        Retry
      </button>
    </div>

    <!-- 3. True empty — nothing found at all -->
    <div v-else-if="showEmptyState" class="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
      <p class="text-[22px] font-display font-light text-text-primary">Nothing nearby</p>
      <p class="text-[14px] text-text-secondary">Try a different vibe or expand your radius</p>
      <button
        class="mt-4 px-6 py-3 rounded-btn border border-border-subtle text-text-secondary text-[14px] hover:border-amber/30 transition-colors"
        @click="router.push('/')"
      >
        Try again
      </button>
    </div>

    <!-- 4. Reset screen — session complete -->
    <div v-else-if="showResetScreen" class="flex-1 flex flex-col items-center px-4">
      <div class="relative w-full flex-1 min-h-0 rounded-card bg-bg-elevated border border-border-subtle overflow-hidden flex flex-col items-center justify-center gap-6 px-8 text-center">
        <p class="text-[13px] font-medium tracking-widest uppercase text-text-muted">You've seen it all</p>
        <p class="text-[48px] font-display font-light text-text-primary leading-none">{{ store.sessionPool.length }}</p>
        <p class="text-[14px] text-text-secondary -mt-4">places explored</p>
        <button
          class="mt-2 px-6 py-3 rounded-btn border border-border-subtle text-text-secondary text-[14px] hover:border-border-subtle/80 transition-colors"
          @click="store.resetSession()"
        >
          Start over
        </button>
      </div>
    </div>

    <!-- 5. Between-card loading screen -->
    <LoadingScreen
      v-else-if="isLoadingMore"
      :intent="store.currentIntent"
      :scene="store.scene?.label"
      :neighborhood="store.city"
      :found-venues="foundVenues"
    />

    <!-- 6. Swipe card — highest priority, renders when currentVenue exists -->
    <div v-else-if="currentVenue" class="flex-1 flex flex-col items-center px-4">
      <!-- Best Of label -->
      <p
        v-if="isBestOf"
        class="mb-3 text-[11px] font-medium tracking-widest uppercase text-text-muted text-center"
      >
        Our top picks for you
      </p>

      <div ref="cardWrapEl" class="relative w-full flex-1 min-h-0 fade-card" style="opacity: 0">
        <div
          v-if="store.isEnriching"
          class="absolute top-3 right-3 w-2 h-2 rounded-full bg-amber z-10 animate-pulse"
        />
        <SwipeCard
          :key="currentVenue.id"
          :venue="currentVenue"
          :is-starred-venue="favStore.isStarred(currentVenue)"
          @tap="$router.push('/detail')"
          @swipe-right="onSwipeRight"
          @swipe-left="onSwipeLeft"
        />
      </div>

      <!-- Hint text -->
      <p
        class="mt-5 text-[13px] text-text-muted text-center cursor-pointer hover:text-text-secondary transition-colors"
        @click="$router.push('/detail')"
      >
        tap for details
      </p>

      <!-- Action buttons -->
      <div ref="buttonsEl" class="flex items-center justify-center gap-8 mt-6 fade-card" style="opacity: 0">
        <button
          class="w-14 h-14 rounded-full bg-bg-elevated border border-border-subtle flex items-center justify-center text-text-secondary hover:border-red-400/40 hover:text-red-400 transition-colors"
          @click="onSwipeLeft"
        >
          <X :size="22" />
        </button>
        <button
          class="w-16 h-16 rounded-full bg-amber flex items-center justify-center text-bg-base shadow-lg shadow-amber/20 hover:bg-amber/90 transition-colors"
          @click="onSwipeRight"
        >
          <ArrowRight :size="24" />
        </button>
      </div>
    </div>

    <!-- 7. Nothing — prevents flash between transitions -->

    <!-- Added toast -->
    <AddedToast
      :show="showToast"
      :venue-name="toastedVenue?.name"
      :peak-hour="toastedVenue?.peak_hour ?? null"
      @dismiss="onToastDismiss"
      @switch-intent="onSwitchIntent"
    />

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { X, ArrowRight } from 'lucide-vue-next'
import SwipeCard     from '@/components/app/SwipeCard.vue'
import TopBar        from '@/components/app/TopBar.vue'
import LoadingScreen from '@/components/app/LoadingScreen.vue'
import AddedToast    from '@/components/app/AddedToast.vue'
import { useVenuesStore }    from '@/stores/venues.js'
import { useFavouritesStore } from '@/stores/favourites.js'

const router   = useRouter()
const store    = useVenuesStore()
const favStore = useFavouritesStore()

const cardWrapEl   = ref(null)
const buttonsEl    = ref(null)
const showToast    = ref(false)
const toastedVenue = ref(null)

const currentVenue = computed(() => store.venues[store.currentIndex] ?? null)
const isBestOf     = computed(() => currentVenue.value?.isBestOf === true)

const isLoading = computed(() =>
  store.loading || (store.isEnriching && store.venues.length === 0)
)

const isLoadingMore = computed(() =>
  !currentVenue.value &&
  (store.isEnriching || store.loading) &&
  !showResetScreen.value
)

const showResetScreen = computed(() =>
  !currentVenue.value &&
  !store.loading &&
  !store.isEnriching &&
  store.sessionPool.length > 0 &&
  store.bestOfShown
)

const showEmptyState = computed(() =>
  !currentVenue.value &&
  !store.loading &&
  !store.isEnriching &&
  store.sessionPool.length === 0
)

const INTENT_LABELS = {
  dinner:    'Dinner',
  drinks:    'Drinks',
  late_eats: 'Late Eats',
  party:     'Party',
  shop:      'Shop',
  visit:     'Visit',
}

const intentLabel = computed(() => INTENT_LABELS[store.currentIntent] || 'Discover')

const foundVenues = ref([])

watch(
  () => store.venues,
  (venues) => {
    venues.forEach(v => {
      if (v.name && !foundVenues.value.includes(v.name)) {
        foundVenues.value.push(v.name)
      }
    })
  },
  { deep: true },
)

watch(
  () => store.loading,
  (isLoading) => {
    if (isLoading) foundVenues.value = []
  },
)

function onSwipeRight() {
  const addedVenue = store.currentVenue
  store.swipeRight()
  if (addedVenue) {
    toastedVenue.value = addedVenue
    showToast.value    = true
  }
}

function onSwipeLeft() {
  store.swipeLeft()
}

function onToastDismiss() {
  showToast.value    = false
  toastedVenue.value = null
}

async function onSwitchIntent(intent, scene) {
  showToast.value = false
  store.setIntent(intent)
  store.setScene(scene)
  store.setVibe(scene.label)
  await store.startEnrichment()
}

function animateIn() {
  if (!cardWrapEl.value || !buttonsEl.value) return
  cardWrapEl.value.style.opacity = '1'
  buttonsEl.value.style.opacity  = '1'
}

onMounted(animateIn)

watch(() => store.currentIndex, () => {
  if (cardWrapEl.value) animateIn()
})

watch(
  () => store.venues.length,
  (newLen, oldLen) => {
    if (newLen > oldLen) {
      console.log(`[swipe] ${newLen - oldLen} new cards added`)
      nextTick(() => {
        console.log(`[swipe] current card: ${store.currentVenue?.name ?? 'none'}`)
        if (currentVenue.value) animateIn()
      })
    }
    if (newLen > 0 && oldLen === 0) {
      nextTick(() => animateIn())
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.fade-card { transition: opacity 0.25s ease; }
</style>
