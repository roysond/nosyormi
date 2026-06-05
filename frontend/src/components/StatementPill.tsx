import { useCallback, useEffect, useState } from 'react';
import {
  getSelectedStatementId,
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
      setFileName(readStoredFileName());
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
      if (getSelectedStatementId()) {
        void fetchStatement();
      } else {
        setFileName(null);
      }
    }, 30_000);

    const handleStatementSwitched = (e: Event) => {
      const detail = (e as CustomEvent<StatementSwitchedDetail>).detail;
      if (detail?.fileName) {
        setFileName(detail.fileName);
      } else {
        setFileName(null);
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

  const pillText = fileName ?? 'No Statement';
  const pillColor = fileName ? '#124346' : '#94A3B8';

  return (
    <div style={{ margin: '0 12px', marginBottom: 16 }}>
      <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 4 }}>Reflecting on:</div>
      <div
        title={pillText}
        style={{
          background: 'rgba(18,67,70,0.08)',
          color: pillColor,
          textAlign: 'center',
          fontSize: 12,
          padding: '6px 10px',
          borderRadius: 999,
          margin: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {pillText}
      </div>
    </div>
  );
}
