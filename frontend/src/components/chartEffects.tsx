import './chartEffects.css';
import { Cell, Sector } from 'recharts';
import { APP_COLORS, ANOMALY_COLOR } from '../constants/palette';
import { BRAND_TEAL } from '../constants/palette';

export const JewelBar = (props: any) => {
  const { x, y, width, height, fill } = props;
  if (!height || height <= 0) return null;
  const color = fill ?? BRAND_TEAL;
  const id = `jwl${Math.round(x)}${Math.round(y)}`;
  return (
    <g>
      <defs>
        <radialGradient id={`${id}r`} cx="38%" cy="28%" r="72%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.30)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.01)" />
        </radialGradient>
      </defs>
      <rect x={x} y={y} width={width} height={height} rx={4} ry={4} fill={color} />
      <rect x={x} y={y} width={width} height={height} rx={4} ry={4} fill={`url(#${id}r)`} />
      <rect x={x} y={y} width={width} height={height} rx={4} ry={4} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
    </g>
  );
};

interface JewelCellsProps {
  data: unknown[];
  hoveredIndex?: number | null;
  activeIndex?: number | null;
}

export function JewelCells({ data, activeIndex = null }: JewelCellsProps) {
  return (
    <>
      {data.map((_, index) => {
        const color = APP_COLORS[index % APP_COLORS.length];
        const isActive = activeIndex === index;
        const hasActive = activeIndex !== null;
        const dimmed = hasActive && !isActive;
        return (
          <Cell
            key={`jewel-cell-${index}`}
            fill={color}
            fillOpacity={dimmed ? 0.35 : 1}
            stroke={isActive ? color : 'none'}
            strokeWidth={isActive ? 2.5 : 0}
          />
        );
      })}
    </>
  );
}

export const AnomalyBar = (props: any) => {
  const { height, isAnomaly } = props;
  if (!height || height <= 0) return null;
  if (isAnomaly) {
    const { x, y, width } = props;
    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={4}
        ry={4}
        fill={ANOMALY_COLOR}
        style={{ animation: 'barAnomalyGlow 1.2s ease-in-out infinite' }}
      />
    );
  }
  return <JewelBar {...props} />;
};

export const JewelSlice = (props: any) => {
  const { outerRadius, startAngle, endAngle, isActive } = props;
  if (!outerRadius || outerRadius <= 0) return null;
  const shimmerEnd = startAngle + (endAngle - startAngle) * 0.42;
  const activeOuter = isActive ? outerRadius + 8 : outerRadius;
  const shimmerInner = activeOuter - Math.round(activeOuter * 0.2);
  return (
    <g>
      <Sector
        {...props}
        outerRadius={activeOuter}
        stroke={isActive ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.22)'}
        strokeWidth={isActive ? 3 : 2}
        fillOpacity={isActive ? 1 : 0.88}
      />
      <Sector
        cx={props.cx}
        cy={props.cy}
        innerRadius={shimmerInner}
        outerRadius={activeOuter}
        startAngle={startAngle}
        endAngle={shimmerEnd}
        fill="rgba(255,255,255,0.18)"
        stroke="none"
        cornerRadius={0}
      />
    </g>
  );
};

export const UniversalTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  const name = item.payload?.fullName || item.payload?.name || item.name || '';
  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(18,67,70,0.3)',
        borderRadius: '12px',
        padding: '10px 14px',
        boxShadow: '0 8px 32px rgba(18,67,70,0.2), inset 0 1px 0 rgba(255,255,255,0.9)',
        minWidth: '140px',
        animation: 'tooltipFadeIn 0.15s ease-out',
        zIndex: 9999,
        position: 'relative' as const,
      }}
    >
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: BRAND_TEAL,
          marginBottom: '4px',
          letterSpacing: '0.04em',
          textTransform: 'uppercase' as const,
        }}
      >
        {name}
      </div>
      {item.payload?.date && (
        <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '4px' }}>
          {item.payload.date}
        </div>
      )}
      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B', marginBottom: '2px' }}>
        ${typeof item.value === 'number' ? item.value.toFixed(2) : item.value}
      </div>
      {item.payload?.isAnomaly && (
        <div style={{ fontSize: '10px', color: ANOMALY_COLOR, marginTop: '4px' }}>⚠ ANOMALY</div>
      )}
      {item.payload?.percentage && (
        <div style={{ fontSize: '11px', color: '#64748B' }}>
          {item.payload.percentage.toFixed(1)}% of total
        </div>
      )}
    </div>
  );
};
