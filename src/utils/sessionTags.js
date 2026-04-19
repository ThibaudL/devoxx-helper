export const LEVEL_STYLE = {
  BEGINNER:     { bg: '#dcfce7', color: '#166534' },
  INTERMEDIATE: { bg: '#fef3c7', color: '#92400e' },
  ADVANCED:     { bg: '#fee2e2', color: '#991b1b' },
}

export function langCode(lang) {
  if (!lang) return null
  return lang.slice(0, 2).toUpperCase()
}
