// ── gradient buckets ────────────────────────────────────────────────────────

const GRADIENT_BUCKETS = [
  {
    tags: ['cozy', 'local', 'quiet'],
    from: '#2D1B69', to: '#0F2A20',
  },
  {
    tags: ['lively', 'loud', 'trendy'],
    from: '#1A0E2A', to: '#2A0E1A',
  },
  {
    tags: ['fancy', 'romantic', 'curated'],
    from: '#1A1428', to: '#0A1A28',
  },
  {
    tags: ['underground', 'raw', 'hidden gem'],
    from: '#0A1A0A', to: '#1A1428',
  },
]

const DEFAULT_GRADIENT = { from: '#1A1028', to: '#0E1820' }

// ── variant map ─────────────────────────────────────────────────────────────

const VARIANT_MAP = {
  amber:  ['cozy', 'local', 'quiet', 'chill', 'hidden gem', 'romantic'],
  blue:   ['lively', 'trendy', 'loud', 'late night'],
  purple: ['underground', 'raw', 'fancy', 'curated'],
  green:  ['cheap', 'touristy'],
}

function variantFor(tag) {
  for (const [variant, tags] of Object.entries(VARIANT_MAP)) {
    if (tags.includes(tag)) return variant
  }
  return 'amber' // fallback
}

// ── exports ──────────────────────────────────────────────────────────────────

export function gradientForTags(tags = []) {
  for (const bucket of GRADIENT_BUCKETS) {
    if (tags.some(t => bucket.tags.includes(t))) {
      return { gradient_from: bucket.from, gradient_to: bucket.to }
    }
  }
  return { gradient_from: DEFAULT_GRADIENT.from, gradient_to: DEFAULT_GRADIENT.to }
}

export function tagsWithVariants(tags = []) {
  return tags.map(label => ({ label, variant: variantFor(label) }))
}
