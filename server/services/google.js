import axios from 'axios'

const BASE = 'https://maps.googleapis.com/maps/api/place'
const KEY  = () => process.env.GOOGLE_PLACES_API_KEY

function getDayName(d) {
  return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d]
}

// Maps Google's weekdayDescriptions busy phrases to a 0–1 score
function parseBusyLevel(text) {
  if (!text) return null
  const t = text.toLowerCase()
  if (t.includes('very busy'))     return 0.95
  if (t.includes('usually busy'))  return 0.75
  if (t.includes('a little busy')) return 0.50
  if (t.includes('not too busy'))  return 0.30
  if (t.includes('not busy'))      return 0.10
  return null
}

function extractPeakHour(text) {
  if (!text) return null
  const matches = text.match(/(\d+)\s*(AM|PM)/gi)
  if (!matches?.length) return null
  const last = matches[matches.length - 1]
  const m    = last.match(/(\d+)\s*(AM|PM)/i)
  if (!m) return null
  let ph = parseInt(m[1])
  if (m[2].toUpperCase() === 'PM' && ph !== 12) ph += 12
  if (m[2].toUpperCase() === 'AM' && ph === 12) ph = 0
  return ph
}

function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R    = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function estimatePeakHour(types) {
  if (types.some(t => ['night_club'].includes(t)))
    return { hour: 23, description: 'Usually peaks around 11 PM' }
  if (types.some(t => ['bar'].includes(t)))
    return { hour: 21, description: 'Usually peaks around 9 PM' }
  if (types.some(t => ['restaurant'].includes(t)))
    return { hour: 19, description: 'Usually peaks around 7 PM' }
  if (types.some(t => ['cafe'].includes(t)))
    return { hour: 10, description: 'Usually peaks around 10 AM' }
  if (types.some(t => ['store', 'clothing_store', 'art_gallery', 'museum'].includes(t)))
    return { hour: 14, description: 'Usually peaks around 2 PM' }
  return { hour: 20, description: 'Usually peaks in the evening' }
}

async function getPopularTimes(placeId) {
  try {
    const now        = new Date()
    const todayIndex = now.getDay()  // 0=Sun

    const response = await axios.get(
      `https://places.googleapis.com/v1/places/${placeId}`,
      {
        headers: {
          'X-Goog-Api-Key':   process.env.GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'currentOpeningHours,regularOpeningHours',
        },
      },
    )

    const descriptions =
      response.data.currentOpeningHours?.weekdayDescriptions ??
      response.data.regularOpeningHours?.weekdayDescriptions ?? []

    // Google: [0]=Mon … [5]=Sat [6]=Sun  →  JS: 0=Sun 1=Mon … 6=Sat
    const googleIdx = jsDay => (jsDay === 0 ? 6 : jsDay - 1)

    // Build busy scores for all 7 JS days (index 0–6)
    const allDaysBusy = Array.from({ length: 7 }, (_, jsDay) => ({
      day:  getDayName(jsDay),
      busy: parseBusyLevel(descriptions[googleIdx(jsDay)]),
      text: descriptions[googleIdx(jsDay)] ?? '',
    }))

    const todayText      = allDaysBusy[todayIndex].text
    const todayBusyLevel = allDaysBusy[todayIndex].busy
    const peakHour       = extractPeakHour(todayText)

    // Weekend = Fri(5) + Sat(6) + Sun(0), Weeknight = Mon–Thu(1–4)
    const avg = arr => {
      const vals = arr.filter(v => v != null)
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    }
    const weekendAvg  = avg([0, 5, 6].map(d => allDaysBusy[d].busy))
    const weeknightAvg = avg([1, 2, 3, 4].map(d => allDaysBusy[d].busy))

    const isWeekendVenue   = weekendAvg != null && weeknightAvg != null && weekendAvg > weeknightAvg + 0.2
    const isWeekdayVenue   = weekendAvg != null && weeknightAvg != null && weeknightAvg > weekendAvg + 0.2
    const isConsistentVenue = !isWeekendVenue && !isWeekdayVenue

    const isWeekend   = todayIndex === 0 || todayIndex === 6
    const isFriday    = todayIndex === 5
    const isWeeknight = !isWeekend && !isFriday

    console.log(`[popular] ${getDayName(todayIndex)}: busy=${todayBusyLevel}, peak=${peakHour}, wkendAvg=${weekendAvg?.toFixed(2)}, wkntAvg=${weeknightAvg?.toFixed(2)}`)

    return {
      peakHour,
      todayText,
      todayBusyLevel,
      weekendAvg,
      weeknightAvg,
      allDaysBusy,
      isWeekendVenue,
      isWeekdayVenue,
      isConsistentVenue,
      isWeekend,
      isFriday,
      isWeeknight,
      dayName: getDayName(todayIndex),
    }
  } catch (e) {
    console.log(`[popular] failed for ${placeId}:`, e.message)
    return null
  }
}

