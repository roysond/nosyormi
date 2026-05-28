import { Cell } from 'recharts';
import { APP_COLORS } from '../constants/palette';

export const JewelBar = (props: any) => {
  const { x, y, width, height, fill } = props;
  if (!height || height <= 0) return null;
  const color = fill ?? '#00637C';
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
    return <rect x={x} y={y} width={width} height={height} rx={4} ry={4} fill="#F59E0B" />;
  }
  return <JewelBar {...props} />;
};
