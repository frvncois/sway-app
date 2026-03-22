<template>
  <nav class="absolute bottom-0 inset-x-0 bg-bg-elevated border-t border-border-subtle px-2" style="z-index: 50">
    <div class="relative flex items-center justify-around h-16">
      <!-- Sliding amber indicator dot -->
      <div
        class="absolute bottom-2 w-1 h-1 rounded-full bg-amber transition-[left] duration-200 ease-in-out"
        :style="indicatorStyle"
      />

      <RouterLink
        v-for="(tab, i) in tabs"
        :key="tab.to"
        :to="tab.to"
        class="flex flex-col items-center gap-1 px-4 py-2 rounded-btn transition-colors duration-150"
        :class="activeIndex === i ? 'text-amber' : 'text-text-muted hover:text-text-secondary'"
      >
        <component
          :is="tab.icon"
          :size="22"
          :stroke-width="activeIndex === i ? 2 : 1.5"
        />
        <span class="text-[10px] font-medium tracking-wide">{{ tab.label }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Home, Compass, Star, User } from 'lucide-vue-next'

const route = useRoute()

const tabs = [
  { to: '/',           label: 'Home',   icon: Home },
  { to: '/swipe',      label: 'Discover', icon: Compass },
  { to: '/favourites', label: 'Saved',  icon: Star },
  { to: '/profile',    label: 'Profile', icon: User },
]

const activeIndex = computed(() =>
  tabs.findIndex(t => t.to === route.path)
)

// Each tab zone is 25% of the nav width; indicator centers within active zone
const indicatorStyle = computed(() => {
  const i = activeIndex.value < 0 ? 0 : activeIndex.value
  return { left: `calc(${i} * 25% + 12.5% - 2px)` }
})
</script>