function extractPeakHours(result) {
  const types = result.types ?? []
  if (types.some(t => ['night_club', 'bar'].includes(t)))
    return { peak_start: 22, peak_end: 2,  description: 'peaks late night' }
  if (types.includes('restaurant'))
    return { peak_start: 19, peak_end: 21, description: 'peaks at dinner time' }
  if (types.includes('cafe'))
    return { peak_start: 9,  peak_end: 11, description: 'peaks in the morning' }
  if (types.some(t => ['store', 'clothing_store', 'book_store'].includes(t)))
    return { peak_start: 13, peak_end: 17, description: 'peaks in the afternoon' }
  if (types.some(t => ['museum', 'art_gallery'].includes(t)))
    return { peak_start: 14, peak_end: 16, description: 'peaks in the afternoon' }
  return null
}

function getCurrentBusyLevel(result) {
  const hour = new Date().getHours()
  const peak = extractPeakHours(result)
  if (!peak) return null

  // Handle late-night wrap-around (e.g. peak_end: 2 means 2am)
  const inPeak = peak.peak_end < peak.peak_start
    ? (hour >= peak.peak_start || hour <= peak.peak_end)
    : (hour >= peak.peak_start && hour <= peak.peak_end)

  return {
    level:       inPeak ? 'busy' : 'quiet',
    description: inPeak
      ? `Good time to go · ${peak.description}`
      : `Usually quieter now · ${peak.description}`,
    peak_start:  peak.peak_start,
    peak_end:    peak.peak_end,
  }
}

export async function getPlaceDetails(placeId, userLat, userLng) {
  const fields = [
    'geometry',
    'name',
    'place_id',
    'types',
    'editorial_summary',
    'reviews',
    'opening_hours',
    'current_opening_hours',
    'price_level',
    'formatted_address',
    'photos',
    'rating',
    'user_ratings_total',
    'website',
  ].join(',')

  const [detailsRes, popularData] = await Promise.all([
    axios.get(`${BASE}/details/json`, {
      params: { place_id: placeId, fields, key: KEY() },
    }),
    getPopularTimes(placeId),
  ])

  const result = detailsRes.data.result || {}

  if (userLat != null && userLng != null) {
    const venueLat = result.geometry?.location?.lat
    const venueLng = result.geometry?.location?.lng
    if (venueLat && venueLng) {
      result.distance_meters  = Math.round(getDistanceMeters(userLat, userLng, venueLat, venueLng))
      result.distance_minutes = Math.round(result.distance_meters / 80)
    }
  }

  result.peak_hours   = extractPeakHours(result)
  result.current_busy = getCurrentBusyLevel(result)

  // Real peak hour from Places API v1, fallback to type-based estimate
  if (popularData?.peakHour !== null && popularData?.peakHour !== undefined) {
    result.peak_hour         = popularData.peakHour
    result.peak_description  = popularData.todayText
    result.peak_estimated    = false
    console.log(`[venue] ${result.name} peaks at ${popularData.peakHour}:00`)
  } else {
    const estimated          = estimatePeakHour(result.types ?? [])
    result.peak_hour         = estimated.hour
    result.peak_description  = estimated.description
    result.peak_estimated    = true
  }

  // ── Day-specific opening hours (periods = primary source) ──────────────────
  const now         = new Date()
  const todayJSDay  = now.getDay()   // 0=Sun … 6=Sat
  const nowMins     = now.getHours() * 60 + now.getMinutes()
  const periods     = result.opening_hours?.periods ?? []

  // 24/7 special case: single period, opens Sunday (day 0), never closes
  const is24h = periods.length === 1 &&
    periods[0].open?.day === 0 &&
    !periods[0].close

  let openTodayAtAll = is24h
  let todayOpenTime  = is24h ? 0        : null
  let todayCloseTime = is24h ? 24 * 60  : null

  if (!is24h && periods.length > 0) {
    const todayPeriods = periods.filter(p => p.open?.day === todayJSDay)

    if (todayPeriods.length > 0) {
      openTodayAtAll = true
      const period   = todayPeriods[0]

      if (period.open?.time) {
        const oh = parseInt(period.open.time.slice(0, 2))
        const om = parseInt(period.open.time.slice(2, 4))
        todayOpenTime = oh * 60 + om
      }
      if (period.close?.time) {
        let ch = parseInt(period.close.time.slice(0, 2))
        const cm = parseInt(period.close.time.slice(2, 4))
        if (ch < 6) ch += 24  // closing after midnight
        todayCloseTime = ch * 60 + cm
      }
    } else {
      openTodayAtAll = false
      console.log(`[hours] ${result.name} — no period for day ${todayJSDay} (${getDayName(todayJSDay)}) → CLOSED`)
    }
  }

  // Secondary confirmation: if open_now is explicitly false past 10am
  // and we already passed close_time, trust it
  const openNow = result.opening_hours?.open_now ?? null
  if (openNow === false && nowMins > 10 * 60 && openTodayAtAll && todayCloseTime && nowMins > todayCloseTime) {
    console.log(`[hours] ${result.name} — past close time, confirming closed`)
    openTodayAtAll = false
  }

  result.open_today      = openTodayAtAll
  result.open_time_mins  = todayOpenTime
  result.close_time_mins = todayCloseTime
  result.day_of_week     = todayJSDay

  const ohH = todayOpenTime  !== null ? `${Math.floor(todayOpenTime/60)}:${String(todayOpenTime%60).padStart(2,'0')}` : '?'
  const chH = todayCloseTime !== null ? `${Math.floor(todayCloseTime/60)}:${String(todayCloseTime%60).padStart(2,'0')}` : '?'
  console.log(`[hours] ${result.name}: day=${getDayName(todayJSDay)} ${openTodayAtAll ? `open ${ohH} → ${chH}` : 'CLOSED TODAY'}`)

  // Day context from popular times
  const today = new Date()
  const di    = today.getDay()
  result.is_weekend   = popularData?.isWeekend   ?? (di === 0 || di === 6)
  result.is_friday    = popularData?.isFriday    ?? (di === 5)
  result.is_weeknight = popularData?.isWeeknight ?? (di !== 0 && di !== 5 && di !== 6)
  result.day_name     = popularData?.dayName     ?? getDayName(di)

  // Busy level data
  result.today_busy_level    = popularData?.todayBusyLevel    ?? null
  result.today_busy_text     = popularData?.todayText         ?? null
  result.weekend_avg_busy    = popularData?.weekendAvg        ?? null
  result.weeknight_avg_busy  = popularData?.weeknightAvg      ?? null
  result.is_weekend_venue    = popularData?.isWeekendVenue    ?? false
  result.is_weekday_venue    = popularData?.isWeekdayVenue    ?? false
  result.is_consistent_venue = popularData?.isConsistentVenue ?? true

  return result
}

