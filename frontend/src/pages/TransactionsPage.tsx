import { useCallback, useEffect, useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ANOMALY_COLOR, APP_COLORS } from '../constants/palette';
import { JewelSlice, UniversalTooltip } from '../components/chartEffects';
import {
  fetchActiveStatement,
  subscribeStatementSwitched,
} from '../statementSelection';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function darkenHex(hex: string): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * 0.6);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * 0.6);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * 0.6);
  return `rgb(${r},${g},${b})`;
}

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

const selectStyle = {
  background: 'white',
  border: '1px solid #E2E8F0',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  color: '#475569',
  cursor: 'pointer',
  outline: 'none',
  appearance: 'auto' as const,
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

function formatFullDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
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

function getCategoryName(tx: Transaction): string {
  return tx.category || 'Other';
}

export default function TransactionsPage() {
  const [statement, setStatement] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'highest' | 'lowest' | 'az' | 'za'>(
    'date',
  );
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [showAnomaliesOnly, setShowAnomaliesOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<'spending' | 'income'>('spending');
  const [tabHover, setTabHover] = useState<'spending' | 'income' | null>(null);
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

  const loadStatement = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setError(null);
    }
    const result = await fetchActiveStatement<Statement>(API_BASE);
    if (result.kind === 'empty') {
      setStatement(null);
      setError('No statements uploaded yet. Upload a CSV from the Statements page.');
    } else if (result.kind === 'ok') {
      setStatement(result.statement);
      setError(null);
      setExpandedRowId(null);
      setActiveCategoryIndex(null);
    } else {
      setStatement(null);
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
    const mainEl = document.querySelector('main');
    if (!mainEl) return;

    const handleScroll = () => {
      setScrolled(prev => {
        if (!prev && mainEl.scrollTop > 40) return true;
        if (prev && mainEl.scrollTop < 20) return false;
        return prev;
      });
    };

    handleScroll();
    mainEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => mainEl.removeEventListener('scroll', handleScroll);
  }, []);

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

  const allTransactions = useMemo(() => {
    if (!statement) return [];
    return [...statement.transactions].sort((a, b) =>
      b.transactionDate.localeCompare(a.transactionDate),
    );
  }, [statement]);

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

  const spendingCategoryTotals = useMemo(() => {
    const dateFiltered = filterTransactionsByDate(allTransactions);
    const expenses = dateFiltered.filter((t) => t.amount < 0);
    const totalSpend = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const grouped = expenses.reduce(
      (acc, t) => {
        const cat = t.category || 'Other';
        if (!acc[cat]) acc[cat] = { name: cat, value: 0, percentage: 0 };
        acc[cat].value = Math.round((acc[cat].value + Math.abs(t.amount)) * 100) / 100;
        return acc;
      },
      {} as Record<string, { name: string; value: number; percentage: number }>,
    );
    return Object.values(grouped)
      .map((c) => ({
        ...c,
        percentage: totalSpend > 0 ? Math.round((c.value / totalSpend) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [allTransactions, filterTransactionsByDate]);

  const incomeCategoryTotals = useMemo(() => {
    const dateFiltered = filterTransactionsByDate(allTransactions);
    const income = dateFiltered.filter((t) => t.amount > 0);
    const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
    const grouped = income.reduce(
      (acc, t) => {
        const cat = t.category || 'Other';
        if (!acc[cat]) acc[cat] = { name: cat, value: 0, percentage: 0 };
        acc[cat].value = Math.round((acc[cat].value + t.amount) * 100) / 100;
        return acc;
      },
      {} as Record<string, { name: string; value: number; percentage: number }>,
    );
    return Object.values(grouped)
      .map((c) => ({
        ...c,
        percentage: totalIncome > 0 ? Math.round((c.value / totalIncome) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [allTransactions, filterTransactionsByDate]);

  const activeCategoryTotals =
    activeTab === 'spending' ? spendingCategoryTotals : incomeCategoryTotals;

  const categoryColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    activeCategoryTotals.forEach((cat, index) => {
      map[cat.name] = APP_COLORS[index % APP_COLORS.length];
    });
    return map;
  }, [activeCategoryTotals]);

  const activeTotalAmount = useMemo(() => {
    const dateFiltered = filterTransactionsByDate(allTransactions);
    return activeTab === 'spending'
      ? dateFiltered.filter((t) => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)
      : dateFiltered.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  }, [allTransactions, activeTab, filterTransactionsByDate]);

  const activeCategory =
    activeCategoryIndex !== null
      ? (activeCategoryTotals[activeCategoryIndex] ?? null)
      : null;

  const filteredTransactions = useMemo(() => {
    let txs = filterTransactionsByDate(allTransactions);

    if (activeTab === 'spending') txs = txs.filter((t) => t.amount < 0);
    if (activeTab === 'income') txs = txs.filter((t) => t.amount > 0);

    if (activeCategoryIndex !== null) {
      const catName = activeCategoryTotals[activeCategoryIndex]?.name;
      if (catName) txs = txs.filter((t) => (t.category || 'Other') === catName);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      txs = txs.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          getCategoryName(t).toLowerCase().includes(q),
      );
    }

    if (showAnomaliesOnly) {
      txs = txs.filter((t) => t.isAnomaly);
    }

    switch (sortBy) {
      case 'highest':
        txs.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
        break;
      case 'lowest':
        txs.sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount));
        break;
      case 'az':
        txs.sort((a, b) =>
          a.description.toLowerCase().localeCompare(b.description.toLowerCase()),
        );
        break;
      case 'za':
        txs.sort((a, b) =>
          b.description.toLowerCase().localeCompare(a.description.toLowerCase()),
        );
        break;
      case 'date':
      default:
        txs.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
        break;
    }

    return txs;
  }, [
    allTransactions,
    searchQuery,
    sortBy,
    showAnomaliesOnly,
    activeTab,
    activeCategoryIndex,
    activeCategoryTotals,
    filterTransactionsByDate,
  ]);

  const summaryStats = useMemo(() => {
    const txs = filteredTransactions;
    const absAmounts = txs.map((t) => Math.abs(t.amount));
    const totalTransactions = txs.length;
    const largestTransaction =
      absAmounts.length > 0 ? Math.max(...absAmounts) : 0;
    const averageTransaction =
      absAmounts.length > 0
        ? absAmounts.reduce((s, a) => s + a, 0) / absAmounts.length
        : 0;
    const totalSpending = txs
      .filter((t) => t.amount < 0)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalIncome = txs
      .filter((t) => t.amount > 0)
      .reduce((s, t) => s + t.amount, 0);
    const anomalyCount = txs.filter((t) => t.isAnomaly).length;

    return {
      totalTransactions,
      largestTransaction,
      averageTransaction,
      totalSpending,
      totalIncome,
      anomalyCount,
    };
  }, [filteredTransactions]);

  const useDateGroups = sortBy === 'date';

  const toggleExpand = (id: string) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  const renderRowGrid = (tx: Transaction, showDateColumn: boolean) => {
    const catName = getCategoryName(tx);
    const catColor = categoryColorMap[catName] ?? '#BAB0AC';

    return (
    <>
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
            fontWeight: 400,
            background: hexToRgba(catColor, 0.15),
            color: darkenHex(catColor),
            borderRadius: 999,
            padding: '3px 10px',
            whiteSpace: 'nowrap',
          }}
        >
          {getCategoryName(tx)}
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
            color: tx.amount > 0 ? '#10B981' : '#EF4444',
            whiteSpace: 'nowrap',
          }}
        >
          {tx.amount > 0 ? '+' : '-'}
          {formatCurrency(Math.abs(tx.amount))}
        </span>
      </div>
    </>
    );
  };

  const renderExpandedPanel = (tx: Transaction) => (
    <div
      style={{
        background: '#F8FAFC',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        borderRadius: 8,
        padding: '16px 20px',
        margin: '0 0 4px 0',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#94A3B8',
            marginBottom: 4,
          }}
        >
          DATE
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#1E293B' }}>
          {formatFullDate(tx.transactionDate)}
        </div>
      </div>
      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#94A3B8',
            marginBottom: 4,
          }}
        >
          CATEGORY
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#071A1E' }}>
          {getCategoryName(tx)}
        </div>
      </div>
      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#94A3B8',
            marginBottom: 4,
          }}
        >
          STATUS
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: tx.isAnomaly ? ANOMALY_COLOR : '#10B981',
          }}
        >
          {tx.isAnomaly ? '\u26a0 Anomaly Detected' : '\u2713 Normal'}
        </div>
      </div>
    </div>
  );

  const renderTransactionItem = (tx: Transaction) => {
    const isExpanded = expandedRowId === tx.id;
    const showDateColumn = !useDateGroups;

    return (
      <div key={tx.id}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleExpand(tx.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleExpand(tx.id);
            }
          }}
          style={{
            display: 'grid',
            gridTemplateColumns: showDateColumn
              ? '80px 1fr 1fr 1fr'
              : '1fr 1fr 1fr',
            alignItems: 'center',
            padding: '12px 16px',
            borderRadius: 8,
            borderBottom: '1px solid #F1F5F9',
            background: tx.isAnomaly
              ? 'rgba(217,119,6,0.06)'
              : isExpanded
                ? '#F4F7F9'
                : 'white',
            cursor: 'pointer',
            transition: 'background 0.15s',
            ...(tx.isAnomaly
              ? { animation: 'chat-anomaly-pulse 2s ease-in-out infinite' }
              : {}),
          }}
          onMouseEnter={(e) => {
            if (!isExpanded && !tx.isAnomaly) {
              e.currentTarget.style.background = '#F4F7F9';
            }
          }}
          onMouseLeave={(e) => {
            if (!isExpanded && !tx.isAnomaly) {
              e.currentTarget.style.background = 'white';
            }
          }}
        >
          {renderRowGrid(tx, showDateColumn)}
        </div>
        {isExpanded && renderExpandedPanel(tx)}
      </div>
    );
  };

  const renderTransactionList = () => {
    if (filteredTransactions.length === 0) {
      return (
        <p style={{ color: '#94A3B8', fontSize: 13 }}>No transactions match your filters.</p>
      );
    }

    if (useDateGroups) {
      return groupByDate(filteredTransactions).map(([date, txs]) => (
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
          {txs.map((tx) => renderTransactionItem(tx))}
        </div>
      ));
    }

    return filteredTransactions.map((tx) => renderTransactionItem(tx));
  };

  const summaryRows = useMemo(
    () =>
      activeTab === 'spending'
        ? [
            {
              label: 'Total Transactions',
              value: String(summaryStats.totalTransactions),
              valueColor: '#1E293B',
            },
            {
              label: 'Largest Transaction',
              value: formatCurrency(summaryStats.largestTransaction),
              valueColor: '#EF4444',
            },
            {
              label: 'Average Transaction',
              value: formatCurrency(summaryStats.averageTransaction),
              valueColor: '#1E293B',
            },
            {
              label: 'Total Spending',
              value: formatCurrency(summaryStats.totalSpending),
              valueColor: '#EF4444',
              noBorder: true,
            },
          ]
        : [
            {
              label: 'Total Transactions',
              value: String(summaryStats.totalTransactions),
              valueColor: '#1E293B',
            },
            {
              label: 'Largest Transaction',
              value: formatCurrency(summaryStats.largestTransaction),
              valueColor: '#10B981',
            },
            {
              label: 'Average Transaction',
              value: formatCurrency(summaryStats.averageTransaction),
              valueColor: '#1E293B',
            },
            {
              label: 'Total Income',
              value: formatCurrency(summaryStats.totalIncome),
              valueColor: '#10B981',
              noBorder: true,
            },
          ],
    [activeTab, summaryStats],
  );

  const tabStyle = (active: boolean, hover: boolean) => ({
    padding: active ? '10px 28px 12px' : '10px 28px',
    fontSize: 14,
    fontWeight: active ? 500 : 400,
    cursor: 'pointer',
    border: active ? '0.5px solid #E2E8F0' : 'none',
    borderBottom: active ? '0.5px solid #FFFFFF' : 'none',
    borderRadius: '12px 12px 0 0',
    background: active ? '#FFFFFF' : hover ? '#F8FAFC' : 'transparent',
    color: active ? '#071A1E' : hover ? '#1E293B' : '#64748B',
    position: 'relative' as const,
    zIndex: active ? 2 : 1,
    transition: 'background 0.15s, color 0.15s',
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        background: '#F4F7F9',
      }}
    >
      <style>{`
        @keyframes chat-anomaly-pulse {
          0%, 100% { box-shadow: inset 0 0 0 0 rgba(217,119,6,0); }
          50% { box-shadow: inset 0 0 22px rgba(217,119,6,0.22); }
        }
        @keyframes anomalyDotPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes anomalyPulse {
          0%, 100% { box-shadow: inset 0 0 0 0 rgba(217,119,6,0); }
          50% { box-shadow: inset 0 0 16px rgba(217,119,6,0.3); }
        }
        @keyframes tx-loading-pulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }
        @keyframes chartFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .nosyormi-tx-tab-spending.nosyormi-tx-tab-active::after {
          content: ''; position: absolute; bottom: 0; right: -12px;
          width: 12px; height: 12px; background: transparent;
          border-bottom-left-radius: 12px;
          box-shadow: -4px 4px 0 4px #FFFFFF; z-index: 3; pointer-events: none;
        }
        .nosyormi-tx-tab-income.nosyormi-tx-tab-active::before {
          content: ''; position: absolute; bottom: 0; left: -12px;
          width: 12px; height: 12px; background: transparent;
          border-bottom-right-radius: 12px;
          box-shadow: 4px 4px 0 4px #FFFFFF; z-index: 3; pointer-events: none;
        }
        .nosyormi-tx-tab-income.nosyormi-tx-tab-active::after {
          content: ''; position: absolute; bottom: 0; right: -12px;
          width: 12px; height: 12px; background: transparent;
          border-bottom-left-radius: 12px;
          box-shadow: -4px 4px 0 4px #FFFFFF; z-index: 3; pointer-events: none;
        }
      `}</style>

      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: '#F4F7F9',
          padding: scrolled ? '10px 32px' : '16px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          transition: 'padding 0.25s ease, font-size 0.25s ease',
        }}
      >
        <h1
          style={{
            fontSize: scrolled ? 16 : 26,
            fontWeight: 700,
            color: '#1E293B',
            margin: 0,
            transition: 'font-size 0.25s ease',
          }}
        >
          Transactions
        </h1>

        {!loading && !error && statement && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 14,
                  pointerEvents: 'none',
                }}
                aria-hidden
              >
                🔍
              </span>
              <input
                type="search"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 8,
                  padding: '8px 14px 8px 36px',
                  fontSize: 13,
                  color: '#1E293B',
                  width: 220,
                  outline: 'none',
                }}
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as 'date' | 'highest' | 'lowest' | 'az' | 'za',
                )
              }
              style={selectStyle}
            >
              <option value="date">Sort: Date (newest)</option>
              <option value="highest">Sort: Highest spend</option>
              <option value="lowest">Sort: Lowest spend</option>
              <option value="az">Sort: A → Z</option>
              <option value="za">Sort: Z → A</option>
            </select>
          </div>
        )}
      </header>

      {loading && (
        <p
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#C9911A',
            fontSize: 15,
            animation: 'tx-loading-pulse 1.6s ease-in-out infinite',
          }}
        >
          Loading transactions...
        </p>
      )}

      {!loading && error && (
        <p
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#EF4444',
            fontSize: 15,
          }}
        >
          {error}
        </p>
      )}

      {!loading && !error && statement && (
        <>
          <div style={{ padding: '0 32px', marginBottom: 24, marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3 }}>
              <button
                type="button"
                className={`nosyormi-tx-tab-spending${activeTab === 'spending' ? ' nosyormi-tx-tab-active' : ''}`}
                style={tabStyle(activeTab === 'spending', tabHover === 'spending')}
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
                className={`nosyormi-tx-tab-income${activeTab === 'income' ? ' nosyormi-tx-tab-active' : ''}`}
                style={tabStyle(activeTab === 'income', tabHover === 'income')}
                onClick={() => {
                  setActiveTab('income');
                  setActiveCategoryIndex(null);
                }}
                onMouseEnter={() => setTabHover('income')}
                onMouseLeave={() => setTabHover(null)}
              >
                Income
              </button>
            </div>

            <div
              style={{
                background: '#FFFFFF',
                borderLeft: '0.5px solid #E2E8F0',
                borderRight: '0.5px solid #E2E8F0',
                borderBottom: '0.5px solid #E2E8F0',
                borderRadius:
                  activeTab === 'spending' ? '0 12px 12px 12px' : '12px 12px 12px 12px',
                padding: '24px 32px',
              }}
            >
              <div
                style={{ position: 'relative', display: 'inline-block' }}
                data-datepicker
              >
                <button
                  type="button"
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
                            type="button"
                            onClick={() => {
                              if (period === 'all') setDateFilter({ type: 'all' });
                              else setDateFilter({ type: 'month', month: period });
                              setShowDatePicker(false);
                            }}
                            style={{
                              padding: '5px 12px',
                              borderRadius: 999,
                              border: isActive ? '1.5px solid #124346' : '1px solid #E2E8F0',
                              background: isActive ? 'rgba(18,67,70,0.08)' : 'white',
                              color: isActive ? '#124346' : '#475569',
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
                      type="button"
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
                        background: '#124346',
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

              <div
                style={{
                  display: 'flex',
                  gap: 24,
                  alignItems: 'flex-start',
                  marginTop: 20,
                }}
              >
                <div style={{ width: '45%', minWidth: 0 }}>
                  <h2
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#64748B',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    {activeTab === 'spending' ? 'Spending' : 'Income'} by Category
                  </h2>
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      animation: 'chartFadeIn 0.4s ease-out',
                    }}
                  >
                    <ResponsiveContainer width="100%" height={340} minHeight={1}>
                      <div
                        style={{ filter: 'saturate(1.12) contrast(1.05) brightness(1.02)' }}
                      >
                        <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                          <Pie
                            data={activeCategoryTotals}
                            shape={(props: any) => (
                              <JewelSlice
                                {...props}
                                isActive={props.index === activeCategoryIndex}
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
                            {activeCategoryTotals.map((_, index) => {
                              const color = APP_COLORS[index % APP_COLORS.length];
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
                            {formatCurrency(activeTotalAmount)}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: '#94A3B8',
                              marginTop: 4,
                            }}
                          >
                            {activeTab === 'spending' ? 'total spend' : 'total income'}
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

                <div style={{ width: '55%', minWidth: 0 }}>
                  <h2
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#64748B',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    Categories
                  </h2>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 8,
                    }}
                  >
                    {activeCategoryTotals.map((cat, index) => {
                      const isHighlighted = index === activeCategoryIndex;
                      const color = APP_COLORS[index % APP_COLORS.length];
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
                            padding: isHighlighted ? '10px 14px 10px 11px' : '10px 14px',
                            borderRadius: 8,
                            border: isHighlighted
                              ? '1px solid rgba(201,145,26,0.2)'
                              : '1px solid transparent',
                            borderLeft: isHighlighted
                              ? `3px solid ${color}`
                              : '1px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            background: isHighlighted ? 'rgba(201,145,26,0.06)' : '#F4F7F9',
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
            </div>
          </div>

        <div
          style={{
            display: 'flex',
            padding: '0 32px 24px',
            gap: 24,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 13, color: '#64748B' }}>
                {summaryStats.totalTransactions} transaction
                {summaryStats.totalTransactions === 1 ? '' : 's'}
              </span>
              {summaryStats.anomalyCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAnomaliesOnly((prev) => !prev)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 999,
                    padding: '4px 12px',
                    cursor: 'pointer',
                    ...(showAnomaliesOnly
                      ? {
                          background: 'rgba(217,119,6,0.15)',
                          border: '1px solid rgba(217,119,6,0.5)',
                          color: '#D97706',
                          animation: 'anomalyPulse 2s ease-in-out infinite',
                        }
                      : {
                          color: ANOMALY_COLOR,
                          background: 'rgba(220,38,38,0.1)',
                          border: '1px solid rgba(220,38,38,0.25)',
                        }),
                  }}
                >
                  {!showAnomaliesOnly && (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: ANOMALY_COLOR,
                        animation: 'anomalyDotPulse 1.5s ease-in-out infinite',
                      }}
                      aria-hidden
                    />
                  )}
                  {showAnomaliesOnly
                    ? 'Showing Anomalies Only ✕'
                    : `${summaryStats.anomalyCount} Anomal${
                        summaryStats.anomalyCount === 1 ? 'y' : 'ies'
                      } Detected`}
                </button>
              )}
            </div>

            {renderTransactionList()}
          </div>

          <div style={{ width: 280, flexShrink: 0 }}>
            <div
              style={{
                background: 'white',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                borderRadius: 12,
                padding: '20px 24px',
                position: 'sticky',
                top: 0,
              }}
            >
              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#1E293B',
                  margin: '0 0 20px',
                }}
              >
                Summary
              </h2>

              {summaryRows.map((row) => (
                <div key={row.label}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 0',
                      borderBottom: row.noBorder
                        ? 'none'
                        : '1px solid #F4F7F9',
                    }}
                  >
                    <span style={{ fontSize: 12, color: '#64748B' }}>
                      {row.label}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: row.valueColor,
                      }}
                    >
                      {row.value}
                    </span>
                  </div>
                </div>
              ))}

              {summaryStats.anomalyCount > 0 && (
                <div
                  style={{
                    background: 'rgba(220,38,38,0.06)',
                    border: '1px solid rgba(220,38,38,0.2)',
                    borderRadius: 8,
                    padding: '12px 14px',
                    marginTop: 16,
                    fontSize: 12,
                    color: '#92400E',
                    lineHeight: 1.5,
                  }}
                >
                  {'\u26a0'} {summaryStats.anomalyCount} Anomal
                  {summaryStats.anomalyCount === 1 ? 'y' : 'ies'} Detected. Review
                  Highlighted Transactions.
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
