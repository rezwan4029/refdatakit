#!/usr/bin/env node
/**
 * Build script for the GitHub Pages coverage explorer.
 *
 * Reads all datasets from /datasets and writes baked JS data files into
 * docs/data/ so the static HTML pages can load them without CORS issues.
 *
 * Usage: node docs/build.mjs  (run from repo root)
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(__dirname, "data");
mkdirSync(outDir, { recursive: true });

function readJSON(rel) {
  try {
    return JSON.parse(readFileSync(join(root, rel), "utf8"));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// District-level approximate centroids for Bangladesh (all 64 districts).
// Used to place cities that lack explicit coordinates on the map.
// ---------------------------------------------------------------------------
const BD_DISTRICT_CENTROIDS = {
  "BD-BAG": [22.65,  89.78], // Bagerhat
  "BD-BAI": [22.70,  90.35], // Barishal
  "BD-BAN": [22.19,  92.22], // Bandarban
  "BD-BAR": [22.03,  90.12], // Barguna
  "BD-BHO": [22.36,  90.65], // Bhola
  "BD-BOG": [24.85,  89.37], // Bogura
  "BD-BRA": [23.95,  91.12], // Brahmanbaria
  "BD-CHA": [23.22,  90.67], // Chandpur
  "BD-CHP": [24.60,  88.27], // Chapainawabganj
  "BD-CHT": [22.33,  91.83], // Chattogram
  "BD-CHU": [23.65,  88.85], // Chuadanga
  "BD-COX": [21.45,  92.01], // Cox's Bazar
  "BD-CUM": [23.47,  91.18], // Cumilla
  "BD-DHA": [23.73,  90.39], // Dhaka
  "BD-DIN": [25.63,  88.65], // Dinajpur
  "BD-FAR": [23.61,  89.84], // Faridpur
  "BD-FEN": [23.02,  91.40], // Feni
  "BD-GAI": [25.33,  89.52], // Gaibandha
  "BD-GAZ": [23.99,  90.42], // Gazipur
  "BD-GOP": [23.00,  89.82], // Gopalganj
  "BD-HAB": [24.37,  91.42], // Habiganj
  "BD-JAM": [24.90,  89.95], // Jamalpur
  "BD-JAS": [23.17,  89.21], // Jashore
  "BD-JHE": [23.55,  89.17], // Jhenaidah
  "BD-JHA": [22.65,  90.20], // Jhalokati
  "BD-JOY": [25.11,  89.02], // Joypurhat
  "BD-KHA": [23.12,  91.95], // Khagrachhari
  "BD-KHU": [22.82,  89.55], // Khulna
  "BD-KIS": [24.44,  90.78], // Kishoreganj
  "BD-KUR": [25.80,  89.63], // Kurigram
  "BD-KUS": [23.90,  89.12], // Kushtia
  "BD-LAK": [22.94,  90.84], // Lakshmipur
  "BD-LAL": [25.92,  89.45], // Lalmonirhat
  "BD-MAD": [23.16,  90.00], // Madaripur
  "BD-MAG": [23.49,  89.42], // Magura
  "BD-MAN": [23.86,  90.00], // Manikganj
  "BD-MAU": [24.48,  91.80], // Maulvibazar
  "BD-MEH": [23.75,  88.63], // Meherpur
  "BD-MYM": [24.75,  90.42], // Mymensingh
  "BD-NAA": [23.14,  89.49], // Narail
  "BD-NAO": [24.80,  88.93], // Naogaon
  "BD-NAR": [23.61,  90.49], // Narayanganj
  "BD-NAS": [23.93,  90.72], // Narsingdi
  "BD-NAT": [24.41,  89.00], // Natore
  "BD-NET": [24.87,  90.73], // Netrokona
  "BD-NIL": [25.47,  88.86], // Nilphamari
  "BD-NOA": [22.86,  91.10], // Noakhali
  "BD-PAB": [24.00,  89.25], // Pabna
  "BD-PAN": [26.33,  88.55], // Panchagarh
  "BD-PAT": [22.36,  90.33], // Patuakhali
  "BD-PIR": [22.57,  89.97], // Pirojpur
  "BD-RAG": [25.75,  89.23], // Rangpur (Gaibandha disambiguation — alias RAG not standard; using for Rangpur city area)
  "BD-RAJ": [23.74,  89.65], // Rajbari
  "BD-RAN": [22.63,  92.20], // Rangamati
  "BD-RAS": [24.37,  88.60], // Rajshahi
  "BD-RAG": [25.74,  89.25], // Rangpur (city)
  "BD-SAT": [22.72,  89.07], // Satkhira
  "BD-SHA": [23.24,  90.44], // Shariatpur
  "BD-SIR": [24.45,  89.70], // Sirajganj
  "BD-SUN": [25.07,  91.40], // Sunamganj
  "BD-SYL": [24.90,  91.87], // Sylhet
  "BD-TAN": [24.25,  89.92], // Tangail
  "BD-MIM": [24.75,  90.42], // Mymensingh alias
  "BD-KIS": [24.44,  90.78], // Kishoreganj
  "BD-RNG": [25.74,  89.25], // Rangpur
  "BD-GAZ": [23.99,  90.42], // Gazipur
  // Additional codes that appear in BD cities
  "BD-THA": [26.03,  88.46], // Thakurgaon
  "BD-DIN": [25.63,  88.65], // Dinajpur
  "BD-NAS": [23.93,  90.72], // Narsingdi
  "BD-NAR": [23.61,  90.49], // Narayanganj
  "BD-MYM": [24.75,  90.42], // Mymensingh (official)
};

// Country bounding boxes for map initialisation [south, west, north, east]
const COUNTRY_BOUNDS = {
  BD: [[20.5, 88.0], [26.7, 92.7]],
  BT: [[26.7, 88.7], [28.3, 92.1]],
  LK: [[5.9,  79.6], [9.9,  81.9]],
  MV: [[-0.7, 72.6], [7.1,  73.8]],
  NP: [[26.3, 80.0], [30.5, 88.2]],
  SG: [[1.15,103.6], [1.47, 104.0]],
};

// ---------------------------------------------------------------------------
// Load all datasets
// ---------------------------------------------------------------------------
const countries = readJSON("datasets/countries/data.json");

const output = {};

for (const country of countries) {
  const cc = country.code;
  const cities    = readJSON(`datasets/cities/by-country/${cc}.json`)       ?? [];
  const insts     = readJSON(`datasets/institutions/by-country/${cc}.json`) ?? [];
  const subdivs   = readJSON(`datasets/subdivisions/by-country/${cc}.json`) ?? [];

  // Build city coordinate index
  const cityCoords = {};
  for (const city of cities) {
    if (city.coordinates) {
      cityCoords[city.id] = [city.coordinates.latitude, city.coordinates.longitude];
    } else if (city.subdivision_code && BD_DISTRICT_CENTROIDS[city.subdivision_code]) {
      // Jitter slightly so pins don't stack exactly
      const [lat, lng] = BD_DISTRICT_CENTROIDS[city.subdivision_code];
      cityCoords[city.id] = [lat + (Math.random() * 0.08 - 0.04), lng + (Math.random() * 0.08 - 0.04)];
    }
  }

  // Institution stats
  const tagCounts = {};
  for (const inst of insts) {
    for (const tag of inst.tags) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
  }

  // Build placeable institution pins (resolve coords via city join)
  const pins = [];
  for (const inst of insts) {
    const coords = cityCoords[inst.city_id];
    if (!coords) continue;
    // Add small jitter to prevent exact pin stacking
    const jitter = () => (Math.random() - 0.5) * 0.015;
    pins.push({
      name: inst.names.en,
      lat:  coords[0] + jitter(),
      lng:  coords[1] + jitter(),
      tag:  inst.tags[0],
      type: inst.entity_type,
      city: inst.city_id,
    });
  }

  // Subdivision summary
  const subdivLevels = {};
  for (const s of subdivs) {
    subdivLevels[s.level] = (subdivLevels[s.level] ?? 0) + 1;
  }

  output[cc] = {
    code: cc,
    name: country.name,
    bounds: COUNTRY_BOUNDS[cc],
    cities:  { total: cities.length, withCoords: cities.filter(c => c.coordinates).length },
    institutions: { total: insts.length, byTag: tagCounts },
    subdivisions: { total: subdivs.length, byLevel: subdivLevels },
    pins,
  };
}

// Write per-country data files
for (const [cc, data] of Object.entries(output)) {
  writeFileSync(
    join(outDir, `${cc}.js`),
    `window.__RDK_DATA_${cc} = ${JSON.stringify(data, null, 2)};\n`,
    "utf8"
  );
  console.log(`  wrote docs/data/${cc}.js  (${data.pins.length} pins)`);
}

// Write index summary
const summary = Object.values(output).map(d => ({
  code: d.code,
  name: d.name,
  cities: d.cities.total,
  institutions: d.institutions.total,
  subdivisions: d.subdivisions.total,
  byTag: d.institutions.byTag,
}));
writeFileSync(
  join(outDir, "index.js"),
  `window.__RDK_INDEX = ${JSON.stringify(summary, null, 2)};\n`,
  "utf8"
);
console.log("  wrote docs/data/index.js");
console.log("Build complete.");
