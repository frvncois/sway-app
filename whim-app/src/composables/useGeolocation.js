// ── shared module-level cache ──────────────────────────────
const CACHE_TTL = 5 * 60 * 1000  // 5 minutes

const _cache = {
  lat:       null,
  lng:       null,
  timestamp: null,

  isValid() {
    return (
      this.lat !== null &&
      this.lng !== null &&
      this.timestamp !== null &&
      Date.now() - this.timestamp < CACHE_TTL
    )
  },

  set(lat, lng) {
    this.lat       = lat
    this.lng       = lng
    this.timestamp = Date.now()
  },

  clear() {
    this.lat       = null
    this.lng       = null
    this.timestamp = null
  },
}

// ── standalone promise wrapper (safe outside Vue components) ─
export function requestGeolocation() {
  if (_cache.isValid()) {
    return Promise.resolve({ lat: _cache.lat, lng: _cache.lng })
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        _cache.set(pos.coords.latitude, pos.coords.longitude)
        resolve({ lat: _cache.lat, lng: _cache.lng })
      },
      err => reject(err),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 },
    )
  })
}

// ── Vue composable ────────────────────────────────────────────
import { ref } from 'vue'

export function useGeolocation() {
  const lat     = ref(_cache.lat)
  const lng     = ref(_cache.lng)
  const error   = ref(null)
  const loading = ref(false)

  function requestLocation() {
    if (_cache.isValid()) {
      lat.value = _cache.lat
      lng.value = _cache.lng
      return Promise.resolve({ lat: _cache.lat, lng: _cache.lng })
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
          _cache.set(pos.coords.latitude, pos.coords.longitude)
          lat.value     = _cache.lat
          lng.value     = _cache.lng
          loading.value = false
          resolve({ lat: _cache.lat, lng: _cache.lng })
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

  function clearCache() {
    _cache.clear()
    lat.value = null
    lng.value = null
  }

  return { lat, lng, error, loading, requestLocation, clearCache }
}
