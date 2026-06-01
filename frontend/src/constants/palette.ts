// NOSYOR.M.I — Colour Palette
// Change colours here ONLY. Never edit chartEffects.tsx for colour changes.
// Add or remove colours from this array freely — effects will pick them up automatically.

export const APP_COLORS = [
  '#59A14F', // Food & Groceries
  '#F28E2B', // Transport & Fuel
  '#EDC948', // Parking & Tolls
  '#FF9DA7', // Subscriptions
  '#4E79A7', // Shopping
  '#B07AA1', // Utilities & Bills
  '#BCBD22', // Income
  '#E15759', // Healthcare
  '#17BECF', // Entertainment
  '#76B7B2', // Dining & Takeaway
  '#7B4F9E', // Transfers & Payments
  '#9C755F', // ATM & Cash
  '#06B6D4', // Education
  '#F97316', // Government & Fees
  '#BAB0AC', // Other
];

export const FORECAST_ACTUAL_COLOR = '#00637C';
export const FORECAST_PREDICTED_COLOR = '#f4a623';
export const LINE_STROKE_COLOR = '#00897B';
export const LINE_FILL_COLOR = 'rgba(0,137,123,0.08)';
export const ANOMALY_COLOR = '#D97706';

export const BRAND_TEAL_BASE = '#124346';
export const BRAND_TEAL_CENTRE = '#1A5E5A';
export const BRAND_TEAL_EDGE = '#0A2E30';
export const BRAND_GOLD = '#D4A843';
export const BRAND_SIDEBAR_GRADIENT = `radial-gradient(ellipse at 40% 30%, #1A5E5A 0%, #124346 45%, #0A2E30 100%)`;

// ── macOS glass texture ───────────────────────────────────────
// A reusable macOS-vibrancy GLASS TEXTURE. Colour is NOT baked in —
// pass any tint via macosGlass(rgb, opacity). The texture (blur +
// saturation + brightness + grain + dual edge hairlines) stays constant;
// only the colour changes. Use for modals, overlays, popovers, any colour.

// The colour-independent part of the material:
export const MACOS_GLASS_TEXTURE = {
  backdropFilter: 'blur(16px) saturate(200%) brightness(1.1)',
  WebkitBackdropFilter: 'blur(16px) saturate(200%) brightness(1.1)',
  boxShadow: '0 22px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.25)',
  borderRadius: '20px',
} as const;

// Builder: combine the texture with any tint colour + opacity.
// Pass colour as an "R,G,B" string. Opacity tunable 0.5–0.85; 0.66 default.
// Example: macosGlass('18,67,70', 0.66) → brand teal glass.
export function macosGlass(rgb: string, opacity: number = 0.66) {
  const lighter = opacity;
  const darker = Math.min(opacity + 0.06, 1);
  return {
    ...MACOS_GLASS_TEXTURE,
    background: `linear-gradient(155deg, rgba(${rgb},${lighter}) 0%, rgba(${rgb},${darker}) 100%)`,
  };
}

// Grain overlay — also colour-independent. Apply to an absolutely
// positioned layer inside the glass element: opacity 0.5,
// mixBlendMode 'overlay', pointerEvents 'none'.
export const MACOS_GLASS_GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23g)'/%3E%3C/svg%3E\")";

// Brand-teal preset, built from the texture above.
export const MACOS_GLASS_TEAL = macosGlass('18,67,70', 0.66);
