import { createContext, useContext, useRef, useState, type ReactNode } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5034';

interface UploadContextValue {
  isUploading: boolean;
  uploadFileName: string | null;
  uploadError: string | null;
  uploadSuccess: boolean;
  showUploadModal: boolean;
  openUploadModal: () => void;
  closeUploadModal: () => void;
  handleUpload: (file: File) => Promise<void>;
  resetUpload: () => void;
}

const UploadContext = createContext<UploadContextValue | null>(null);

export function UploadProvider({ children }: { children: ReactNode }) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const openUploadModal = () => {
    if (isUploading) return;
    setUploadError(null);
    setUploadSuccess(false);
    setUploadFileName(null);
    setShowUploadModal(true);
  };

  const closeUploadModal = () => {
    if (isUploading) return;
    setShowUploadModal(false);
    setUploadError(null);
    setUploadSuccess(false);
    setUploadFileName(null);
  };

  const resetUpload = () => {
    setIsUploading(false);
    setUploadFileName(null);
    setUploadError(null);
    setUploadSuccess(false);
  };

  const handleUpload = async (file: File) => {
    if (isUploading) return;
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
    setUploadFileName(file.name);

    const controller = new AbortController();
    abortRef.current = controller;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE}/api/statements/upload`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.error ?? `Upload failed with status ${response.status}.`;
        setUploadError(message);
        setIsUploading(false);
        return;
      }

      setUploadSuccess(true);
      setIsUploading(false);
      window.dispatchEvent(new CustomEvent('nosyormi-statement-uploaded'));

      setTimeout(() => {
        setShowUploadModal(false);
        setUploadSuccess(false);
        setUploadFileName(null);
      }, 1500);

    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      setUploadError('Upload failed. Please try again.');
      setIsUploading(false);
    }
  };

  return (
    <UploadContext.Provider value={{
      isUploading,
      uploadFileName,
      uploadError,
      uploadSuccess,
      showUploadModal,
      openUploadModal,
      closeUploadModal,
      handleUpload,
      resetUpload,
    }}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUpload must be used within UploadProvider');
  return ctx;
}
