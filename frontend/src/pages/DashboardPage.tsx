import { useEffect, useState } from 'react';

const API_STATEMENTS_URL = 'http://localhost:5034/api/statements';

interface Statement {
  id: string;
  fileName: string;
  uploadedAt: string;
  transactionCount: number;
}

const colors = {
  text: '#e8ecf4',
  muted: '#7a8aaa',
  teal: '#00637C',
  amber: '#f4a623',
  white: '#ffffff',
};

const styles = {
  page: {
    padding: '8px 0',
  },
  title: {
    margin: '0 0 8px',
    fontSize: '1.75rem',
    fontWeight: 600,
    color: colors.text,
  },
  subtitle: {
    margin: '0 0 32px',
    color: colors.muted,
    fontSize: '0.95rem',
  },
  loading: {
    color: colors.teal,
    fontSize: '1rem',
    animation: 'dashboard-pulse 1.6s ease-in-out infinite',
  },
  error: {
    color: colors.amber,
    fontSize: '0.95rem',
  },
  empty: {
    textAlign: 'center' as const,
    padding: '48px 24px',
  },
  emptyTitle: {
    margin: '0 0 8px',
    fontSize: '1.1rem',
    color: colors.text,
  },
  emptySubtext: {
    margin: 0,
    fontSize: '0.9rem',
    color: colors.muted,
  },
  summary: {
    margin: '0 0 16px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 12,
    color: colors.muted,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 16,
  },
  card: {
    background:
      'linear-gradient(135deg, rgba(0,99,124,0.35) 0%, rgba(0,99,124,0.18) 100%)',
    border: '1px solid rgba(0,200,220,0.18)',
    borderRadius: 12,
    padding: 24,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    boxShadow:
      '0 4px 24px rgba(0,99,124,0.15), inset 0 1px 0 rgba(255,255,255,0.06)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  cardFileName: {
    margin: '0 0 10px',
    fontWeight: 600,
    color: colors.white,
    fontSize: '1.05rem',
    wordBreak: 'break-word' as const,
  },
  cardTransactions: {
    margin: '0 0 8px',
    color: colors.teal,
    fontSize: '0.95rem',
    fontWeight: 500,
  },
  cardDate: {
    margin: '0 0 16px',
    color: colors.muted,
    fontSize: 13,
  },
  cardLink: {
    color: colors.teal,
    fontSize: 13,
    textDecoration: 'none',
    fontWeight: 500,
  },
};

function formatUploadedDate(isoDate: string): string {
  const date = new Date(isoDate);
  const formatted = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  return `Uploaded ${formatted}`;
}

export default function DashboardPage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(API_STATEMENTS_URL)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load statements (HTTP ${res.status}).`);
        }
        return res.json();
      })
      .then((data: Statement[]) => {
        setStatements(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load statements.');
        setLoading(false);
      });
  }, []);

  return (
    <div className="page-content" style={styles.page}>
      <style>{`
        @keyframes dashboard-pulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }
        .statement-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0,99,124,0.28), inset 0 1px 0 rgba(255,255,255,0.08);
        }
      `}</style>

      <h1 style={styles.title}>Dashboard</h1>
      <p style={styles.subtitle}>Your financial picture at a glance.</p>

      {loading && <p style={styles.loading}>Reflecting on your data...</p>}

      {!loading && error && <p style={styles.error}>{error}</p>}

      {!loading && !error && statements.length === 0 && (
        <div style={styles.empty}>
          <p style={styles.emptyTitle}>No statements uploaded yet.</p>
          <p style={styles.emptySubtext}>
            Head to Upload to add your first bank statement.
          </p>
        </div>
      )}

      {!loading && !error && statements.length > 0 && (
        <>
          <p style={styles.summary}>
            {statements.length} statement{statements.length === 1 ? '' : 's'} uploaded
          </p>
          <div style={styles.grid}>
            {statements.map((statement) => (
              <article
                key={statement.id}
                className="statement-card"
                style={styles.card}
              >
                <p style={styles.cardFileName}>{statement.fileName}</p>
                <p style={styles.cardTransactions}>
                  {statement.transactionCount} transactions
                </p>
                <p style={styles.cardDate}>
                  {formatUploadedDate(statement.uploadedAt)}
                </p>
                <a
                  href={`/dashboard/${statement.id}`}
                  style={styles.cardLink}
                >
                  View Details →
                </a>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
