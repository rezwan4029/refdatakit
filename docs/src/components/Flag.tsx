/**
 * Country flags rendered as inline SVG.
 *
 * Emoji flags (🇧🇩) look fine on macOS but degrade to bare letter pairs on
 * Windows, so the site draws simple, recognisable versions instead. These are
 * stylised reconstructions for identification — not heraldic reproductions —
 * which is why the Bangladesh disc is centred and Nepal's pennants simplified.
 */

type FlagProps = { code: string; size?: number }

export default function Flag({ code, size = 20 }: FlagProps) {
  const cc = code.toUpperCase()
  const w = size * 1.5
  const h = size
  const rx = Math.max(2, size * 0.14)

  const frame = (children: React.ReactNode) => (
    <svg
      width={w} height={h} viewBox="0 0 60 40"
      role="img" aria-label={`${cc} flag`}
      style={{ display: 'block', flexShrink: 0, borderRadius: rx, overflow: 'hidden' }}
    >
      {children}
    </svg>
  )

  switch (cc) {
    // Bangladesh — green field, red disc slightly left of centre
    case 'BD':
      return frame(<>
        <rect width="60" height="40" fill="#006A4E" />
        <circle cx="26" cy="20" r="12" fill="#F42A41" />
      </>)

    // Bhutan — divided diagonally, yellow over orange, with a white dragon
    case 'BT':
      return frame(<>
        <rect width="60" height="40" fill="#FFD520" />
        <path d="M60 0 L60 40 L0 40 Z" fill="#FF4E12" />
        <circle cx="30" cy="20" r="6.5" fill="#fff" />
        <circle cx="28" cy="19" r="1.6" fill="#1a1a1a" />
        <circle cx="33" cy="19" r="1.6" fill="#1a1a1a" />
      </>)

    // Sri Lanka — maroon field with gold lion, orange/green stripes at hoist
    case 'LK':
      return frame(<>
        <rect width="60" height="40" fill="#8D153A" />
        <rect x="0" y="0" width="5" height="40" fill="#00534E" />
        <rect x="5" y="0" width="5" height="40" fill="#EB7400" />
        <rect x="10" y="0" width="50" height="40" fill="#8D153A" />
        <rect x="10" y="0" width="50" height="40" fill="none" stroke="#D4A017" strokeWidth="1.6" />
        <circle cx="34" cy="20" r="8" fill="#D4A017" />
      </>)

    // Maldives — red field, green rectangle, white crescent
    case 'MV':
      return frame(<>
        <rect width="60" height="40" fill="#D21034" />
        <rect x="16" y="10" width="28" height="20" fill="#007E3A" />
        <circle cx="33" cy="20" r="6" fill="#fff" />
        <circle cx="36.5" cy="20" r="6" fill="#007E3A" />
      </>)

    // Nepal — double pennant, crimson with blue border, simplified
    case 'NP':
      return frame(<>
        <rect width="60" height="40" fill="#fff" />
        <path d="M4 2 L4 38 L34 27 L15 20 L34 11 Z" fill="#DC143C" stroke="#003893" strokeWidth="2" />
      </>)

    // Singapore — red over white, crescent and five stars
    case 'SG':
      return frame(<>
        <rect width="60" height="20" fill="#EF3340" />
        <rect y="20" width="60" height="20" fill="#fff" />
        <circle cx="13" cy="10" r="6" fill="#fff" />
        <circle cx="16" cy="10" r="5.2" fill="#EF3340" />
        {[[19, 5.4], [23, 8.6], [21.6, 13.4], [16.4, 13.4], [15, 8.6]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.15" fill="#fff" />
        ))}
      </>)

    default:
      return frame(<>
        <rect width="60" height="40" fill="#334155" />
        <text x="30" y="26" textAnchor="middle" fontSize="16" fill="#cbd5e1"
              fontFamily="system-ui, sans-serif" fontWeight="700">{cc}</text>
      </>)
  }
}
