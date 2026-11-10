export const FLAGS: Record<string, string> = {
  BD: '🇧🇩', BT: '🇧🇹', LK: '🇱🇰', MV: '🇲🇻', NP: '🇳🇵', SG: '🇸🇬',
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

/** Per-country accent pair [primary, secondary] */
export const COUNTRY_THEME: Record<string, {
  g1: string; g2: string;
  mapAccent: string;
  tileStyle: 'dark' | 'topo' | 'ocean' | 'warm';
  description: string;
}> = {
  BD: {
    g1: '#f43f5e', g2: '#f59e0b',
    mapAccent: '#f43f5e',
    tileStyle: 'dark',
    description: 'People\'s Republic of Bangladesh',
  },
  BT: {
    g1: '#f59e0b', g2: '#10b981',
    mapAccent: '#f59e0b',
    tileStyle: 'topo',
    description: 'Kingdom of Bhutan',
  },
  LK: {
    g1: '#f97316', g2: '#eab308',
    mapAccent: '#f97316',
    tileStyle: 'warm',
    description: 'Democratic Socialist Republic of Sri Lanka',
  },
  MV: {
    g1: '#06b6d4', g2: '#3b82f6',
    mapAccent: '#06b6d4',
    tileStyle: 'ocean',
    description: 'Republic of Maldives',
  },
  NP: {
    g1: '#8b5cf6', g2: '#3b82f6',
    mapAccent: '#8b5cf6',
    tileStyle: 'topo',
    description: 'Federal Democratic Republic of Nepal',
  },
  SG: {
    g1: '#ef4444', g2: '#f43f5e',
    mapAccent: '#ef4444',
    tileStyle: 'dark',
    description: 'Republic of Singapore',
  },
}

/** Tile URL per style */
export const TILE_URLS: Record<string, { url: string; attribution: string }> = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
  },
  ocean: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  warm: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
}

export const COUNTRY_GRADIENTS: Record<string, [string, string]> = Object.fromEntries(
  Object.entries(COUNTRY_THEME).map(([cc, t]) => [cc, [t.g1, t.g2]])
) as Record<string, [string, string]>

export function getTheme(cc: string) {
  return COUNTRY_THEME[cc] ?? { g1: '#4f8ef7', g2: '#7c3aed', mapAccent: '#4f8ef7', tileStyle: 'dark', description: '' }
}

export function tagColor(tag: string) {
  return TAG_COLORS[tag] ?? TAG_COLORS._default
}

export function tagBg(tag: string) {
  return TAG_BG[tag] ?? TAG_BG._default
}
