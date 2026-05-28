import { Cell } from 'recharts';

export const CRYSTAL_COLORS = [
  '#00637C',
  '#38c9b0',
  '#f4a623',
  '#9b7fe8',
  '#e8607a',
  '#5ad97a',
  '#f97316',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#0891B2',
];

export function hexWithOpacity(hex: string, opacity: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

interface CrystalCellsProps {
  data: unknown[];
  hoveredIndex?: number | null;
}

export function CrystalCells({ data, hoveredIndex = null }: CrystalCellsProps) {
  return (
    <>
      {data.map((_, index) => {
        const color = CRYSTAL_COLORS[index % CRYSTAL_COLORS.length];
        const isHovered = index === hoveredIndex;
        const hasHover = hoveredIndex !== null;
        const opacity = hasHover && !isHovered ? 0.5 : 1.0;
        return (
          <Cell
            key={`crystal-cell-${index}`}
            fill={hexWithOpacity(color, opacity)}
          />
        );
      })}
    </>
  );
}
