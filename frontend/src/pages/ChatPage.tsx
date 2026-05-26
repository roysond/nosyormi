import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PieSectorShapeProps } from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5034';
const COLORS = [
  '#00637C',
  '#38c9b0',
  '#5ab4e8',
  '#9b7fe8',
  '#f4a623',
  '#5ad97a',
  '#e8607a',
];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChartUpdate {
  type: 'pie' | 'bar' | 'line' | 'anomalies' | 'forecast';
  category: string | null;
  highlightTransactionIds: string[] | null;
}

interface ChatResponse {
  answer: string;
  chartUpdate: ChartUpdate | null;
}

interface StatementSummary {
  id: string;
  fileName: string;
  uploadedAt: string;
  transactionCount: number;
}

interface Transaction {
  id: string;
  transactionDate: string;
  description: string;
  amount: number;
  isAnomaly: boolean;
  category?: string;
}

interface CategoryTotal {
  name: string;
  value: number;
}

interface CategoryTotalWithPercentage extends CategoryTotal {
  percentage: number;
}

interface ForecastItem {
  category: string;
  actualAverage: number;
  forecastedAmount: number;
}

const colors = {
  text: '#1E293B',
  muted: '#64748B',
  hint: '#94A3B8',
  teal: '#00637C',
  amber: '#f4a623',
  white: '#ffffff',
};

const UniversalTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(0, 99, 124, 0.3)',
        borderRadius: '12px',
        padding: '10px 14px',
        boxShadow:
          '0 8px 32px rgba(0, 99, 124, 0.2), inset 0 1px 0 rgba(255,255,255,0.9)',
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
          color: '#00637C',
          marginBottom: '4px',
          letterSpacing: '0.04em',
          textTransform: 'uppercase' as const,
        }}
      >
        {item.payload?.fullName || item.payload?.name || ''}
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
        <div style={{ fontSize: '10px', color: '#F59E0B', marginTop: '4px' }}>⚠ ANOMALY</div>
      )}
      {item.payload?.percentage && (
        <div style={{ fontSize: '11px', color: '#64748B' }}>
          {item.payload.percentage.toFixed(1)}% of total
        </div>
      )}
    </div>
  );
};

function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function hexWithOpacity(hex: string, alphaHex = '66'): string {
  return `${hex}${alphaHex}`;
}

