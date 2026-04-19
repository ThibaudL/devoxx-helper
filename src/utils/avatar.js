export async function computeGravatarUrl(email, size = 32) {
  if (!email) return null
  const clean = email.trim().toLowerCase()
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clean))
  const hash = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=${size}`
}
