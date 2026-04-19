export default async function handler(req, res) {
  const { day } = req.query
  const allowed = ['wednesday', 'thursday', 'friday']
  if (!allowed.includes(day)) {
    return res.status(400).json({ error: 'Invalid day' })
  }

  const upstream = await fetch(`https://devoxxfr2026.cfp.dev/api/public/schedules/${day}`)
  const data = await upstream.json()

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600')
  res.json(data)
}
