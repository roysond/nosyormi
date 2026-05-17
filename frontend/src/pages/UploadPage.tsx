import { useRef, useState } from 'react';

const API_UPLOAD_URL = 'http://localhost:5034/api/statements/upload';

const colors = {
  text: '#e8ecf4',
  muted: '#7a8aaa',
  teal: '#00637C',
  amber: '#f4a623',
};

type UploadResult = {
  statementId: string;
  transactionCount: number;
  fileName: string;
};

const styles = {
  page: {
    padding: '8px 0',
    maxWidth: 560,
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
  dropZone: (dragOver: boolean) => ({
    border: `2px dashed ${dragOver ? colors.teal : 'rgba(0, 99, 124, 0.5)'}`,
    background: dragOver ? 'rgba(0, 99, 124, 0.15)' : 'rgba(0, 99, 124, 0.08)',
    borderRadius: 16,
    padding: '60px 40px',
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'border-color 0.15s ease, background 0.15s ease',
    marginBottom: 16,
  }),
  dropIcon: {
    fontSize: 48,
    lineHeight: 1,
    marginBottom: 16,
    display: 'block',
  },
  dropTitle: {
    margin: '0 0 8px',
    fontSize: '1.25rem',
    fontWeight: 500,
    color: colors.text,
  },
  dropSubtext: {
    margin: '0 0 12px',
    fontSize: '0.9rem',
    color: colors.muted,
  },
  dropNote: {
    margin: 0,
    fontSize: '0.75rem',
    color: colors.muted,
    opacity: 0.85,
  },
  fileName: {
    margin: '0 0 8px',
    fontSize: '1.1rem',
    fontWeight: 500,
    color: colors.teal,
    wordBreak: 'break-word' as const,
  },
  uploadButton: (disabled: boolean) => ({
    width: '100%',
    marginTop: 8,
    marginBottom: 16,
    padding: '14px 32px',
    border: 'none',
    borderRadius: 8,
    background: colors.teal,
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.7 : 1,
  }),
  error: {
    margin: '0 0 16px',
    fontSize: '0.9rem',
    color: colors.amber,
  },
  successCard: {
    marginTop: 24,
    padding: '28px 24px',
    borderRadius: 12,
    background: 'rgba(0, 99, 124, 0.12)',
    border: '1px solid rgba(0, 99, 124, 0.35)',
    textAlign: 'center' as const,
  },
  successIcon: {
    fontSize: 32,
    marginBottom: 12,
    display: 'block',
  },
  successTitle: {
    margin: '0 0 8px',
    fontSize: '1.05rem',
    color: colors.text,
    fontWeight: 500,
  },
  successMeta: {
    margin: '0 0 16px',
    fontSize: '0.95rem',
    color: colors.muted,
  },
  successHint: {
    margin: '0 0 20px',
    fontSize: '0.9rem',
    color: colors.teal,
  },
  resetButton: {
    padding: '10px 24px',
    borderRadius: 8,
    border: `1px solid ${colors.teal}`,
    background: 'transparent',
    color: colors.teal,
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  hiddenInput: {
    display: 'none',
  },
};

function isCsvFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.csv');
}

export default function UploadPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectFile = (candidate: File | undefined) => {
    if (!candidate) return;

    if (!isCsvFile(candidate)) {
      setError('Only .csv files are supported.');
      setFile(null);
      return;
    }

    setError(null);
    setFile(candidate);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    selectFile(e.dataTransfer.files[0]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    selectFile(e.target.files?.[0]);
  };

  const handleUpload = async () => {
    if (!file || uploading || result) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(API_UPLOAD_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message =
          body?.error ?? `Upload failed with status ${response.status}.`;
        throw new Error(message);
      }

      const data: UploadResult = await response.json();
      setResult(data);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const resetAll = () => {
    setDragOver(false);
    setFile(null);
    setUploading(false);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const showDropZone = !result;
  const showUploadButton = file !== null && !result;

  return (
    <div className="page-content" style={styles.page}>
      <h1 style={styles.title}>Upload Statement</h1>
      <p style={styles.subtitle}>Drop your CSV bank statement to begin reflecting.</p>

      {showDropZone && (
        <>
          <div
            role="button"
            tabIndex={0}
            style={styles.dropZone(dragOver)}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <span style={styles.dropIcon} aria-hidden>
              ⬆️
            </span>
            {file ? (
              <p style={styles.fileName}>{file.name}</p>
            ) : (
              <>
                <p style={styles.dropTitle}>Drop your CSV here</p>
                <p style={styles.dropSubtext}>or click to browse</p>
              </>
            )}
            <p style={styles.dropNote}>Accepts .csv files from any bank</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={styles.hiddenInput}
            onChange={handleInputChange}
          />

          {error && <p style={styles.error}>{error}</p>}

          {showUploadButton && (
            <button
              type="button"
              style={styles.uploadButton(uploading)}
              disabled={uploading}
              onClick={handleUpload}
            >
              {uploading ? 'Uploading...' : 'Reflect on this statement'}
            </button>
          )}
        </>
      )}

      {result && (
        <div style={styles.successCard}>
          <span style={styles.successIcon} aria-hidden>
            ✅
          </span>
          <p style={styles.successTitle}>{result.fileName} uploaded successfully</p>
          <p style={styles.successMeta}>
            {result.transactionCount} transactions reflected
          </p>
          <p style={styles.successHint}>Head to Dashboard to explore your data</p>
          <button type="button" style={styles.resetButton} onClick={resetAll}>
            Upload another statement
          </button>
        </div>
      )}
    </div>
  );
}
