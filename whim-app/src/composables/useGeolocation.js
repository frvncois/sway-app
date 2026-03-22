import { ref } from 'vue'

// Module-level cache — survives navigations within the session
let cachedLat       = null
let cachedLng       = null
let cacheTimestamp  = null
const CACHE_TTL     = 5 * 60 * 1000 // 5 minutes

// Standalone Promise wrapper — safe to import outside of Vue components
export function requestGeolocation() {
  const now = Date.now()
  if (cachedLat && cachedLng && cacheTimestamp && now - cacheTimestamp < CACHE_TTL) {
    return Promise.resolve({ lat: cachedLat, lng: cachedLng })
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        cachedLat      = pos.coords.latitude
        cachedLng      = pos.coords.longitude
        cacheTimestamp = Date.now()
        resolve({ lat: cachedLat, lng: cachedLng })
      },
      err => reject(err),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 },
    )
  })
}

export function useGeolocation() {
  const lat     = ref(cachedLat)
  const lng     = ref(cachedLng)
  const error   = ref(null)
  const loading = ref(false)

  function requestLocation() {
    // Return cached coords if still fresh
    const now = Date.now()
    if (cachedLat && cachedLng && cacheTimestamp && now - cacheTimestamp < CACHE_TTL) {
      lat.value = cachedLat
      lng.value = cachedLng
      return Promise.resolve({ lat: cachedLat, lng: cachedLng })
    }

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        error.value = 'Geolocation not supported'
        reject(new Error(error.value))
        return
      }

      loading.value = true
      error.value   = null

      navigator.geolocation.getCurrentPosition(
        pos => {
          cachedLat      = pos.coords.latitude
          cachedLng      = pos.coords.longitude
          cacheTimestamp = Date.now()
          lat.value      = cachedLat
          lng.value      = cachedLng
          loading.value  = false
          resolve({ lat: cachedLat, lng: cachedLng })
        },
        () => {
          error.value   = 'Location access denied'
          loading.value = false
          reject(new Error(error.value))
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 },
      )
    })
  }

  return { lat, lng, error, loading, requestLocation }
}
