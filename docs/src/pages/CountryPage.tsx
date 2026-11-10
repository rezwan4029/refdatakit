import { useState, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

import { useCountry } from '../hooks/useCountryData'
import {
  FLAGS, TAG_LABELS, LANG_NAMES, getTheme, tagBgFrom, countryTagColors,
} from '../constants'

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

function DetailRow({ label, value, mono, dot, href }: {
  label: string; value: string; mono?: boolean; dot?: string; href?: string
}) {
  const inner = (
    <>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />}
      {value}
      {href && (
        <span aria-hidden style={{ fontSize: '0.6rem', opacity: 0.7, flexShrink: 0 }}>↗</span>
      )}
    </>
  )
  const style: React.CSSProperties = {
    fontSize: mono ? '0.68rem' : '0.76rem',
    color: href ? 'var(--accent)' : 'var(--text)',
    fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
    textAlign: 'right', minWidth: 0,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    display: 'inline-flex', alignItems: 'center', gap: 5,
    textDecoration: 'none',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: '0.68rem', color: 'var(--muted)', flexShrink: 0 }}>{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={style}
          onClick={e => e.stopPropagation()}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none' }}
        >{inner}</a>
      ) : (
        <span style={style}>{inner}</span>
      )}
    </div>
  )
}

/**
 * Google Maps link for a city, qualified by country so ambiguous names
 * (e.g. "Victoria") resolve to the right place.
 */
function cityMapsUrl(city: string, country: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${city}, ${country}`)}`
}

/**
 * Google Maps link for a coordinate pair.
 * Uses the plain search URL so it needs no API key and works everywhere;
 * the place name is included so Maps resolves to the actual institution
 * rather than a bare pin when it knows the place.
 */
