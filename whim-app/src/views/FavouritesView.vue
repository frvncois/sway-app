<template>
  <div class="fav-view">
    <TopBar :showBack="true" />

    <div class="fav-header">
      <span class="fav-title">Starred places</span>
      <span class="fav-count">{{ store.favourites.length }}</span>
    </div>

    <!-- Empty state -->
    <div v-if="!store.favourites.length" class="fav-empty">
      <p>No starred places yet</p>
      <p class="fav-empty-sub">Star places you love — we'll suggest them again</p>
    </div>

    <!-- Favourites list -->
    <div v-else class="fav-list">
      <TransitionGroup name="fav-item">
        <div
          v-for="venue in sortedFavourites"
          :key="venue.name"
          class="fav-card"
        >
          <!-- Swipe to unstar -->
          <div
            class="fav-card-inner"
            @touchstart="onTouchStart($event, venue.name)"
            @touchmove="onTouchMove($event, venue.name)"
            @touchend="onTouchEnd($event, venue.name)"
            :style="getSwipeStyle(venue.name)"
          >
            <!-- Unstar reveal -->
            <div class="unstar-reveal">
              <span class="unstar-label">Unstar</span>
            </div>

            <!-- Card content -->
            <div class="fav-card-content">

              <!-- Photo -->
              <div class="fav-photo" :style="getPhotoStyle(venue)" />

              <!-- Info -->
              <div class="fav-info">
                <div class="fav-name">{{ venue.name }}</div>
                <div class="fav-meta">
                  <span v-if="venue.neighborhood">{{ venue.neighborhood }}</span>
                  <span v-if="venue.distance_minutes"> · {{ venue.distance_minutes }} min walk</span>
                </div>
                <div class="fav-tags">
                  <span
                    v-for="tag in venue.tags?.slice(0, 2)"
                    :key="tag.label ?? tag"
                    class="fav-tag"
                  >{{ tag.label ?? tag }}</span>
                </div>
                <div class="fav-starred-at">Starred {{ formatStarredAt(venue.starred_at) }}</div>
              </div>

              <!-- Unstar button -->
              <button class="fav-star" @click="store.unstarVenue(venue.name)">★</button>

            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import TopBar from '@/components/app/TopBar.vue'
import { useVenuesStore } from '@/stores/venues'

const store = useVenuesStore()

const sortedFavourites = computed(() =>
  [...store.favourites].sort((a, b) => new Date(b.starred_at) - new Date(a.starred_at))
)

function formatStarredAt(isoStr) {
  if (!isoStr) return ''
  const diff = Date.now() - new Date(isoStr)
  const mins = Math.floor(diff / 60000)
  const hrs  = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60)  return `${mins}m ago`
  if (hrs  < 24)  return `${hrs}h ago`
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

function getPhotoStyle(venue) {
  if (venue.photos?.[0]) {
    return {
      backgroundImage:    `url(${venue.photos[0]})`,
      backgroundSize:     'cover',
      backgroundPosition: 'center',
    }
  }
  return { background: `linear-gradient(135deg, ${venue.gradient_from ?? '#1A1028'} 0%, ${venue.gradient_to ?? '#0E1820'} 100%)` }
}

// Swipe-to-unstar
const swipeState = ref({})

function onTouchStart(e, name) {
  swipeState.value[name] = { startX: e.touches[0].clientX, currentX: e.touches[0].clientX }
}
function onTouchMove(e, name) {
  const s = swipeState.value[name]
  if (!s) return
  const dx = e.touches[0].clientX - s.startX
  if (dx < 0) swipeState.value[name] = { ...s, currentX: e.touches[0].clientX }
}
function onTouchEnd(e, name) {
  const s = swipeState.value[name]
  if (!s) return
  if (s.currentX - s.startX < -80) store.unstarVenue(name)
  delete swipeState.value[name]
}
function getSwipeStyle(name) {
  const s = swipeState.value[name]
  if (!s) return {}
  const dx = Math.min(0, s.currentX - s.startX)
  return { transform: `translateX(${dx}px)`, transition: 'none' }
}
</script>

<style scoped>
.fav-view {
  height: 100%;
  background: #0C0B0A;
  padding: 18px 18px 0;
  overflow-y: auto;
}
.fav-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 20px;
  padding-top: 48px;
}
.fav-title {
  font-family: 'Fraunces', serif;
  font-size: 24px;
  font-weight: 300;
  color: rgba(255,255,255,0.92);
  letter-spacing: -0.02em;
}
.fav-count {
  font-size: 13px;
  color: rgba(255,255,255,0.2);
  font-family: 'DM Sans', sans-serif;
}
.fav-empty {
  text-align: center;
  padding: 60px 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fav-empty p {
  font-size: 14px;
  color: rgba(255,255,255,0.3);
  font-family: 'DM Sans', sans-serif;
  margin: 0;
}
.fav-empty-sub {
  font-size: 12px !important;
  color: rgba(255,255,255,0.15) !important;
}
.fav-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 32px;
}
.fav-card {
  position: relative;
  overflow: hidden;
  border-radius: 16px;
}
.fav-card-inner {
  position: relative;
  will-change: transform;
}
.unstar-reveal {
  position: absolute;
  right: 0; top: 0; bottom: 0;
  width: 80px;
  background: rgba(232,147,90,0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0 16px 16px 0;
  pointer-events: none;
}
.unstar-label {
  font-size: 11px;
  font-weight: 500;
  color: rgba(232,147,90,0.7);
  font-family: 'DM Sans', sans-serif;
}
.fav-card-content {
  display: flex;
  gap: 10px;
  background: rgba(255,255,255,0.04);
  border-radius: 16px;
  padding: 12px;
  border: 1px solid rgba(255,255,255,0.06);
  align-items: center;
}
.fav-photo {
  width: 52px;
  height: 52px;
  border-radius: 10px;
  flex-shrink: 0;
  background: linear-gradient(135deg, #1A1028, #0E1820);
}
.fav-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.fav-name {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255,255,255,0.88);
  font-family: 'DM Sans', sans-serif;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fav-meta {
  font-size: 10px;
  color: rgba(255,255,255,0.25);
  font-family: 'DM Sans', sans-serif;
}
.fav-tags {
  display: flex;
  gap: 4px;
  margin-top: 2px;
}
.fav-tag {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 100px;
  font-size: 9px;
  font-weight: 500;
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.3);
  border: 1px solid rgba(255,255,255,0.08);
  font-family: 'DM Sans', sans-serif;
}
.fav-starred-at {
  font-size: 9px;
  color: rgba(255,255,255,0.15);
  font-family: 'DM Sans', sans-serif;
  margin-top: 2px;
}
.fav-star {
  color: #E8935A;
  font-size: 14px;
  flex-shrink: 0;
  opacity: 0.7;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
}
.fav-item-enter-active { transition: all 0.3s ease; }
.fav-item-enter-from   { opacity: 0; transform: translateX(-8px); }
.fav-item-leave-active { transition: all 0.25s ease; }
.fav-item-leave-to     { opacity: 0; transform: translateX(8px); }
</style>
