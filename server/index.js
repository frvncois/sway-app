import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import venuesRouter   from './routes/venues.js'
import locationRouter from './routes/location.js'
import planRouter     from './routes/plan.js'

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json({ limit: '25mb' }))
app.use(express.urlencoded({ limit: '25mb', extended: true }))

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
app.use('/api/venues',   venuesRouter)
app.use('/api/location', locationRouter)
app.use('/api/plan',     planRouter)

app.listen(PORT, () => console.log(`Whim server running on :${PORT}`))
