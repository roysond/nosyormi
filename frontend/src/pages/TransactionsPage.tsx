import { useCallback, useEffect, useMemo, useState } from 'react';
import { ANOMALY_COLOR } from '../constants/palette';
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [showAnomaliesOnly, setShowAnomaliesOnly] = useState(false);

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
      setScrolled(mainEl.scrollTop > 40);
    };

    handleScroll();
    mainEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => mainEl.removeEventListener('scroll', handleScroll);
  }, []);

  const allTransactions = useMemo(() => {
    if (!statement) return [];
    return [...statement.transactions].sort((a, b) =>
      b.transactionDate.localeCompare(a.transactionDate),
    );
  }, [statement]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of allTransactions) {
      set.add(getCategoryName(t));
    }
    return Array.from(set).sort();
  }, [allTransactions]);

  const filteredTransactions = useMemo(() => {
    let txs = [...allTransactions];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      txs = txs.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          getCategoryName(t).toLowerCase().includes(q),
      );
    }

    if (selectedCategory) {
      txs = txs.filter((t) => getCategoryName(t) === selectedCategory);
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
  }, [allTransactions, searchQuery, selectedCategory, sortBy, showAnomaliesOnly]);

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

  const renderRowGrid = (tx: Transaction, showDateColumn: boolean) => (
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
            background: 'rgba(7,26,30,0.07)',
            color: '#071A1E',
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

  const summaryRows: Array<{
    label: string;
    value: string;
    valueColor: string;
    dividerAfter?: boolean;
    noBorder?: boolean;
  }> = [
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
      label: 'Total Income',
      value: formatCurrency(summaryStats.totalIncome),
      valueColor: '#10B981',
      dividerAfter: true,
    },
    {
      label: 'Total Spending',
      value: formatCurrency(summaryStats.totalSpending),
      valueColor: '#EF4444',
      noBorder: true,
    },
  ];

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
              value={selectedCategory ?? ''}
              onChange={(e) =>
                setSelectedCategory(e.target.value || null)
              }
              style={selectStyle}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

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
        <div
          style={{
            display: 'flex',
            padding: '24px 32px',
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
                  {row.dividerAfter && (
                    <div
                      style={{
                        borderTop: '1px solid #E2E8F0',
                        margin: '8px 0',
                      }}
                    />
                  )}
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
                  {summaryStats.anomalyCount === 1 ? 'y' : 'ies'} Detected In This
                  Statement. Review Highlighted Transactions.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
