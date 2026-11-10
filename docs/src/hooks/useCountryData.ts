import { useState, useEffect } from 'react'
import type { CountryDetail, CountrySummary } from '../types'

const BASE = import.meta.env.BASE_URL

export function useIndex() {
  const [data, setData] = useState<CountrySummary[] | null>(null)
  useEffect(() => {
    fetch(`${BASE}data/index.json`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
  }, [])
  return data
}

export function useCountry(cc: string) {
  const [data, setData] = useState<CountryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    setData(null)
    fetch(`${BASE}data/${cc}.json`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [cc])
  return { data, loading }
}
