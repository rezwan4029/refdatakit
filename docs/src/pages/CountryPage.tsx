import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

import Flag from '../components/Flag'
import { useCountry } from '../hooks/useCountryData'
import {
  TAG_LABELS, LANG_NAMES, getTheme, tagBgFrom, countryTagColors,
} from '../constants'
import type { Pin } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function cityMapsUrl(city: string, country: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${city}, ${country}`)}`
}

function gmapsUrl(lat: number, lng: number, name?: string) {
  const coords = `${lat.toFixed(6)},${lng.toFixed(6)}`
  const q = name ? encodeURIComponent(`${name} ${coords}`) : encodeURIComponent(coords)
  return `https://www.google.com/maps/search/?api=1&query=${q}`
}

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{
      flex: '1 1 90px', minWidth: 90,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '0.7rem 0.9rem', textAlign: 'center',
    }}>
      <div style={{ fontSize: '1.35rem', fontWeight: 800, color, lineHeight: 1 }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: '0.64rem', color: 'var(--muted)', marginTop: 4, fontWeight: 500 }}>{label}</div>
    </div>
  )
}

type SortKey = 'name' | 'city' | 'tag' | 'lang'
type SortDir = 'asc' | 'desc'

// ---------------------------------------------------------------------------
// Main page — tabular, filter-driven, no drawer
// ---------------------------------------------------------------------------
export default function CountryPage() {
  const { cc = 'BD' } = useParams<{ cc: string }>()
  const navigate = useNavigate()
  const code = cc.toUpperCase()
  const { data, loading } = useCountry(code)
  const theme = getTheme(code)

  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Counts of institutions actually shown in the table (mapped pins only), so
  // chip numbers reconcile with the visible row total instead of including
  // unmapped institutions the table cannot display.
  const pinTagCounts = useMemo(() => {
    const m: Record<string, number> = {}
    if (data) for (const p of data.pins) m[p.tag] = (m[p.tag] ?? 0) + 1
    return m
  }, [data])

  const allTags = useMemo(() => {
    if (!data) return []
    return Object.keys(data.institutions.byPrimaryTag ?? data.institutions.byTag)
      .sort((a, b) => (pinTagCounts[b] ?? 0) - (pinTagCounts[a] ?? 0))
  }, [data, pinTagCounts])

  const palette = useMemo(() => countryTagColors(code, allTags), [code, allTags])
  const tColor = useCallback(
    (tag: string) => palette.get(tag) ?? theme.mapAccent,
    [palette, theme.mapAccent],
  )

  // Selected types start as "all". An empty set means "all types selected"
  // (the default view); a toggle-off of every type is prevented.
  const effectiveTypes = useMemo(
    () => (activeTypes.size > 0 ? activeTypes : new Set(allTags)),
    [activeTypes, allTags],
  )

  const toggleType = useCallback((tag: string) => {
    setActiveTypes(prev => {
      // From the default "all" state, the first click narrows to just that tag.
      if (prev.size === 0) return new Set([tag])

      const next = new Set(prev)
      if (next.has(tag)) {
        next.delete(tag)
        // Empty selection falls back to showing everything.
        if (next.size === 0) return new Set()
      } else {
        next.add(tag)
      }
      // If everything ends up selected, collapse to the default "all" state.
      if (next.size === allTags.length) return new Set()
      return next
    })
  }, [allTags])

  // Distinct cities for the city dropdown
  const cities = useMemo(() => {
    if (!data) return []
    const seen = new Map<string, string>()
    for (const p of data.pins) {
      if (p.city && !seen.has(p.city)) seen.set(p.city, p.cityName || p.city)
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [data])

  const rows = useMemo<Pin[]>(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    const list = data.pins.filter(p =>
      effectiveTypes.has(p.tag) &&
      (!cityFilter || p.city === cityFilter) &&
      (!q ||
        p.name.toLowerCase().includes(q) ||
        (p.cityName || p.city).toLowerCase().includes(q) ||
        (p.localNames ?? []).some(l => l.name.toLowerCase().includes(q))),
    )
    const lang = (p: Pin) => p.localNames?.map(l => l.name).join(' ') ?? ''
    const dir = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      let av = '', bv = ''
      if (sortKey === 'name') { av = a.name; bv = b.name }
      else if (sortKey === 'city') { av = a.cityName || a.city; bv = b.cityName || b.city }
      else if (sortKey === 'tag') { av = a.tag; bv = b.tag }
      else { av = lang(a); bv = lang(b) }
      return av.localeCompare(bv) * dir
    })
    return list
  }, [data, effectiveTypes, cityFilter, search, sortKey, sortDir])

  const clearFilters = () => {
    setActiveTypes(new Set())
    setSearch('')
    setCityFilter('')
  }

  const hasFilter = activeTypes.size > 0 || search.trim() !== '' || cityFilter !== ''

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.4 }}
          style={{ fontSize: '1.4rem', color: 'var(--muted)' }}
        >
          Loading…
        </motion.div>
      </div>
    )
  }
  if (!data) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: '1.2rem', color: 'var(--muted)' }}>No data for {cc}</div>
        <button onClick={() => navigate('/')} style={btn(theme.mapAccent)}>← Back</button>
      </div>
    )
  }

  const { g1, g2 } = theme

  const headerCols: { key: SortKey | null; label: string; align?: 'right'; width?: number }[] = [
    { key: 'name', label: 'Institution' },
    { key: 'tag', label: 'Type', width: 140 },
    { key: 'city', label: 'City', width: 150 },
    { key: 'lang', label: 'Native name', width: 220 },
    { key: null, label: 'Location', width: 90, align: 'right' },
  ]

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '0.6rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem',
        flexWrap: 'wrap',
      }}>
        <button onClick={() => navigate('/')} style={btn('transparent', true)}>← All</button>
        <Flag code={code} size={24} />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{
            fontSize: '0.98rem', fontWeight: 700,
            background: `linear-gradient(90deg, ${g1}, ${g2})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>{data.name}</span>
          <span style={{ fontSize: '0.64rem', color: 'var(--muted)' }}>{theme.description}</span>
        </div>
      </div>

      <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto', padding: '1.25rem', flex: 1 }}>

        {/* ── Stats ── */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <StatCard value={data.institutions.total} label="Institutions" color={g2} />
          <StatCard value={data.institutions.mapped ?? data.pins.length} label="Mapped" color={g1} />
          <StatCard value={data.cities.total} label="Cities" color={g1} />
          {data.subdivisions.total > 0 &&
            <StatCard value={data.subdivisions.total} label="Subdivisions" color="#8b5cf6" />}
        </div>

        {/* ── Filter bar (replaces the drawer) ── */}
        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '0.85rem 1rem', marginBottom: '1rem',
          display: 'flex', flexDirection: 'column', gap: '0.75rem',
        }}>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, city, or native name…"
              style={{
                flex: '1 1 260px', minWidth: 180,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '0.5rem 0.75rem', color: 'var(--text)',
                fontSize: '0.82rem', outline: 'none',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = g1)}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
            <select
              value={cityFilter}
              onChange={e => setCityFilter(e.target.value)}
              style={{
                flex: '0 1 200px', minWidth: 140,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '0.5rem 0.6rem', color: 'var(--text)',
                fontSize: '0.82rem', outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="">All cities ({cities.length})</option>
              {cities.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            {hasFilter && (
              <button onClick={clearFilters} style={btn('transparent', true)}>Clear</button>
            )}
          </div>

          {/* type chips */}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {allTags.map(tag => {
              const on = effectiveTypes.has(tag)
              const c = tColor(tag)
              const count = pinTagCounts[tag] ?? 0
              return (
                <button
                  key={tag}
                  onClick={() => toggleType(tag)}
                  style={{
                    cursor: 'pointer',
                    background: on ? tagBgFrom(c) : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${on ? c + '66' : 'var(--border)'}`,
                    borderRadius: 100, padding: '0.25rem 0.65rem',
                    color: on ? c : 'var(--muted)',
                    fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap',
                    opacity: on ? 1 : 0.55, transition: 'all 0.15s',
                  }}
                >
                  <span style={{
                    display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                    background: c, marginRight: 5, verticalAlign: 'middle',
                  }} />
                  {TAG_LABELS[tag] || tag} {count}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Result count ── */}
        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.5rem', paddingLeft: 2 }}>
          {rows.length.toLocaleString()} of {data.pins.length.toLocaleString()} institutions
        </div>

        {/* ── Table ── */}
        <div style={{
          border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden',
          background: 'var(--card)',
        }}>
          {/* header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(200px,2.5fr) 140px 150px minmax(160px,2fr) 90px',
            background: 'var(--surface)', borderBottom: '1px solid var(--border)',
            fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: 'var(--muted)',
          }}>
            {headerCols.map(col => (
              <div
                key={col.label}
                onClick={() => {
                  if (!col.key) return
                  if (sortKey === col.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                  else { setSortKey(col.key); setSortDir('asc') }
                }}
                style={{
                  padding: '0.6rem 0.85rem',
                  cursor: col.key ? 'pointer' : 'default',
                  userSelect: 'none',
                  display: 'flex', alignItems: 'center', gap: 4,
                  justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start',
                }}
              >
                {col.label}
                {col.key && sortKey === col.key && (
                  <span style={{ fontSize: '0.55rem', opacity: 0.8 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
                )}
              </div>
            ))}
          </div>

          {/* body */}
          {rows.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
              No institutions match the current filters.
            </div>
          ) : (
            rows.map((p, i) => (
              <div
                key={p.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(200px,2.5fr) 140px 150px minmax(160px,2fr) 90px',
                  alignItems: 'center',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                  fontSize: '0.8rem',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.035)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                {/* name */}
                <div style={{ padding: '0.55rem 0.85rem', minWidth: 0 }}>
                  <span title={p.name} style={{
                    display: 'block', overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', color: 'var(--text)',
                  }}>{p.name}</span>
                </div>
                {/* type */}
                <div style={{ padding: '0.55rem 0.85rem' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: '0.68rem', fontWeight: 600,
                    color: tColor(p.tag),
                    background: tagBgFrom(tColor(p.tag), 0.14),
                    border: `1px solid ${tColor(p.tag)}44`,
                    borderRadius: 100, padding: '1px 8px', whiteSpace: 'nowrap',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: tColor(p.tag) }} />
                    {TAG_LABELS[p.tag] || p.tag}
                  </span>
                </div>
                {/* city */}
                <div style={{ padding: '0.55rem 0.85rem', minWidth: 0 }}>
                  <a
                    href={cityMapsUrl(p.cityName || p.city, data.name)}
                    target="_blank" rel="noopener noreferrer"
                    title={`Open ${p.cityName || p.city} in Google Maps`}
                    style={{
                      color: 'var(--muted)', textDecoration: 'none',
                      display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = g1}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--muted)'}
                  >{p.cityName || p.city}</a>
                </div>
                {/* native name — hover reveals language labels */}
                <div style={{ padding: '0.55rem 0.85rem', minWidth: 0 }}>
                  {p.localNames?.length ? (
                    p.localNames.map(l => (
                      <div
                        key={l.lang}
                        title={LANG_NAMES[l.lang] ?? l.lang}
                        style={{
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          color: 'var(--text)', lineHeight: 1.4,
                        }}
                      >{l.name}</div>
                    ))
                  ) : (
                    <span style={{ color: 'var(--muted)', opacity: 0.5 }}>—</span>
                  )}
                </div>
                {/* location link */}
                <div style={{ padding: '0.55rem 0.85rem', textAlign: 'right' }}>
                  <a
                    href={gmapsUrl(p.lat, p.lng, p.name)}
                    target="_blank" rel="noopener noreferrer"
                    title={`${p.lat.toFixed(4)}, ${p.lng.toFixed(4)} — open in Google Maps`}
                    style={{ color: g1, textDecoration: 'none', fontSize: '0.72rem', whiteSpace: 'nowrap' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.textDecoration = 'underline'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.textDecoration = 'none'}
                  >Map ↗</a>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ height: '2rem' }} />
      </div>
    </div>
  )
}

function btn(_accent: string, subtle = false): React.CSSProperties {
  return {
    background: subtle ? 'rgba(255,255,255,0.06)' : _accent,
    border: subtle ? '1px solid var(--border)' : 'none',
    borderRadius: 8, color: subtle ? 'var(--muted)' : '#fff',
    cursor: 'pointer', padding: '0.3rem 0.75rem', fontSize: '0.78rem',
    whiteSpace: 'nowrap', flexShrink: 0,
  }
}
