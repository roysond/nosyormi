import type { CSSProperties } from 'react';

interface NosyormiLogoProps {
  size?: number;
  showWordmark?: boolean;
  style?: CSSProperties;
}

// ── NOSYOR.M.I Logo ───────────────────────────────────────────
// Icon: teal circle (r=36, cx=50, cy=50) with six descending
// gold bars forming the letter N (square proportion: width=height=40px)
// surrounded by four sharp-cut donut arc segments in Google colors.
//
// Bar specs: width=5px, gap=2px, baseline y=70
// x positions:  30  37  44  51  58  65
// heights:      40  32  24  16   8  40
// tops:         30  38  46  54  62  30
//
// Arc specs: r=44, stroke-width=7, stroke-linecap=butt
// Blue  #4285F4 — top-right    (53.8,6.2)  → (93.8,46.2)
// Red   #EA4335 — right-bottom (93.8,53.8) → (53.8,93.8)
// Yellow #FBBC05 — bottom-left (46.2,93.8) → (6.2,53.8)
// Green  #34A853 — left-top    (6.2,46.2)  → (46.2,6.2)
// ─────────────────────────────────────────────────────────────

const ICON_COLORS = {
  teal:   '#124346',
  gold:   '#D4A843',
  blue:   '#4285F4',
  red:    '#EA4335',
  yellow: '#FBBC05',
  green:  '#34A853',
} as const;

export default function NosyormiLogo({
  size = 32,
  showWordmark = false,
  style,
}: NosyormiLogoProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: showWordmark ? 10 : 0,
        ...style,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
        aria-label="NOSYOR.M.I logo"
      >
        {/* Four donut arc segments — sharp cut (butt linecap) */}
        <path d="M53.8,6.2 A44,44,0,0,1,93.8,46.2" fill="none" stroke={ICON_COLORS.blue}   strokeWidth="7" strokeLinecap="butt"/>
        <path d="M93.8,53.8 A44,44,0,0,1,53.8,93.8" fill="none" stroke={ICON_COLORS.red}    strokeWidth="7" strokeLinecap="butt"/>
        <path d="M46.2,93.8 A44,44,0,0,1,6.2,53.8"  fill="none" stroke={ICON_COLORS.yellow} strokeWidth="7" strokeLinecap="butt"/>
        <path d="M6.2,46.2 A44,44,0,0,1,46.2,6.2"   fill="none" stroke={ICON_COLORS.green}  strokeWidth="7" strokeLinecap="butt"/>

        {/* Teal circle background */}
        <circle cx="50" cy="50" r="36" fill={ICON_COLORS.teal}/>

        {/* Six gold bars forming letter N — square proportion (40×40px) */}
        <rect x="30" y="30" width="5" height="40" rx="1.5" fill={ICON_COLORS.gold}/>
        <rect x="37" y="38" width="5" height="32" rx="1.5" fill={ICON_COLORS.gold}/>
        <rect x="44" y="46" width="5" height="24" rx="1.5" fill={ICON_COLORS.gold}/>
        <rect x="51" y="54" width="5" height="16" rx="1.5" fill={ICON_COLORS.gold}/>
        <rect x="58" y="62" width="5" height="8"  rx="1.5" fill={ICON_COLORS.gold}/>
        <rect x="65" y="30" width="5" height="40" rx="1.5" fill={ICON_COLORS.gold}/>
      </svg>

      {showWordmark && (
        <div
          style={{
            fontSize: '15px',
            fontWeight: 800,
            color: ICON_COLORS.teal,
            letterSpacing: '0.01em',
            whiteSpace: 'nowrap',
            fontFamily: 'Urbanist, sans-serif',
          }}
        >
          NOSYOR<span style={{ color: ICON_COLORS.gold }}>.</span>
          M<span style={{ color: ICON_COLORS.gold }}>.</span>I
        </div>
      )}
    </div>
  );
}
