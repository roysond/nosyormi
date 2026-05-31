import { useCallback, useEffect, useState } from 'react';
import {
  STATEMENT_FILENAME_KEY,
  STATEMENT_SWITCHED_EVENT,
  type StatementSwitchedDetail,
} from '../statementSelection';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5034';

interface StatementSummary {
  fileName: string;
}

function readStoredFileName(): string | null {
  return sessionStorage.getItem(STATEMENT_FILENAME_KEY);
}

export default function StatementPill() {
  const [fileName, setFileName] = useState<string | null>(() => readStoredFileName());

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
      setFileName(readStoredFileName() ?? summaries[0].fileName);
    } catch {
      setFileName(null);
    }
  }, []);

  useEffect(() => {
    const stored = readStoredFileName();
    if (stored) {
      setFileName(stored);
    } else {
      void fetchStatement();
    }

    const intervalId = window.setInterval(() => {
      void fetchStatement();
    }, 30_000);

    const handleStatementSwitched = (e: Event) => {
      const detail = (e as CustomEvent<StatementSwitchedDetail>).detail;
      if (detail?.fileName) {
        setFileName(detail.fileName);
      }
    };

    const handleStatementsChanged = () => {
      const stored = readStoredFileName();
      if (stored) {
        setFileName(stored);
      } else {
        void fetchStatement();
      }
    };

    window.addEventListener(STATEMENT_SWITCHED_EVENT, handleStatementSwitched);
    window.addEventListener('nosyormi-statement-deleted', handleStatementsChanged);
    window.addEventListener('nosyormi-statement-uploaded', handleStatementsChanged);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(STATEMENT_SWITCHED_EVENT, handleStatementSwitched);
      window.removeEventListener('nosyormi-statement-deleted', handleStatementsChanged);
      window.removeEventListener('nosyormi-statement-uploaded', handleStatementsChanged);
    };
  }, [fetchStatement]);

  if (!fileName) {
    return null;
  }

  return (
    <div style={{ margin: '0 12px', marginBottom: 16 }}>
      <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 4 }}>Reflecting on:</div>
      <div
        title={fileName}
        style={{
          background: 'rgba(52,211,153,0.08)',
          color: '#34D399',
          fontSize: 12,
          padding: '6px 10px',
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
