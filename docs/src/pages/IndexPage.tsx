import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useIndex } from '../hooks/useCountryData'
import Flag from '../components/Flag'
import { TAG_LABELS, getTheme, tagColor, tagBg } from '../constants'

export default function IndexPage() {
  const data = useIndex()
  const navigate = useNavigate()
  const bd = data?.find(c => c.code === 'BD')
  const theme = getTheme('BD')
  const { g1, g2 } = theme
  const topTags = bd ? Object.entries(bd.byTag).sort((a, b) => b[1] - a[1]) : []

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(180deg, #0d1023 0%, var(--bg) 100%)',
        borderBottom: '1px solid var(--border)',
        padding: '3.5rem 2rem 3rem',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -60, left: '20%',
          width: 300, height: 300, borderRadius: '50%',
          background: `radial-gradient(circle, ${g1}33, transparent 70%)`, pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: -40, right: '20%',
          width: 250, height: 250, borderRadius: '50%',
          background: `radial-gradient(circle, ${g2}33, transparent 70%)`, pointerEvents: 'none',
        }} />

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.3)',
            borderRadius: 100, padding: '0.3rem 1rem', fontSize: '0.78rem',
            color: '#4f8ef7', fontWeight: 600, marginBottom: '1.5rem',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4f8ef7', display: 'inline-block' }} />
            Live · Source-backed Bangladesh data
          </div>

          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, letterSpacing: '-0.03em',
            background: 'linear-gradient(135deg, #e2e8f8 30%, #8892b0)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            marginBottom: '0.75rem', lineHeight: 1.1,
          }}>Bangladesh Data</h1>
          <p style={{ color: 'var(--muted)', fontSize: '1.05rem', maxWidth: 460, margin: '0 auto 2.5rem' }}>
            Validated, source-backed reference data for Bangladesh — cities, subdivisions, and institutions
          </p>
        </motion.div>

        {/* The single country entry: Bangladesh */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.45, ease: 'easeOut' }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          onClick={() => navigate('/country/BD')}
          style={{
            maxWidth: 520, margin: '0 auto', cursor: 'pointer',
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 22, overflow: 'hidden', position: 'relative', textAlign: 'left',
          }}
        >
          <div style={{ height: 5, background: `linear-gradient(90deg, ${g1}, ${g2})` }} />
          <div style={{ padding: '1.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.4rem' }}>
              <Flag code="BD" size={44} />
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Bangladesh</div>
                <div style={{
                  fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.1em',
                  background: `linear-gradient(90deg, ${g1}, ${g2})`,
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginTop: 2,
                }}>BD · {theme.description}</div>
              </div>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
              gap: '0.75rem', marginBottom: '1.25rem',
            }}>
              {[
                { n: bd?.cities ?? 0, label: 'Cities' },
                { n: bd?.institutions ?? 0, label: 'Institutions' },
                { n: bd?.subdivisions ?? 0, label: 'Subdivisions' },
              ].map(({ n, label }) => (
                <div key={label} style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '0.85rem', textAlign: 'center',
                }}>
                  <div style={{
                    fontSize: '1.5rem', fontWeight: 800, lineHeight: 1,
                    background: `linear-gradient(135deg, ${g1}, ${g2})`,
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  }}>{n.toLocaleString()}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 4, fontWeight: 500 }}>{label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
              {topTags.slice(0, 6).map(([tag, count]) => (
                <span key={tag} style={{
                  fontSize: '0.7rem', fontWeight: 600, padding: '0.25rem 0.65rem',
                  borderRadius: 100, background: tagBg(tag), color: tagColor(tag),
                  border: `1px solid ${tagColor(tag)}44`, whiteSpace: 'nowrap',
                }}>
                  {TAG_LABELS[tag] || tag} <strong>{count}</strong>
                </span>
              ))}
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem',
              fontSize: '0.82rem', fontWeight: 700, color: g1,
            }}>
              Browse table
              <motion.span animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}>→</motion.span>
            </div>
          </div>
        </motion.div>
      </div>

      <footer style={{
        textAlign: 'center', padding: '1.5rem', marginTop: 'auto',
        fontSize: '0.78rem', color: 'var(--muted)', borderTop: '1px solid var(--border)',
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