function gmapsUrl(lat: number, lng: number, name?: string) {
  const coords = `${lat.toFixed(6)},${lng.toFixed(6)}`
  const q = name ? encodeURIComponent(`${name} ${coords}`) : encodeURIComponent(coords)
  return `https://www.google.com/maps/search/?api=1&query=${q}`
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

  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [activePin, setActivePin] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // All tags present in this country's data
  const allTags = useMemo(() => {
    if (!data) return []
    return Object.keys(data.institutions.byTag).sort((a, b) =>
      ((data.institutions.byPrimaryTag ?? data.institutions.byTag)[b] ?? 0) -
      ((data.institutions.byPrimaryTag ?? data.institutions.byTag)[a] ?? 0)
    )
  }, [data])

  // Flag-derived palette for this country's tags
  const palette = useMemo(
    () => countryTagColors(cc.toUpperCase(), allTags),
    [cc, allTags],
  )
  const tColor = useCallback(
    (tag: string) => palette.get(tag) ?? theme.mapAccent,
    [palette, theme.mapAccent],
  )

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

  // Group the visible institutions by city — a per-country view reads far
  // better as "places and what's in them" than one flat alphabetical list.
  const cityGroups = useMemo(() => {
    const m = new Map<string, { name: string; pins: typeof visiblePins }>()
    for (const p of visiblePins) {
      const key = p.city || 'unknown'
      const g = m.get(key)
      if (g) g.pins.push(p)
      else m.set(key, { name: p.cityName || p.city, pins: [p] })
    }
    return [...m.entries()]
      .map(([id, g]) => ({ id, ...g }))
      .sort((a, b) => b.pins.length - a.pins.length)
  }, [visiblePins])

  const activePinObj = useMemo(
    () => visiblePins.find(p => p.id === activePin) ?? null,
    [visiblePins, activePin],
  )

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
            const c  = tColor(tag)
            const count = (data.institutions.byPrimaryTag ?? data.institutions.byTag)[tag] ?? 0
            return (
              <motion.button
                key={tag}
                onClick={() => toggleFilter(tag)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  cursor: 'pointer',
                  background: on ? tagBgFrom(c) : 'rgba(255,255,255,0.03)',
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
            flex: 1,
            width: '100%',
            background: 'var(--surface)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* stats */}
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <StatCard value={data.institutions.total} label="Institutions" color={g2} />
            <StatCard value={data.institutions.mapped ?? data.pins?.length ?? 0} label="Mapped" color={g1} />
            <StatCard value={data.cities.total} label="Cities" color={g1} />
            {data.subdivisions.total > 0 &&
              <StatCard value={data.subdivisions.total} label="Subdivisions" color="#8b5cf6" />}
          </div>

          {/* coverage note — explains why mapped < total */}
          {(data.institutions.unmapped ?? 0) > 0 && (
            <div style={{
              padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)',
              fontSize: '0.68rem', color: 'var(--muted)', lineHeight: 1.5,
            }}>
              <strong style={{ color: 'var(--text)' }}>
                {(data.institutions.mapped ?? 0).toLocaleString()}
              </strong>{' of '}
              {data.institutions.total.toLocaleString()} have coordinates.{' '}
              {(data.institutions.unmapped ?? 0).toLocaleString()} are listed but not on the map.
            </div>
          )}

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

          {/* list — grouped by city */}
          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '0.25rem 0' }}>
            {cityGroups.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.82rem' }}>
                No institutions match that search.
              </div>
            ) : (
              cityGroups.map(city => (
                <div key={city.id} style={{ marginBottom: 6 }}>
                  {/* city header */}
                  <div style={{
                    display: 'flex', alignItems: 'baseline', gap: 8,
                    padding: '0.55rem 1rem 0.35rem',
                    position: 'sticky', top: 0, zIndex: 2,
                    background: 'var(--surface)',
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.06em',
                      textTransform: 'uppercase', color: 'var(--text)',
                    }}>{city.name}</span>
                    <span style={{
                      fontSize: '0.62rem', color: 'var(--muted)',
                      background: 'rgba(255,255,255,0.06)',
                      borderRadius: 100, padding: '1px 7px',
                    }}>{city.pins.length}</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>

                  {city.pins.map(pin => {
                    const isSel = activePin === pin.id
                    return (
                      <div
                        key={pin.id}
                        data-pin-id={pin.id}
                        onClick={() => setActivePin(isSel ? null : pin.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 9,
                          padding: '0.5rem 1rem 0.5rem 1.35rem',
                          cursor: 'pointer',
                          background: isSel ? tagBgFrom(tColor(pin.tag), 0.22) : 'transparent',
                          borderLeft: isSel
                            ? `2px solid ${tColor(pin.tag)}` : '2px solid transparent',
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={e => {
                          if (!isSel) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.035)'
                        }}
                        onMouseLeave={e => {
                          if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent'
                        }}
                      >
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                          background: tColor(pin.tag),
                        }} />
                        <span style={{
                          flex: 1, minWidth: 0,
                          fontSize: '0.8rem', lineHeight: 1.35, color: 'var(--text)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {pin.name}
                        </span>
                        <span style={{
                          fontSize: '0.62rem', color: 'var(--muted)', flexShrink: 0,
                          whiteSpace: 'nowrap',
                        }}>
                          {TAG_LABELS[pin.tag] || pin.tag}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* ── Detail panel ── */}
        <AnimatePresence>
          {activePinObj && (
            <motion.aside
              key="detail"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              style={{
                flexShrink: 0, overflow: 'hidden',
                background: 'var(--surface)',
                borderLeft: '1px solid var(--border)',
              }}
            >
              <div style={{ width: 340, height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* header */}
                <div style={{
                  padding: '1rem 1.1rem', borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.98rem', fontWeight: 700, color: 'var(--text)',
                      lineHeight: 1.35, wordBreak: 'break-word',
                    }}>
                      {activePinObj.name}
                    </div>
                    {activePinObj.localNames?.map(({ lang, name }) => (
                      <div key={lang} style={{ marginTop: 6 }}>
                        <div style={{
                          fontSize: '0.58rem', textTransform: 'uppercase',
                          letterSpacing: '0.09em', color: 'var(--muted)',
                          fontWeight: 700, marginBottom: 1,
                        }}>
                          {LANG_NAMES[lang] ?? lang}
                        </div>
                        <div style={{
                          fontSize: '0.85rem', color: 'var(--text)',
                          lineHeight: 1.45, wordBreak: 'break-word',
                        }}>
                          {name}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setActivePin(null)}
                    aria-label="Close details"
                    style={{
                      cursor: 'pointer', flexShrink: 0,
                      background: 'rgba(255,255,255,0.06)', border: 'none',
                      color: 'var(--muted)', borderRadius: 8,
                      width: 26, height: 26, fontSize: '0.9rem', lineHeight: 1,
                    }}
                  >×</button>
                </div>

                {/* facts */}
                <div style={{ padding: '0.9rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <DetailRow label="Type" value={TAG_LABELS[activePinObj.tag] || activePinObj.tag} dot={tColor(activePinObj.tag)} />
                  <DetailRow
                    label="City"
                    value={activePinObj.cityName || activePinObj.city}
                    href={cityMapsUrl(activePinObj.cityName || activePinObj.city, data.name)}
                  />
                  <DetailRow
                    label="Location"
                    value={`${activePinObj.lat.toFixed(4)}, ${activePinObj.lng.toFixed(4)}`}
                    mono
                    href={gmapsUrl(activePinObj.lat, activePinObj.lng, activePinObj.name)}
                  />
                  <DetailRow label="Entity" value={activePinObj.type} />
                  <DetailRow label="Source ID" value={activePinObj.id} mono />
                </div>

                {/* other institutions in the same city */}
                {(() => {
                  const others = visiblePins.filter(
                    p => p.city === activePinObj.city && p.id !== activePinObj.id,
                  )
                  if (!others.length) return null
                  return (
                    <div style={{
                      flex: 1, overflowY: 'auto',
                      borderTop: '1px solid var(--border)',
                      padding: '0.8rem 1.1rem 1rem',
                    }}>
                      <div style={{
                        fontSize: '0.62rem', textTransform: 'uppercase',
                        letterSpacing: '0.08em', color: 'var(--muted)',
                        fontWeight: 700, marginBottom: 8,
                      }}>
                        Also in {activePinObj.cityName || activePinObj.city} · {others.length}
                      </div>
                      {others.slice(0, 20).map(o => (
                        <div
                          key={o.id}
                          onClick={() => setActivePin(o.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            padding: '0.35rem 0', cursor: 'pointer',
                            fontSize: '0.76rem', color: 'var(--text)', lineHeight: 1.35,
                          }}
                        >
                          <span style={{
                            width: 5, height: 5, borderRadius: '50%',
                            background: tColor(o.tag), flexShrink: 0,
                          }} />
                          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {o.name}
                          </span>
                        </div>
                      ))}
                      {others.length > 20 && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 6 }}>
                          +{others.length - 20} more
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}
