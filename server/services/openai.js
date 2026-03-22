import axios from 'axios'

const FALLBACK = { tags: ['local'], vibe_reason: 'Worth checking out.' }

function getVibeDescription(vibe) {
  const descriptions = {
    chill:       'relaxed, low-key, easy going. No loud music, no rush. You can have a conversation.',
    lively:      'buzzing, energetic, fun crowd. Music is up. People are out.',
    fancy:       'elevated, refined. Good service, nice setting, worth dressing up for.',
    underground: 'off the beaten path, locals only, not on every tourist list. Raw and authentic.',
    any:         'no strong preference — just good and worth going to.',
  }
  return descriptions[vibe] ?? descriptions.any
}

function buildSystemPrompt(vibe, scene) {
  return `You are a vibe curator for a spontaneous city discovery app.
The user wants somewhere that feels: ${vibe ?? 'any vibe'}.
Specifically they are looking for: ${scene ?? 'any type of venue'}.
Both are important — prioritize venues that match the scene first, then the vibe.

A '${vibe ?? 'any'}' place means:
${getVibeDescription(vibe ?? 'any')}

Given venue data, return ONLY a valid JSON object:
{
  "tags": string[],      // 2-4 tags from the allowed list only
  "vibe_reason": string  // max 12 words, like a friend's tip
}

Allowed tags: [cozy, local, lively, quiet, fancy, cheap, trendy,
underground, late night, touristy, romantic, loud, chill, raw,
curated, hidden gem]

Return only JSON. No markdown. No explanation.`
}

const HALLUCINATION_PATTERNS = [
  // Generic street address names
  /de la rue/i,
  /de la avenue/i,
  // Generic typed names
  /^le café/i,
  /^la boulangerie/i,
  /^la pâtisserie/i,
  /^le bistro$/i,
  /^la brasserie$/i,
  /^le bar$/i,
  /^le restaurant$/i,
  /^la boutique$/i,
  /^la friperie$/i,
  /^le magasin$/i,
  // Numbers/addresses as names
  /^\d+/,
]

function isHallucinated(name) {
  return HALLUCINATION_PATTERNS.some(p => p.test(name))
}

export async function generateVenueNames(intent, vibe, scene, neighborhood, city, round = 1) {
  console.time('GPT_VENUES')
  console.log(`[gpt] generating venue names — intent: ${intent}, scene: ${scene}, vibe: ${vibe}, area: ${neighborhood}, round: ${round}`)

  const roundAngles = {
    1: `Focus on the well-known spots — the classics that locals consistently love and recommend.`,
    2: `Focus on hidden gems and lesser-known spots — places that don't appear on tourist lists but locals swear by. Think smaller, more obscure, off the beaten path.`,
    3: `Focus on newer venues, forgotten spots, or places that fly under the radar — things that opened in the last few years or just don't get enough attention.`,
  }

  const angle = roundAngles[round] ?? roundAngles[1]

  const intentDescriptions = {
    dinner:    'restaurants and places to eat',
    drinks:    'bars, wine bars, brasseries, pubs',
    late_eats: 'restaurants and bars open late',
    party:     'nightclubs, bars with DJs, live music',
    shop:      'stores, boutiques, markets, shops of all kinds',
    visit:     'museums, parks, landmarks, galleries, attractions',
  }
  const intentContext = intentDescriptions[intent] ?? intent

  const systemPrompt = `You are a local expert recommending venues in ${city}.
The user is looking for: ${intentContext}.
Return ONLY a JSON array of real venue names. No markdown. No explanation.
Start with [ and end with ].
CRITICAL: Only suggest venues that match the requested type exactly.
If you don't know enough real venues, return fewer — return 5 real ones rather than 20 with fake ones.
Every venue must actually exist and match the category.`

  const userPrompt = `I'm in ${neighborhood}, ${city}.
I want: ${scene ?? intent}
Vibe: ${vibe ?? 'any'}

${angle}

Return ONLY real venues that match "${scene ?? intent}" exactly.
Do not suggest restaurants, cafes, bars or other venue types unless they specifically match the scene.
Return between 5-20 venues — fewer real ones beats more fake ones.
JSON array only.`

  try {
    const { data } = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    )

    let raw = data.choices?.[0]?.message?.content?.trim()
    raw = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()
    const names    = JSON.parse(raw)
    const filtered = names.filter(name => !isHallucinated(name))
    if (filtered.length < names.length) {
      console.log(`[gpt] filtered ${names.length - filtered.length} hallucinated names`)
    }
    console.log(`[gpt] generated ${filtered.length} venue names:`, filtered)
    console.timeEnd('GPT_VENUES')
    return filtered
  } catch (e) {
    console.log('[gpt] venue name generation failed:', e.message)
    console.timeEnd('GPT_VENUES')
    return []
  }
}

