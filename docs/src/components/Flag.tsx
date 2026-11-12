/**
 * Country flags rendered as inline SVG.
 *
 * Emoji flags (🇧🇩) look fine on macOS but degrade to bare letter pairs on
 * Windows, so the site draws simple, recognisable versions instead. These are
 * stylised reconstructions for identification — not heraldic reproductions —
 * which is why the Bangladesh disc is centred.
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

    default:
      return frame(<>
        <rect width="60" height="40" fill="#334155" />
        <text x="30" y="26" textAnchor="middle" fontSize="16" fill="#cbd5e1"
              fontFamily="system-ui, sans-serif" fontWeight="700">{cc}</text>
      </>)
  }
}
