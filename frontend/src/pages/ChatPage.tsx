import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
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
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const STATEMENT_ID = '3574c93a-16ac-43e6-a142-a5463437d542';
const API_BASE = 'http://localhost:5034';
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

interface ForecastItem {
  category: string;
  actualAverage: number;
  forecastedAmount: number;
}

const colors = {
  text: '#e8ecf4',
  muted: '#7a8aaa',
  teal: '#00637C',
  amber: '#f4a623',
  white: '#ffffff',
};

const tooltipBoxStyle: CSSProperties = {
  background: 'rgba(13, 21, 38, 0.92)',
  border: '1px solid rgba(0, 200, 220, 0.25)',
  borderRadius: '10px',
  padding: '10px 16px',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  boxShadow: '0 4px 24px rgba(0, 99, 124, 0.2)',
  color: '#e8ecf4',
  fontSize: '13px',
};

function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputFocused, setInputFocused] = useState(false);

  const expenses = useMemo(
    () => transactions.filter((t) => t.amount < 0),
    [transactions],
  );

  const categoryTotals = useMemo(
    () => buildCategoryTotals(expenses),
    [expenses],
  );

  useEffect(() => {
    fetch(`${API_BASE}/api/statements/${STATEMENT_ID}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load statement (HTTP ${res.status}).`);
        return res.json();
      })
      .then((data) => {
        setTransactions(data.transactions ?? []);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load statement.');
      });
  }, []);

  useEffect(() => {
    if (chartUpdate?.type !== 'forecast') return;

    fetch(`${API_BASE}/api/forecast/${STATEMENT_ID}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load forecast (HTTP ${res.status}).`);
        return res.json();
      })
      .then((data: ForecastItem[]) => setForecastData(data))
      .catch(() => setForecastData([]));
  }, [chartUpdate?.type]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const GlassTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ name?: string; value?: number; payload?: { isAnomaly?: boolean } }>;
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    const value = Number(payload[0].value ?? 0);
    return (
      <div style={tooltipBoxStyle}>
        {label && (
          <div
            style={{
              color: colors.muted,
              marginBottom: 4,
              fontFamily: 'monospace',
              fontSize: 11,
            }}
          >
            {label}
          </div>
        )}
        {!label && payload[0].name && (
          <div
            style={{
              color: colors.muted,
              marginBottom: 4,
              fontFamily: 'monospace',
              fontSize: 11,
            }}
          >
            {payload[0].name}
          </div>
        )}
        <div style={{ color: colors.white, fontWeight: 600 }}>
          ${value.toFixed(2)}
        </div>
      </div>
    );
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    const history = messages;

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/chat/${STATEMENT_ID}`, {
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
    if (type === 'bar') return 'Category Breakdown';
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
      return (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={categoryTotals}
              dataKey="value"
              nameKey="name"
              cx="40%"
              cy="50%"
              outerRadius={90}
            >
              {categoryTotals.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<GlassTooltip />} />
            <Legend layout="vertical" align="right" verticalAlign="middle" />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (type === 'bar') {
      const filtered = chartUpdate.category
        ? expenses.filter((t) => (t.category || 'Other') === chartUpdate.category)
        : expenses;
      const barData = buildCategoryTotals(filtered);

      return (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={barData}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" />
            <XAxis
              dataKey="name"
              tick={{ fill: colors.muted, fontSize: 11 }}
              stroke="rgba(255,255,255,0.2)"
            />
            <YAxis
              tick={{ fill: colors.muted, fontSize: 11 }}
              stroke="rgba(255,255,255,0.2)"
            />
            <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(0, 99, 124, 0.1)' }} />
            <Bar dataKey="value" fill={colors.teal} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
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
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={lineData}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" />
            <XAxis
              dataKey="date"
              tick={{ fill: colors.muted, fontSize: 11 }}
              stroke="rgba(255,255,255,0.2)"
            />
            <YAxis
              tick={{ fill: colors.muted, fontSize: 11 }}
              stroke="rgba(255,255,255,0.2)"
            />
            <Tooltip content={<GlassTooltip />} />
            <Line
              type="monotone"
              dataKey="amount"
              stroke={colors.teal}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (type === 'anomalies') {
      const highlightIds = new Set(chartUpdate.highlightTransactionIds ?? []);
      const anomalyRows = transactions.filter(
        (t) => t.isAnomaly || highlightIds.has(t.id),
      );

      if (anomalyRows.length === 0) {
        return (
          <p style={{ color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 40 }}>
            No anomalies detected in this statement.
          </p>
        );
      }

      return (
        <div style={{ overflowY: 'auto', maxHeight: 280 }}>
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
                borderLeft: `3px solid ${colors.amber}`,
                background: 'rgba(244,166,35,0.06)',
                borderRadius: 4,
              }}
            >
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  color: colors.muted,
                }}
              >
                {formatShortDate(tx.transactionDate)}
              </span>
              <span style={{ color: colors.text, fontSize: 13 }}>{tx.description}</span>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 13,
                  color: colors.white,
                }}
              >
                -${Math.abs(tx.amount).toFixed(2)}
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
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" />
            <XAxis
              dataKey="name"
              tick={{ fill: colors.muted, fontSize: 10 }}
              stroke="rgba(255,255,255,0.2)"
            />
            <YAxis
              tick={{ fill: colors.muted, fontSize: 11 }}
              stroke="rgba(255,255,255,0.2)"
            />
            <Tooltip content={<GlassTooltip />} />
            <Legend />
            <Bar dataKey="actual" name="Actual Avg" fill={colors.teal} radius={[4, 4, 0, 0]} />
            <Bar dataKey="forecast" name="Forecast" fill={colors.amber} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    return null;
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 0px)', overflow: 'hidden' }}>
      <style>{`
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
          background: #7a8aaa;
          margin-right: 4px;
          animation: chat-dot-pulse 1.2s ease-in-out infinite;
        }
        .chat-typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .chat-typing-dot:nth-child(3) { animation-delay: 0.4s; margin-right: 0; }
      `}</style>

      {/* Left panel */}
      <div
        style={{
          flex: '0 0 60%',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          borderRight: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 style={{ margin: 0, color: colors.white, fontSize: '1.35rem', fontWeight: 600 }}>
            Ask NOSYOR.M.I
          </h2>
          <p style={{ margin: '6px 0 0', color: colors.muted, fontSize: 13 }}>
            Reflecting on sample_statement.csv
          </p>
          {error && (
            <p style={{ margin: '8px 0 0', color: colors.amber, fontSize: 12 }}>{error}</p>
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
              <p style={{ margin: 0, color: colors.muted, fontSize: 15 }}>
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
                  msg.role === 'user'
                    ? 'rgba(0,99,124,0.35)'
                    : 'rgba(255,255,255,0.04)',
                border:
                  msg.role === 'user'
                    ? '1px solid rgba(0,200,220,0.2)'
                    : '1px solid rgba(255,255,255,0.08)',
                borderRadius:
                  msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding: '12px 16px',
                maxWidth: msg.role === 'user' ? '75%' : '80%',
                color: colors.text,
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
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
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
            borderTop: '1px solid rgba(255,255,255,0.07)',
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
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${inputFocused ? 'rgba(0,200,220,0.4)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 12,
              padding: '14px 18px',
              color: colors.text,
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
          flex: '0 0 40%',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        <h3
          style={{
            margin: '0 0 16px',
            color: colors.white,
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          {getChartTitle()}
        </h3>
        <div style={{ flex: 1, minHeight: 0 }}>{renderChart()}</div>
        <p style={{ margin: '12px 0 0', color: colors.muted, fontSize: 12 }}>
          {getChartHint()}
        </p>
      </div>
    </div>
  );
}
