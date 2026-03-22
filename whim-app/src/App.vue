<template>
  <div class="flex justify-center items-center min-h-screen bg-white">
    <div class="relative w-full max-w-[390px] aspect-[9/19.5] overflow-hidden bg-bg-base font-ui rounded-[4em] py-12 px-2">
      <RouterView />
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useGeolocation } from '@/composables/useGeolocation.js'
import { useVenuesStore }  from '@/stores/venues.js'
import { fetchCity }       from '@/services/api.js'

const store = useVenuesStore()
const geo   = useGeolocation()

onMounted(async () => {
  try {
    const { lat, lng } = await geo.requestLocation()
    store.setLocation(lat, lng)
    // Fetch city name in background — don't block anything
    fetchCity({ lat, lng }).then(name => store.setCity(name))
  } catch {
    // Location denied — store stays null, views show "Nearby"
  }
})
</script>
