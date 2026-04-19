export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { keywords } = req.body ?? {}
  if (!keywords?.length) return res.status(400).json({ error: 'No keywords provided' })

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: "Tu es un expert RH et tech qui analyse les centres d'intérêt de développeurs. Réponds en français, de façon concise, bienveillante et perspicace.",
        },
        {
          role: 'user',
          content: `Voici les mots-clés des conférences qu'un développeur a mis en favori à Devoxx France 2026 :\n\n${keywords.join(', ')}\n\nEn te basant uniquement sur ces mots-clés, dresse un portrait de ce développeur : son profil probable (rôle, spécialité), ses centres d'intérêt techniques, son niveau d'expertise supposé, et ce qu'il cherche probablement à apprendre ou consolider. Sois direct et utilise des sections courtes.`,
        },
      ],
      max_tokens: 600,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    return res.status(502).json({ error: 'LLM error', detail: err })
  }

  const data = await response.json()
  res.json({ profile: data.choices?.[0]?.message?.content ?? '' })
}
