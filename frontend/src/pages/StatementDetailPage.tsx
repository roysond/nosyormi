import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
} from 'recharts';
import type { PieSectorShapeProps } from 'recharts';

const COLORS = [
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

function formatPeriodLabel(period: string): string {
  if (period === 'all') return 'All Time';
  const [year, month] = period.split('-');
  const date = new Date(`${year}-${month}-01T00:00:00`);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function renderActiveShape(props: PieSectorShapeProps) {
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
  activeCategoryIndex: number | null,
) {
  if (activeCategoryIndex === index) {
    return renderActiveShape(props);
  }
  return <Sector {...props} />;
}

export default function StatementDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [statement, setStatement] = useState<StatementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'transactions' | 'charts'>('transactions');
  const [activeCategoryIndex, setActiveCategoryIndex] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('all');
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
        anomalies: [] as Transaction[],
        totalSpend: 0,
        totalIncome: 0,
        anomalyCount: 0,
      };
    }

    const expenses = statement.transactions.filter((t) => t.amount < 0);
    const anomalies = statement.transactions.filter((t) => t.isAnomaly);
    const totalSpend = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalIncome = statement.transactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      expenses,
      anomalies,
      totalSpend,
      totalIncome,
      anomalyCount: anomalies.length,
    };
  }, [statement]);

  const chartsDerived = useMemo(() => {
    if (!statement) {
      return {
        availablePeriods: ['all'] as string[],
        filteredTransactions: [] as Transaction[],
        filteredExpenses: [] as Transaction[],
        filteredCategoryTotals: [] as CategoryTotal[],
        totalFilteredSpend: 0,
        activeCategory: null as CategoryTotal | null,
        activeCategoryHasAnomaly: false,
      };
    }

    const periodSet = new Set<string>();
    for (const t of statement.transactions) {
      if (t.transactionDate.length >= 7) {
        periodSet.add(t.transactionDate.slice(0, 7));
      }
    }
    const availablePeriods = ['all', ...Array.from(periodSet).sort()];

    const filteredTransactions =
      selectedPeriod === 'all'
        ? statement.transactions
        : statement.transactions.filter((t) =>
            t.transactionDate.startsWith(selectedPeriod),
          );

    const filteredExpenses = filteredTransactions.filter((t) => t.amount < 0);

    const filteredCategoryTotals: CategoryTotal[] = Object.values(
      filteredExpenses.reduce((acc, t) => {
        const cat = t.category || 'Other';
        if (!acc[cat]) acc[cat] = { name: cat, value: 0 };
        acc[cat].value = Math.round((acc[cat].value + Math.abs(t.amount)) * 100) / 100;
        return acc;
      }, {} as Record<string, CategoryTotal>),
    ).sort((a, b) => b.value - a.value);

    const totalFilteredSpend = filteredCategoryTotals.reduce(
      (sum, c) => sum + c.value,
      0,
    );

    const activeCategory =
      activeCategoryIndex !== null
        ? (filteredCategoryTotals[activeCategoryIndex] ?? null)
        : null;

    const activeCategoryHasAnomaly =
      activeCategory !== null &&
      statement.transactions.some(
        (t) =>
          t.isAnomaly && (t.category || 'Other') === activeCategory.name,
      );

    return {
      availablePeriods,
      filteredTransactions,
      filteredExpenses,
      filteredCategoryTotals,
      totalFilteredSpend,
      activeCategory,
      activeCategoryHasAnomaly,
    };
  }, [statement, selectedPeriod, activeCategoryIndex]);


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
            <div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 24,
                }}
              >
                {chartsDerived.availablePeriods.map((period) => {
                  const isActive = selectedPeriod === period;
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => {
                        setSelectedPeriod(period);
                        setActiveCategoryIndex(null);
                      }}
                      style={{
                        background: isActive
                          ? '#00637C'
                          : 'rgba(255,255,255,0.05)',
                        color: isActive ? '#ffffff' : '#7a8aaa',
                        border: isActive
                          ? 'none'
                          : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 999,
                        padding: '6px 16px',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {formatPeriodLabel(period)}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                <div style={{ width: '40%', minWidth: 0 }}>
                  <div
                    style={{
                      color: colors.muted,
                      fontSize: 12,
                      fontFamily: 'monospace',
                      marginBottom: 12,
                    }}
                  >
                    Spending Categories
                  </div>
                  <div
                    style={{
                      maxHeight: 320,
                      overflowY: 'auto',
                    }}
                  >
                    {chartsDerived.filteredCategoryTotals.map((cat, index) => {
                      const isActive = activeCategoryIndex === index;
                      const pct =
                        chartsDerived.totalFilteredSpend > 0
                          ? Math.round(
                              (cat.value / chartsDerived.totalFilteredSpend) * 100,
                            )
                          : 0;
                      const dotColor = COLORS[index % COLORS.length];
                      return (
                        <div
                          key={cat.name}
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            setActiveCategoryIndex(
                              activeCategoryIndex === index ? null : index,
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              setActiveCategoryIndex(
                                activeCategoryIndex === index ? null : index,
                              );
                            }
                          }}
                          style={{
                            cursor: 'pointer',
                            padding: isActive ? '10px 14px 10px 11px' : '10px 14px',
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            transition: 'background 0.15s',
                            background: isActive
                              ? 'rgba(0,99,124,0.15)'
                              : 'transparent',
                            borderLeft: isActive
                              ? '3px solid #00637C'
                              : '3px solid transparent',
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.background =
                                'rgba(255,255,255,0.04)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.background = 'transparent';
                            }
                          }}
                        >
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: dotColor,
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              flex: 1,
                              fontSize: 13,
                              color: '#e8ecf4',
                            }}
                          >
                            {cat.name}
                          </span>
                          <span
                            style={{
                              fontSize: 13,
                              color: '#e8ecf4',
                              fontWeight: 600,
                            }}
                          >
                            ${cat.value.toFixed(0)}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: '#7a8aaa',
                              marginLeft: 4,
                            }}
                          >
                            {pct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {activeCategoryIndex !== null &&
                    chartsDerived.activeCategoryHasAnomaly &&
                    chartsDerived.activeCategory && (
                      <div
                        style={{
                          marginTop: 12,
                          background: 'rgba(244,166,35,0.08)',
                          border: '1px solid rgba(244,166,35,0.25)',
                          borderRadius: 8,
                          padding: '10px 14px',
                          fontSize: 12,
                          color: '#f4a623',
                        }}
                      >
                        {'\u26a0'} Anomaly detected in{' '}
                        {chartsDerived.activeCategory.name}
                      </div>
                    )}
                </div>

                <div style={{ width: '60%', minWidth: 0 }}>
                  <div style={{ position: 'relative' }}>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={chartsDerived.filteredCategoryTotals}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          innerRadius={60}
                          paddingAngle={2}
                          shape={(props, index) =>
                            renderPieSector(props, index, activeCategoryIndex)
                          }
                          onClick={(_, index) =>
                            setActiveCategoryIndex(
                              activeCategoryIndex === index ? null : index,
                            )
                          }
                        >
                          {chartsDerived.filteredCategoryTotals.map((_, index) => {
                            const color = COLORS[index % COLORS.length];
                            let fill = color;
                            if (
                              activeCategoryIndex !== null &&
                              activeCategoryIndex !== index
                            ) {
                              fill = hexToRgba(color, 0.3);
                            }
                            return (
                              <Cell key={`cell-${index}`} fill={fill} />
                            );
                          })}
                        </Pie>
                        <Tooltip content={<CustomPieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: 'none',
                        textAlign: 'center',
                      }}
                    >
                      {activeCategoryIndex === null ? (
                        <>
                          <div
                            style={{
                              fontSize: 22,
                              fontWeight: 600,
                              color: '#e8ecf4',
                            }}
                          >
                            ${chartsDerived.totalFilteredSpend.toFixed(0)}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: colors.muted,
                              marginTop: 4,
                            }}
                          >
                            total spend
                          </div>
                        </>
                      ) : (
                        chartsDerived.activeCategory && (
                          <>
                            <div
                              style={{
                                fontSize: 22,
                                fontWeight: 600,
                                color: '#e8ecf4',
                              }}
                            >
                              ${chartsDerived.activeCategory.value.toFixed(0)}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: colors.muted,
                                marginTop: 4,
                              }}
                            >
                              {chartsDerived.activeCategory.name.length > 10
                                ? `${chartsDerived.activeCategory.name.slice(0, 10)}…`
                                : chartsDerived.activeCategory.name}
                            </div>
                          </>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
