<template>
  <div
    class="absolute top-0 inset-x-0 flex items-center justify-between px-5"
    style="height: 48px; z-index: 30;"
  >
    <!-- Left: back arrow or spacer -->
    <button
      v-if="showBack"
      class="flex items-center justify-center -ml-1"
      style="color: rgba(255,255,255,0.5);"
      @click="goBack()"
    >
      <ChevronLeft :size="24" :stroke-width="1.5" />
    </button>
    <div v-else />

    <!-- Right: optional icons -->
    <div class="flex items-center gap-4">
      <!-- Favourites star -->
      <div v-if="showStar" class="relative">
        <button
          class="flex items-center justify-center"
          style="color: rgba(255,255,255,0.4);"
          @click="router.push('/favourites')"
        >
          <Star :size="20" :stroke-width="1.5" />
        </button>
        <span
          v-if="planCount > 0"
          class="plan-dot pointer-events-none"
        >{{ planCount >= 2 ? planCount : '' }}</span>
      </div>

      <!-- Profile avatar -->
      <button
        class="flex items-center justify-center rounded-full"
        style="width: 28px; height: 28px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.5); font-size: 11px; font-weight: 500;"
        @click="router.push('/profile')"
      >
        M
      </button>
    </div>
  </div>
</template>

<script setup>
import { useRouter, useRoute } from 'vue-router'
import { ChevronLeft, Star } from 'lucide-vue-next'

defineProps({
  showBack:  { type: Boolean, default: false },
  showStar:  { type: Boolean, default: true  },
  planCount: { type: Number,  default: 0     },
})

const router = useRouter()
const route  = useRoute()

const BACK_ROUTES = {
  '/swipe':      '/',
  '/detail':     '/swipe',
  '/profile':    '/swipe',
  '/favourites': '/swipe',
}

function goBack() {
  router.push(BACK_ROUTES[route.path] ?? '/')
}
</script>

<style scoped>
.plan-dot {
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
}
</style>
