import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { APP_COLORS, ANOMALY_COLOR } from '../constants/palette';
import { JewelSlice, UniversalTooltip } from '../components/chartEffects';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5034';
const COLORS = APP_COLORS;

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
    background: '#F4F7F9',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 32px',
    background: '#F4F7F9',
  },
  headerTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#1E293B',
    margin: 0,
  },
  statsRow: {
    padding: '20px 32px',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
  },
  statCard: {
    background: 'white',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
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
    borderBottom: `2px solid ${active ? '#071A1E' : 'transparent'}`,
    color: active ? '#071A1E' : '#64748B',
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
    color: '#C9911A',
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

function useCountUp(target: number, duration: number = 800): number {
  const [current, setCurrent] = useState(0);
  const previousTarget = useRef<number>(0);

  useEffect(() => {
    if (target === previousTarget.current) return;
    previousTarget.current = target;
    if (target === 0) { setCurrent(0); return; }

    const startTime = performance.now();
    const startValue = 0;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCurrent(Math.round(startValue + (target - startValue) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return current;
}

export default function DashboardPage() {
  const [statement, setStatement] = useState<Statement | null>(null);
  const [hasNoStatements, setHasNoStatements] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'spending' | 'income'>('spending');
  const [activeCategoryIndex, setActiveCategoryIndex] = useState<number | null>(null);
  const [dateFilter, setDateFilter] = useState<{
    type: 'all' | 'month' | 'custom';
    month?: string;
    from?: string;
    to?: string;
  }>({ type: 'all' });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as SVGElement | HTMLElement;
      const isPieSlice =
        (target as SVGElement).classList?.contains('recharts-sector') ||
        target.closest?.('[class*="recharts-pie"]') !== null;
      if (!isPieSlice) {
        setActiveCategoryIndex(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-datepicker]')) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

  const availablePeriods = useMemo(() => {
    if (!statement) return ['all'];
    const periodSet = new Set<string>();
    statement.transactions.forEach((t) => {
      const d = new Date(t.transactionDate + 'T00:00:00');
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      periodSet.add(key);
    });
    return ['all', ...Array.from(periodSet).sort()];
  }, [statement]);

  const filterTransactionsByDate = useCallback(
    (transactions: Transaction[]) => {
      if (dateFilter.type === 'all') return transactions;
      if (dateFilter.type === 'month' && dateFilter.month) {
        return transactions.filter((t) => t.transactionDate.startsWith(dateFilter.month!));
      }
      if (dateFilter.type === 'custom' && dateFilter.from && dateFilter.to) {
        return transactions.filter(
          (t) => t.transactionDate >= dateFilter.from! && t.transactionDate <= dateFilter.to!,
        );
      }
      return transactions;
    },
    [dateFilter],
  );

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

    const allFiltered = filterTransactionsByDate(statement.transactions);
    const expenses = allFiltered.filter((t) => t.amount < 0);
    const income = allFiltered.filter((t) => t.amount > 0);
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

    const anomalyCount = allFiltered.filter((t) => t.isAnomaly).length;
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
  }, [statement, activeCategoryIndex, dateFilter, filterTransactionsByDate]);

  const categoryTotals = derived.categoryTotals;

  const animatedIncome = useCountUp(statement ? derived.totalIncome : 0);
  const animatedExpenses = useCountUp(statement ? derived.totalSpend : 0);
  const animatedNet = useCountUp(statement ? Math.abs(derived.net) : 0);
  const animatedAnomalies = useCountUp(statement ? derived.anomalyCount : 0);

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
              borderLeft: '3px solid rgba(220, 38, 38, 0.8)',
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
            background: 'rgba(201,145,26,0.08)',
            color: '#C9911A',
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
              background: 'rgba(220,38,38,0.1)',
              color: ANOMALY_COLOR,
              border: '1px solid rgba(220,38,38,0.3)',
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
          0%, 100% { background: rgba(220, 38, 38, 0.12); box-shadow: inset 0 0 0 1px rgba(220, 38, 38, 0.35); }
          50% { background: rgba(220, 38, 38, 0.25); box-shadow: inset 0 0 0 1px rgba(220, 38, 38, 0.6), 0 0 20px rgba(220, 38, 38, 0.15); }
        }
        @keyframes chartFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <header style={styles.header}>
        <h1 style={styles.headerTitle}>Dashboard</h1>
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
                {formatCurrency(animatedIncome)}
              </p>
            </div>
            <div style={styles.statCard}>
              <p style={styles.statLabel}>Total Expenses</p>
              <p style={styles.statValue('#EF4444')}>
                {formatCurrency(animatedExpenses)}
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
                {formatCurrency(animatedNet)}
              </p>
            </div>
            <div style={styles.statCard}>
              <p style={styles.statLabel}>Anomalies</p>
              <p
                style={styles.statValue(
                  derived.anomalyCount > 0 ? ANOMALY_COLOR : '#64748B',
                )}
              >
                {animatedAnomalies}
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
                    ? '#071A1E'
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
                    ? '#071A1E'
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
                  <div
                    style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}
                    data-datepicker
                  >
                    <button
                      onClick={() => setShowDatePicker((p) => !p)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 14px',
                        borderRadius: 8,
                        border: '1px solid #E2E8F0',
                        background: 'white',
                        color: '#1E293B',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      }}
                    >
                      <span>📅</span>
                      <span>
                        {dateFilter.type === 'all'
                          ? 'All Time'
                          : dateFilter.type === 'month' && dateFilter.month
                          ? new Date(dateFilter.month + '-01T00:00:00').toLocaleString('default', {
                              month: 'long',
                              year: 'numeric',
                            })
                          : `${dateFilter.from} → ${dateFilter.to}`}
                      </span>
                      <span style={{ color: '#94A3B8' }}>▾</span>
                    </button>
                    {showDatePicker && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 8px)',
                          left: 0,
                          zIndex: 200,
                          background: 'white',
                          border: '1px solid #E2E8F0',
                          borderRadius: 12,
                          padding: 16,
                          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                          minWidth: 280,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#94A3B8',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            marginBottom: 10,
                          }}
                        >
                          Quick Select
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                          {availablePeriods.map((period) => {
                            const isActive =
                              period === 'all'
                                ? dateFilter.type === 'all'
                                : dateFilter.type === 'month' && dateFilter.month === period;
                            const label =
                              period === 'all'
                                ? 'All Time'
                                : new Date(period + '-01T00:00:00').toLocaleString('default', {
                                    month: 'short',
                                    year: 'numeric',
                                  });
                            return (
                              <button
                                key={period}
                                onClick={() => {
                                  if (period === 'all') setDateFilter({ type: 'all' });
                                  else setDateFilter({ type: 'month', month: period });
                                  setShowDatePicker(false);
                                }}
                                style={{
                                  padding: '5px 12px',
                                  borderRadius: 999,
                                  border: isActive ? '1.5px solid #00637C' : '1px solid #E2E8F0',
                                  background: isActive ? 'rgba(0,99,124,0.08)' : 'white',
                                  color: isActive ? '#00637C' : '#475569',
                                  fontSize: 12,
                                  fontWeight: isActive ? 600 : 400,
                                  cursor: 'pointer',
                                }}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#94A3B8',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            marginBottom: 10,
                          }}
                        >
                          Custom Range
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                          <input
                            type="date"
                            value={customFrom}
                            onChange={(e) => setCustomFrom(e.target.value)}
                            style={{
                              flex: 1,
                              padding: '6px 10px',
                              borderRadius: 8,
                              border: '1px solid #E2E8F0',
                              fontSize: 12,
                              color: '#1E293B',
                            }}
                          />
                          <span style={{ color: '#94A3B8', fontSize: 12 }}>→</span>
                          <input
                            type="date"
                            value={customTo}
                            onChange={(e) => setCustomTo(e.target.value)}
                            style={{
                              flex: 1,
                              padding: '6px 10px',
                              borderRadius: 8,
                              border: '1px solid #E2E8F0',
                              fontSize: 12,
                              color: '#1E293B',
                            }}
                          />
                        </div>
                        <button
                          onClick={() => {
                            if (customFrom && customTo) {
                              setDateFilter({ type: 'custom', from: customFrom, to: customTo });
                            }
                            setShowDatePicker(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 0',
                            borderRadius: 8,
                            border: 'none',
                            background: '#00637C',
                            color: 'white',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Apply
                        </button>
                      </div>
                    )}
                  </div>
                  <h2 style={styles.sectionTitle}>Spending by Category</h2>
                  <div style={{ position: 'relative', zIndex: 1, animation: 'chartFadeIn 0.4s ease-out' }}>
                    <ResponsiveContainer width="100%" height={340}>
                      <div
                        style={{ filter: 'saturate(1.12) contrast(1.05) brightness(1.02)' }}
                      >
                      <PieChart
                        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                      >
                        <Pie
                          data={categoryTotals}
                          shape={(props: any) => (
                            <JewelSlice
                              {...props}
                              isActive={
                                props.index === activeCategoryIndex
                              }
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
                          onClick={(_, index) =>
                            setActiveCategoryIndex(
                              activeCategoryIndex === index ? null : index,
                            )
                          }
                        >
                          {categoryTotals.map((_, index) => {
                            const color = COLORS[index % COLORS.length];
                            const isActive = activeCategoryIndex === index;
                            const hasActive = activeCategoryIndex !== null;
                            const dimmed = hasActive && !isActive;
                            return (
                              <Cell
                                key={`cell-${index}`}
                                fill={color}
                                fillOpacity={dimmed ? 0.35 : 1}
                                stroke={isActive ? color : 'none'}
                                strokeWidth={isActive ? 2.5 : 0}
                              />
                            );
                          })}
                        </Pie>
                        <Tooltip
                          content={<UniversalTooltip />}
                          wrapperStyle={{ zIndex: 9999, background: 'transparent' }}
                        />
                      </PieChart>
                      </div>
                    </ResponsiveContainer>
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: -1,
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
                              ? '1px solid rgba(201,145,26,0.2)'
                              : '1px solid transparent',
                            borderLeft: isHighlighted
                              ? `3px solid ${color}`
                              : '1px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            background: isHighlighted
                              ? 'rgba(201,145,26,0.06)'
                              : '#F4F7F9',
                          }}
                          onMouseEnter={(e) => {
                            if (!isHighlighted) {
                              e.currentTarget.style.background = '#F1F5F9';
                              e.currentTarget.style.borderColor = '#E2E8F0';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isHighlighted) {
                              e.currentTarget.style.background = '#F4F7F9';
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
                          <span style={{ color: '#C9911A', fontWeight: 500 }}>
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
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
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
                            borderBottom: '1px solid #F4F7F9',
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
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
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
    </div>
  );
}
