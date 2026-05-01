'use client';

import { useCallback, useRef, useState } from 'react';

type FileInfo = {
  id: number;
  revision: number;
  original_name: string;
  size_bytes: number;
  uploaded_at: string;
  uploaded_by_name: string;
} | null;

type LockInfo = {
  locked_by: number | null;
  locked_at: string | null;
  locked_by_name: string | null;
  last_downloaded_by_name: string | null;
  last_downloaded_at: string | null;
  last_uploaded_by_name: string | null;
  last_uploaded_at: string | null;
} | null;

type CurrentUser = { userId: number; userName: string };

interface Props {
  file: FileInfo;
  lock: LockInfo;
  currentUser: CurrentUser;
  onRefresh: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.endsWith('Z') ? '' : 'Z'));
  return d.toLocaleString('en-AE', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Dubai',
  });
}

export default function FilePanel({ file, lock, currentUser, onRefresh }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dupInfo, setDupInfo] = useState<{ uploadedBy: string; uploadedAt: string; pendingFile: File } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLockedByOther = lock?.locked_by !== null && lock?.locked_by !== undefined && lock.locked_by !== currentUser.userId;
  const isLockedByMe = lock?.locked_by === currentUser.userId;
  const canDownload = !isLockedByOther && file !== null;
  const canUpload = !isLockedByOther;

  async function doUpload(f: File, force = false) {
    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append('file', f);
    const url = force ? '/api/file?force=1' : '/api/file';
    const res = await fetch(url, { method: 'POST', body: formData });
    const data = await res.json() as { duplicate?: boolean; uploadedBy?: string; uploadedAt?: string; error?: string };
    setUploading(false);

    if (res.status === 409 && data.duplicate) {
      setDupInfo({ uploadedBy: data.uploadedBy!, uploadedAt: data.uploadedAt!, pendingFile: f });
      return;
    }
    if (!res.ok) {
      setUploadError(data.error || 'Upload failed');
      return;
    }
    onRefresh();
  }

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    doUpload(f);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!canUpload) return;
    handleFiles(e.dataTransfer.files);
  };

  async function handleDownload() {
    const res = await fetch('/api/file/download');
    if (!res.ok) {
      const d = await res.json() as { error?: string };
      setUploadError(d.error || 'Download failed');
      return;
    }
    const blob = await res.blob();
    const filename = file?.original_name || 'download.xlsx';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    onRefresh();
  }

  async function handleSkip() {
    await fetch('/api/file/skip', { method: 'POST' });
    onRefresh();
  }

  return (
    <div className="flex flex-col h-full p-6 gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Emirates File Share</h1>
          <p className="text-sm text-gray-500 mt-0.5">Secure Excel file distribution</p>
        </div>
        <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
          {currentUser.userName}
        </div>
      </div>

      {/* File Card */}
      {file ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
          {/* Excel icon */}
          <div className="flex-shrink-0 w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-green-700" fill="currentColor">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
              <path d="M14 2v6h6" fill="none" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 13l2 2 2-2M8 17l2-2 2 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 truncate">{file.original_name}</span>
              <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                Rev #{file.revision}
              </span>
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {formatBytes(file.size_bytes)} &bull; Uploaded by <span className="font-medium text-gray-700">{file.uploaded_by_name}</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{formatDate(file.uploaded_at)}</div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-400">
          No file uploaded yet
        </div>
      )}

      {/* Activity Banner */}
      {(lock?.last_downloaded_by_name || lock?.last_uploaded_by_name) && (
        <div className={`rounded-xl px-4 py-3 text-sm flex items-start gap-2 ${
          isLockedByMe
            ? 'bg-amber-50 border border-amber-200 text-amber-800'
            : isLockedByOther
            ? 'bg-red-50 border border-red-200 text-red-800'
            : 'bg-green-50 border border-green-200 text-green-800'
        }`}>
          <span className="text-base mt-0.5">{isLockedByOther ? '🔒' : isLockedByMe ? '⏳' : '✅'}</span>
          <div>
            {isLockedByMe && (
              <>
                <div className="font-semibold">You downloaded this file</div>
                <div className="text-xs mt-0.5">
                  {lock?.locked_at && formatDate(lock.locked_at)} &bull; Please upload the updated version
                </div>
              </>
            )}
            {isLockedByOther && (
              <>
                <div className="font-semibold">{lock?.locked_by_name} downloaded on {lock?.locked_at && formatDate(lock.locked_at)}</div>
                <div className="text-xs mt-0.5">Waiting for re-upload — download is temporarily unavailable</div>
              </>
            )}
            {!lock?.locked_by && lock?.last_downloaded_by_name && (
              <div>
                Last downloaded by <span className="font-medium">{lock.last_downloaded_by_name}</span>
                {lock.last_downloaded_at && ` on ${formatDate(lock.last_downloaded_at)}`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Download Button */}
      <button
        onClick={handleDownload}
        disabled={!canDownload}
        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
          canDownload
            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {isLockedByOther
          ? `Locked — waiting for ${lock?.locked_by_name}`
          : file
          ? 'Download File'
          : 'No File Available'}
      </button>

      {/* Upload Zone */}
      {canUpload && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex-1 min-h-[140px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
            dragging
              ? 'border-blue-400 bg-blue-50'
              : uploading
              ? 'border-gray-200 bg-gray-50 cursor-wait'
              : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
          }`}
        >
          {uploading ? (
            <>
              <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-500">Uploading…</span>
            </>
          ) : (
            <>
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-sm font-medium text-gray-600">
                {isLockedByMe ? 'Upload updated file' : 'Upload new version'}
              </span>
              <span className="text-xs text-gray-400">Drag & drop or click to browse</span>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      {/* Skip Button */}
      {isLockedByMe && (
        <button
          onClick={handleSkip}
          className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2 text-center"
        >
          Skip upload — release lock without uploading
        </button>
      )}

      {/* Error */}
      {uploadError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {uploadError}
        </div>
      )}

      {/* Duplicate Warning Modal */}
      {dupInfo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">⚠️</span>
              <h3 className="font-bold text-gray-900">Duplicate File Detected</h3>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              This exact file was already uploaded by{' '}
              <span className="font-semibold">{dupInfo.uploadedBy}</span> on{' '}
              <span className="font-semibold">{formatDate(dupInfo.uploadedAt)}</span>.
              Do you want to upload it anyway?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setDupInfo(null); }}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const f = dupInfo.pendingFile;
                  setDupInfo(null);
                  doUpload(f, true);
                }}
                className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                Upload Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
