import { useState, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapContainer, TileLayer, CircleMarker, Popup, useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import { useCountry } from '../hooks/useCountryData'
import {
  FLAGS, TAG_LABELS, TAG_COLORS, getTheme, TILE_URLS, tagColor, tagBg,
} from '../constants'

// ---------------------------------------------------------------------------
// Map bounds fitter — runs once when bounds are ready
// ---------------------------------------------------------------------------
function BoundsFitter({ bounds }: { bounds: [[number,number],[number,number]] | null }) {
  const map = useMap()
  const fitted = useRef(false)
  if (bounds && !fitted.current) {
    fitted.current = true
    map.fitBounds(bounds, { padding: [40, 40] })
  }
  return null
}

// ---------------------------------------------------------------------------
// Fly-to helper — triggered when user clicks a list item
// ---------------------------------------------------------------------------
function FlyTo({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap()
  if (target) map.flyTo([target.lat, target.lng], 13, { duration: 1.2 })
  return null
}

// ---------------------------------------------------------------------------
// Custom circle marker icon color
// ---------------------------------------------------------------------------
function pinOptions(tag: string, accent: string, active: boolean) {
  const c = TAG_COLORS[tag] ?? accent
  return {
    radius: active ? 9 : 7,
    fillColor: c,
    color: active ? '#fff' : c,
    weight: active ? 2 : 1,
    opacity: 0.9,
    fillOpacity: active ? 1 : 0.75,
  }
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 80,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: '0.9rem 1rem', textAlign: 'center',
    }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color, lineHeight: 1 }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 4, fontWeight: 500 }}>{label}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------
