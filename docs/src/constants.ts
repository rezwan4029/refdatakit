export const FLAGS: Record<string, string> = {
  BD: '🇧🇩',
}

export const TAG_LABELS: Record<string, string> = {
  hospital:                     'Hospital',
  university:                   'University',
  medical_college:              'Medical College',
  polytechnic:                  'Polytechnic',
  technical_training_institute: 'Training Institute',
  k12_school:                   'School',
  nursing_home:                 'Nursing Home',
}

export const TAG_COLORS: Record<string, string> = {
  hospital:                     '#f43f5e',
  university:                   '#3b82f6',
  medical_college:              '#f59e0b',
  polytechnic:                  '#10b981',
  technical_training_institute: '#8b5cf6',
  k12_school:                   '#ec4899',
  nursing_home:                 '#06b6d4',
  _default:                     '#94a3b8',
}

export const TAG_BG: Record<string, string> = {
  hospital:                     'rgba(244,63,94,0.15)',
  university:                   'rgba(59,130,246,0.15)',
  medical_college:              'rgba(245,158,11,0.15)',
  polytechnic:                  'rgba(16,185,129,0.15)',
  technical_training_institute: 'rgba(139,92,246,0.15)',
  k12_school:                   'rgba(236,72,153,0.15)',
  nursing_home:                 'rgba(6,182,212,0.15)',
  _default:                     'rgba(148,163,184,0.1)',
}

/** Per-country accent pair [primary, secondary] — derived from each national flag.
 *  g1/g2 drive the gradient; mapAccent is the country polygon + pin accent. */
export const COUNTRY_THEME: Record<string, {
  g1: string; g2: string;
  mapAccent: string;
  description: string;
}> = {
  // Bangladesh — bottle green field (#006A4E) with red disc (#F42A41)
  BD: {
    g1: '#006A4E', g2: '#F42A41',
    mapAccent: '#F42A41',
    description: "People's Republic of Bangladesh",
  },
}

export const COUNTRY_GRADIENTS: Record<string, [string, string]> = Object.fromEntries(
  Object.entries(COUNTRY_THEME).map(([cc, t]) => [cc, [t.g1, t.g2]])
) as Record<string, [string, string]>

export function getTheme(cc: string) {
  return COUNTRY_THEME[cc] ?? { g1: '#4f8ef7', g2: '#7c3aed', mapAccent: '#4f8ef7', description: '' }
}

export function tagColor(tag: string) {
  return TAG_COLORS[tag] ?? TAG_COLORS._default
}

export function tagBg(tag: string) {
  return TAG_BG[tag] ?? TAG_BG._default
}

// ---------------------------------------------------------------------------
// Flag-derived tag palette
//
// On a country page the pins should belong to that country, so instead of the
// global rainbow we tint each tag along the country's own flag gradient.
// Tags keep a stable, readable order via TAG_ORDER.
// ---------------------------------------------------------------------------

const TAG_ORDER = [
  'university',
  'hospital',
  'medical_college',
  'polytechnic',
  'technical_training_institute',
  'k12_school',
  'nursing_home',
]

/** Linear interpolation between two hex colours, t in [0,1]. */
function mixHex(a: string, b: string, t: number) {
  const pa = parseHex(a)
  const pb = parseHex(b)
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t))
  return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`
}

function parseHex(h: string): [number, number, number] {
  const s = h.replace('#', '')
  const full = s.length === 3 ? s.split('').map(ch => ch + ch).join('') : s
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

const countryTagCache = new Map<string, Map<string, string>>()

/**
 * Returns a tag -> colour map derived from the country's flag gradient.
 * Falls back to the global TAG_COLORS for tags not in TAG_ORDER.
 */
export function countryTagColors(cc: string, tags: string[]): Map<string, string> {
  const key = `${cc}|${tags.join(',')}`
  const cached = countryTagCache.get(key)
  if (cached) return cached

  const theme = getTheme(cc)
  const ordered = TAG_ORDER.filter(t => tags.includes(t))
  const extras = tags.filter(t => !TAG_ORDER.includes(t)).sort()
  const list = [...ordered, ...extras]

  const map = new Map<string, string>()
  const n = list.length
  list.forEach((tag, i) => {
    if (n === 1) {
      map.set(tag, theme.mapAccent)
      return
    }
    // spread evenly across the flag gradient
    map.set(tag, mixHex(theme.g1, theme.g2, i / (n - 1)))
  })

  countryTagCache.set(key, map)
  return map
}

/** Translucent version of a tag colour for chip backgrounds. */
export function tagBgFrom(hex: string, alpha = 0.16) {
  const [r, g, b] = parseHex(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Darken a colour toward black — used for text on light chip backgrounds. */
export function shade(hex: string, amount = 0.35) {
  const [r, g, b] = parseHex(hex)
  const f = (v: number) => Math.round(v * (1 - amount))
  return `#${[f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join('')}`
}

/** Human-readable language names for the local-language name labels. */
export const LANG_NAMES: Record<string, string> = {
  bn: 'Bengali',
}
