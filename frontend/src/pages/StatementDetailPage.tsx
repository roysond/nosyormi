import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const CHART_COLORS = [
  '#00637C',
  '#38c9b0',
  '#5ab4e8',
  '#9b7fe8',
  '#f4a623',
  '#5ad97a',
  '#e8607a',
];

interface Transaction {
  id: string;
  transactionDate: string;
  description: string;
  amount: number;
  isAnomaly: boolean;
  category?: string;
}

interface StatementDetail {
  id: string;
  fileName: string;
  uploadedAt: string;
  transactions: Transaction[];
}

interface CategoryTotal {
  name: string;
  value: number;
}

const colors = {
  text: '#e8ecf4',
  muted: '#7a8aaa',
  teal: '#00637C',
  amber: '#f4a623',
  white: '#ffffff',
  income: '#5ad97a',
};

const styles = {
  page: {
    padding: '8px 24px 40px',
    maxWidth: 960,
  },
  backLink: {
    display: 'inline-block',
    marginBottom: 24,
    color: colors.muted,
    textDecoration: 'none',
    fontSize: '0.9rem',
  },
  title: {
    margin: '0 0 8px',
    fontSize: '1.75rem',
    fontWeight: 600,
    color: colors.text,
    wordBreak: 'break-word' as const,
  },
  subtitle: {
    margin: '0 0 28px',
    color: colors.muted,
    fontSize: '0.95rem',
  },
  statsRow: {
    display: 'flex',
    gap: 16,
    marginBottom: 32,
    flexWrap: 'wrap' as const,
  },
  statCard: {
    flex: '1 1 180px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 10,
    padding: '20px 24px',
  },
  statLabel: {
    margin: '0 0 8px',
    fontSize: '0.8rem',
    color: colors.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  statValue: (color: string) => ({
    margin: 0,
    fontSize: '1.75rem',
    fontWeight: 600,
    color,
  }),
  tabs: {
    display: 'flex',
    gap: 4,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    marginBottom: 24,
  },
  tab: (active: boolean) => ({
    padding: '10px 20px',
    border: 'none',
    borderBottom: active ? `2px solid ${colors.teal}` : '2px solid transparent',
    background: 'transparent',
    color: active ? colors.white : colors.muted,
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: active ? 500 : 400,
    marginBottom: -1,
  }),
  transactionRow: (isAnomaly: boolean) => ({
    display: 'grid',
    gridTemplateColumns: '100px 1fr auto',
    gap: 16,
    alignItems: 'center',
    padding: '14px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    borderLeft: isAnomaly ? `3px solid ${colors.amber}` : '3px solid transparent',
    background: isAnomaly ? 'rgba(244,166,35,0.06)' : 'transparent',
    animation: isAnomaly ? 'anomaly-row-pulse 2s ease-in-out infinite' : undefined,
  }),
  txDate: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 12,
    color: colors.muted,
  },
  txDescription: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap' as const,
    color: colors.white,
    fontSize: '0.95rem',
  },
  anomalyBadge: {
    fontSize: 11,
    color: colors.amber,
    fontWeight: 500,
  },
  txAmount: (positive: boolean) => ({
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '0.95rem',
    fontWeight: 500,
    color: positive ? colors.income : colors.white,
    textAlign: 'right' as const,
  }),
  chartsStack: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 40,
    alignItems: 'center',
  },
  chartBlock: {
    width: '100%',
    maxWidth: 480,
  },
  chartTitle: {
    margin: '0 0 16px',
    fontSize: '1rem',
    fontWeight: 500,
    color: colors.text,
    textAlign: 'center' as const,
  },
  loading: {
    color: colors.teal,
    animation: 'dashboard-pulse 1.6s ease-in-out infinite',
  },
  error: {
    color: colors.amber,
  },
};

function formatUploadedDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export default function StatementDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [statement, setStatement] = useState<StatementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'transactions' | 'charts'>('transactions');
  const [backHover, setBackHover] = useState(false);

  useEffect(() => {
    if (!id) {
      setError('Statement ID is missing.');
      setLoading(false);
      return;
    }

    fetch(`http://localhost:5034/api/statements/${id}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load statement (HTTP ${res.status}).`);
        }
        return res.json();
      })
      .then((data: StatementDetail) => {
        setStatement(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load statement.');
        setLoading(false);
      });
  }, [id]);

  const derived = useMemo(() => {
    if (!statement) {
      return {
        expenses: [] as Transaction[],
        categoryTotals: [] as CategoryTotal[],
        anomalies: [] as Transaction[],
        totalSpend: 0,
        totalIncome: 0,
        anomalyCount: 0,
        barData: [] as Array<{
          id: string;
          label: string;
          amount: number;
          isAnomaly: boolean;
        }>,
      };
    }

    const expenses = statement.transactions.filter((t) => t.amount < 0);
    const anomalies = statement.transactions.filter((t) => t.isAnomaly);
    const totalSpend = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalIncome = statement.transactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const categoryTotals: CategoryTotal[] = Object.values(
      expenses.reduce((acc, t) => {
        const cat = t.category || 'Other';
        if (!acc[cat]) acc[cat] = { name: cat, value: 0 };
        acc[cat].value = Math.round((acc[cat].value + Math.abs(t.amount)) * 100) / 100;
        return acc;
      }, {} as Record<string, CategoryTotal>),
    ).sort((a, b) => b.value - a.value);

    return {
      expenses,
      categoryTotals,
      anomalies,
      totalSpend,
      totalIncome,
      anomalyCount: anomalies.length,
      barData: expenses.map((t) => ({
        id: t.id,
        label: formatShortDate(t.transactionDate),
        amount: Math.abs(t.amount),
        isAnomaly: t.isAnomaly,
      })),
    };
  }, [statement]);

  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(13, 21, 38, 0.92)',
          border: '1px solid rgba(0, 200, 220, 0.25)',
          borderRadius: '10px',
          padding: '10px 16px',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 4px 24px rgba(0, 99, 124, 0.2)',
          color: '#e8ecf4',
          fontSize: '13px',
        }}>
          <div style={{ color: '#7a8aaa', marginBottom: '4px', fontFamily: 'monospace', fontSize: '11px' }}>{label}</div>
          <div style={{ color: '#ffffff', fontWeight: 600 }}>Amount: ${payload[0].value.toFixed(2)}</div>
          {payload[0].payload.isAnomaly && (
            <div style={{ color: '#f4a623', fontSize: '11px', marginTop: '4px' }}>⚠ Anomaly detected</div>
          )}
        </div>
      );
    }
    return null;
  };

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(13, 21, 38, 0.92)',
          border: '1px solid rgba(0, 200, 220, 0.25)',
          borderRadius: '10px',
          padding: '10px 16px',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 4px 24px rgba(0, 99, 124, 0.2)',
          color: '#e8ecf4',
          fontSize: '13px',
        }}>
          <div style={{ color: '#7a8aaa', marginBottom: '4px', fontFamily: 'monospace', fontSize: '11px' }}>{payload[0].name}</div>
          <div style={{ color: '#ffffff', fontWeight: 600 }}>${payload[0].value.toFixed(2)}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="page-content" style={styles.page}>
      <style>{`
        @keyframes dashboard-pulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }
        @keyframes anomaly-row-pulse {
          0%, 100% { box-shadow: inset 0 0 0 0 rgba(244,166,35,0); }
          50% { box-shadow: inset 0 0 24px rgba(244,166,35,0.12); }
        }
      `}</style>

      <Link
        to="/"
        style={{
          ...styles.backLink,
          color: backHover ? colors.teal : colors.muted,
        }}
        onMouseEnter={() => setBackHover(true)}
        onMouseLeave={() => setBackHover(false)}
      >
        ← Back to Dashboard
      </Link>

      {loading && <p style={styles.loading}>Reflecting on your data...</p>}

      {!loading && error && <p style={styles.error}>{error}</p>}

      {!loading && !error && statement && (
        <>
          <h1 style={styles.title}>{statement.fileName}</h1>
          <p style={styles.subtitle}>
            {statement.transactions.length} transactions · Uploaded{' '}
            {formatUploadedDate(statement.uploadedAt)}
          </p>

          <div style={styles.statsRow}>
            <div style={styles.statCard}>
              <p style={styles.statLabel}>Total Spend</p>
              <p style={styles.statValue(colors.white)}>
                ${derived.totalSpend.toFixed(2)}
              </p>
            </div>
            <div style={styles.statCard}>
              <p style={styles.statLabel}>Total Income</p>
              <p style={styles.statValue(colors.teal)}>
                ${derived.totalIncome.toFixed(2)}
              </p>
            </div>
            <div style={styles.statCard}>
              <p style={styles.statLabel}>Anomalies</p>
              <p
                style={styles.statValue(
                  derived.anomalyCount > 0 ? colors.amber : colors.white,
                )}
              >
                {derived.anomalyCount}
              </p>
            </div>
          </div>

          <div style={styles.tabs}>
            <button
              type="button"
              style={styles.tab(activeTab === 'transactions')}
              onClick={() => setActiveTab('transactions')}
            >
              Transactions
            </button>
            <button
              type="button"
              style={styles.tab(activeTab === 'charts')}
              onClick={() => setActiveTab('charts')}
            >
              Charts
            </button>
          </div>

          {activeTab === 'transactions' && (
            <div>
              {statement.transactions.map((tx) => (
                <div key={tx.id} style={styles.transactionRow(tx.isAnomaly)}>
                  <span style={styles.txDate}>
                    {formatShortDate(tx.transactionDate)}
                  </span>
                  <div style={styles.txDescription}>
                    <span>{tx.description}</span>
                    {tx.isAnomaly && (
                      <span style={styles.anomalyBadge}>⚠ anomaly</span>
                    )}
                  </div>
                  <span style={styles.txAmount(tx.amount > 0)}>
                    {tx.amount > 0
                      ? `+$${tx.amount.toFixed(2)}`
                      : `-$${Math.abs(tx.amount).toFixed(2)}`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'charts' && (
            <div style={styles.chartsStack}>
              <div style={styles.chartBlock}>
                <h2 style={styles.chartTitle}>Spending by Category</h2>
                <PieChart width={500} height={320}>
                  <Pie
                    data={derived.categoryTotals}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                  >
                    {derived.categoryTotals.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" />
                </PieChart>
              </div>

              <div style={{ ...styles.chartBlock, maxWidth: '100%' }}>
                <h2 style={styles.chartTitle}>Transaction Amounts</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={derived.barData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: colors.muted, fontSize: 11 }}
                      stroke="rgba(255,255,255,0.2)"
                    />
                    <YAxis
                      tick={{ fill: colors.muted, fontSize: 11 }}
                      stroke="rgba(255,255,255,0.2)"
                    />
                    <Tooltip
                      content={<CustomBarTooltip />}
                      cursor={{ fill: 'rgba(0, 99, 124, 0.1)' }}
                    />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {derived.barData.map((entry) => (
                        <Cell
                          key={entry.id}
                          fill={entry.isAnomaly ? colors.amber : colors.teal}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
