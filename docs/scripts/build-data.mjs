#!/usr/bin/env node
/**
 * Pre-build data generator for the GitHub Pages site.
 *
 * Uses @rezwan4029/refdatakit (the published npm package) to load all
 * datasets — so the site always reflects what's actually in the package.
 * Falls back to reading the local repo datasets when the package doesn't
 * have the latest data yet (i.e. during development before a release).
 *
 * Run from repo root: node docs/scripts/build-data.mjs
 * Or from docs/:      npm run build-data
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dir  = dirname(fileURLToPath(import.meta.url))
const docsDir = resolve(__dir, '..')
const repoRoot = resolve(docsDir, '..')
const outDir = join(docsDir, 'public', 'data')
mkdirSync(outDir, { recursive: true })

// ---------------------------------------------------------------------------
// Try to load from the published package first; fall back to local repo files
// ---------------------------------------------------------------------------
let getCities, getCountries, getInstitutions, getSubdivisions, CountryCode

// The repository's datasets/ directory is the source of truth: contributors
// edit it and CI validates it. The published npm package can lag behind it
// (at one point it held 293 BD institutions against 1031 in the repo), so
// prefer the local datasets and only fall back to the package if they are
// missing — e.g. when this script runs outside a full checkout.
const localCountryFile = join(repoRoot, 'datasets', 'countries', 'data.json')

if (existsSync(localCountryFile)) {
  console.log('Reading datasets directly from the repository')
  const readJSON = (rel) => {
    const p = join(repoRoot, rel)
    if (!existsSync(p)) return []
    return JSON.parse(readFileSync(p, 'utf8'))
  }
  const countryCodes = readJSON('datasets/countries/data.json').map(c => c.code)
  CountryCode = Object.fromEntries(countryCodes.map(c => [c, c]))
  getCities       = async (cc) => readJSON(`datasets/cities/by-country/${cc}.json`)
  getCountries    = async ()   => readJSON('datasets/countries/data.json')
  getInstitutions = async (cc) => readJSON(`datasets/institutions/by-country/${cc}.json`)
  getSubdivisions = async (cc) => readJSON(`datasets/subdivisions/by-country/${cc}.json`)
} else {
  const pkg = await import('@rezwan4029/refdatakit')
  getCities       = pkg.getCities
  getCountries    = pkg.getCountries
  getInstitutions = pkg.getInstitutions
  getSubdivisions = pkg.getSubdivisions
  CountryCode     = pkg.CountryCode
  console.log('Repository datasets not found — using @rezwan4029/refdatakit')
}

// ---------------------------------------------------------------------------
// Approximate district centroids for Bangladesh (all 64 districts)
// Used to place cities that lack explicit coordinates on the map.
// ---------------------------------------------------------------------------
const BD_CENTROIDS = {
  'BD-BAG':[22.65,89.78],'BD-BAI':[22.70,90.35],'BD-BAN':[22.19,92.22],
  'BD-BAR':[22.03,90.12],'BD-BHO':[22.36,90.65],'BD-BOG':[24.85,89.37],
  'BD-BRA':[23.95,91.12],'BD-CHA':[23.22,90.67],'BD-CHP':[24.60,88.27],
  'BD-CHT':[22.33,91.83],'BD-CHU':[23.65,88.85],'BD-COX':[21.45,92.01],
  'BD-CUM':[23.47,91.18],'BD-DHA':[23.73,90.39],'BD-DIN':[25.63,88.65],
  'BD-FAR':[23.61,89.84],'BD-FEN':[23.02,91.40],'BD-GAI':[25.33,89.52],
  'BD-GAZ':[23.99,90.42],'BD-GOP':[23.00,89.82],'BD-HAB':[24.37,91.42],
  'BD-JAM':[24.90,89.95],'BD-JAS':[23.17,89.21],'BD-JHE':[23.55,89.17],
  'BD-JHA':[22.65,90.20],'BD-JOY':[25.11,89.02],'BD-KHA':[23.12,91.95],
  'BD-KHU':[22.82,89.55],'BD-KIS':[24.44,90.78],'BD-KUR':[25.80,89.63],
  'BD-KUS':[23.90,89.12],'BD-LAK':[22.94,90.84],'BD-LAL':[25.92,89.45],
  'BD-MAD':[23.16,90.00],'BD-MAG':[23.49,89.42],'BD-MAN':[23.86,90.00],
  'BD-MAU':[24.48,91.80],'BD-MEH':[23.75,88.63],'BD-MYM':[24.75,90.42],
  'BD-NAA':[23.14,89.49],'BD-NAO':[24.80,88.93],'BD-NAR':[23.61,90.49],
  'BD-NAS':[23.93,90.72],'BD-NAT':[24.41,89.00],'BD-NET':[24.87,90.73],
  'BD-NIL':[25.47,88.86],'BD-NOA':[22.86,91.10],'BD-PAB':[24.00,89.25],
  'BD-PAN':[26.33,88.55],'BD-PAT':[22.36,90.33],'BD-PIR':[22.57,89.97],
  'BD-RAJ':[23.74,89.65],'BD-RAN':[22.63,92.20],'BD-RAS':[24.37,88.60],
  'BD-SAT':[22.72,89.07],'BD-SHA':[23.24,90.44],'BD-SIR':[24.45,89.70],
  'BD-SUN':[25.07,91.40],'BD-SYL':[24.90,91.87],'BD-TAN':[24.25,89.92],
  'BD-THA':[26.03,88.46],'BD-RAG':[25.74,89.25],
}

const COUNTRY_BOUNDS = {
  BD: [[20.5,88.0],[26.7,92.7]],
  BT: [[26.7,88.7],[28.3,92.1]],
  LK: [[5.9,79.6],[9.9,81.9]],
  MV: [[-0.7,72.6],[7.1,73.8]],
  NP: [[26.3,80.0],[30.5,88.2]],
  SG: [[1.15,103.6],[1.47,104.0]],
}

function write(name, data) {
  writeFileSync(join(outDir, name), JSON.stringify(data), 'utf8')
  console.log(`  wrote public/data/${name}`)
}

// ---------------------------------------------------------------------------
// Process each country
// ---------------------------------------------------------------------------
const countries = await getCountries()
const summary = []

for (const country of countries) {
  const cc      = country.code
  const cities  = await getCities(CountryCode[cc])
  const insts   = await getInstitutions(CountryCode[cc])
  const subdivs = await getSubdivisions(CountryCode[cc])

  // City metadata: display name + coordinates, keyed by city id
  const cityMeta = {}
  for (const c of cities) {
    cityMeta[c.id] = { name: c.name }
  }

  // Build city coordinate index
  const cityCoords = {}
  for (const c of cities) {
    if (c.coordinates) {
      cityCoords[c.id] = [c.coordinates.latitude, c.coordinates.longitude]
    } else if (c.subdivision_code && BD_CENTROIDS[c.subdivision_code]) {
      const [la, lo] = BD_CENTROIDS[c.subdivision_code]
      // slight jitter so pins in the same district don't stack exactly
      cityCoords[c.id] = [la + (Math.random()*0.06-0.03), lo + (Math.random()*0.06-0.03)]
    }
  }

  // Build placeable pins
  const pins = []
  for (const inst of insts) {
    const coords = cityCoords[inst.city_id]
    if (!coords) continue
    const jit = () => (Math.random()-0.5)*0.012
    pins.push({
      id:   inst.id,
      name: inst.names.en,
      // all non-English names, kept with their language tag so the UI can
      // label them (bn, si, ta, dv, ne, dz, ms, zh …)
      localNames: Object.entries(inst.names.languages ?? {}).map(([lang, name]) => ({ lang, name })),
      lat:  coords[0] + jit(),
      lng:  coords[1] + jit(),
      tag:  inst.tags[0],
      city: inst.city_id,
      cityName: cityMeta[inst.city_id]?.name ?? inst.city_id,
      type: inst.entity_type,
    })
  }

  // Tag counts.
  // An institution may carry several tags (e.g. Dhaka Medical College is both
  // a hospital and a medical college), which is meaningful for filtering.
  // For a total that reconciles we also record a primary-tag breakdown, where
  // every institution is counted exactly once.
  const byTag = {}
  for (const inst of insts) {
    for (const t of inst.tags) byTag[t] = (byTag[t] ?? 0) + 1
  }

  const byPrimaryTag = {}
  for (const inst of insts) {
    const t = inst.tags[0] ?? 'unclassified'
    byPrimaryTag[t] = (byPrimaryTag[t] ?? 0) + 1
  }

  // Subdivision breakdown
  const byLevel = {}
  for (const s of subdivs) byLevel[s.level] = (byLevel[s.level] ?? 0) + 1

  write(`${cc}.json`, {
    code: cc,
    name: country.name,
    bounds: COUNTRY_BOUNDS[cc] ?? null,
    cities:  { total: cities.length, withCoords: cities.filter(c => c.coordinates).length },
    institutions: {
      total: insts.length,
      byTag,          // an institution with N tags appears in N buckets
      byPrimaryTag,   // every institution counted exactly once
      mapped: pins.length,          // institutions that could be placed on the map
      unmapped: insts.length - pins.length,
    },
    subdivisions: { total: subdivs.length, byLevel },
    pins,
  })

  summary.push({
    code: cc, name: country.name,
    cities: cities.length,
    institutions: insts.length,
    mapped: pins.length,
    unmapped: insts.length - pins.length,
    subdivisions: subdivs.length,
    pins: pins.length,
    byTag,
    byPrimaryTag,
  })
}

write('index.json', summary)
console.log(`Done. ${summary.reduce((s,c)=>s+c.pins,0)} total pins across ${summary.length} countries.`)
