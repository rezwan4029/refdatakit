export interface Pin {
  id: string
  name: string
  lat: number
  lng: number
  tag: string
  city: string
  cityName?: string
  localNames?: { lang: string; name: string }[]
  type: string
}

export interface CountrySummary {
  code: string
  name: string
  cities: number
  institutions: number
  subdivisions: number
  pins: number
  byTag: Record<string, number>
}

export interface CountryDetail {
  code: string
  name: string
  bounds: [[number, number], [number, number]]
  cities: { total: number; withCoords: number }
  institutions: {
    total: number
    byTag: Record<string, number>        // entity counted once per tag it has
    byPrimaryTag?: Record<string, number> // entity counted exactly once
    mapped?: number
    unmapped?: number
  }
  subdivisions: { total: number; byLevel: Record<string, number> }
  pins: Pin[]
}