function formatPieCenterAmount(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })}`;
}

function renderActivePieShape(props: PieSectorShapeProps) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={(outerRadius ?? 0) + 8}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
    />
  );
}

function renderPieSector(
  props: PieSectorShapeProps,
  index: number,
  hoveredPieIndex: number | null,
) {
  if (index === hoveredPieIndex) {
    return renderActivePieShape(props);
  }
  return <Sector {...props} />;
}

function buildCategoryTotals(expenses: Transaction[]): CategoryTotal[] {
  return Object.values(
    expenses.reduce((acc, t) => {
      const cat = t.category || 'Other';
      if (!acc[cat]) acc[cat] = { name: cat, value: 0 };
      acc[cat].value = Math.round((acc[cat].value + Math.abs(t.amount)) * 100) / 100;
      return acc;
    }, {} as Record<string, CategoryTotal>),
  ).sort((a, b) => b.value - a.value);
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [chartUpdate, setChartUpdate] = useState<ChartUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forecastData, setForecastData] = useState<ForecastItem[]>([]);
  const [statementId, setStatementId] = useState<string | null>(null);
  const [statementFileName, setStatementFileName] = useState<string>('your statement');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [hoveredPieIndex, setHoveredPieIndex] = useState<number | null>(null);

  const expenses = useMemo(
    () => transactions.filter((t) => t.amount < 0),
    [transactions],
  );

  const categoryTotals = useMemo(
    () => buildCategoryTotals(expenses),
    [expenses],
  );

  useEffect(() => {
    const savedMessages = sessionStorage.getItem('nosyormi-chat-messages');
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages) as ChatMessage[];
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        }
      } catch {
        // ignore invalid persisted chat history
      }
    }

    const savedStatementId = sessionStorage.getItem('nosyormi-chat-statement-id');
    const savedStatementFileName = sessionStorage.getItem('nosyormi-chat-statement-filename');
    if (savedStatementFileName) {
      setStatementFileName(savedStatementFileName);
    }

    const savedChartUpdate = sessionStorage.getItem('nosyormi-chat-chart-update');
    if (savedChartUpdate) {
      try {
        const parsed = JSON.parse(savedChartUpdate) as ChartUpdate | null;
        setChartUpdate(parsed);
      } catch {
        // ignore invalid persisted chart update
      }
    }

    (async () => {
      try {
        const listRes = await fetch(`${API_BASE}/api/statements`);
        if (!listRes.ok) {
          throw new Error(`Failed to load statements (HTTP ${listRes.status}).`);
        }
        const summaries: StatementSummary[] = await listRes.json();
        if (summaries.length === 0) {
          setError('No statements uploaded yet. Upload a CSV from the Statements page.');
          return;
        }
        const persistedSummary =
          savedStatementId != null
            ? summaries.find((s) => s.id === savedStatementId)
            : undefined;
        const summary = persistedSummary ?? summaries[0];
        const id = summary.id;
        setStatementId(id);
        setStatementFileName(summary.fileName);
        const detailRes = await fetch(`${API_BASE}/api/statements/${id}`);
        if (!detailRes.ok) {
          throw new Error(`Failed to load statement (HTTP ${detailRes.status}).`);
        }
        const data = await detailRes.json();
        setTransactions(data.transactions ?? []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load statement.');
      }
    })();
  }, []);

  useEffect(() => {
    if (chartUpdate?.type !== 'forecast' || statementId === null) return;

    fetch(`${API_BASE}/api/forecast/${statementId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load forecast (HTTP ${res.status}).`);
        return res.json();
      })
      .then((data: ForecastItem[]) => setForecastData(data))
      .catch(() => setForecastData([]));
  }, [chartUpdate?.type, statementId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    sessionStorage.setItem('nosyormi-chat-messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (statementId !== null) {
      sessionStorage.setItem('nosyormi-chat-statement-id', statementId);
    }
  }, [statementId]);

  useEffect(() => {
    sessionStorage.setItem('nosyormi-chat-statement-filename', statementFileName);
  }, [statementFileName]);

  useEffect(() => {
    if (chartUpdate === null) {
      sessionStorage.removeItem('nosyormi-chat-chart-update');
    } else {
      sessionStorage.setItem('nosyormi-chat-chart-update', JSON.stringify(chartUpdate));
    }
  }, [chartUpdate]);

  const clearChat = () => {
    sessionStorage.removeItem('nosyormi-chat-messages');
    sessionStorage.removeItem('nosyormi-chat-chart-update');
    sessionStorage.removeItem('nosyormi-chat-statement-id');
    sessionStorage.removeItem('nosyormi-chat-statement-filename');
    setMessages([]);
    setChartUpdate(null);
  };

  useEffect(() => {
    const handleStatementDeleted = () => {
      clearChat();
    };

    window.addEventListener('nosyormi-statement-deleted', handleStatementDeleted);
    return () =>
      window.removeEventListener('nosyormi-statement-deleted', handleStatementDeleted);
  }, []);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || statementId === null) return;

    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    const history = [...messages, userMessage];

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/chat/${statementId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `Chat failed (HTTP ${response.status}).`);
      }

      const data: ChatResponse = await response.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }]);
      if (data.chartUpdate) {
        setChartUpdate(data.chartUpdate);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setMessages((prev) => [...prev, { role: 'assistant', content: message }]);
    } finally {
      setLoading(false);
    }
  };

  const getChartTitle = (): string => {
    const type = chartUpdate?.type;
    if (!type || type === 'pie') return 'Spending Overview';
    if (type === 'bar') {
      if (chartUpdate?.category !== null && chartUpdate?.category !== undefined) {
        return `${chartUpdate.category} Breakdown`;
      }
      return 'Category Breakdown';
    }
    if (type === 'line') return 'Spending Over Time';
    if (type === 'anomalies') return 'Anomalies Detected';
    return 'Next Month Forecast';
  };

  const getChartHint = (): string => {
    const type = chartUpdate?.type;
    if (!type || type === 'pie') return 'Your spending distribution across categories';
    if (type === 'bar') return 'Spending grouped by category';
    if (type === 'line') return 'Your expenses plotted over time';
    if (type === 'anomalies') return 'Transactions flagged by our anomaly detector';
    return 'Predicted vs actual spending next month';
  };

  const renderChart = () => {
    const type = chartUpdate?.type ?? 'pie';

    if (type === 'pie' || !chartUpdate?.type) {
      const totalSpend = categoryTotals.reduce((sum, c) => sum + c.value, 0);
      const pieData: CategoryTotalWithPercentage[] = categoryTotals.map((c) => ({
        ...c,
        percentage:
          totalSpend > 0 ? Math.round((c.value / totalSpend) * 1000) / 10 : 0,
      }));
      const hoveredCategory =
        hoveredPieIndex !== null ? pieData[hoveredPieIndex] : null;

      return (
        <div
          key={chartUpdate?.type ?? 'pie'}
          style={{
            animation: 'chartFadeIn 0.3s ease-out',
            width: '100%',
          }}
        >
          <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
            <div style={{ width: '100%' }}>
            <ResponsiveContainer width="100%" height={340}>
              <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={130}
                innerRadius={78}
                paddingAngle={2}
                shape={(props, index) =>
                  renderPieSector(props, index, hoveredPieIndex)
                }
                onMouseEnter={(_: unknown, index: number) =>
                  setHoveredPieIndex(index)
                }
                onMouseLeave={() => setHoveredPieIndex(null)}
              >
                {pieData.map((_, index) => {
                  const color = COLORS[index % COLORS.length];
                  const isHighlighted = index === hoveredPieIndex;
                  const hasHighlight = hoveredPieIndex !== null;
                  const fill =
                    hasHighlight && !isHighlighted
                      ? hexWithOpacity(color)
                      : color;
                  return <Cell key={`cell-${index}`} fill={fill} />;
                })}
              </Pie>
              <Tooltip content={<UniversalTooltip />} wrapperStyle={{ zIndex: 9999 }} />
              </PieChart>
            </ResponsiveContainer>
            </div>
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                zIndex: 0,
                textAlign: 'center',
              }}
            >
              {hoveredPieIndex === null ? (
                <>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#1E293B',
                    }}
                  >
                    {formatPieCenterAmount(totalSpend)}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: '#94A3B8',
                      marginTop: 2,
                    }}
                  >
                    total spend
                  </div>
                </>
              ) : (
                hoveredCategory && (
                  <>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: '#1E293B',
                      }}
                    >
                      {formatPieCenterAmount(hoveredCategory.value)}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: '#94A3B8',
                        marginTop: 2,
                      }}
                    >
                      {hoveredCategory.name.length > 12
                        ? `${hoveredCategory.name.slice(0, 12)}…`
                        : hoveredCategory.name}
                    </div>
                  </>
                )
              )}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              justifyContent: 'center',
              marginTop: 12,
            }}
          >
            {pieData.map((category, index) => {
              const isActive = index === hoveredPieIndex;
              return (
                <div
                  key={category.name}
                  onMouseEnter={() => setHoveredPieIndex(index)}
                  onMouseLeave={() => setHoveredPieIndex(null)}
                  style={{
                    background: isActive
                      ? 'rgba(0,99,124,0.08)'
                      : 'white',
                    border: isActive
                      ? '1px solid rgba(0,99,124,0.25)'
                      : '1px solid #E2E8F0',
                    borderRadius: 999,
                    padding: '4px 10px',
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    color: isActive ? '#00637C' : '#475569',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: COLORS[index % COLORS.length],
                      flexShrink: 0,
                    }}
                  />
                  {category.name}: ${category.value.toFixed(0)}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (type === 'bar') {
      const isDrillDown =
        chartUpdate?.category !== null && chartUpdate?.category !== undefined;

      const drillDownData = isDrillDown
        ? expenses
            .filter((t) => (t.category || 'Other') === chartUpdate.category)
            .map((t) => ({
              id: t.id,
              name:
                t.description.length > 14
                  ? `${t.description.substring(0, 14)}...`
                  : t.description,
              fullName: t.description,
              value: Math.abs(t.amount),
              isAnomaly: t.isAnomaly,
              date: t.transactionDate,
            }))
        : [];

      const barData = isDrillDown ? drillDownData : buildCategoryTotals(expenses);

      const AnomalyBarShape = (props: any) => {
        const { x, y, width, height, index } = props;
        if (!height || height <= 0) return null;
        const entry = drillDownData[index];
        const isAnomaly = entry?.isAnomaly;
        return (
          <g
            style={
              isAnomaly
                ? { animation: 'barAnomalyGlow 2s ease-in-out infinite' }
                : {}
            }
          >
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              fill={isAnomaly ? '#F59E0B' : '#00637C'}
              rx={4}
              ry={4}
            />
          </g>
        );
      };

      const DrillDownTick = ({ x, y, payload }: any) => {
        const entry = drillDownData.find((d: { id: string }) => d.id === payload.value);
        const label = entry?.name || payload.value;
        return (
          <g transform={`translate(${x},${y})`}>
            <text
              x={0}
              y={0}
              dy={12}
              textAnchor="end"
              fill="#64748B"
              fontSize={10}
              transform="rotate(-35)"
            >
              {label}
            </text>
          </g>
        );
      };

      return (
        <div
          key={chartUpdate?.type ?? 'pie'}
          style={{ animation: 'chartFadeIn 0.3s ease-out', width: '100%' }}
        >
          <div style={{ width: '100%' }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={barData}
                margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E2E8F0"
                />
                {isDrillDown ? (
                  <XAxis
                    dataKey="id"
                    tick={<DrillDownTick />}
                    height={65}
                    interval={0}
                  />
                ) : (
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#64748B', fontSize: 10 }}
                    angle={-35}
                    textAnchor="end"
                    height={60}
                    interval={0}
                  />
                )}
                <YAxis
                  tick={{ fill: '#64748B', fontSize: 11 }}
                  stroke="#E2E8F0"
                />
                <Tooltip content={<UniversalTooltip />} wrapperStyle={{ zIndex: 9999 }} />
                {isDrillDown ? (
                  <Bar
                    dataKey="value"
                    shape={(props: any) => <AnomalyBarShape {...props} />}
                  />
                ) : (
                  <Bar dataKey="value" fill="#00637C" radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (type === 'line') {
      const lineData = [...expenses]
        .sort(
          (a, b) =>
            new Date(a.transactionDate + 'T00:00:00').getTime() -
            new Date(b.transactionDate + 'T00:00:00').getTime(),
        )
        .map((t) => ({
          date: formatShortDate(t.transactionDate),
          amount: Math.abs(t.amount),
        }));

      return (
        <div
          key={chartUpdate?.type ?? 'pie'}
          style={{ animation: 'chartFadeIn 0.3s ease-out', width: '100%' }}
        >
          <div style={{ width: '100%' }}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={lineData}>
                <defs>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(0,99,124,0.3)" />
                    <stop offset="100%" stopColor="rgba(0,99,124,0)" />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(0,0,0,0.06)"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#64748B', fontSize: 11 }}
                  stroke="#E2E8F0"
                />
                <YAxis
                  tick={{ fill: '#64748B', fontSize: 11 }}
                  stroke="#E2E8F0"
                />
                <Tooltip content={<UniversalTooltip />} wrapperStyle={{ zIndex: 9999 }} />
                <Area
                  type="monotone"
                  dataKey="amount"
                  fill="url(#lineGradient)"
                  stroke="none"
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#00637C"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (type === 'anomalies') {
      const highlightIds = new Set(chartUpdate.highlightTransactionIds ?? []);
      const dbAnomalies = transactions.filter((t) => t.isAnomaly);
      const shownIds = new Set(dbAnomalies.map((t) => t.id));
      const highlightedExtras = transactions.filter(
        (t) => highlightIds.has(t.id) && !shownIds.has(t.id),
      );
      const anomalyRows = [...dbAnomalies, ...highlightedExtras];

      if (anomalyRows.length === 0) {
        return (
          <div
            key={chartUpdate?.type ?? 'pie'}
            style={{ animation: 'chartFadeIn 0.3s ease-out', width: '100%' }}
          >
            <p style={{ color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 40 }}>
              No anomalies detected in this statement.
            </p>
          </div>
        );
      }

      return (
        <div
          key={chartUpdate?.type ?? 'pie'}
          style={{
            animation: 'chartFadeIn 0.3s ease-out',
            width: '100%',
            overflowY: 'auto',
            maxHeight: 280,
          }}
        >
          {anomalyRows.map((tx) => (
            <div
              key={tx.id}
              className="chat-anomaly-row"
              style={{
                display: 'grid',
                gridTemplateColumns: '72px 1fr auto',
                gap: 12,
                alignItems: 'center',
                padding: '12px 10px',
                marginBottom: 8,
                borderLeft: '3px solid rgba(245,158,11,0.6)',
                background: 'rgba(245,158,11,0.04)',
                borderRadius: 4,
              }}
            >
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  color: colors.hint,
                }}
              >
                {formatShortDate(tx.transactionDate)}
              </span>
              <span style={{ color: colors.text, fontSize: 13 }}>{tx.description}</span>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 13,
                  color: tx.amount > 0 ? '#10B981' : '#EF4444',
                  flexShrink: 0,
                  minWidth: 80,
                  textAlign: 'right',
                }}
              >
                {tx.amount >= 0
                  ? `$${tx.amount.toFixed(2)}`
                  : `-$${Math.abs(tx.amount).toFixed(2)}`}
              </span>
            </div>
          ))}
        </div>
      );
    }

    if (type === 'forecast') {
      const chartData = forecastData.map((f) => ({
        name: f.category,
        actual: f.actualAverage,
        forecast: f.forecastedAmount,
      }));

      return (
        <div
          key={chartUpdate?.type ?? 'pie'}
          style={{ animation: 'chartFadeIn 0.3s ease-out', width: '100%' }}
        >
          <div style={{ width: '100%' }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#64748B', fontSize: 11 }}
                  angle={-25}
                  textAnchor="end"
                  height={50}
                  stroke="#E2E8F0"
                />
                <YAxis tick={{ fill: '#64748B', fontSize: 11 }} stroke="#E2E8F0" />
                <Tooltip content={<UniversalTooltip />} wrapperStyle={{ zIndex: 9999 }} />
                <Legend />
                <Bar dataKey="actual" name="Actual Avg" fill="#00637C" radius={[4, 4, 0, 0]} />
                <Bar dataKey="forecast" name="Forecast" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', background: '#CCE8EC' }}>
      <style>{`
        @keyframes tooltipFadeIn {
          from { opacity: 0; transform: translateY(4px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes chartFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes barAnomalyGlow {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(245, 158, 11, 0.5)); }
          50% { filter: drop-shadow(0 0 14px rgba(245, 158, 11, 0.9)); }
        }
        @keyframes chat-dot-pulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes chat-anomaly-pulse {
          0%, 100% { box-shadow: inset 0 0 0 0 rgba(244,166,35,0); }
          50% { box-shadow: inset 0 0 20px rgba(244,166,35,0.12); }
        }
        .chat-anomaly-row {
          animation: chat-anomaly-pulse 2s ease-in-out infinite;
        }
        .chat-typing-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #94A3B8;
          margin-right: 4px;
          animation: chat-dot-pulse 1.2s ease-in-out infinite;
        }
        .chat-typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .chat-typing-dot:nth-child(3) { animation-delay: 0.4s; margin-right: 0; }
      `}</style>

      {/* Left panel */}
      <div
        style={{
          flex: '0 0 55%',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#CCE8EC',
          borderRight: '1px solid #E2E8F0',
        }}
      >
        <div
          style={{
            padding: '24px 28px',
            background: '#CCE8EC',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: '#1E293B', fontSize: '1.35rem', fontWeight: 600 }}>
              Ask NOSYOR.M.I
            </h2>
            <p style={{ margin: '6px 0 0', color: '#64748B', fontSize: 13 }}>
              Reflecting on {statementFileName}
            </p>
            {error && (
              <p style={{ margin: '8px 0 0', color: colors.amber, fontSize: 12 }}>{error}</p>
            )}
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearChat}
              style={{
                background: 'transparent',
                border: '1px solid #CBD5E1',
                color: '#94A3B8',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 11,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Clear chat
            </button>
          )}
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: '#CCE8EC',
          }}
        >
          {messages.length === 0 && !loading && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: 48, marginBottom: 16 }} aria-hidden>
                🪞
              </span>
              <p style={{ margin: 0, color: colors.hint, fontSize: 15 }}>
                Ask me about your spending, anomalies, or forecasts.
              </p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={index}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                background:
                  msg.role === 'user' ? '#00637C' : '#F8FAFC',
                border:
                  msg.role === 'user' ? 'none' : '1px solid #E2E8F0',
                borderRadius:
                  msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding: '12px 16px',
                maxWidth: msg.role === 'user' ? '75%' : '80%',
                color: msg.role === 'user' ? 'white' : '#1E293B',
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {msg.content}
            </div>
          ))}

          {loading && (
            <div
              style={{
                alignSelf: 'flex-start',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '16px 16px 16px 4px',
                padding: '14px 18px',
              }}
            >
              <span className="chat-typing-dot" />
              <span className="chat-typing-dot" />
              <span className="chat-typing-dot" />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div
          style={{
            padding: '16px 28px',
            background: 'white',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            gap: 12,
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void sendMessage();
            }}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder="Ask about your spending..."
            disabled={loading}
            style={{
              flex: 1,
              background: '#CCE8EC',
              border: `1px solid ${inputFocused ? '#00637C' : '#E2E8F0'}`,
              borderRadius: 12,
              padding: '14px 18px',
              color: '#1E293B',
              fontSize: 14,
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={loading || !input.trim()}
            style={{
              background: colors.teal,
              color: colors.white,
              border: 'none',
              borderRadius: 12,
              padding: '14px 20px',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              fontSize: 14,
              opacity: loading || !input.trim() ? 0.6 : 1,
            }}
          >
            →
          </button>
        </div>
      </div>

      {/* Right panel */}
      <div
        style={{
          flex: '0 0 45%',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          overflow: 'hidden',
          background: '#CCE8EC',
          borderLeft: '1px solid #E2E8F0',
        }}
      >
        <h3
          style={{
            margin: '0 0 16px',
            color: '#1E293B',
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          {getChartTitle()}
        </h3>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
          }}
        >
          {renderChart()}
        </div>
        <p style={{ margin: '12px 0 0', color: colors.hint, fontSize: 12 }}>
          {getChartHint()}
        </p>
      </div>
    </div>
  );
}
