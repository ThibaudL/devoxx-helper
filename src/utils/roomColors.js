// Color coding derived from the Devoxx France floor plan images.
// Neuilly wing (left on maps) = green, Paris wing (right) = orange.
const ROOM_RULES = [
  { match: name => /amphi.*(bleu|blue)/i.test(name) || /bleu/i.test(name), bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd', dot: '#3b82f6' },
  { match: name => /maillot/i.test(name),                                   bg: '#fce7f3', color: '#9d174d', border: '#f9a8d4', dot: '#ec4899' },
  // Neuilly wing: 15x and 25x rooms (including 252 AB, 252AB, etc.)
  { match: name => /\b(15[0-9]|25[0-9])/.test(name),                       bg: '#dcfce7', color: '#15803d', border: '#86efac', dot: '#22c55e' },
  // Paris wing: 14x and 24x rooms (including 242 AB, 242AB, etc.)
  { match: name => /\b(14[0-9]|24[0-9])/.test(name),                       bg: '#fff7ed', color: '#c2410c', border: '#fdba74', dot: '#f97316' },
]

const FALLBACK = { bg: 'var(--surface-subtle)', color: 'var(--text-3)', border: 'var(--border)', dot: 'var(--text-4)' }

export function getRoomColor(roomName) {
  if (!roomName) return FALLBACK
  return ROOM_RULES.find(r => r.match(roomName)) ?? FALLBACK
}
