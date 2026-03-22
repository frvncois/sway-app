const BASE = 'http://localhost:3001/api'

export async function fetchVenues({ lat, lng, intent, radius = 1000, vibe = null }) {
  try {
    const params = new URLSearchParams({ lat, lng, intent, radius })
    if (vibe) params.set('vibe', vibe)
    const res    = await fetch(`${BASE}/venues?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const { venues } = await res.json()
    return venues || []
  } catch (err) {
    console.error('[api] fetchVenues failed:', err)
    return []
  }
}

export async function fetchRawVenues({ lat, lng, intent, radius = 5000, vibe, scene, city, round }) {
  try {
    const params = new URLSearchParams({ lat, lng, intent, radius, vibe: vibe ?? 'any', round: round ?? 1 })
    if (scene) params.append('scene', scene)
    if (city)  params.append('city', city)
    const res    = await fetch(`${BASE}/venues/raw?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const { venues } = await res.json()
    return venues || []
  } catch (err) {
    console.error('[api] fetchRawVenues failed:', err)
    return []
  }
}

export async function enrichVenues({ venues, vibe, intent }) {
  try {
    const res = await fetch(`${BASE}/venues/enrich`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ venues, vibe, intent }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const { venues: enriched } = await res.json()
    return enriched || []
  } catch (err) {
    console.error('[api] enrichVenues failed:', err)
    return []
  }
}

export async function buildNightPlan({ venues, intent, vibe }) {
  const res = await fetch(`${BASE}/plan/build`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ venues, intent, vibe }),
  })
  if (!res.ok) throw new Error('Failed to build plan')
  return res.json()
}

export async function fetchCity({ lat, lng }) {
  try {
    const params = new URLSearchParams({ lat, lng })
    const res    = await fetch(`${BASE}/location/city?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const { city } = await res.json()
    return city || 'Nearby'
  } catch (err) {
    console.error('[api] fetchCity failed:', err)
    return 'Nearby'
  }
}
