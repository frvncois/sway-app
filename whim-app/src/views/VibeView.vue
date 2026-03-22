<template>
  <div ref="rootEl" class="relative flex flex-col h-full overflow-y-auto fade-page" style="opacity: 0">
    <TopBar :showBack="true" />
    <!-- Header -->
    <div class="px-5 pt-12 pb-6">
      <p class="text-[13px] font-medium tracking-widest uppercase text-text-muted mb-1">Almost there</p>
      <h1 class="text-[32px] font-display font-light text-text-primary leading-tight">
        What's your<br>
        <span class="italic text-amber">vibe</span>?
      </h1>
    </div>

    <!-- Scene chips grid -->
    <div class="px-4 grid grid-cols-2 gap-3">
      <div
        v-for="scene in scenes"
        :key="scene.label"
        :class="[store.vibe === scene.label ? ringClass[scene.color] : '', 'rounded-card']"
      >
        <IntentCard
          :label="scene.label"
          :icon="SCENE_ICONS[scene.label]"
          :color="scene.color"
          @click="onChipClick(scene)"
        />
      </div>
    </div>

    <div class="h-4" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  UtensilsCrossed, Soup, ChefHat, Crown, Flame, Fish, Leaf, Moon, Coffee,
  Globe, Sparkles, Wine, Beer, GlassWater, Music, Music2, Tv, Building2,
  ShoppingBag, Shirt, BookOpen, Palette, Disc3, Package, Scissors, Tag,
  Gem, BookMarked, Utensils, Headphones, Mic, Mic2, Smile, Zap,
} from 'lucide-vue-next'
import IntentCard from '@/components/app/IntentCard.vue'
import TopBar     from '@/components/app/TopBar.vue'
import { useVenuesStore } from '@/stores/venues.js'
import { SCENES } from '@/data/scenes.js'

const router = useRouter()
const store  = useVenuesStore()

const rootEl = ref(null)

const SCENE_ICONS = {
  // Dinner
  'Bistro':      UtensilsCrossed,
  'Ramen':       Soup,
  'Pizza':       ChefHat,
  'Fine dining': Crown,
  'Smoked meat': Flame,
  'Sushi':       Fish,
  'Vegan':       Leaf,
  'Late night':  Moon,
  'Brunch':      Coffee,
  'Peruvian':    Globe,
  'Greek':       Globe,
  'Thai':        Sparkles,
  // Drinks
  'Wine bar':      Wine,
  'Brewpub':       Beer,
  'Dive bar':      GlassWater,
  'Cocktail bar':  GlassWater,
  'Rock bar':      Music2,
  'Jazz bar':      Music,
  'Buvette':       Wine,
  'Sports bar':    Tv,
  'Rooftop':       Building2,
  'Sake bar':      Wine,
  'Irish pub':     Beer,
  'Depanneur bar': ShoppingBag,
  // Shop
  'Vintage':        Shirt,
  'Record store':   Disc3,
  'Bookshop':       BookOpen,
  'Local designer': Scissors,
  'Concept store':  Sparkles,
  'Market':         ShoppingBag,
  'Antiques':       Package,
  'Comics':         BookMarked,
  'Ceramics':       Gem,
  'Plant shop':     Leaf,
  'Sneakers':       Tag,
  'Jewelry':        Gem,
  // Visit
  'Museum':           Building2,
  'Art gallery':      Palette,
  'Park':             Leaf,
  'Landmark':         Globe,
  'Beach':            GlassWater,
  'Botanical garden': Leaf,
  'Architecture':     Building2,
  'Street art':       Palette,
  'Historic site':    Globe,
  'Viewpoint':        Globe,
  'Cemetery':         BookMarked,
  'Sports venue':     Zap,
  // Late eats
  'Poutine':    Flame,
  'Shawarma':   Utensils,
  'Diner':      Coffee,
  'Bar snacks': Beer,
  'Burgers':    ChefHat,
  'Tacos':      Utensils,
  // Party
  'Techno':     Headphones,
  'Rave':       Zap,
  'Live music': Music2,
  'Hip hop':    Mic,
  'Jazz club':  Music,
  'Karaoke':    Mic2,
  'DJ bar':     Headphones,
  'Salsa':      Music2,
  'Comedy':     Smile,
  'Drag show':  Sparkles,
  'Punk bar':   Music,
  'Indie':      Music2,
}

const scenes = computed(() => SCENES[store.currentIntent] ?? [])

const ringClass = {
  amber:  'ring-1 ring-amber/40',
  blue:   'ring-1 ring-blue/40',
  purple: 'ring-1 ring-purple/40',
  green:  'ring-1 ring-green/40',
}

function onChipClick(scene) {
  store.setVibe(scene.label)
  store.setScene(scene)
  store.startEnrichment()
  router.push('/swipe')
}

onMounted(() => {
  requestAnimationFrame(() => {
    rootEl.value.style.opacity = '1'
  })
})
</script>

<style scoped>
.fade-page { transition: opacity 0.25s ease; }
</style>
