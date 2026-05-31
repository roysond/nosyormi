import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Treemap,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  APP_COLORS,
  FORECAST_ACTUAL_COLOR,
  FORECAST_PREDICTED_COLOR,
  LINE_STROKE_COLOR,
  LINE_FILL_COLOR,
} from '../constants/palette';
import { JewelBar, AnomalyBar, JewelSlice, UniversalTooltip } from '../components/chartEffects';
import {
  fetchActiveStatement,
  STATEMENT_FILENAME_KEY,
  STATEMENT_ID_KEY,
  subscribeStatementSwitched,
} from '../statementSelection';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5034';
const COLORS = APP_COLORS;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChartUpdate {
  type: 'pie' | 'bar' | 'line' | 'anomalies' | 'forecast' | 'stacked' | 'horizontal' | 'treemap' | 'topN' | 'categoryMonthly';
  category: string | null;
  highlightTransactionIds: string[] | null;
}

interface Statement {
  id: string;
  fileName: string;
  uploadedAt: string;
  transactions: Transaction[];
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
  teal: '#C9911A',
  amber: '#f4a623',
  white: '#ffffff',
};

function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatPieCenterAmount(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })}`;
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
  const angleRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const bubblesRef = useRef<Array<{ canvas: HTMLCanvasElement; bubble: HTMLDivElement }>>([]);
  const [inputFocused, setInputFocused] = useState(false);
  const [hoveredPieIndex, setHoveredPieIndex] = useState<number | null>(null);
  const [chatWidth, setChatWidth] = useState(55);
  const [hoveredStackCategory, setHoveredStackCategory] = useState<string | null>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(55);

  const handleDragStart = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = chatWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  };

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    const containerWidth = window.innerWidth;
    const delta = e.clientX - dragStartX.current;
    const deltaPercent = (delta / containerWidth) * 100;
    const newWidth = Math.min(75, Math.max(30, dragStartWidth.current + deltaPercent));
    setChatWidth(newWidth);
  }, []);

  const handleDragEnd = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
  }, [handleDragMove]);

  function drawBorder(canvas: HTMLCanvasElement, bubble: HTMLDivElement, angle: number) {
    canvas.width = bubble.offsetWidth;
    canvas.height = bubble.offsetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.max(w, h);
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 360; i++) {
      const a1 = ((i + angle) * Math.PI) / 180;
      const a2 = ((i + 1 + angle) * Math.PI) / 180;
      const t = i / 360;
      let r2: number;
      let g: number;
      let b: number;
      if (t < 0.5) {
        const p = t * 2;
        r2 = Math.round(52 + (232 - 52) * p);
        g = Math.round(211 + (201 - 211) * p);
        b = Math.round(153 + (106 - 153) * p);
      } else {
        const p = (t - 0.5) * 2;
        r2 = Math.round(232 + (52 - 232) * p);
        g = Math.round(201 + (211 - 201) * p);
        b = Math.round(106 + (153 - 106) * p);
      }
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a1, a2);
      ctx.closePath();
      ctx.fillStyle = `rgb(${r2},${g},${b})`;
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.roundRect(3, 3, w - 6, h - 6, 14);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  function startLoop() {
    if (rafRef.current) return;
    function loop() {
      angleRef.current = (angleRef.current + 1.0) % 360;
      bubblesRef.current.forEach(({ canvas, bubble }) => {
        drawBorder(canvas, bubble, angleRef.current);
      });
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  const expenses = useMemo(
    () => transactions.filter((t) => t.amount < 0),
    [transactions],
  );

  const categoryTotals = useMemo(
    () => buildCategoryTotals(expenses),
    [expenses],
  );

  const loadActiveStatement = useCallback(async () => {
    const result = await fetchActiveStatement<Statement>(API_BASE);
    if (result.kind === 'empty') {
      setStatementId(null);
      setTransactions([]);
      setError('No statements uploaded yet. Upload a CSV from the Statements page.');
      return;
    }
    if (result.kind === 'error') {
      setStatementId(null);
      setTransactions([]);
      setError(result.message);
      return;
    }
    setStatementId(result.statement.id);
    setStatementFileName(result.statement.fileName);
    setTransactions(result.statement.transactions ?? []);
    setError(null);
  }, []);

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

    const savedStatementFileName = sessionStorage.getItem(STATEMENT_FILENAME_KEY);
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

    void loadActiveStatement();
  }, [loadActiveStatement]);

  useEffect(() => {
    const handleStatementSwitched = () => {
      const newId = sessionStorage.getItem(STATEMENT_ID_KEY);
      const savedFileName = sessionStorage.getItem(STATEMENT_FILENAME_KEY);
      if (newId !== statementId) {
        clearChat();
        if (newId) {
          sessionStorage.setItem(STATEMENT_ID_KEY, newId);
        }
        if (savedFileName) {
          sessionStorage.setItem(STATEMENT_FILENAME_KEY, savedFileName);
        }
      }
      if (savedFileName) {
        setStatementFileName(savedFileName);
      }
      void loadActiveStatement();
    };

    return subscribeStatementSwitched(handleStatementSwitched);
  }, [loadActiveStatement, statementId]);

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
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem('nosyormi-chat-messages');
    if (messages.length === 0 && stored) {
      return;
    }
    sessionStorage.setItem('nosyormi-chat-messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (statementId !== null) {
      sessionStorage.setItem(STATEMENT_ID_KEY, statementId);
    }
  }, [statementId]);

  useEffect(() => {
    sessionStorage.setItem(STATEMENT_FILENAME_KEY, statementFileName);
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
    sessionStorage.removeItem(STATEMENT_ID_KEY);
    sessionStorage.removeItem(STATEMENT_FILENAME_KEY);
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
    const history = [...messages];

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

      if (!response.ok || !response.body) {
        throw new Error(`Chat failed (HTTP ${response.status}).`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamedContent = '';
      let assistantMessageAdded = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'text') {
              streamedContent += event.content;
              if (!assistantMessageAdded) {
                setMessages((prev) => [...prev, { role: 'assistant', content: streamedContent }]);
                assistantMessageAdded = true;
                setLoading(false);
              } else {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: streamedContent };
                  return updated;
                });
              }
            }

            if (event.type === 'chart' && event.chartUpdate) {
              setChartUpdate(event.chartUpdate);
            }

            if (event.type === 'error') {
              setMessages((prev) => [...prev, { role: 'assistant', content: event.message }]);
              setLoading(false);
            }

          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
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
    if (type === 'forecast') return 'Next Month Forecast';
    if (type === 'stacked') return 'Monthly Spending by Category';
    if (type === 'horizontal') return 'Category Comparison';
    if (type === 'treemap') return 'Spending Map';
    if (type === 'topN') return 'Biggest Transactions';
    if (type === 'categoryMonthly') {
      return chartUpdate?.category
        ? `${chartUpdate.category} — Monthly Spend`
        : 'Monthly Spend by Category';
    }
    return 'Spending Overview';
  };

  const getChartHint = (): string => {
    const type = chartUpdate?.type;
    if (!type || type === 'pie') return 'Your spending distribution across categories';
    if (type === 'bar') return 'Spending grouped by category';
    if (type === 'line') return 'Your expenses plotted over time';
    if (type === 'anomalies') return 'Transactions flagged by our anomaly detector';
    if (type === 'forecast') return 'Predicted vs actual spending next month';
    if (type === 'stacked') return 'Spending per category stacked by month';
    if (type === 'horizontal') return 'Categories ranked by total spend';
    if (type === 'treemap') return 'Size represents total spend per category';
    if (type === 'topN') return 'Individual transactions ranked by amount';
    if (type === 'categoryMonthly') return 'Monthly spending totals for this category';
    return 'Your spending distribution across categories';
  };

  const renderedChart = useMemo(() => {
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
                shape={(props: any) => (
                  <JewelSlice
                    {...props}
                    isActive={props.index === hoveredPieIndex}
                  />
                )}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={130}
                innerRadius={78}
                paddingAngle={2}
                isAnimationActive={true}
              >
                {pieData.map((_, index) => {
                  const color = COLORS[index % COLORS.length];
                  const isHovered = hoveredPieIndex === index;
                  const hasHover = hoveredPieIndex !== null;
                  const dimmed = hasHover && !isHovered;
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={color}
                      fillOpacity={dimmed ? 0.35 : 1}
                    />
                  );
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
                      ? 'rgba(7,26,30,0.07)'
                      : 'white',
                    border: isActive
                      ? '1px solid rgba(7,26,30,0.25)'
                      : '1px solid #E2E8F0',
                    borderRadius: 999,
                    padding: '4px 10px',
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    color: isActive ? '#071A1E' : '#475569',
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
            <ResponsiveContainer width="100%" height={isDrillDown ? 520 : 280}>
              <BarChart
                data={barData}
                margin={{ top: 10, right: 10, left: 0, bottom: 60 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E2E8F0"
                />
                {isDrillDown ? (
                  <XAxis
                    dataKey="id"
                    tick={<DrillDownTick />}
                    height={90}
                    interval={0}
                  />
                ) : (
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#64748B', fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                )}
                <YAxis
                  tick={{ fill: '#64748B', fontSize: 11 }}
                  stroke="#E2E8F0"
                  tickCount={5}
                  allowDecimals={false}
                  domain={[0, (dataMax: number) => Math.ceil((dataMax * 1.2) / 10) * 10]}
                />
                <Tooltip content={<UniversalTooltip />} wrapperStyle={{ zIndex: 9999 }} />
                {isDrillDown ? (
                  <Bar
                    dataKey="value"
                    shape={(props: any) => <AnomalyBar {...props} isAnomaly={(barData as any[])[props.index]?.isAnomaly} />}
                    fill={COLORS[0]}
                  />
                ) : (
                  <Bar dataKey="value" shape={<JewelBar />}>
                    {barData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Bar>
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
            <ResponsiveContainer width="100%" height={580}>
              <LineChart data={lineData}>
                <defs>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={LINE_FILL_COLOR} />
                    <stop offset="100%" stopColor={LINE_FILL_COLOR} />
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
                  stroke={LINE_STROKE_COLOR}
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
            height: '100%',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
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
                background: 'rgba(217,119,6,0.06)',
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
          style={{
            animation: 'chartFadeIn 0.3s ease-out',
            width: '100%',
            height: '100%',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%" minHeight={480}>
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 20, left: 0, bottom: 100 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#64748B', fontSize: 10 }}
                  height={90}
                  angle={-45}
                  textAnchor="end"
                  stroke="#E2E8F0"
                />
                <YAxis
                  tick={{ fill: '#64748B', fontSize: 11 }}
                  stroke="#E2E8F0"
                  tickCount={5}
                  allowDecimals={false}
                  domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15 / 50) * 50]}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    return (
                      <div
                        style={{
                          background: 'white',
                          border: '1px solid #E2E8F0',
                          borderRadius: 8,
                          padding: '10px 14px',
                          fontSize: 12,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          minWidth: 180,
                        }}
                      >
                        <div style={{ color: '#64748B', marginBottom: 6, fontWeight: 600 }}>
                          {label}
                        </div>
                        {payload.map((entry: any) => (
                          <div
                            key={entry.dataKey}
                            style={{ color: entry.color, marginBottom: 3 }}
                          >
                            {entry.name}: ${Number(entry.value).toFixed(2)}
                          </div>
                        ))}
                      </div>
                    );
                  }}
                  wrapperStyle={{ zIndex: 9999 }}
                />
                <Legend />
                <Bar
                  dataKey="actual"
                  name="Historical Avg"
                  shape={<JewelBar />}
                  fill={FORECAST_ACTUAL_COLOR}
                />
                <Bar
                  dataKey="forecast"
                  name="Next Month Forecast"
                  shape={<JewelBar />}
                  fill={FORECAST_PREDICTED_COLOR}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (type === 'stacked') {
      const months = Array.from(
        new Set(
          expenses.map((t) => {
            const d = new Date(t.transactionDate + 'T00:00:00');
            return `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
          }),
        ),
      ).sort((a, b) => {
        const monthOrder = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const [aMonth, aYear] = a.split(' ');
        const [bMonth, bYear] = b.split(' ');
        if (aYear !== bYear) return Number(aYear) - Number(bYear);
        return monthOrder.indexOf(aMonth) - monthOrder.indexOf(bMonth);
      });
      const categories = Array.from(new Set(expenses.map((t) => t.category || 'Other')));
      const stackedData = months.map((month) => {
        const row: Record<string, string | number> = { month };
        categories.forEach((cat) => {
          row[cat] = expenses
            .filter((t) => {
              const d = new Date(t.transactionDate + 'T00:00:00');
              const m = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
              return m === month && (t.category || 'Other') === cat;
            })
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        });
        return row;
      });
      return (
        <div key="stacked" style={{ animation: 'chartFadeIn 0.3s ease-out', width: '100%' }}>
          <div style={{ width: '100%' }}>
            <ResponsiveContainer width="100%" height={620}>
              <BarChart data={stackedData} margin={{ top: 10, right: 10, left: 0, bottom: 80 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E2E8F0"
                  syncWithTicks={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#64748B', fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                />
                <YAxis
                  tick={{ fill: '#64748B', fontSize: 11 }}
                  stroke="#E2E8F0"
                  tickCount={5}
                  allowDecimals={false}
                  domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15 / 50) * 50]}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const target = hoveredStackCategory
                      ? payload.find((e: any) => e.dataKey === hoveredStackCategory)
                      : payload[payload.length - 1];
                    if (!target || Number(target.value) === 0) return null;
                    const monthTotal = payload.reduce((sum: number, e: any) => sum + Number(e.value), 0);
                    return (
                      <div style={{
                        background: 'white',
                        border: `2px solid ${target.color}`,
                        borderRadius: 8,
                        padding: '10px 14px',
                        fontSize: 12,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                        minWidth: 160,
                      }}>
                        <div style={{ color: '#64748B', marginBottom: 4, fontSize: 11 }}>{label}</div>
                        <div style={{ color: target.color, fontWeight: 700, fontSize: 14 }}>{target.name}</div>
                        <div style={{ color: '#1E293B', fontWeight: 600, marginTop: 2 }}>
                          ${Number(target.value).toFixed(2)}
                        </div>
                        <div style={{
                          color: '#94A3B8',
                          fontSize: 11,
                          marginTop: 6,
                          borderTop: '1px solid #F1F5F9',
                          paddingTop: 6
                        }}>
                          Month total: ${monthTotal.toFixed(2)}
                        </div>
                      </div>
                    );
                  }}
                  wrapperStyle={{ zIndex: 9999 }}
                />
                <Legend />
                {categories.map((cat, index) => (
                  <Bar
                    key={cat}
                    dataKey={cat}
                    stackId="a"
                    fill={APP_COLORS[index % APP_COLORS.length]}
                    shape={<JewelBar />}
                    isAnimationActive={false}
                    onMouseEnter={() => setHoveredStackCategory(cat)}
                    onMouseLeave={() => setHoveredStackCategory(null)}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (type === 'horizontal') {
      const hData = categoryTotals
        .slice()
        .sort((a, b) => b.value - a.value)
        .map((c) => ({ name: c.name, value: c.value }));
      return (
        <div key="horizontal" style={{ animation: 'chartFadeIn 0.3s ease-out', width: '100%' }}>
          <div style={{ width: '100%' }}>
            <ResponsiveContainer width="100%" height={Math.max(520, hData.length * 80)}>
              <BarChart data={hData} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: '#64748B', fontSize: 11 }}
                  stroke="#E2E8F0"
                  tickCount={5}
                  domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.1 / 50) * 50]}
                />
                <YAxis type="category" dataKey="name" tick={{ fill: '#64748B', fontSize: 11 }} width={75} />
                <Tooltip content={<UniversalTooltip />} wrapperStyle={{ zIndex: 9999 }} />
                <Bar dataKey="value" shape={<JewelBar />}>
                  {hData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={APP_COLORS[index % APP_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (type === 'treemap') {
      const tData = categoryTotals.map((c, index) => ({
        name: c.name,
        size: c.value,
        fill: APP_COLORS[index % APP_COLORS.length],
      }));
      const CustomTreemapContent = ({ x, y, width, height, name, fill, value }: any) => {
              const showText = width > 80 && height > 50;
        if (!name || width < 30 || height < 20) return null;
        return (
          <g>
            <rect
              x={x + 1}
              y={y + 1}
              width={width - 2}
              height={height - 2}
              rx={6}
              ry={6}
              fill={fill}
              fillOpacity={0.85}
              stroke="white"
              strokeWidth={2}
            />
            {showText && (
              <>
                <text
                  x={x + width / 2}
                  y={y + height / 2 - 6}
                  textAnchor="middle"
                  fill="white"
                  fontSize={Math.min(13, width / 6)}
                  fontWeight={600}
                >
                  {name}
                </text>
                <text
                  x={x + width / 2}
                  y={y + height / 2 + 10}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.85)"
                  fontSize={Math.min(11, width / 7)}
                >
                  ${value?.toFixed(0)}
                </text>
              </>
            )}
          </g>
        );
      };
      return (
        <div
          key="treemap"
          style={{ animation: 'chartFadeIn 0.4s ease-out', width: '100%', background: 'transparent' }}
        >
          <ResponsiveContainer width="100%" height={420} style={{ background: 'transparent' }}>
            <Treemap
              data={tData}
              dataKey="size"
              aspectRatio={4 / 3}
              isAnimationActive={false}
              stroke="transparent"
              content={<CustomTreemapContent />}>
              <Tooltip content={<UniversalTooltip />} wrapperStyle={{ zIndex: 9999 }} />
            </Treemap>
          </ResponsiveContainer>
        </div>
      );
    }

    if (type === 'topN') {
      const n = chartUpdate?.highlightTransactionIds?.length ?? 10;
      const topData = [...expenses]
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
        .slice(0, n)
        .map((t) => ({
          id: t.id,
          name: t.description.length > 16 ? `${t.description.substring(0, 16)}...` : t.description,
          fullName: t.description,
          value: Math.abs(t.amount),
          isAnomaly: t.isAnomaly,
          date: t.transactionDate,
          category: t.category,
        }));

      const TopNTick = ({ x, y, payload }: any) => {
        const entry = topData.find((d) => d.id === payload.value);
        const label = entry?.name || payload.value;
        return (
          <g transform={`translate(${x},${y})`}>
            <text
              x={0} y={0} dy={12}
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
        <div key="topN" style={{ animation: 'chartFadeIn 0.3s ease-out', width: '100%' }}>
          <ResponsiveContainer width="100%" height={560}>
            <BarChart data={topData} margin={{ top: 10, right: 10, left: 0, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="id" tick={<TopNTick />} height={90} interval={0} />
              <YAxis
                tick={{ fill: '#64748B', fontSize: 11 }}
                stroke="#E2E8F0"
                tickCount={5}
                allowDecimals={false}
                domain={[0, (dataMax: number) => Math.ceil((dataMax * 1.2) / 10) * 10]}
              />
              <Tooltip content={<UniversalTooltip />} wrapperStyle={{ zIndex: 9999 }} />
              <Bar
                dataKey="value"
                shape={(props: any) => <AnomalyBar {...props} isAnomaly={topData[props.index]?.isAnomaly} />}
                fill="#00637C"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (type === 'categoryMonthly') {
      const cat = chartUpdate?.category;
      const filtered = expenses.filter((t) => !cat || (t.category || 'Other') === cat);

      const monthlyMap: Record<string, number> = {};
      filtered.forEach((t) => {
        const d = new Date(t.transactionDate + 'T00:00:00');
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyMap[key] = (monthlyMap[key] ?? 0) + Math.abs(t.amount);
      });

      const monthlyData = Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => ({
          month: new Date(key + '-01T00:00:00').toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric',
          }),
          value: Math.round(value * 100) / 100,
        }));

      return (
        <div
          key="categoryMonthly"
          style={{
            animation: 'chartFadeIn 0.3s ease-out',
            width: '100%',
            height: '100%',
            flex: 1,
          }}
        >
          <ResponsiveContainer width="100%" height={520}>
            <BarChart data={monthlyData} margin={{ top: 20, right: 20, left: 0, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                dataKey="month"
                tick={{ fill: '#64748B', fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
              />
              <YAxis
                tick={{ fill: '#64748B', fontSize: 11 }}
                stroke="#E2E8F0"
                tickCount={5}
                allowDecimals={false}
                domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15 / 10) * 10]}
              />
              <Tooltip content={<UniversalTooltip />} wrapperStyle={{ zIndex: 9999 }} />
              <Bar dataKey="value" shape={<JewelBar />}>
                {monthlyData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    return null;
  }, [
    chartUpdate,
    transactions,
    expenses,
    categoryTotals,
    forecastData,
    hoveredPieIndex,
    hoveredStackCategory,
  ]);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', background: '#F4F7F9' }}>
      <style>{`
        @keyframes tooltipFadeIn {
          from { opacity: 0; transform: translateY(4px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes chartFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes chat-dot-pulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes chat-anomaly-pulse {
          0%, 100% { box-shadow: inset 0 0 0 0 rgba(217,119,6,0); }
          50% { box-shadow: inset 0 0 22px rgba(217,119,6,0.22); }
        }
        @keyframes loadingBorderSpin {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
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
          flex: `0 0 ${chatWidth}%`,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#F4F7F9',
          borderRight: '1px solid #E2E8F0',
        }}
      >
        <div
          style={{
            padding: '24px 28px',
            background: '#F4F7F9',
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
            gap: '30px',
            background: '#F4F7F9',
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
              <p style={{ margin: 0, color: colors.hint, fontSize: 15 }}>
                Ask me about your spending, anomalies, or forecasts.
              </p>
            </div>
          )}

          {messages.map((msg, index) =>
            msg.role === 'user' ? (
              <div
                key={index}
                style={{
                  alignSelf: 'flex-end',
                  background: 'rgba(7,26,30,0.88)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  color: '#E8EDEE',
                  padding: '11px 17px',
                  borderRadius: '18px 18px 4px 18px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  maxWidth: '72%',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  whiteSpace: 'pre-wrap',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow:
                    '0 8px 24px rgba(7,26,30,0.35), 0 4px 10px rgba(7,26,30,0.2), 0 1px 3px rgba(7,26,30,0.15)',
                }}
              >
                {msg.content}
              </div>
            ) : (
              <div
                key={index}
                ref={(el) => {
                  if (el) {
                    const canvas = el.querySelector('canvas') as HTMLCanvasElement;
                    const bubble = el as HTMLDivElement;
                    const existing = bubblesRef.current.find((b) => b.bubble === bubble);
                    if (!existing && canvas) {
                      bubblesRef.current.push({ canvas, bubble });
                      startLoop();
                    }
                  }
                }}
                style={{
                  alignSelf: 'flex-start',
                  position: 'relative',
                  borderRadius: '18px 18px 18px 4px',
                  padding: '3px',
                  maxWidth: '78%',
                  boxShadow:
                    '0 8px 24px rgba(52,211,153,0.15), 0 4px 10px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '18px 18px 18px 4px',
                    overflow: 'hidden',
                    zIndex: 0,
                  }}
                >
                  <canvas
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                    }}
                  />
                </div>
                <div
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    background: 'rgba(255,255,255,0.97)',
                    borderRadius: '16px 16px 16px 3px',
                    padding: '11px 17px',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    color: '#1E293B',
                    margin: '0',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ),
          )}

          {loading && (
            <div
              style={{
                alignSelf: 'flex-start',
                position: 'relative',
                borderRadius: '18px 18px 18px 4px',
                padding: '2px',
                background: 'linear-gradient(135deg, #34D399, #E8C96A, #34D399)',
                backgroundSize: '200% 200%',
                animation: 'loadingBorderSpin 0.5s linear infinite',
                boxShadow:
                  '0 0 20px rgba(52,211,153,0.8), 0 0 40px rgba(232,201,106,0.6), 0 0 60px rgba(52,211,153,0.3)',
              }}
            >
              <div
                style={{
                  background: '#F8FAFC',
                  borderRadius: '16px 16px 16px 3px',
                  padding: '14px 18px',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#94A3B8',
                    animation: 'chat-dot-pulse 1.4s ease-in-out infinite',
                    animationDelay: '0ms',
                  }}
                />
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#94A3B8',
                    animation: 'chat-dot-pulse 1.4s ease-in-out infinite',
                    animationDelay: '200ms',
                  }}
                />
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#94A3B8',
                    animation: 'chat-dot-pulse 1.4s ease-in-out infinite',
                    animationDelay: '400ms',
                  }}
                />
              </div>
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
              background: '#F4F7F9',
              border: `1px solid ${inputFocused ? '#C9911A' : '#E2E8F0'}`,
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
              background: '#071A1E',
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

      <div
        onMouseDown={handleDragStart}
        style={{
          width: 6,
          cursor: 'col-resize',
          background: 'transparent',
          flexShrink: 0,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 2,
            height: 48,
            borderRadius: 999,
            background: '#CBD5E1',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#00637C')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#CBD5E1')}
        />
      </div>

      {/* Right panel */}
      <div
        style={{
          flex: `0 0 ${100 - chatWidth}%`,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          overflow: 'hidden',
          background: '#F4F7F9',
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
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            paddingTop: 12,
          }}
        >
          {renderedChart}
        </div>
        <p style={{ margin: '12px 0 0', color: colors.hint, fontSize: 12 }}>
          {getChartHint()}
        </p>
      </div>
    </div>
  );
}
