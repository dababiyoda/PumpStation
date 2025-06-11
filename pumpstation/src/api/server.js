import express from 'express'
import dotenv from 'dotenv'
import clientPromise from '../lib/db.js'

dotenv.config()

const app = express()
app.use(express.json())

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/users', async (req, res) => {
  const client = await clientPromise
  const db = client.db()
  const users = await db.collection('users').find().toArray()
  res.json(users)
})

const port = process.env.PORT || 4000
app.listen(port, () => console.log(`API running on port ${port}`))
