'use client';

type HistoryItem = {
  id: number;
  action: 'upload' | 'download' | 'skip';
  timestamp: string;
  user_name: string;
  file_id: number | null;
  revision: number | null;
  original_name: string | null;
  size_bytes: number | null;
};

interface Props {
  history: HistoryItem[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.endsWith('Z') ? '' : 'Z'));
  return d.toLocaleString('en-AE', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Dubai',
  });
}

const ACTION_CONFIG = {
  upload: { icon: '↑', label: 'Uploaded', bg: 'bg-green-100', text: 'text-green-700' },
  download: { icon: '↓', label: 'Downloaded', bg: 'bg-blue-100', text: 'text-blue-700' },
  skip: { icon: '⤳', label: 'Skipped', bg: 'bg-gray-100', text: 'text-gray-600' },
};

export default function HistoryPanel({ history }: Props) {
  async function handleExport() {
    const res = await fetch('/api/history/export');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `file-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col h-full border-l border-gray-200 bg-gray-50">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-200 bg-white">
        <h2 className="font-semibold text-gray-900 text-sm">Version History</h2>
        <p className="text-xs text-gray-400 mt-0.5">Last 15 versions kept</p>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm">
            No history yet
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {history.map((item) => {
              const cfg = ACTION_CONFIG[item.action] ?? ACTION_CONFIG.upload;
              return (
                <li key={item.id} className="px-4 py-3 bg-white hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-2">
                    {/* Action badge */}
                    <span
                      className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${cfg.bg} ${cfg.text}`}
                    >
                      {cfg.icon}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.revision !== null && (
                          <span className="text-xs font-medium bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                            Rev #{item.revision}
                          </span>
                        )}
                        <span className="text-xs font-medium text-gray-700">{item.user_name}</span>
                        <span className="text-xs text-gray-400">{cfg.label.toLowerCase()}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{formatDate(item.timestamp)}</div>
                    </div>

                    {/* Download link for upload events */}
                    {item.action === 'upload' && item.file_id !== null && (
                      <a
                        href={`/api/history/${item.file_id}/download`}
                        className="flex-shrink-0 text-blue-500 hover:text-blue-700"
                        title={`Download Rev #${item.revision}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Export Button */}
      <div className="px-4 py-3 border-t border-gray-200 bg-white">
        <button
          onClick={handleExport}
          className="w-full flex items-center justify-center gap-2 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          Export History CSV
        </button>
      </div>
    </div>
  );
}
