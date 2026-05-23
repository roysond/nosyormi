import { useCallback, useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5034';

interface StatementSummary {
  fileName: string;
}

export default function StatementPill() {
  const [fileName, setFileName] = useState<string | null>(null);

  const fetchStatement = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/statements`);
      if (!res.ok) {
        setFileName(null);
        return;
      }
      const summaries: StatementSummary[] = await res.json();
      if (summaries.length === 0) {
        setFileName(null);
        return;
      }
      setFileName(summaries[0].fileName);
    } catch {
      setFileName(null);
    }
  }, []);

  useEffect(() => {
    void fetchStatement();

    const intervalId = window.setInterval(() => {
      void fetchStatement();
    }, 30_000);

    const handleStatementsChanged = () => {
      void fetchStatement();
    };

    window.addEventListener('nosyormi-statement-deleted', handleStatementsChanged);
    window.addEventListener('nosyormi-statement-uploaded', handleStatementsChanged);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('nosyormi-statement-deleted', handleStatementsChanged);
      window.removeEventListener('nosyormi-statement-uploaded', handleStatementsChanged);
    };
  }, [fetchStatement]);

  if (!fileName) {
    return null;
  }

  return (
    <div style={{ margin: '0 12px' }}>
      <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 4 }}>Reflecting on:</div>
      <div
        title={fileName}
        style={{
          background: 'rgba(0,99,124,0.08)',
          color: '#00637C',
          fontSize: 11,
          padding: '6px 12px',
          borderRadius: 999,
          margin: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {fileName}
      </div>
    </div>
  );
}