export async function searchByName(name, lat, lng, radius) {
  const label = `GOOGLE_NAME_${Date.now()}`
  console.time(label)
  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/textsearch/json',
      {
        params: {
          query:    `${name} Montreal`,
          location: `${lat},${lng}`,
          radius,
          key: KEY(),
        },
      },
    )
    console.timeEnd(label)
    const results = response.data.results ?? []
    console.log(`[google] name "${name}" → ${results.length} results`)
    return results.slice(0, 1) // top match only
  } catch (e) {
    console.log(`[google] name search failed for "${name}":`, e.message)
    console.timeEnd(label)
    return []
  }
}

export async function searchByQuery(query, lat, lng, radius) {
  const allResults = []
  let pagetoken = null
  let pages     = 0

  do {
    const params = { query, location: `${lat},${lng}`, radius, key: KEY() }
    if (pagetoken) {
      params.pagetoken = pagetoken
      await new Promise(r => setTimeout(r, 200))
    }

    const label = `GOOGLE_TEXT_${Date.now()}`
    console.time(label)
    try {
      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/place/textsearch/json',
        { params },
      )
      console.timeEnd(label)
      const results = response.data.results ?? []
      allResults.push(...results)
      pagetoken = response.data.next_page_token ?? null
      pages++
      console.log(`[google] "${query}" page ${pages} → ${results.length} results`)
    } catch (e) {
      console.log(`[google] text search failed for "${query}":`, e.message)
      console.timeEnd(label)
      break
    }
  } while (pagetoken && pages < 2)

  return allResults
}

// Returns raw Nearby Search results (no Place Details — caller handles that).
// Paginates up to maxPages × 20 results.
export async function getNearbyVenues(lat, lng, type, radius = 1000, keyword = null) {
  const allResults = []
  let pagetoken = null
  let page      = 0
  const maxPages = 3

  do {
    const params = {
      location: `${lat},${lng}`,
      radius,
      key: KEY(),
    }
    if (type)      params.type      = type
    if (keyword)   params.keyword   = keyword
    if (pagetoken) params.pagetoken = pagetoken

    // Google requires a short delay before using a pagetoken
    if (pagetoken) await new Promise(r => setTimeout(r, 200))

    const label = `GOOGLE_NEARBY_${Date.now()}`
    console.time(label)
    const response = await axios.get(`${BASE}/nearbysearch/json`, { params })
    console.timeEnd(label)

    const results = response.data.results ?? []
    allResults.push(...results)
    pagetoken = response.data.next_page_token ?? null
    page++

    console.log(`[google] page ${page}: ${results.length} results (total so far: ${allResults.length})`)
  } while (pagetoken && page < maxPages)

  return allResults
}