function Skeleton() {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ repeat: Infinity, duration: 1.4 }}
        style={{ fontSize: '2rem', color: 'var(--muted)' }}
      >
        Loading map…
      </motion.div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function CountryPage() {
  const { cc = 'BD' } = useParams<{ cc: string }>()
  const navigate = useNavigate()
  const { data, loading } = useCountry(cc.toUpperCase())
  const theme = getTheme(cc.toUpperCase())
  const tile  = TILE_URLS[theme.tileStyle]

  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null)
  const [activePin, setActivePin] = useState<string | null>(null)

  // All tags present in this country's data
  const allTags = useMemo(() => {
    if (!data) return []
    return Object.keys(data.institutions.byTag).sort((a, b) =>
      (data.institutions.byTag[b] ?? 0) - (data.institutions.byTag[a] ?? 0)
    )
  }, [data])

  // Active filters default to all tags
  const effectiveFilters = activeFilters.size > 0 ? activeFilters : new Set(allTags)

  const toggleFilter = useCallback((tag: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev.size === 0 ? allTags : prev)
      if (next.has(tag)) { next.delete(tag); if (next.size === allTags.length) next.clear() }
      else { next.add(tag); if (next.size === allTags.length) next.clear() }
      return next
    })
  }, [allTags])

  const visiblePins = useMemo(() => {
    if (!data) return []
    return data.pins.filter(p =>
      effectiveFilters.has(p.tag) &&
      (!search || p.name.toLowerCase().includes(search.toLowerCase()) ||
                   p.city.toLowerCase().includes(search.toLowerCase()))
    )
  }, [data, effectiveFilters, search])

  if (loading) return <Skeleton />
  if (!data) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: '1.2rem', color: 'var(--muted)' }}>No data for {cc}</div>
      <button onClick={() => navigate('/')} style={{ cursor: 'pointer', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.25rem', fontSize: '0.9rem' }}>← Back</button>
    </div>
  )

  const { g1, g2 } = theme

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Top bar ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{
          flexShrink: 0,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '0 1.25rem',
          display: 'flex', alignItems: 'center', gap: '1rem',
          height: 56, minHeight: 56,
          position: 'relative', overflow: 'hidden',
        }}
      >
        {/* gradient shimmer */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `linear-gradient(90deg, ${g1}18 0%, ${g2}10 50%, transparent 100%)`,
        }} />

        <button
          onClick={() => navigate('/')}
          style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--muted)', cursor: 'pointer',
            padding: '0.3rem 0.75rem', fontSize: '0.8rem', whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >← All</button>

        <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>{FLAGS[cc.toUpperCase()] || '🌐'}</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em',
            background: `linear-gradient(90deg, ${g1}, ${g2})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{data.name}</div>
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 1 }}>{theme.description}</div>
        </div>

        {/* tag filter pills */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'nowrap', overflowX: 'auto', flexShrink: 0 }}>
          {allTags.map(tag => {
            const on = effectiveFilters.has(tag)
            const c  = tagColor(tag)
            const count = data.institutions.byTag[tag] ?? 0
            return (
              <motion.button
                key={tag}
                onClick={() => toggleFilter(tag)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  cursor: 'pointer',
                  background: on ? tagBg(tag) : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${on ? c + '66' : 'var(--border)'}`,
                  borderRadius: 100, padding: '0.25rem 0.65rem',
                  color: on ? c : 'var(--muted)',
                  fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap',
                  opacity: on ? 1 : 0.5,
                  transition: 'all 0.15s',
                }}
              >
                <span style={{
                  display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                  background: c, marginRight: 5, verticalAlign: 'middle',
                }} />
                {TAG_LABELS[tag] || tag} {count}
              </motion.button>
            )
          })}
        </div>
      </motion.div>

      {/* ── Body: sidebar + map ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Sidebar ── */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          style={{
            width: 280, flexShrink: 0,
            background: 'var(--surface)',
            borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* stats */}
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <StatCard value={data.cities.total} label="Cities" color={g1} />
            <StatCard value={data.institutions.total} label="Institutions" color={g2} />
            {data.subdivisions.total > 0 &&
              <StatCard value={data.subdivisions.total} label="Subdivisions" color="#8b5cf6" />}
          </div>

          {/* search */}
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search institutions…"
              style={{
                width: '100%', background: 'var(--card)',
                border: '1px solid var(--border)', borderRadius: 10,
                padding: '0.5rem 0.75rem', color: 'var(--text)',
                fontSize: '0.82rem', outline: 'none',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = g1)}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
            {visiblePins.length > 0 && (
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 6, paddingLeft: 2 }}>
                {visiblePins.length.toLocaleString()} result{visiblePins.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <AnimatePresence>
              {visiblePins.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.82rem' }}>
                  No results
                </div>
              ) : (
                visiblePins.slice(0, 400).map((pin, i) => (
                  <motion.div
                    key={pin.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.012, 0.3) }}
                    onClick={() => { setFlyTarget(pin); setActivePin(pin.id); setTimeout(() => setFlyTarget(null), 50) }}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                      padding: '0.6rem 1rem', cursor: 'pointer',
                      background: activePin === pin.id ? `${tagBg(pin.tag)}` : 'transparent',
                      borderLeft: activePin === pin.id ? `3px solid ${tagColor(pin.tag)}` : '3px solid transparent',
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={e => { if (activePin !== pin.id) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}
                    onMouseLeave={e => { if (activePin !== pin.id) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <div style={{
                      width: 9, height: 9, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                      background: tagColor(pin.tag),
                      boxShadow: `0 0 6px ${tagColor(pin.tag)}88`,
                    }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', lineHeight: 1.4, wordBreak: 'break-word', color: 'var(--text)' }}>
                        {pin.name}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 2 }}>
                        {TAG_LABELS[pin.tag] || pin.tag} · {pin.city}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
            {visiblePins.length > 400 && (
              <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.72rem', color: 'var(--muted)' }}>
                Showing 400 of {visiblePins.length.toLocaleString()} — refine search to narrow results
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Map ── */}
        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer
            style={{ width: '100%', height: '100%' }}
            center={[20, 90]}
            zoom={5}
            scrollWheelZoom
            preferCanvas
          >
            <TileLayer url={tile.url} attribution={tile.attribution} subdomains="abcd" maxZoom={19} />
            <BoundsFitter bounds={data.bounds} />
            <FlyTo target={flyTarget} />

            {visiblePins.map(pin => (
              <CircleMarker
                key={pin.id}
                center={[pin.lat, pin.lng]}
                {...pinOptions(pin.tag, theme.mapAccent, activePin === pin.id)}
                eventHandlers={{
                  click: () => setActivePin(pin.id),
                  popupclose: () => setActivePin(null),
                }}
              >
                <Popup>
                  <div style={{ minWidth: 180 }}>
                    <div style={{
                      fontWeight: 700, fontSize: '0.88rem', marginBottom: 4,
                      color: '#e2e8f8', lineHeight: 1.4,
                    }}>{pin.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                        background: tagColor(pin.tag), flexShrink: 0,
                      }} />
                      <span style={{ fontSize: '0.75rem', color: '#8892b0' }}>
                        {TAG_LABELS[pin.tag] || pin.tag}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#6b7fa3', marginTop: 4 }}>
                      City: {pin.city}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>

          {/* Map legend overlay */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            style={{
              position: 'absolute', bottom: 28, right: 12, zIndex: 1000,
              background: 'rgba(14,18,34,0.9)', backdropFilter: 'blur(8px)',
              border: '1px solid var(--border)', borderRadius: 12,
              padding: '0.75rem 1rem', fontSize: '0.72rem',
              pointerEvents: 'none',
            }}
          >
            <div style={{ color: 'var(--muted)', fontWeight: 600, marginBottom: 6, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {visiblePins.length.toLocaleString()} pins visible
            </div>
            {allTags.map(tag => (
              effectiveFilters.has(tag) && (
                <div key={tag} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                  <div style={{
                    width: 9, height: 9, borderRadius: '50%', background: tagColor(tag),
                    boxShadow: `0 0 5px ${tagColor(tag)}99`, flexShrink: 0,
                  }} />
                  <span style={{ color: 'var(--text)' }}>{TAG_LABELS[tag] || tag}</span>
                  <span style={{ color: 'var(--muted)', marginLeft: 'auto', paddingLeft: 12 }}>
                    {data.institutions.byTag[tag] ?? 0}
                  </span>
                </div>
              )
            ))}
          </motion.div>

          {/* Country name watermark */}
          <div style={{
            position: 'absolute', top: 12, right: 12, zIndex: 1000,
            pointerEvents: 'none', userSelect: 'none',
          }}>
            <span style={{
              fontSize: '1.8rem',
              filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6))',
            }}>{FLAGS[cc.toUpperCase()] || ''}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
