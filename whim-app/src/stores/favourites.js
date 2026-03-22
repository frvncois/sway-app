import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

function variantFor(label) {
  const map = {
    cozy:         'amber',
    local:        'amber',
    'hidden gem': 'amber',
    chill:        'amber',
    lively:       'blue',
    loud:         'blue',
    trendy:       'blue',
    'late night': 'blue',
    touristy:     'blue',
    underground:  'purple',
    raw:          'purple',
    cheap:        'green',
    quiet:        'green',
    fancy:        'gold',
    romantic:     'gold',
    curated:      'gold',
  }
  return map[label] ?? 'amber'
}

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback)) }
  catch { return fallback }
}

export const useFavouritesStore = defineStore('favourites', () => {

  const favourites   = ref(load('whim_favourites', []))
  const tasteProfile = ref(load('whim_taste', {}))

  const favouriteCount = computed(() => favourites.value.length)

  function starVenue(venue) {
    if (!favourites.value.find(v =>
      v.name === venue.name ||
      v.google_place_id === venue.google_place_id
    )) {
      favourites.value.push({
        ...venue,
        starred_at: new Date().toISOString(),
      })
      localStorage.setItem(
        'whim_favourites',
        JSON.stringify(favourites.value)
      )
      console.log('[star] added:', venue.name)
    }

    // Strengthen taste profile — 2x weight vs swipe right
    venue.tags?.forEach(tag => {
      const label = tag.label ?? tag
      tasteProfile.value[label] = (tasteProfile.value[label] ?? 0) + 2
    })
    localStorage.setItem('whim_taste', JSON.stringify(tasteProfile.value))
  }

  function unstarVenue(venueName) {
    favourites.value = favourites.value.filter(
      v => v.name !== venueName &&
           v.google_place_id !== venueName
    )
    localStorage.setItem(
      'whim_favourites',
      JSON.stringify(favourites.value)
    )
    console.log('[star] removed:', venueName)
  }

  function isStarred(venue) {
    return favourites.value.some(
      v => v.name === venue?.name ||
           v.google_place_id === venue?.google_place_id
    )
  }

  function addVibeWeight(tags) {
    tags?.forEach(tag => {
      const label = tag.label ?? tag
      tasteProfile.value[label] =
        (tasteProfile.value[label] ?? 0) + 1
    })
    localStorage.setItem('whim_taste', JSON.stringify(tasteProfile.value))
  }

  return {
    favourites, tasteProfile, favouriteCount,
    starVenue, unstarVenue, isStarred, addVibeWeight,
  }
})
