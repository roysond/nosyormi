import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
} from 'recharts';
import type { PieSectorShapeProps } from 'recharts';

const API_BASE = 'http://localhost:5034';
const COLORS = [
  '#00637C',
  '#0891B2',
  '#0EA5E9',
  '#6366F1',
  '#F59E0B',
  '#10B981',
  '#EF4444',
  '#8B5CF6',
];

interface Transaction {
  id: string;
  transactionDate: string;
  description: string;
  amount: number;
  isAnomaly: boolean;
  category?: string;
}

interface StatementSummary {
  id: string;
  fileName: string;
  uploadedAt: string;
  transactionCount: number;
}

interface Statement {
  id: string;
  fileName: string;
  uploadedAt: string;
  transactions: Transaction[];
}

interface CategoryTotal {
  name: string;
  value: number;
  percentage: number;
}

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: '100%',
    background: '#F8FAFC',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 32px',
    borderBottom: '1px solid #E2E8F0',
    background: 'white',
  },
  headerTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#1E293B',
    margin: 0,
  },
  uploadBtn: {
    background: '#00637C',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    padding: '9px 18px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  statsRow: {
    padding: '20px 32px',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
  },
  statCard: {
    background: 'white',
    border: '1px solid #E2E8F0',
    borderRadius: 12,
    padding: '16px 20px',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: '#94A3B8',
    margin: 0,
  },
  statValue: (color: string) => ({
    fontSize: 24,
    fontWeight: 700,
    marginTop: 4,
    margin: '4px 0 0',
    color,
  }),
  subNav: {
    padding: '0 32px',
    borderBottom: '1px solid #E2E8F0',
    display: 'flex',
    gap: 0,
    background: 'white',
  },
  tab: (active: boolean) => ({
    padding: '12px 20px',
    fontSize: 13,
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    borderBottom: `2px solid ${active ? '#00637C' : 'transparent'}`,
    color: active ? '#00637C' : '#64748B',
    marginBottom: -1,
  }),
  tabContent: {
    padding: '24px 32px',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#64748B',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: 16,
    marginTop: 0,
  },
  chartRow: {
    display: 'flex',
    gap: 24,
    alignItems: 'flex-start',
  },
  chartColLeft: {
    width: '45%',
    minWidth: 0,
  },
  chartColRight: {
    width: '55%',
    minWidth: 0,
  },
  categoryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
  },
  txSection: {
    marginTop: 24,
    borderTop: '1px solid #E2E8F0',
    paddingTop: 20,
  },
  centered: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    fontSize: 15,
  },
  loading: {
    color: '#00637C',
    animation: 'dashboard-pulse 1.6s ease-in-out infinite',
  },
  error: {
    color: '#EF4444',
  },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateHeader(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatMonthDay(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function hexWithOpacity(hex: string, alphaHex = '66'): string {
  return `${hex}${alphaHex}`;
}

function isCsvFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.csv');
}

function groupByDate(transactions: Transaction[]): [string, Transaction[]][] {
  const sorted = [...transactions].sort((a, b) =>
    b.transactionDate.localeCompare(a.transactionDate),
  );
  const map = new Map<string, Transaction[]>();
  for (const t of sorted) {
    const existing = map.get(t.transactionDate);
    if (existing) {
      existing.push(t);
    } else {
      map.set(t.transactionDate, [t]);
    }
  }
  return Array.from(map.entries());
}

function renderActivePieShape(props: PieSectorShapeProps) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={(outerRadius ?? 0) + 6}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
    />
  );
}

function renderPieSector(
  props: PieSectorShapeProps,
  index: number,
  hoveredCategoryIndex: number | null,
  activeCategoryIndex: number | null,
) {
  const isHighlighted =
    index === hoveredCategoryIndex || index === activeCategoryIndex;
  if (isHighlighted) {
    return renderActivePieShape(props);
  }
  return <Sector {...props} />;
}

const GlassTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
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
          zIndex: 9999,
          position: 'relative',
        }}
      >
        <div
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#00637C',
            marginBottom: '4px',
            letterSpacing: '0.02em',
          }}
        >
          {item.name}
        </div>
        <div
          style={{
            fontSize: '16px',
            fontWeight: 700,
            color: '#1E293B',
            marginBottom: '2px',
          }}
        >
          ${item.value.toFixed(2)}
        </div>
        <div
          style={{
            fontSize: '11px',
            color: '#64748B',
          }}
        >
          {item.percentage}% of total
        </div>
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [statement, setStatement] = useState<Statement | null>(null);
  const [hasNoStatements, setHasNoStatements] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'spending' | 'income'>('spending');
  const [activeCategoryIndex, setActiveCategoryIndex] = useState<number | null>(null);
  const [hoveredCategoryIndex, setHoveredCategoryIndex] = useState<number | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [tabHover, setTabHover] = useState<'spending' | 'income' | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'highest' | 'lowest' | 'az' | 'za'>(
    'date',
  );

  const loadStatement = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setError(null);
      setHasNoStatements(false);
    }
    try {
      const listRes = await fetch(`${API_BASE}/api/statements`);
      if (!listRes.ok) {
        throw new Error(`Failed to load statements (HTTP ${listRes.status}).`);
      }
      const summaries: StatementSummary[] = await listRes.json();

      if (summaries.length === 0) {
        setStatement(null);
        setHasNoStatements(true);
        return;
      }

      const newest = summaries[0];
      const detailRes = await fetch(`${API_BASE}/api/statements/${newest.id}`);
      if (!detailRes.ok) {
        throw new Error(`Failed to load statement (HTTP ${detailRes.status}).`);
      }
      const data: Statement = await detailRes.json();
      setStatement(data);
      setHasNoStatements(false);
    } catch (err: unknown) {
      setStatement(null);
      setHasNoStatements(false);
      setError(err instanceof Error ? err.message : 'Failed to load statement.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatement(true);
  }, [loadStatement]);

  const derived = useMemo(() => {
    if (!statement) {
      return {
        expenses: [] as Transaction[],
        income: [] as Transaction[],
        categoryTotals: [] as CategoryTotal[],
        totalSpend: 0,
        totalIncome: 0,
        filteredTransactions: [] as Transaction[],
        anomalyCount: 0,
        net: 0,
        incomeAverage: 0,
      };
    }

    const expenses = statement.transactions.filter((t) => t.amount < 0);
    const income = statement.transactions.filter((t) => t.amount > 0);
    const totalSpend = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);

    const grouped = expenses.reduce(
      (acc, t) => {
        const cat = t.category || 'Other';
        if (!acc[cat]) acc[cat] = { name: cat, value: 0, percentage: 0 };
        acc[cat].value =
          Math.round((acc[cat].value + Math.abs(t.amount)) * 100) / 100;
        return acc;
      },
      {} as Record<string, CategoryTotal>,
    );

    const categoryTotals: CategoryTotal[] = Object.values(grouped)
      .map((c) => ({
        ...c,
        percentage:
          totalSpend > 0
            ? Math.round((c.value / totalSpend) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.value - a.value);

    const filteredTransactions =
      activeCategoryIndex === null
        ? expenses
        : expenses.filter((t) => {
            const catName = categoryTotals[activeCategoryIndex]?.name;
            return (t.category || 'Other') === catName;
          });

    const anomalyCount = statement.transactions.filter((t) => t.isAnomaly).length;
    const net = totalIncome - totalSpend;
    const incomeAverage = income.length > 0 ? totalIncome / income.length : 0;

    return {
      expenses,
      income,
      categoryTotals,
      totalSpend,
      totalIncome,
      filteredTransactions,
      anomalyCount,
      net,
      incomeAverage,
    };
  }, [statement, activeCategoryIndex]);

  const activeCategory =
    activeCategoryIndex !== null
      ? (derived.categoryTotals[activeCategoryIndex] ?? null)
      : null;

  const sortedFilteredTransactions = useMemo(() => {
    const txs = [...derived.filteredTransactions];
    switch (sortBy) {
      case 'highest':
        return txs.sort(
          (a, b) => Math.abs(b.amount) - Math.abs(a.amount),
        );
      case 'lowest':
        return txs.sort(
          (a, b) => Math.abs(a.amount) - Math.abs(b.amount),
        );
      case 'az':
        return txs.sort((a, b) =>
          a.description.toLowerCase().localeCompare(b.description.toLowerCase()),
        );
      case 'za':
        return txs.sort((a, b) =>
          b.description.toLowerCase().localeCompare(a.description.toLowerCase()),
        );
      case 'date':
      default:
        return txs.sort((a, b) =>
          b.transactionDate.localeCompare(a.transactionDate),
        );
    }
  }, [derived.filteredTransactions, sortBy]);

  const filteredSpendSummary = useMemo(() => {
    const txs = derived.filteredTransactions;
    const total = txs.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const largest =
      txs.length > 0
        ? Math.max(...txs.map((t) => Math.abs(t.amount)))
        : 0;
    const average = txs.length > 0 ? total / txs.length : 0;
    return { count: txs.length, largest, average, total };
  }, [derived.filteredTransactions]);

  const closeUploadModal = () => {
    setShowUploadModal(false);
    setUploadFile(null);
    setUploadError(null);
    setDragOver(false);
    setUploadSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const selectUploadFile = (candidate: File | undefined) => {
    if (!candidate) return;
    if (!isCsvFile(candidate)) {
      setUploadError('Only .csv files are supported.');
      setUploadFile(null);
      return;
    }
    setUploadError(null);
    setUploadFile(candidate);
  };

  const handleUpload = async () => {
    if (!uploadFile || uploading) return;

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const response = await fetch(`${API_BASE}/api/statements/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message =
          body?.error ?? `Upload failed with status ${response.status}.`;
        throw new Error(message);
      }

      setUploadSuccess(true);
      await loadStatement(false);
      setTimeout(() => {
        closeUploadModal();
      }, 1500);
    } catch (err: unknown) {
      setUploadError(
        err instanceof Error ? err.message : 'Upload failed. Please try again.',
      );
    } finally {
      setUploading(false);
    }
  };

  const renderTransactionRow = (
    tx: Transaction,
    amountColor: string,
    showDateColumn: boolean,
  ) => (
    <div
      key={tx.id}
      style={{
        display: 'grid',
        gridTemplateColumns: showDateColumn
          ? '80px 1fr 1fr 1fr'
          : '1fr 1fr 1fr',
        alignItems: 'center',
        padding: tx.isAnomaly ? '12px 16px 12px 13px' : '12px 16px',
        borderRadius: 6,
        borderBottom: '1px solid #F1F5F9',
        background: 'white',
        ...(tx.isAnomaly
          ? {
              animation: 'rowAnomalyGlow 2.5s ease-in-out infinite',
              borderLeft: '3px solid rgba(245, 158, 11, 0.8)',
            }
          : {}),
      }}
    >
      {showDateColumn && (
        <span
          style={{
            fontSize: 11,
            color: '#CBD5E1',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        >
          {formatMonthDay(tx.transactionDate)}
        </span>
      )}
      <span
        style={{
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          fontSize: 14,
          color: '#1E293B',
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}
      >
        {tx.description}
      </span>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <span
          style={{
            fontSize: 11,
            background: 'rgba(0,99,124,0.08)',
            color: '#00637C',
            borderRadius: 999,
            padding: '3px 10px',
            whiteSpace: 'nowrap',
          }}
        >
          {tx.category || 'Other'}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 10,
        }}
      >
        {tx.isAnomaly && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              background: 'rgba(245,158,11,0.1)',
              color: '#F59E0B',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 999,
              padding: '2px 8px',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            {'\u26a0'} ANOMALY
          </span>
        )}
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: amountColor,
            whiteSpace: 'nowrap',
          }}
        >
          {tx.amount > 0 ? '+' : '-'}
          {formatCurrency(Math.abs(tx.amount))}
        </span>
      </div>
    </div>
  );

  const renderTransactionRows = (
    transactions: Transaction[],
    amountColor: string,
    useDateGroups: boolean,
  ) => {
    if (useDateGroups) {
      return groupByDate(transactions).map(([date, txs]) => (
        <div key={date}>
          <div
            style={{
              background: '#F8FAFC',
              borderTop: '1px solid #F1F5F9',
              borderBottom: '1px solid #F1F5F9',
              padding: '6px 16px',
              fontSize: 11,
              color: '#94A3B8',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {formatDateHeader(date)}
          </div>
          {txs.map((tx) => renderTransactionRow(tx, amountColor, false))}
        </div>
      ));
    }

    return transactions.map((tx) =>
      renderTransactionRow(tx, amountColor, true),
    );
  };


  return (
    <div style={styles.page}>
      <style>{`
        @keyframes dashboard-pulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }
        @keyframes rowAnomalyGlow {
          0%, 100% { background: rgba(245, 158, 11, 0.12); box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.35); }
          50% { background: rgba(245, 158, 11, 0.25); box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.6), 0 0 20px rgba(245, 158, 11, 0.15); }
        }
      `}</style>

      <header style={styles.header}>
        <h1 style={styles.headerTitle}>Dashboard</h1>
        <button
          type="button"
          style={styles.uploadBtn}
          onClick={() => setShowUploadModal(true)}
        >
          + Upload Statement
        </button>
      </header>

      {loading && (
        <p style={{ ...styles.centered, ...styles.loading }}>
          Reflecting on your data...
        </p>
      )}

      {!loading && error && (
        <p style={{ ...styles.centered, ...styles.error }}>{error}</p>
      )}

      {!loading && !error && hasNoStatements && (
        <div
          style={{
            ...styles.centered,
            flexDirection: 'column',
            gap: 8,
            textAlign: 'center',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: '#1E293B',
            }}
          >
            No statements uploaded yet.
          </p>
          <p style={{ margin: 0, fontSize: 14, color: '#94A3B8' }}>
            Upload a bank statement CSV to get started.
          </p>
        </div>
      )}

      {!loading && !error && !hasNoStatements && statement && (
        <>
          <div style={styles.statsRow}>
            <div style={styles.statCard}>
              <p style={styles.statLabel}>Total Income</p>
              <p style={styles.statValue('#10B981')}>
                {formatCurrency(derived.totalIncome)}
              </p>
            </div>
            <div style={styles.statCard}>
              <p style={styles.statLabel}>Total Expenses</p>
              <p style={styles.statValue('#EF4444')}>
                {formatCurrency(derived.totalSpend)}
              </p>
            </div>
            <div style={styles.statCard}>
              <p style={styles.statLabel}>Net</p>
              <p
                style={styles.statValue(
                  derived.net >= 0 ? '#10B981' : '#EF4444',
                )}
              >
                {derived.net >= 0 ? '' : '-'}
                {formatCurrency(Math.abs(derived.net))}
              </p>
            </div>
            <div style={styles.statCard}>
              <p style={styles.statLabel}>Anomalies</p>
              <p
                style={styles.statValue(
                  derived.anomalyCount > 0 ? '#F59E0B' : '#64748B',
                )}
              >
                {derived.anomalyCount}
              </p>
            </div>
          </div>

          <div style={styles.subNav}>
            <button
              type="button"
              style={{
                ...styles.tab(activeTab === 'spending'),
                color:
                  activeTab === 'spending'
                    ? '#00637C'
                    : tabHover === 'spending'
                      ? '#1E293B'
                      : '#64748B',
              }}
              onClick={() => {
                setActiveTab('spending');
                setActiveCategoryIndex(null);
              }}
              onMouseEnter={() => setTabHover('spending')}
              onMouseLeave={() => setTabHover(null)}
            >
              Spending
            </button>
            <button
              type="button"
              style={{
                ...styles.tab(activeTab === 'income'),
                color:
                  activeTab === 'income'
                    ? '#00637C'
                    : tabHover === 'income'
                      ? '#1E293B'
                      : '#64748B',
              }}
              onClick={() => setActiveTab('income')}
              onMouseEnter={() => setTabHover('income')}
              onMouseLeave={() => setTabHover(null)}
            >
              Income
            </button>
          </div>

          {activeTab === 'spending' && (
            <div style={styles.tabContent}>
              <div style={styles.chartRow}>
                <div style={styles.chartColLeft}>
                  <h2 style={styles.sectionTitle}>Spending by Category</h2>
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <ResponsiveContainer width="100%" height={340}>
                      <PieChart>
                        <Pie
                          data={derived.categoryTotals}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={130}
                          innerRadius={78}
                          paddingAngle={2}
                          shape={(props, index) =>
                            renderPieSector(
                              props,
                              index,
                              hoveredCategoryIndex,
                              activeCategoryIndex,
                            )
                          }
                          onClick={(_, index) =>
                            setActiveCategoryIndex(
                              activeCategoryIndex === index ? null : index,
                            )
                          }
                          onMouseEnter={(_, index) =>
                            setHoveredCategoryIndex(index)
                          }
                          onMouseLeave={() => setHoveredCategoryIndex(null)}
                        >
                          {derived.categoryTotals.map((_, index) => {
                            const color = COLORS[index % COLORS.length];
                            const isHighlighted =
                              index === hoveredCategoryIndex ||
                              index === activeCategoryIndex;
                            const hasHighlight =
                              hoveredCategoryIndex !== null ||
                              activeCategoryIndex !== null;
                            const fill =
                              hasHighlight && !isHighlighted
                                ? hexWithOpacity(color)
                                : color;
                            return (
                              <Cell key={`cell-${index}`} fill={fill} />
                            );
                          })}
                        </Pie>
                        <Tooltip
                          content={<GlassTooltip />}
                          wrapperStyle={{ zIndex: 9999 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 0,
                        pointerEvents: 'none',
                        textAlign: 'center',
                      }}
                    >
                      {activeCategoryIndex === null ? (
                        <>
                          <div
                            style={{
                              fontSize: 18,
                              fontWeight: 700,
                              color: '#1E293B',
                            }}
                          >
                            {formatCurrency(derived.totalSpend)}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: '#94A3B8',
                              marginTop: 4,
                            }}
                          >
                            total spend
                          </div>
                        </>
                      ) : (
                        activeCategory && (
                          <>
                            <div
                              style={{
                              fontSize: 18,
                              fontWeight: 700,
                              color: '#1E293B',
                            }}
                          >
                              {formatCurrency(activeCategory.value)}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: '#94A3B8',
                                marginTop: 4,
                              }}
                            >
                              {activeCategory.name.length > 12
                                ? `${activeCategory.name.slice(0, 12)}…`
                                : activeCategory.name}
                            </div>
                          </>
                        )
                      )}
                    </div>
                  </div>
                </div>

                <div style={styles.chartColRight}>
                  <h2 style={styles.sectionTitle}>Categories</h2>
                  <div style={styles.categoryGrid}>
                    {derived.categoryTotals.map((cat, index) => {
                      const isHighlighted =
                        index === hoveredCategoryIndex ||
                        index === activeCategoryIndex;
                      const color = COLORS[index % COLORS.length];
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
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: isHighlighted
                              ? '10px 14px 10px 11px'
                              : '10px 14px',
                            borderRadius: 8,
                            border: isHighlighted
                              ? '1px solid rgba(0,99,124,0.2)'
                              : '1px solid transparent',
                            borderLeft: isHighlighted
                              ? `3px solid ${color}`
                              : '1px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            background: isHighlighted
                              ? 'rgba(0,99,124,0.06)'
                              : '#F8FAFC',
                          }}
                          onMouseEnter={(e) => {
                            if (!isHighlighted) {
                              e.currentTarget.style.background = '#F1F5F9';
                              e.currentTarget.style.borderColor = '#E2E8F0';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isHighlighted) {
                              e.currentTarget.style.background = '#F8FAFC';
                              e.currentTarget.style.borderColor = 'transparent';
                            }
                          }}
                        >
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: color,
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 13,
                              color: '#1E293B',
                              flex: 1,
                            }}
                          >
                            {cat.name}
                          </span>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: '#1E293B',
                            }}
                          >
                            {formatCurrency(cat.value)}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: '#94A3B8',
                              marginLeft: 4,
                            }}
                          >
                            {cat.percentage.toFixed(0)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div style={styles.txSection}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 12,
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 15,
                          fontWeight: 600,
                          color: '#1E293B',
                        }}
                      >
                        Transactions
                        {activeCategory && (
                          <span style={{ color: '#00637C', fontWeight: 500 }}>
                            {' '}
                            — {activeCategory.name}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 12,
                            color: '#94A3B8',
                            fontWeight: 400,
                            marginLeft: 8,
                          }}
                        >
                          ({derived.filteredTransactions.length} transaction
                          {derived.filteredTransactions.length === 1 ? '' : 's'})
                        </span>
                      </h3>
                      <select
                        value={sortBy}
                        onChange={(e) =>
                          setSortBy(
                            e.target.value as
                              | 'date'
                              | 'highest'
                              | 'lowest'
                              | 'az'
                              | 'za',
                          )
                        }
                        style={{
                          background: 'white',
                          border: '1px solid #E2E8F0',
                          borderRadius: 8,
                          padding: '6px 12px',
                          fontSize: 12,
                          color: '#475569',
                          cursor: 'pointer',
                          outline: 'none',
                          appearance: 'auto',
                        }}
                      >
                        <option value="date">Sort: Date (newest)</option>
                        <option value="highest">Sort: Highest spend</option>
                        <option value="lowest">Sort: Lowest spend</option>
                        <option value="az">Sort: A → Z</option>
                        <option value="za">Sort: Z → A</option>
                      </select>
                    </div>
                    {derived.filteredTransactions.length === 0 ? (
                      <p style={{ color: '#94A3B8', fontSize: 13 }}>
                        No transactions to show.
                      </p>
                    ) : (
                      renderTransactionRows(
                        sortedFilteredTransactions,
                        '#EF4444',
                        sortBy === 'date',
                      )
                    )}
                  </div>

                  <div
                    style={{
                      width: 260,
                      flexShrink: 0,
                      marginLeft: 24,
                    }}
                  >
                    <div
                      style={{
                        background: 'white',
                        border: '1px solid #E2E8F0',
                        borderRadius: 12,
                        padding: 20,
                        position: 'sticky',
                        top: 0,
                      }}
                    >
                      <h4
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: '#1E293B',
                          margin: '0 0 16px',
                        }}
                      >
                        Summary
                      </h4>
                      {[
                        {
                          label: 'Total transactions',
                          value: String(filteredSpendSummary.count),
                          isAmount: false,
                        },
                        {
                          label: 'Largest transaction',
                          value: formatCurrency(filteredSpendSummary.largest),
                          isAmount: true,
                        },
                        {
                          label: 'Average transaction',
                          value: formatCurrency(filteredSpendSummary.average),
                          isAmount: true,
                        },
                        {
                          label: 'Total spending',
                          value: formatCurrency(filteredSpendSummary.total),
                          isAmount: true,
                        },
                      ].map((row) => (
                        <div
                          key={row.label}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '8px 0',
                            borderBottom: '1px solid #F8FAFC',
                          }}
                        >
                          <span style={{ fontSize: 12, color: '#64748B' }}>
                            {row.label}
                          </span>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: row.isAmount ? '#EF4444' : '#1E293B',
                            }}
                          >
                            {row.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'income' && (
            <div style={styles.tabContent}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 20,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#1E293B',
                  }}
                >
                  Income
                </h2>
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: '#10B981',
                  }}
                >
                  {formatCurrency(derived.totalIncome)}
                </span>
              </div>

              <div
                style={{
                  background: 'white',
                  border: '1px solid #E2E8F0',
                  borderRadius: 12,
                  padding: '16px 20px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                <div>
                  <p style={styles.statLabel}>Total Income</p>
                  <p style={styles.statValue('#10B981')}>
                    {formatCurrency(derived.totalIncome)}
                  </p>
                </div>
                <div>
                  <p style={styles.statLabel}>Transactions</p>
                  <p style={styles.statValue('#1E293B')}>{derived.income.length}</p>
                </div>
                <div>
                  <p style={styles.statLabel}>Average</p>
                  <p style={styles.statValue('#10B981')}>
                    {formatCurrency(derived.incomeAverage)}
                  </p>
                </div>
              </div>

              {derived.income.length === 0 ? (
                <p style={{ color: '#94A3B8', fontSize: 13 }}>
                  No income transactions recorded.
                </p>
              ) : (
                renderTransactionRows(derived.income, '#10B981', true)
              )}
            </div>
          )}
        </>
      )}

      {showUploadModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={closeUploadModal}
          role="presentation"
        >
          <div
            style={{
              background: 'white',
              borderRadius: 16,
              padding: 32,
              width: 480,
              maxWidth: '90vw',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-modal-title"
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 24,
              }}
            >
              <h2
                id="upload-modal-title"
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#1E293B',
                }}
              >
                Upload Statement
              </h2>
              <button
                type="button"
                onClick={closeUploadModal}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: 20,
                  color: '#94A3B8',
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {uploadSuccess ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <span style={{ fontSize: 32, display: 'block', marginBottom: 12 }}>
                  ✓
                </span>
                <p
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 600,
                    color: '#00637C',
                  }}
                >
                  Statement reflected successfully
                </p>
              </div>
            ) : (
              <>
                <div
                  role="button"
                  tabIndex={0}
                  style={{
                    border: `2px dashed ${dragOver ? '#00637C' : 'rgba(0,99,124,0.3)'}`,
                    background: dragOver
                      ? 'rgba(0,99,124,0.08)'
                      : 'rgba(0,99,124,0.03)',
                    borderRadius: 12,
                    padding: 40,
                    textAlign: 'center',
                    cursor: 'pointer',
                    marginBottom: 16,
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    selectUploadFile(e.dataTransfer.files[0]);
                  }}
                >
                  <span
                    style={{
                      fontSize: 36,
                      display: 'block',
                      marginBottom: 12,
                    }}
                    aria-hidden
                  >
                    ⬆
                  </span>
                  {uploadFile ? (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#00637C',
                        wordBreak: 'break-word',
                      }}
                    >
                      {uploadFile.name}
                    </p>
                  ) : (
                    <>
                      <p
                        style={{
                          margin: '0 0 6px',
                          fontSize: 15,
                          fontWeight: 500,
                          color: '#1E293B',
                        }}
                      >
                        Drop your CSV here
                      </p>
                      <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
                        or click to browse
                      </p>
                    </>
                  )}
                  <p
                    style={{
                      margin: '12px 0 0',
                      fontSize: 11,
                      color: '#94A3B8',
                    }}
                  >
                    Accepts .csv files from any bank
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={(e) => selectUploadFile(e.target.files?.[0])}
                />

                {uploadError && (
                  <p
                    style={{
                      margin: '0 0 12px',
                      fontSize: 13,
                      color: '#F59E0B',
                    }}
                  >
                    {uploadError}
                  </p>
                )}

                {uploadFile && (
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={uploading}
                    style={{
                      width: '100%',
                      padding: '12px 24px',
                      border: 'none',
                      borderRadius: 8,
                      background: '#00637C',
                      color: 'white',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: uploading ? 'not-allowed' : 'pointer',
                      opacity: uploading ? 0.7 : 1,
                    }}
                  >
                    {uploading ? 'Uploading...' : 'Reflect on this statement'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
