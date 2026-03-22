import { Router } from 'express'
import { buildItinerary } from '../services/planBuilder.js'

const router = Router()

router.post('/build', async (req, res) => {
  const { venues, intent, vibe } = req.body

  if (!venues?.length) {
    return res.status(400).json({ error: 'No venues provided' })
  }

  try {
    const plan = await buildItinerary(venues, intent ?? 'dinner', vibe ?? null)
    res.json(plan)
  } catch (e) {
    console.error('[plan] build failed:', e.message)
    res.status(500).json({ error: 'Failed to build plan' })
  }
})

export default router
