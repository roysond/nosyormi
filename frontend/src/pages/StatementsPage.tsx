import { useCallback, useEffect, useRef, useState } from 'react';
import { IconArrowUp } from '@tabler/icons-react';
import { useUpload } from '../components/UploadContext';
import { ANOMALY_COLOR, MACOS_GLASS_TEAL } from '../constants/palette';
import {
  clearStatement,
  dispatchStatementSwitched,
  getSelectedStatementId,
  selectStatement,
  subscribeStatementSwitched,
} from '../statementSelection';
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5034';

interface StatementSummary {
  id: string;
  fileName: string;
  uploadedAt: string;
  transactionCount: number;
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
  centered: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    fontSize: 15,
    textAlign: 'center' as const,
  },
  loading: {
    color: '#C9911A',
    animation: 'dashboard-pulse 1.6s ease-in-out infinite',
  },
  error: {
    color: '#EF4444',
  },
  emptyTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#1E293B',
  },
  emptySubtext: {
    margin: '8px 0 0',
    fontSize: 14,
    color: '#94A3B8',
  },
  list: {
    padding: '24px 32px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  card: {
    background: '#FFFFFF',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    padding: '20px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: '#1E293B',
    wordBreak: 'break-word' as const,
  },
  uploadedAt: {
    margin: '6px 0 0',
    fontSize: 13,
    color: '#64748B',
  },
  countPill: {
    background: 'rgba(7,26,30,0.08)',
    color: '#071A1E',
    fontSize: 12,
    padding: '4px 12px',
    borderRadius: 999,
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  deleteBtn: {
    background: 'transparent',
    color: '#EF4444',
    border: '1px solid #EF4444',
    borderRadius: 8,
    padding: '7px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  modalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 24,
  },
  modalPanel: {
    background: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    width: 440,
    maxWidth: '90vw',
    boxSizing: 'border-box' as const,
  },
  modalTitle: {
    margin: '0 0 12px',
    fontSize: 18,
    fontWeight: 700,
    color: '#1E293B',
  },
  modalBody: {
    margin: '0 0 24px',
    fontSize: 14,
    color: '#64748B',
    lineHeight: 1.5,
  },
  modalError: {
    margin: '0 0 16px',
    fontSize: 13,
    color: ANOMALY_COLOR,
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelBtn: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    color: '#64748B',
    borderRadius: 8,
    padding: '9px 20px',
    fontSize: 14,
    cursor: 'pointer',
  },
  confirmDeleteBtn: {
    background: '#EF4444',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 8,
    padding: '9px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  reflectBtn: {
    background: 'transparent',
    color: '#124346',
    border: '1px solid rgba(18,67,70,0.4)',
    borderRadius: 8,
    padding: '7px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  cardActive: {
    background: 'rgba(18,67,70,0.12)',
    border: '1px solid rgba(18,67,70,0.4)',
    borderRadius: 8,
  },
};

function formatUploadedDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function StatementsPage() {
  const {
    isUploading,
    uploadFileName,
    uploadError,
    uploadSuccess,
    showUploadModal,
    openUploadModal,
    closeUploadModal,
    handleUpload,
  } = useUpload();

  const [statements, setStatements] = useState<StatementSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StatementSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteHoverId, setDeleteHoverId] = useState<string | null>(null);
  const [hoveringActiveId, setHoveringActiveId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [activeStatementId, setActiveStatementId] = useState<string | null>(
    () => getSelectedStatementId(),
  );

  useEffect(() => {
    return subscribeStatementSwitched(() => {
      setActiveStatementId(getSelectedStatementId());
    });
  }, []);

  const loadStatements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/statements`);
      if (!res.ok) {
        throw new Error(`Failed to load statements (HTTP ${res.status}).`);
      }
      const data: StatementSummary[] = await res.json();
      setStatements(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load statements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatements();
  }, [loadStatements]);

  useEffect(() => {
    if (uploadSuccess) {
      void loadStatements();
      setSelectedFile(null);
      setSelectionError(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [uploadSuccess, loadStatements]);

  const closeDeleteModal = () => {
    if (deleting) return;
    setConfirmDelete(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete || deleting) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`${API_BASE}/api/statements/${confirmDelete.id}`, {
        method: 'DELETE',
      });

      if (res.status === 404) {
        throw new Error('Statement not found.');
      }

      if (!res.ok) {
        throw new Error(`Delete failed (HTTP ${res.status}).`);
      }

      setStatements((prev) => prev.filter((s) => s.id !== confirmDelete.id));

      const deletedIsActive = confirmDelete.id === getSelectedStatementId();
      if (deletedIsActive) {
        sessionStorage.removeItem('nosyormi-chat-messages');
        sessionStorage.removeItem('nosyormi-chat-chart-update');
        clearStatement();
        setActiveStatementId(null);
      }

      window.dispatchEvent(new CustomEvent('nosyormi-statement-deleted'));
      setConfirmDelete(null);
      setDeleteError(null);
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete statement.',
      );
    } finally {
      setDeleting(false);
    }
  };

  function isCsvFile(file: File): boolean {
    return file.name.toLowerCase().endsWith('.csv');
  }

  const handleCloseUploadModal = () => {
    closeUploadModal();
    setSelectedFile(null);
    setSelectionError(null);
    setDragOver(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const selectUploadFile = (candidate: File | undefined) => {
    if (!candidate) return;
    if (!isCsvFile(candidate)) {
      setSelectionError('Only .csv files are supported.');
      setSelectedFile(null);
      return;
    }
    setSelectionError(null);
    setSelectedFile(candidate);
  };

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes dashboard-pulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }
        @keyframes nosyormi-upload-pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.97); }
          50% { opacity: 1; transform: scale(1.03); }
        }
      `}</style>

      <header style={styles.header}>
        <h1 style={styles.headerTitle}>Statements</h1>
        <button
          type="button"
          style={{
            background: 'radial-gradient(ellipse at 78% 12%, #1A5E5A 0%, #124346 55%, #0E3638 100%)',
            color: '#D4A843',
            border: 'none',
            borderRadius: 8,
            padding: '9px 18px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(18,67,70,0.3)',
            letterSpacing: '0.01em',
          }}
          onClick={openUploadModal}
        >
          + Upload Statement
        </button>
      </header>

      {loading && (
        <p style={{ ...styles.centered, ...styles.loading }}>Loading statements...</p>
      )}

      {!loading && error && (
        <p style={{ ...styles.centered, ...styles.error }}>{error}</p>
      )}

      {!loading && !error && statements.length === 0 && (
        <div
          style={{
            ...styles.centered,
            flexDirection: 'column',
          }}
        >
          <p style={styles.emptyTitle}>No statements uploaded yet.</p>
          <p style={styles.emptySubtext}>
            Click Upload Statement to get started.
          </p>
        </div>
      )}

      {!loading && !error && statements.length > 0 && (
        <div style={styles.list}>
          {statements.map((statement) => {
            const isActive = activeStatementId === statement.id;
            const isHoveringActive = isActive && hoveringActiveId === statement.id;
            return (
            <div
              key={statement.id}
              style={{
                ...styles.card,
                ...(isActive ? styles.cardActive : {}),
              }}
            >
              <div style={styles.cardMain}>
                <p style={styles.fileName}>{statement.fileName}</p>
                <p style={styles.uploadedAt}>
                  Uploaded {formatUploadedDate(statement.uploadedAt)}
                </p>
              </div>
              <span style={styles.countPill}>
                {statement.transactionCount} transaction
                {statement.transactionCount === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                style={{
                  ...styles.reflectBtn,
                  ...(isHoveringActive ? { color: '#E57373' } : {}),
                }}
                onClick={() => {
                  if (isActive) {
                    clearStatement();
                    setActiveStatementId(null);
                    return;
                  }
                  selectStatement(statement.id, statement.fileName);
                  dispatchStatementSwitched(statement.fileName);
                  setActiveStatementId(statement.id);
                }}
                onMouseEnter={() => {
                  if (isActive) setHoveringActiveId(statement.id);
                }}
                onMouseLeave={() => setHoveringActiveId(null)}
              >
                {isActive
                  ? isHoveringActive
                    ? 'Stop Reflecting'
                    : 'Reflected ✓'
                  : 'Reflect'}
              </button>
              <button
                type="button"
                style={{
                  ...styles.deleteBtn,
                  background:
                    deleteHoverId === statement.id
                      ? 'rgba(239,68,68,0.06)'
                      : 'transparent',
                }}
                onClick={() => {
                  setConfirmDelete(statement);
                  setDeleteError(null);
                }}
                onMouseEnter={() => setDeleteHoverId(statement.id)}
                onMouseLeave={() => setDeleteHoverId(null)}
              >
                Delete
              </button>
            </div>
            );
          })}
        </div>
      )}

      {confirmDelete && (
        <div
          style={styles.modalOverlay}
          role="presentation"
          onClick={closeDeleteModal}
        >
          <div
            style={styles.modalPanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-statement-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-statement-title" style={styles.modalTitle}>
              Delete Statement?
            </h2>
            <p style={styles.modalBody}>
              This will permanently delete{' '}
              <span style={{ fontWeight: 600 }}>{confirmDelete.fileName}</span> and
              all{' '}
              <span style={{ fontWeight: 600 }}>
                {confirmDelete.transactionCount}
              </span>{' '}
              transaction{confirmDelete.transactionCount === 1 ? '' : 's'}. This
              cannot be undone.
            </p>
            {deleteError && <p style={styles.modalError}>{deleteError}</p>}
            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.cancelBtn}
                onClick={closeDeleteModal}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{
                  ...styles.confirmDeleteBtn,
                  opacity: deleting ? 0.7 : 1,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
                onClick={() => void handleConfirmDelete()}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: isUploading ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.12)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: isUploading ? 'none' : 'auto',
          }}
          onClick={handleCloseUploadModal}
          role="presentation"
        >
          <div
            style={{
              ...MACOS_GLASS_TEAL,
              width: 480,
              maxWidth: '90vw',
              padding: '28px 28px 28px',
              boxSizing: 'border-box' as const,
              position: 'relative' as const,
              overflow: 'hidden',
              pointerEvents: 'auto' as const,
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-modal-title"
          >
            <div style={{ position: 'relative', zIndex: 1 }}>
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
                  color: '#ffffff',
                }}
              >
                Upload Statement
              </h2>
              <button
                type="button"
                onClick={handleCloseUploadModal}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: 20,
                  color: 'rgba(255,255,255,0.65)',
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
                    color: '#C9911A',
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
                    border: `2px dashed ${dragOver ? '#D4A843' : 'rgba(212,168,67,0.55)'}`,
                    background: dragOver
                      ? 'rgba(212,168,67,0.12)'
                      : 'rgba(255,255,255,0.07)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
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
                  {isUploading ? (
                    <div
                      style={{
                        animation: 'nosyormi-upload-pulse 1.8s ease-in-out infinite',
                        textAlign: 'center',
                        padding: '20px 0',
                      }}
                    >
                      <div style={{ color: '#F2D177', fontSize: 14, fontWeight: 500 }}>
                        Reflecting on your data...
                      </div>
                    </div>
                  ) : (
                    <>
                      <IconArrowUp
                        size={36}
                        color="#ffffff"
                        style={{ display: 'block', margin: '0 auto 12px' }}
                        aria-hidden
                      />
                      {selectedFile || uploadFileName ? (
                        <p
                          style={{
                            margin: 0,
                            fontSize: 14,
                            fontWeight: 600,
                            color: '#D4A843',
                            wordBreak: 'break-word',
                          }}
                        >
                          {selectedFile?.name ?? uploadFileName}
                        </p>
                      ) : (
                        <>
                          <p
                            style={{
                              margin: '0 0 6px',
                              fontSize: 15,
                              fontWeight: 500,
                              color: '#ffffff',
                            }}
                          >
                            Drop your CSV here
                          </p>
                          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.72)' }}>
                            or click to browse
                          </p>
                        </>
                      )}
                      <p
                        style={{
                          margin: '12px 0 0',
                          fontSize: 11,
                          color: 'rgba(255,255,255,0.55)',
                        }}
                      >
                        Accepts .csv files from any bank
                      </p>
                    </>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={(e) => selectUploadFile(e.target.files?.[0])}
                />

                {(selectionError || uploadError) && (
                  <p
                    style={{
                      margin: '0 0 12px',
                      fontSize: 13,
                      color: ANOMALY_COLOR,
                    }}
                  >
                    {selectionError ?? uploadError}
                  </p>
                )}

                {(selectedFile || isUploading) && (
                  <button
                    type="button"
                    onClick={() => { if (selectedFile) void handleUpload(selectedFile); }}
                    disabled={isUploading}
                    style={{
                      width: '100%',
                      padding: '12px 24px',
                      border: 'none',
                      borderRadius: 8,
                      background: isUploading ? 'rgba(212,168,67,0.7)' : 'linear-gradient(180deg, #DCAE47, #C8952A)',
                      color: '#3a2a08',
                      boxShadow: '0 4px 14px rgba(200,149,42,0.3), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.15)',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: isUploading ? 'not-allowed' : 'pointer',
                      opacity: isUploading ? 0.7 : 1,
                    }}
                  >
                    {isUploading ? 'Uploading...' : 'Reflect on this statement'}
                  </button>
                )}
              </>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
