import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { APP_COLORS, ANOMALY_COLOR } from '../constants/palette';
import {
  fetchActiveStatement,
  subscribeStatementSwitched,
} from '../statementSelection';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5034';

interface Transaction {
  id: string;
  transactionDate: string;
  description: string;
  amount: number;
  isAnomaly: boolean;
  category?: string;
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
    fontSize: '26px',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: '#1E293B',
    margin: 0,
  },
  statsRow: {
    padding: '20px 32px',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
  },
  statCardExpenses: {
    background: 'white',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
    borderRadius: 12,
    padding: '16px 20px',
  },
  statCardNet: {
    background: 'white',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
    borderRadius: 12,
    padding: '16px 20px',
  },
  statCardAnomalies: {
    background: 'white',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
    borderRadius: 12,
    padding: '16px 20px',
  },
  statCardHero: {
    background: 'radial-gradient(ellipse at 78% 12%, #1A5E5A 0%, #124346 55%, #0E3638 100%)',
    boxShadow: '0 4px 16px rgba(18,67,70,0.25)',
    borderRadius: 12,
    padding: '16px 20px',
  },
  statLabelHero: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'rgba(212,168,67,0.65)',
    margin: 0,
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
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(startValue + (target - startValue) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return current;
}

export default function DashboardPage() {
  const [bankInfo, setBankInfo] = useState<{ bankName: string; accountType: string; statementPeriod: string } | null>(null);
  const [bankInfoLoading, setBankInfoLoading] = useState(false);
  const [narration, setNarration] = useState<string | null>(null);
  const [narrationLoading, setNarrationLoading] = useState(false);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [hasNoStatements, setHasNoStatements] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anomalyTab, setAnomalyTab] = useState<'spending' | 'income'>('spending');
  const [anomalyChartTab, setAnomalyChartTab] = useState<'spending' | 'income'>('spending');
  const [forecastTab, setForecastTab] = useState<'expenses' | 'income'>('expenses');

  const loadStatement = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setError(null);
      setHasNoStatements(false);
    }
    const result = await fetchActiveStatement<Statement>(API_BASE);
    if (result.kind === 'empty') {
      setStatement(null);
      setHasNoStatements(true);
    } else if (result.kind === 'ok') {
      setStatement(result.statement);
      setHasNoStatements(false);
    } else {
      setStatement(null);
      setHasNoStatements(false);
      setError(result.message);
    }
    if (showLoading) setLoading(false);
  }, []);

  useEffect(() => {
    void loadStatement(true);
    return subscribeStatementSwitched(() => {
      void loadStatement(false);
    });
  }, [loadStatement]);

  useEffect(() => {
    if (!statement?.id) return;
    setBankInfo(null);
    setBankInfoLoading(true);
    fetch(`${API_BASE}/api/bankinfo/${statement.id}`)
      .then(r => r.json())
      .then(data => setBankInfo(data))
      .catch(() => setBankInfo(null))
      .finally(() => setBankInfoLoading(false));
  }, [statement?.id]);

  useEffect(() => {
    if (!statement?.id) return;
    setNarration(null);
    setNarrationLoading(true);
    fetch(`${API_BASE}/api/narration/${statement.id}`)
      .then(r => r.json())
      .then(data => setNarration(data.narration ?? null))
      .catch(() => setNarration(null))
      .finally(() => setNarrationLoading(false));
  }, [statement?.id]);

  const derived = useMemo(() => {
    if (!statement) return {
      expenses: [] as Transaction[],
      income: [] as Transaction[],
      categoryTotals: [] as CategoryTotal[],
      totalSpend: 0,
      totalIncome: 0,
      anomalyCount: 0,
      net: 0,
    };
    const allTx = statement.transactions;
    const expenses = allTx.filter(t => t.amount < 0);
    const income = allTx.filter(t => t.amount > 0);
    const totalSpend = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalIncome = income.reduce((s, t) => s + t.amount, 0);
    const grouped = expenses.reduce((acc, t) => {
      const cat = t.category || 'Other';
      if (!acc[cat]) acc[cat] = { name: cat, value: 0, percentage: 0 };
      acc[cat].value = Math.round((acc[cat].value + Math.abs(t.amount)) * 100) / 100;
      return acc;
    }, {} as Record<string, CategoryTotal>);
    const categoryTotals: CategoryTotal[] = Object.values(grouped)
      .map(c => ({ ...c, percentage: totalSpend > 0 ? Math.round((c.value / totalSpend) * 1000) / 10 : 0 }))
      .sort((a, b) => b.value - a.value);
    const anomalyCount = allTx.filter(t => t.isAnomaly).length;
    const net = totalIncome - totalSpend;
    return { expenses, income, categoryTotals, totalSpend, totalIncome, anomalyCount, net };
  }, [statement]);

  const monthlyData = useMemo(() => {
    if (!statement) return [];
    const monthMap: Record<string, { income: number; expenses: number }> = {};
    statement.transactions.forEach(t => {
      const key = t.transactionDate.slice(0, 7);
      if (!monthMap[key]) monthMap[key] = { income: 0, expenses: 0 };
      if (t.amount > 0) monthMap[key].income += t.amount;
      else monthMap[key].expenses += Math.abs(t.amount);
    });
    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        label: new Date(month + '-01T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        income: Math.round(data.income),
        expenses: Math.round(data.expenses),
      }));
  }, [statement]);

  const forecastData = useMemo(() => {
    if (monthlyData.length < 2) return null;
    const recent = monthlyData.slice(-3);
    const avgExpenses = Math.round(recent.reduce((s, m) => s + m.expenses, 0) / recent.length);
    const avgIncome = Math.round(recent.reduce((s, m) => s + m.income, 0) / recent.length);
    const last = monthlyData[monthlyData.length - 1];
    return {
      predictedExpenses: avgExpenses,
      predictedIncome: avgIncome,
      expensesDelta: avgExpenses - last.expenses,
      incomeDelta: avgIncome - last.income,
      recentMonths: recent,
    };
  }, [monthlyData]);

  const topAnomaliesSpending = useMemo(() =>
    statement
      ? statement.transactions
          .filter(t => t.isAnomaly && t.amount < 0)
          .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
          .slice(0, 3)
      : [],
  [statement]);

  const topAnomaliesIncome = useMemo(() =>
    statement
      ? statement.transactions
          .filter(t => t.isAnomaly && t.amount > 0)
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 3)
      : [],
  [statement]);

  const topCategories = useMemo(() =>
    derived.categoryTotals.slice(0, 5),
  [derived.categoryTotals]);

  const anomalyMonthlyData = useMemo(() => {
    if (!statement) return [];
    const monthMap: Record<string, { spending: number; income: number }> = {};
    statement.transactions.filter(t => t.isAnomaly).forEach(t => {
      const key = t.transactionDate.slice(0, 7);
      if (!monthMap[key]) monthMap[key] = { spending: 0, income: 0 };
      if (t.amount < 0) monthMap[key].spending++;
      else monthMap[key].income++;
    });
    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        label: new Date(month + '-01T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        spending: data.spending,
        income: data.income,
      }));
  }, [statement]);

  const anomalyCategoryData = useMemo(() => {
    if (!statement) return [];
    const catMap: Record<string, number> = {};
    statement.transactions
      .filter(t => t.isAnomaly)
      .forEach(t => {
        const cat = t.category || 'Other';
        catMap[cat] = (catMap[cat] || 0) + 1;
      });
    return Object.entries(catMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [statement]);

  const animatedIncome = useCountUp(statement ? derived.totalIncome : 0);
  const animatedExpenses = useCountUp(statement ? derived.totalSpend : 0);
  const animatedNet = useCountUp(statement ? Math.abs(derived.net) : 0);
  const animatedAnomalies = useCountUp(statement ? derived.anomalyCount : 0);

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes dashboard-pulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
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

      {!loading && !error && (
        <>
          {hasNoStatements && (
            <div style={{
              margin: '0 32px 16px',
              padding: '10px 16px',
              background: 'rgba(18,67,70,0.06)',
              borderRadius: 8,
              border: '0.5px solid rgba(18,67,70,0.15)',
              fontSize: 13,
              color: '#124346',
            }}>
              Upload a bank statement from the Statements page to populate your dashboard.
            </div>
          )}

          <div style={{
              margin: '0 32px 20px',
              padding: '16px 20px',
              background: 'white',
              borderRadius: 12,
              border: '0.5px solid #E2E8F0',
            }}>
              {bankInfoLoading ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  color: '#94A3B8',
                  fontSize: 13,
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#124346',
                    animation: 'dashboard-pulse 1.2s ease-in-out infinite',
                  }} />
                  Detecting bank info...
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  gap: 32,
                  alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: '#94A3B8',
                    }}>
                      BANK
                    </span>
                    <span style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: '#124346',
                    }}>
                      {bankInfo?.bankName ?? '—'}
                    </span>
                  </div>
                  <div style={{ width: 1, height: 32, background: '#E2E8F0' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: '#94A3B8',
                    }}>
                      ACCOUNT TYPE
                    </span>
                    <span style={{ fontSize: 15, color: '#1E293B' }}>
                      {bankInfo?.accountType ?? '—'}
                    </span>
                  </div>
                  <div style={{ width: 1, height: 32, background: '#E2E8F0' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: '#94A3B8',
                    }}>
                      PERIOD
                    </span>
                    <span style={{ fontSize: 15, color: '#1E293B' }}>
                      {bankInfo?.statementPeriod ?? '—'}
                    </span>
                  </div>
                </div>
              )}
            </div>

          <div style={{
              margin: '0 24px 20px',
              padding: '16px 20px',
              background: 'white',
              borderRadius: 12,
              border: '0.5px solid #E2E8F0',
              boxShadow: '0 2px 8px rgba(18,67,70,0.06)',
            }}>
              {narrationLoading ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  color: '#94A3B8',
                  fontSize: 13,
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#124346',
                    animation: 'dashboard-pulse 1.2s ease-in-out infinite',
                  }} />
                  Reflecting on your statement...
                </div>
              ) : (
                <p style={{
                  margin: 0,
                  fontSize: 14,
                  color: '#334155',
                  lineHeight: 1.7,
                }}>
                  {narration ?? 'Upload a statement to begin your reflection.'}
                </p>
              )}
            </div>

          <div style={styles.statsRow}>
            <div style={styles.statCardHero}>
              <p style={styles.statLabelHero}>Total Income</p>
              <p style={{ ...styles.statValue('#D4A843'), fontSize: 28, fontWeight: 800 }}>
                {formatCurrency(animatedIncome)}
              </p>
            </div>
            <div style={styles.statCardExpenses}>
              <p style={styles.statLabel}>Total Expenses</p>
              <p style={styles.statValue('#EF4444')}>
                {formatCurrency(animatedExpenses)}
              </p>
            </div>
            <div style={styles.statCardNet}>
              <p style={styles.statLabel}>Net</p>
              <p style={styles.statValue('#3B82F6')}>
                {derived.net >= 0 ? '' : '-'}
                {formatCurrency(animatedNet)}
              </p>
            </div>
            <div style={styles.statCardAnomalies}>
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

          <div style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Top row: trend + categories + forecast */}
            <div style={{ display: 'grid', gridTemplateColumns: '40% 30% 30%', gap: 16, alignItems: 'stretch' }}>

            {/* Monthly Trend */}
            <div style={{ background: 'white', borderRadius: 12, border: '0.5px solid #E2E8F0', padding: '20px 24px' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1E293B', margin: '0 0 2px' }}>Monthly Trend</p>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Income vs Expenses</p>
              <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748B' }}>
                  <div style={{ width: 16, height: 2, background: '#1D9E75', borderRadius: 1 }} /> Income
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748B' }}>
                  <div style={{ width: 16, height: 2, background: '#EF4444', borderRadius: 1 }} /> Expenses
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1D9E75" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#1D9E75" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expensesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    wrapperStyle={{ zIndex: 9999 }}
                    contentStyle={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12, padding: '8px 12px' }}
                    formatter={(value, name) => [formatCurrency(Number(value ?? 0)), name]}
                    labelFormatter={(label) => label}
                  />
                  <Area type="monotone" dataKey="income" stroke="#1D9E75" strokeWidth={2} fill="url(#incomeGrad)" name="Income" dot={false} />
                  <Area type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} fill="url(#expensesGrad)" name="Expenses" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

              {/* Top Spending Categories */}
              <div style={{ background: 'white', borderRadius: 12, border: '0.5px solid #E2E8F0', padding: '16px 20px', flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1E293B', margin: '0 0 14px' }}>Top Spending Categories</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {topCategories.map((cat, index) => (
                    <div key={cat.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: APP_COLORS[index % APP_COLORS.length], flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: '#1E293B' }}>{cat.name}</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1E293B' }}>
                          {formatCurrency(cat.value)} <span style={{ color: '#94A3B8', fontWeight: 400, fontSize: 12 }}>{cat.percentage.toFixed(0)}%</span>
                        </span>
                      </div>
                      <div style={{ height: 4, background: '#F1F5F9', borderRadius: 2 }}>
                        <div style={{ width: `${cat.percentage}%`, height: '100%', background: APP_COLORS[index % APP_COLORS.length], borderRadius: 2 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Next Month Forecast */}
              <div style={{ background: 'white', borderRadius: 12, border: '0.5px solid #E2E8F0', padding: '14px 16px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: 0 }}>Next Month Forecast</p>
                  <div style={{ display: 'flex', gap: 2, background: '#F4F7F9', borderRadius: 6, padding: 2 }}>
                    {(['expenses', 'income'] as const).map(tab => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setForecastTab(tab)}
                        style={{
                          padding: '3px 8px', borderRadius: 4, border: 'none',
                          fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
                          background: forecastTab === tab ? 'white' : 'transparent',
                          color: forecastTab === tab ? '#1E293B' : '#94A3B8',
                          fontWeight: forecastTab === tab ? 600 : 400,
                        }}
                      >
                        {tab === 'expenses' ? 'Spend' : 'Income'}
                      </button>
                    ))}
                  </div>
                </div>
                {forecastData ? (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 2px' }}>Next Month Predicted</p>
                    <p style={{ fontSize: 22, fontWeight: 700, color: forecastTab === 'expenses' ? '#EF4444' : '#10B981', margin: '0 0 2px' }}>
                      {formatCurrency(forecastTab === 'expenses' ? forecastData.predictedExpenses : forecastData.predictedIncome)}
                    </p>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 12px' }}>
                      {forecastTab === 'expenses'
                        ? forecastData.expensesDelta > 0 ? `↑ +${formatCurrency(forecastData.expensesDelta)} vs last month` : `↓ ${formatCurrency(Math.abs(forecastData.expensesDelta))} vs last month`
                        : forecastData.incomeDelta > 0 ? `↑ +${formatCurrency(forecastData.incomeDelta)} vs last month` : `↓ ${formatCurrency(Math.abs(forecastData.incomeDelta))} vs last month`
                      }
                    </p>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', flex: 1, minHeight: 60 }}>
                      {forecastData.recentMonths.map((m, i) => {
                        const val = forecastTab === 'expenses' ? m.expenses : m.income;
                        const predicted = forecastTab === 'expenses' ? forecastData.predictedExpenses : forecastData.predictedIncome;
                        const maxVal = Math.max(...forecastData.recentMonths.map(r => forecastTab === 'expenses' ? r.expenses : r.income), predicted);
                        const h = maxVal > 0 ? Math.round((val / maxVal) * 50) : 0;
                        return (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: '100%', height: h, background: '#E2E8F0', borderRadius: '3px 3px 0 0', minHeight: 4 }} />
                            <span style={{ fontSize: 9, color: '#94A3B8' }}>{m.label}</span>
                          </div>
                        );
                      })}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: '100%', height: 40, background: forecastTab === 'expenses' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', border: `1.5px dashed ${forecastTab === 'expenses' ? '#EF4444' : '#10B981'}`, borderRadius: '3px 3px 0 0' }} />
                        <span style={{ fontSize: 9, color: forecastTab === 'expenses' ? '#EF4444' : '#10B981' }}>Next ✦</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Not enough data to forecast.</p>
                )}
              </div>

            </div>

            {/* Bottom row: anomaly spotlight + count + category */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

                {/* Anomaly Spotlight */}
                <div style={{ background: 'white', borderRadius: 12, border: '0.5px solid #E2E8F0', padding: '14px 16px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: 0 }}>Anomaly Spotlight</p>
                    <div style={{ display: 'flex', gap: 2, background: '#F4F7F9', borderRadius: 6, padding: 2 }}>
                      {(['spending', 'income'] as const).map(tab => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setAnomalyTab(tab)}
                          style={{
                            padding: '3px 8px', borderRadius: 4, border: 'none',
                            fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
                            background: anomalyTab === tab ? 'white' : 'transparent',
                            color: anomalyTab === tab ? '#1E293B' : '#94A3B8',
                            fontWeight: anomalyTab === tab ? 600 : 400,
                          }}
                        >
                          {tab === 'spending' ? 'Spend' : 'Income'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                    {(anomalyTab === 'spending' ? topAnomaliesSpending : topAnomaliesIncome).length === 0 ? (
                      <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No {anomalyTab} anomalies found.</p>
                    ) : (
                      (anomalyTab === 'spending' ? topAnomaliesSpending : topAnomaliesIncome).map(tx => (
                        <div key={tx.id} style={{ padding: '7px 10px', background: anomalyTab === 'spending' ? 'rgba(217,119,6,0.06)' : 'rgba(16,185,129,0.06)', borderRadius: 8 }}>
                          <p style={{ fontSize: 11, fontWeight: 600, color: anomalyTab === 'spending' ? '#D97706' : '#10B981', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tx.description.split(' ').slice(0, 3).join(' ')}
                          </p>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 10, color: '#94A3B8' }}>{new Date(tx.transactionDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: anomalyTab === 'spending' ? '#EF4444' : '#10B981' }}>
                              {tx.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(tx.amount))}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Anomaly Count */}
                <div style={{ background: 'white', borderRadius: 12, border: '0.5px solid #E2E8F0', padding: '16px 20px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#1E293B', margin: 0 }}>Anomaly Count</p>
                    <div style={{ display: 'flex', gap: 2, background: '#F4F7F9', borderRadius: 6, padding: 2 }}>
                      {(['spending', 'income'] as const).map(tab => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setAnomalyChartTab(tab)}
                          style={{
                            padding: '3px 8px', borderRadius: 4, border: 'none',
                            fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
                            background: anomalyChartTab === tab ? 'white' : 'transparent',
                            color: anomalyChartTab === tab ? '#1E293B' : '#94A3B8',
                            fontWeight: anomalyChartTab === tab ? 600 : 400,
                          }}
                        >
                          {tab === 'spending' ? 'Spend' : 'Income'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Anomalies per month</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={anomalyMonthlyData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        wrapperStyle={{ zIndex: 9999 }}
                        contentStyle={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12 }}
                        formatter={(value) => [value, anomalyChartTab === 'spending' ? 'Spending Anomalies' : 'Income Anomalies']}
                        labelFormatter={(label) => label}
                      />
                      <Bar
                        dataKey={anomalyChartTab}
                        fill={anomalyChartTab === 'spending' ? ANOMALY_COLOR : '#10B981'}
                        radius={[4, 4, 0, 0]}
                        name={anomalyChartTab === 'spending' ? 'Spending Anomalies' : 'Income Anomalies'}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ background: 'white', borderRadius: 12, border: '0.5px solid #E2E8F0', padding: '14px 16px', display: 'flex', flexDirection: 'column' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: '0 0 4px' }}>Anomaly by Category</p>
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Flagged transactions per category</p>
                  {anomalyCategoryData.length === 0 ? (
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No anomalies detected.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                      {anomalyCategoryData.map((cat, index) => {
                        const maxCount = anomalyCategoryData[0].count;
                        const barWidth = maxCount > 0 ? Math.round((cat.count / maxCount) * 100) : 0;
                        return (
                          <div key={cat.name}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: APP_COLORS[index % APP_COLORS.length], flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: '#1E293B' }}>{cat.name}</span>
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 600, color: ANOMALY_COLOR }}>{cat.count} {cat.count === 1 ? 'anomaly' : 'anomalies'}</span>
                            </div>
                            <div style={{ height: 4, background: '#F1F5F9', borderRadius: 2 }}>
                              <div style={{ width: `${barWidth}%`, height: '100%', background: ANOMALY_COLOR, borderRadius: 2, opacity: 0.7 }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

            </div>
          </div>
        </>
      )}
    </div>
  );
}
