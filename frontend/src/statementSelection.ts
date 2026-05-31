export const STATEMENT_ID_KEY = 'nosyormi-chat-statement-id';
export const STATEMENT_FILENAME_KEY = 'nosyormi-chat-statement-filename';
export const STATEMENT_SWITCHED_EVENT = 'nosyormi-statement-switched';

export function getSelectedStatementId(): string | null {
  return sessionStorage.getItem(STATEMENT_ID_KEY);
}

export function selectStatement(id: string, fileName: string): void {
  sessionStorage.setItem(STATEMENT_ID_KEY, id);
  sessionStorage.setItem(STATEMENT_FILENAME_KEY, fileName);
  window.dispatchEvent(new Event(STATEMENT_SWITCHED_EVENT));
}

export function subscribeStatementSwitched(listener: () => void): () => void {
  window.addEventListener(STATEMENT_SWITCHED_EVENT, listener);
  return () => window.removeEventListener(STATEMENT_SWITCHED_EVENT, listener);
}

export interface StatementSummary {
  id: string;
  fileName: string;
  uploadedAt: string;
  transactionCount: number;
}

export type FetchActiveStatementResult<T> =
  | { kind: 'empty' }
  | { kind: 'ok'; statement: T }
  | { kind: 'error'; message: string };

export async function fetchActiveStatement<T>(
  apiBase: string,
): Promise<FetchActiveStatementResult<T>> {
  try {
    const listRes = await fetch(`${apiBase}/api/statements`);
    if (!listRes.ok) {
      throw new Error(`Failed to load statements (HTTP ${listRes.status}).`);
    }
    const summaries: StatementSummary[] = await listRes.json();
    if (summaries.length === 0) {
      return { kind: 'empty' };
    }

    const preferredId = getSelectedStatementId();
    const summary =
      preferredId != null
        ? summaries.find((s) => s.id === preferredId) ?? summaries[0]
        : summaries[0];

    const detailRes = await fetch(`${apiBase}/api/statements/${summary.id}`);
    if (!detailRes.ok) {
      throw new Error(`Failed to load statement (HTTP ${detailRes.status}).`);
    }
    const statement = (await detailRes.json()) as T;
    return { kind: 'ok', statement };
  } catch (err: unknown) {
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : 'Failed to load statement.',
    };
  }
}
