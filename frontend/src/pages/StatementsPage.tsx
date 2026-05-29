import { useCallback, useEffect, useRef, useState } from 'react';
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
    fontSize: '20px',
    fontWeight: 700,
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
    color: '#F59E0B',
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
  const [statements, setStatements] = useState<StatementSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StatementSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteHoverId, setDeleteHoverId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

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
      sessionStorage.removeItem('nosyormi-chat-messages');
      sessionStorage.removeItem('nosyormi-chat-chart-update');
      sessionStorage.removeItem('nosyormi-chat-statement-id');
      sessionStorage.removeItem('nosyormi-chat-statement-filename');
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

  const closeUploadModal = () => {
    setShowUploadModal(false);
    setUploadFile(null);
    setUploadError(null);
    setDragOver(false);
    setUploadSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const selectUploadFile = (candidate: File | undefined) => {
    if (!candidate) return;
    if (!isCsvFile(candidate)) {
      setUploadError('Only .csv files are supported.');
      setUploadFile(null);
      return;
    }
    setUploadError(null);
    setUploadFile(candidate);
  };

  const handleUpload = async () => {
    if (!uploadFile || uploading) return;
    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append('file', uploadFile);
    try {
      const response = await fetch(`${API_BASE}/api/statements/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.error ?? `Upload failed with status ${response.status}.`;
        throw new Error(message);
      }
      setUploadSuccess(true);
      window.dispatchEvent(new CustomEvent('nosyormi-statement-uploaded'));
      await loadStatements();
      setTimeout(() => {
        closeUploadModal();
      }, 1500);
    } catch (err: unknown) {
      setUploadError(
        err instanceof Error ? err.message : 'Upload failed. Please try again.',
      );
    } finally {
      setUploading(false);
    }
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
            background: '#071A1E',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '9px 18px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
          onClick={() => setShowUploadModal(true)}
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
          {statements.map((statement) => (
            <div key={statement.id} style={styles.card}>
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
          ))}
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
            background: 'rgba(0,0,0,0.3)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={closeUploadModal}
          role="presentation"
        >
          <div
            style={{
              background: 'white',
              borderRadius: 16,
              padding: 32,
              width: 480,
              maxWidth: '90vw',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-modal-title"
          >
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
                  color: '#1E293B',
                }}
              >
                Upload Statement
              </h2>
              <button
                type="button"
                onClick={closeUploadModal}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: 20,
                  color: '#94A3B8',
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
                    border: `2px dashed ${dragOver ? '#C9911A' : 'rgba(201,145,26,0.3)'}`,
                    background: dragOver
                      ? 'rgba(201,145,26,0.08)'
                      : 'rgba(201,145,26,0.03)',
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
                  {uploading ? (
                    <div
                      style={{
                        animation: 'nosyormi-upload-pulse 1.8s ease-in-out infinite',
                        textAlign: 'center',
                        padding: '20px 0',
                      }}
                    >
                      <div style={{ color: '#C9911A', fontSize: 14, fontWeight: 500 }}>
                        Reflecting on your data...
                      </div>
                    </div>
                  ) : (
                    <>
                      <span
                        style={{
                          fontSize: 36,
                          display: 'block',
                          marginBottom: 12,
                        }}
                        aria-hidden
                      >
                        ⬆
                      </span>
                      {uploadFile ? (
                        <p
                          style={{
                            margin: 0,
                            fontSize: 14,
                            fontWeight: 600,
                            color: '#C9911A',
                            wordBreak: 'break-word',
                          }}
                        >
                          {uploadFile.name}
                        </p>
                      ) : (
                        <>
                          <p
                            style={{
                              margin: '0 0 6px',
                              fontSize: 15,
                              fontWeight: 500,
                              color: '#1E293B',
                            }}
                          >
                            Drop your CSV here
                          </p>
                          <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
                            or click to browse
                          </p>
                        </>
                      )}
                      <p
                        style={{
                          margin: '12px 0 0',
                          fontSize: 11,
                          color: '#94A3B8',
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

                {uploadError && (
                  <p
                    style={{
                      margin: '0 0 12px',
                      fontSize: 13,
                      color: '#F59E0B',
                    }}
                  >
                    {uploadError}
                  </p>
                )}

                {uploadFile && (
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={uploading}
                    style={{
                      width: '100%',
                      padding: '12px 24px',
                      border: 'none',
                      borderRadius: 8,
                      background: '#C9911A',
                      color: 'white',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: uploading ? 'not-allowed' : 'pointer',
                      opacity: uploading ? 0.7 : 1,
                    }}
                  >
                    {uploading ? 'Uploading...' : 'Reflect on this statement'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