function getVariant(label) {
  const map = {
    cozy: 'amber', local: 'amber', quiet: 'amber', romantic: 'amber',
    'hidden gem': 'amber', chill: 'amber',
    lively: 'blue', loud: 'blue', trendy: 'blue', 'late night': 'blue',
    underground: 'purple', raw: 'purple', fancy: 'purple', curated: 'purple',
    cheap: 'green', touristy: 'green',
  }
  return map[label] ?? 'amber'
}

export async function inferVibeTagsBatch(venues, vibe, scene = null) {
  if (!venues.length) return []

  console.time(`OPENAI_BATCH_${venues.length}`)
  console.log(`[openai] batch inferring ${venues.length} venues`)

  const venueList = venues.map((v, i) => ({
    index:   i,
    name:    v.name,
    type:    v.types?.slice(0, 3).join(', ') ?? '',
    price:   v.price_level ?? null,
    rating:  v.rating ?? null,
    summary: (v.editorial_summary?.overview ?? v.editorial_summary ?? '').slice(0, 150),
    reviews: (v.reviews ?? []).slice(0, 1).map(r => r.text?.slice(0, 100)).join(' '),
  }))

  const systemPrompt = `You are a vibe curator for a city discovery app.
The user wants: ${scene ?? vibe ?? 'a good place'} with a ${vibe ?? 'any'} vibe.
For each venue, return vibe tags and a short reason.
Return ONLY a valid JSON array. No markdown. No explanation.
Start with [ and end with ]`

  const userPrompt = `Rate these ${venues.length} venues:
${JSON.stringify(venueList)}

Return a JSON array with one object per venue, in the same order:
[
  {
    "index": 0,
    "tags": ["tag1", "tag2"],
    "vibe_reason": "Short tip under 12 words"
  }
]

Allowed tags only: cozy, local, lively, quiet, fancy, cheap, trendy,
underground, late night, touristy, romantic, loud, chill, raw,
curated, hidden gem

Each venue gets 2-3 tags max.`

  try {
    const { data } = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model:       'gpt-4o-mini',
        max_tokens:  600,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
        ],
      },
      {
        headers: {
          Authorization:  `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    )

    let raw = data.choices?.[0]?.message?.content?.trim() ?? ''
    raw = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    const results = JSON.parse(raw)
    console.timeEnd(`OPENAI_BATCH_${venues.length}`)

    return venues.map((venue, i) => {
      const result = results.find(r => r.index === i) ?? {}
      return {
        ...venue,
        tags:        (result.tags ?? ['local']).map(label => ({ label, variant: getVariant(label) })),
        vibe_reason: result.vibe_reason ?? 'Worth checking out.',
      }
    })
  } catch (e) {
    console.log('[openai] batch inference failed:', e.message)
    return venues.map(venue => ({
      ...venue,
      tags:        [{ label: 'local', variant: 'amber' }],
      vibe_reason: 'Worth checking out.',
    }))
  }
}

export async function inferVibeTags(venueData, vibe, scene = null) {
  const trimmed = {
    name:        venueData.name,
    type:        venueData.type,
    price_level: venueData.price_level,
    summary:     venueData.editorial_summary?.slice(0, 200) ?? '',
    reviews:     venueData.reviews
                   ?.slice(0, 2)
                   .map(r => r.text?.slice(0, 150)) ?? [],
  }

  console.time(`OPENAI_${venueData.name}`)
  console.log(`[openai] inferring vibe for "${venueData.name}"...`)
  try {
    const { data } = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: buildSystemPrompt(vibe, scene) },
          { role: 'user',   content: JSON.stringify(trimmed) },
        ],
        temperature: 0.7,
        max_tokens: 120,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    )

    let raw = data.choices?.[0]?.message?.content?.trim()
    if (!raw) return FALLBACK
    raw = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed.tags) || !parsed.vibe_reason) {
      console.timeEnd(`OPENAI_${venueData.name}`)
      return FALLBACK
    }
    console.log(`[openai] "${venueData.name}" → tags: [${parsed.tags.join(', ')}]`)
    console.timeEnd(`OPENAI_${venueData.name}`)
    return parsed
  } catch (err) {
    console.error('[openai] inference failed:', err.message)
    console.timeEnd(`OPENAI_${venueData.name}`)
    return FALLBACK
  }
}

// ── plan builder ──────────────────────────────────────────────────────────────

function formatMins(totalMins) {
  let h = Math.floor(totalMins / 60) % 24
  let m = totalMins % 60
  const period = h >= 12 ? 'PM' : 'AM'
  if (h > 12) h -= 12
  if (h === 0) h = 12
  return `${h}:${m.toString().padStart(2, '0')} ${period}`
}

function getDayName(d) {
  return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d]
}

export function sequencePlan(venues, currentTimeStr) {
  const [h, m]  = currentTimeStr.split(':').map(Number)
  const nowMins = h * 60 + m

  const today      = new Date()
  const dayIdx     = today.getDay()
  const isWeekend  = dayIdx === 0 || dayIdx === 6
  const isFriday   = dayIdx === 5
  const isWeeknight = !isWeekend && !isFriday

  console.log(`[plan] ${getDayName(dayIdx)} plan — weekend: ${isWeekend}, friday: ${isFriday}, weeknight: ${isWeeknight}`)

  function getVenueCategory(venue) {
    const types = venue.types ?? []
    const tags  = venue.tags?.map(t => t.label ?? t) ?? []

    if (types.some(t => ['store', 'clothing_store', 'book_store',
      'art_gallery', 'museum', 'park', 'tourist_attraction'].includes(t)))
      return 'daytime'

    if (types.some(t => ['restaurant', 'cafe', 'bakery'].includes(t)))
      return 'dinner'

    if (types.some(t => ['bar'].includes(t)))
      return 'drinks'

    if (types.some(t => ['night_club'].includes(t)))
      return 'club'

    if (tags.some(t => ['late night', 'lively', 'loud'].includes(t)))
      return 'drinks'
    if (tags.some(t => ['cozy', 'quiet', 'curated'].includes(t)))
      return 'daytime'

    return 'drinks'
  }

  function parseOpenUntil(openUntil) {
    if (!openUntil) return 24 * 60
    const clean = openUntil.toString().replace(/[^\d:]/g, '')
    const parts = clean.split(':')
    if (parts.length < 2) return 24 * 60
    let hh = parseInt(parts[0])
    let mm  = parseInt(parts[1]) || 0
    if (hh < 6) hh += 24
    return hh * 60 + mm
  }

  function getIdealStartMins(venue) {
    const peakHour = venue.peak_hour ?? null
    const category = venue.category

    if (peakHour !== null && peakHour !== undefined) {
      return Math.max(peakHour * 60 - 30, nowMins)
    }

    // Day-aware fallback windows
    const WINDOWS = {
      daytime: { default: 13 * 60, weekend:   12 * 60 },
      dinner:  { default: 19 * 60, weekend:   20 * 60, weeknight: 18 * 60 },
      drinks:  { default: 21 * 60, weekend:   22 * 60, friday:    21 * 60, weeknight: 20 * 60 },
      club:    { default: 23 * 60, weekend:   24 * 60, friday:    23 * 60, weeknight: 22 * 60 },
    }

    const w = WINDOWS[category] ?? WINDOWS.drinks
    let ideal = w.default
    if (isWeekend   && w.weekend)   ideal = w.weekend
    if (isFriday    && w.friday)    ideal = w.friday
    if (isWeeknight && w.weeknight) ideal = w.weeknight

    return Math.max(ideal, nowMins)
  }

  const DURATIONS = {
    daytime: 60,
    dinner:  isWeekend ? 90 : 75,
    drinks:  isWeekend ? 75 : 60,
    club:    isWeekend ? 150 : 90,
  }

  const categorized = venues.map(v => ({
    ...v,
    category:      getVenueCategory(v),
    closeMinsReal: v.close_time_mins ?? parseOpenUntil(v.open_until),
    openTodayReal: v.open_today ?? true,
  }))

  const sorted = [...categorized].sort(
    (a, b) => getIdealStartMins(a) - getIdealStartMins(b)
  )

  let cursor = nowMins
  const stops = []

  for (const venue of sorted) {
    // HARD BLOCK — never schedule closed venues
    if (venue.open_today === false || venue.openTodayReal === false) {
      console.log(`[plan] BLOCKED: ${venue.name} closed on ${getDayName(dayIdx)}`)
      stops.push({
        ...venue,
        startMins:  getIdealStartMins(venue),
        skipped:    true,
        skipReason: `Closed on ${getDayName(dayIdx)}s`,
      })
      continue
    }

    const idealStart = getIdealStartMins(venue)
    const duration   = DURATIONS[venue.category] ?? 60
    let startMins    = Math.max(idealStart, cursor)

    // Not open yet
    if (venue.open_time_mins && startMins < venue.open_time_mins) {
      startMins = Math.max(venue.open_time_mins, cursor)
      const oh = Math.floor(venue.open_time_mins / 60)
      const om = String(venue.open_time_mins % 60).padStart(2, '0')
      console.log(`[plan] ${venue.name} not open until ${oh}:${om}`)
    }

    // Closes too soon — must be open for at least 45 min
    if (venue.closeMinsReal && startMins + 45 > venue.closeMinsReal) {
      console.log(`[plan] BLOCKED: ${venue.name} closes too soon (${formatMins(venue.closeMinsReal)})`)
      stops.push({
        ...venue,
        startMins,
        skipped:    true,
        skipReason: `Closes too early`,
      })
      continue
    }

    // Weeknight club warning
    const weeknight_warning = venue.category === 'club' && isWeeknight
    if (weeknight_warning) {
      console.log(`[plan] weeknight club warning: ${venue.name}`)
    }

    stops.push({ ...venue, startMins, skipped: false, weeknight_warning })
    cursor = startMins + duration
  }

  return stops
}

export async function buildPlan(venues, intent, vibe) {
  console.time('BUILD_PLAN')
  console.log(`[plan] building for ${venues.length} venues`)

  const now     = new Date()
  const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`

  const sequenced = sequencePlan(venues, timeStr)
  console.log('[plan] sequenced:',
    sequenced.map(s => `${formatMins(s.startMins)} ${s.name}${s.skipped ? ' (SKIP)' : ''}`)
  )

  const dayName   = getDayName(new Date().getDay())
  const isWeekend = [0, 6].includes(new Date().getDay())
  const isFriday  = new Date().getDay() === 5

  const systemPrompt = `You are writing short punchy descriptions for a night-out plan on ${dayName}.
${isWeekend ? 'It is the weekend — energy is high, people stay out late.' : ''}
${isFriday  ? 'It is Friday — good energy, most places will be busy.' : ''}
${!isWeekend && !isFriday ? 'It is a weeknight — some places may be quieter than usual.' : ''}

Timing and order are decided by code. Your job is ONLY:
1. One-line description per stop (max 12 words, friend tip style)
2. Mention peak timing naturally when peak_hour is real data (peak_estimated is false)
3. If weeknight_warning is true, mention it might be quieter
4. If today_busy_text is set, you may weave one detail from it into the description naturally
5. If skipped is true, write why briefly (1 short phrase)
6. One-sentence summary (max 20 words, match the day energy)
Return ONLY valid JSON. No markdown.`

  const userPrompt = JSON.stringify({
    intent,
    vibe,
    day: dayName,
    stops: sequenced.map(s => ({
      name:              s.name,
      time:              formatMins(s.startMins),
      category:          s.category,
      tags:              s.tags?.map(t => t.label ?? t).slice(0, 3) ?? [],
      peak_hour:         s.peak_hour ?? null,
      peak_description:  s.peak_description ?? null,
      peak_estimated:    s.peak_estimated ?? false,
      open_today:        s.openTodayReal ?? true,
      weeknight_warning: s.weeknight_warning ?? false,
      today_busy_text:   s.today_busy_text ?? null,
      skipped:           s.skipped,
      skip_reason:       s.skipReason ?? null,
      day_name:          getDayName(new Date().getDay()),
    })),
  })

  const schema = {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      stops: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name:        { type: 'string' },
            description: { type: 'string' },
            transition:  { type: 'string'  },
          },
          required: ['name', 'description', 'transition'],
          // transition is "" when no walking note needed
          additionalProperties: false,
        },
      },
    },
    required: ['summary', 'stops'],
    additionalProperties: false,
  }

  try {
    const { data } = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model:       'gpt-4o-mini',
        temperature: 0.5,
        max_tokens:  600,
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'plan_copy', strict: true, schema },
        },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
      },
      {
        headers: {
          Authorization:  `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    )

    const copy = JSON.parse(data.choices[0].message.content)

    const finalStops = sequenced.map(s => {
      const gptStop = copy.stops.find(c =>
        c.name.toLowerCase().includes(s.name.toLowerCase()) ||
        s.name.toLowerCase().includes(c.name.toLowerCase())
      )

      return {
        name:             s.name,
        time:             formatMins(s.startMins),
        category:         s.category,
        description:      s.skipped
          ? `Might be closed — ${s.skipReason}`
          : (gptStop?.description ?? s.vibe_reason ?? ''),
        transition:       (gptStop?.transition || null) ?? (
          s.distance_minutes ? `${s.distance_minutes} min walk` : null
        ),
        skipped:          s.skipped,
        tags:             s.tags,
        distance_minutes: s.distance_minutes,
      }
    })

    const plan = {
      summary:  copy.summary,
      stops:    finalStops,
      built_at: timeStr,
    }

    console.log('[plan] final stops:', finalStops.map(s => `${s.time} ${s.name}`))
    console.timeEnd('BUILD_PLAN')
    return plan

  } catch (e) {
    console.log('[plan] GPT copy failed — using fallback descriptions:', e.message)
    console.timeEnd('BUILD_PLAN')

    return {
      summary: `Your ${intent} plan for tonight.`,
      stops: sequenced.map(s => ({
        name:             s.name,
        time:             formatMins(s.startMins),
        category:         s.category,
        description:      s.skipped
          ? `Might be closed — ${s.skipReason}`
          : (s.vibe_reason ?? ''),
        transition:       s.distance_minutes ? `${s.distance_minutes} min walk` : null,
        skipped:          s.skipped,
        tags:             s.tags,
        distance_minutes: s.distance_minutes,
      })),
    }
  }
}
