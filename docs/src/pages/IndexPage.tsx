import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useIndex } from '../hooks/useCountryData'
import Flag from '../components/Flag'
import { TAG_LABELS, getTheme, tagColor, tagBg } from '../constants'
import type { CountrySummary } from '../types'

function AnimatedNumber({ value }: { value: number }) {
  return <span>{value.toLocaleString()}</span>
}

function CountryCard({ c, index }: { c: CountrySummary; index: number }) {
  const navigate = useNavigate()
  const { g1, g2 } = getTheme(c.code)
  const topTags = Object.entries(c.byTag).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: 'easeOut' }}
      whileHover={{ y: -6, transition: { duration: 0.2 } }}
      onClick={() => navigate(`/country/${c.code}`)}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        cursor: 'pointer',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Gradient top bar */}
      <div style={{
        height: 4,
        background: `linear-gradient(90deg, ${g1}, ${g2})`,
      }} />

      {/* Glow effect on hover */}
      <motion.div
        style={{
          position: 'absolute', inset: 0, borderRadius: 20, pointerEvents: 'none',
          background: `radial-gradient(circle at 50% 0%, ${g1}18, transparent 60%)`,
          opacity: 0,
        }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      />

      <div style={{ padding: '1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', marginBottom: '1.25rem' }}>
          <Flag code={c.code} size={38} />
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.02em' }}>{c.name}</div>
            <div style={{
              fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em',
              background: `linear-gradient(90deg, ${g1}, ${g2})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              marginTop: 2,
            }}>{c.code}</div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: '0.75rem', marginBottom: '1.25rem',
        }}>
          {[
            { n: c.cities, label: 'Cities' },
            { n: c.institutions, label: 'Institutions' },
            { n: c.subdivisions, label: 'Subdivisions' },
          ].map(({ n, label }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '0.75rem',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: '1.5rem', fontWeight: 800,
                background: `linear-gradient(135deg, ${g1}, ${g2})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                lineHeight: 1,
              }}>
                <AnimatedNumber value={n} />
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 4, fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Tag pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {topTags.map(([tag, count]) => (
            <span key={tag} style={{
              fontSize: '0.7rem', fontWeight: 600,
              padding: '0.25rem 0.65rem', borderRadius: 100,
              background: tagBg(tag),
              color: tagColor(tag),
              border: `1px solid ${tagColor(tag)}44`,
              whiteSpace: 'nowrap',
            }}>
              {TAG_LABELS[tag] || tag} <strong>{count}</strong>
            </span>
          ))}
        </div>

        {/* Explore arrow */}
        <div style={{
          marginTop: '1rem', display: 'flex', alignItems: 'center',
          justifyContent: 'flex-end', gap: '0.4rem',
          fontSize: '0.78rem', fontWeight: 600,
          color: g1,
        }}>
          Explore map
          <motion.span
            animate={{ x: [0, 4, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
          >→</motion.span>
        </div>
      </div>
    </motion.div>
  )
}

export default function IndexPage() {
  const data = useIndex()

  const totalCities = data?.reduce((s, c) => s + c.cities, 0) ?? 0
  const totalInst   = data?.reduce((s, c) => s + c.institutions, 0) ?? 0
  const totalSub    = data?.reduce((s, c) => s + c.subdivisions, 0) ?? 0

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(180deg, #0d1023 0%, var(--bg) 100%)',
        borderBottom: '1px solid var(--border)',
        padding: '3rem 2rem 2.5rem',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background orbs */}
        <div style={{
          position: 'absolute', top: -60, left: '20%',
          width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, #4f8ef733, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: -40, right: '20%',
          width: 250, height: 250, borderRadius: '50%',
          background: 'radial-gradient(circle, #7c3aed33, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.3)',
            borderRadius: 100, padding: '0.3rem 1rem', fontSize: '0.78rem',
            color: '#4f8ef7', fontWeight: 600, marginBottom: '1.25rem',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4f8ef7', display: 'inline-block' }} />
            Live reference data
          </div>

          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 800, letterSpacing: '-0.03em',
            background: 'linear-gradient(135deg, #e2e8f8 30%, #8892b0)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            marginBottom: '0.75rem', lineHeight: 1.1,
          }}>
            refdatakit
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '1.05rem', maxWidth: 480, margin: '0 auto 2rem' }}>
            Validated reference data for South &amp; Southeast Asia — cities, institutions, and subdivisions
          </p>

          {/* Global stats */}
          {data && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}
            >
              {[
                { n: data.length, label: 'Countries', color: '#4f8ef7' },
                { n: totalCities, label: 'Cities & Towns', color: '#10b981' },
                { n: totalInst, label: 'Institutions', color: '#f59e0b' },
                { n: totalSub, label: 'Subdivisions', color: '#8b5cf6' },
              ].map(({ n, label, color }) => (
                <div key={label} style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border)',
                  borderRadius: 16, padding: '1rem 1.75rem',
                  minWidth: 110,
                }}>
                  <div style={{ fontSize: '1.9rem', fontWeight: 800, color, lineHeight: 1 }}>
                    {n.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Grid */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2.5rem 1.5rem', flex: 1, width: '100%' }}>
        <div style={{
          fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '1.5rem',
        }}>
          {data ? `${data.length} countries` : 'Loading…'}
        </div>

        {!data ? (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[1,2,3,4,5,6].map(i => (
              <motion.div key={i}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.4, delay: i * 0.1 }}
                style={{ flex: '1 1 300px', height: 220, borderRadius: 20, background: 'var(--card)' }}
              />
            ))}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem',
          }}>
            {data.map((c, i) => <CountryCard key={c.code} c={c} index={i} />)}
          </div>
        )}
      </main>

      <footer style={{
        textAlign: 'center', padding: '1.5rem',
        fontSize: '0.78rem', color: 'var(--muted)',
        borderTop: '1px solid var(--border)',
      }}>
        Data from{' '}
        <a href="https://www.wikidata.org" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Wikidata</a>,{' '}
        <a href="https://geonames.org" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>GeoNames</a>{' '}
        &amp; Bangladesh government public records · &nbsp;
        <a href="https://github.com/rezwan4029/refdatakit" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
          GitHub
        </a>
      </footer>
    </div>
  )
}
