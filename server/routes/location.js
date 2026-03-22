import { Router } from 'express'
import axios from 'axios'

const router = Router()

router.get('/city', async (req, res) => {
  const { lat, lng } = req.query
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' })

  try {
    const { data } = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        latlng: `${lat},${lng}`,
        key:    process.env.GOOGLE_PLACES_API_KEY,
        result_type: 'locality',
      },
    })

    const components = data.results?.[0]?.address_components ?? []
    const locality   = components.find(c => c.types.includes('locality'))
    const city       = locality?.long_name || 'Nearby'
    res.json({ city })
  } catch (err) {
    console.error('[location] city lookup failed:', err.message)
    res.json({ city: 'Nearby' })
  }
})

export default router
