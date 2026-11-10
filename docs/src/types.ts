export interface Pin {
  id: string
  name: string
  lat: number
  lng: number
  tag: string
  city: string
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
  institutions: { total: number; byTag: Record<string, number> }
  subdivisions: { total: number; byLevel: Record<string, number> }
  pins: Pin[]
}
