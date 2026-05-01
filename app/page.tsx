'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import FilePanel from '@/components/FilePanel';
import HistoryPanel from '@/components/HistoryPanel';

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

type AppData = {
  file: FileInfo;
  lock: LockInfo;
  currentUser: { userId: number; userName: string };
};

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

export default function Home() {
  const [appData, setAppData] = useState<AppData | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    const [fileRes, histRes] = await Promise.all([
      fetch('/api/file'),
      fetch('/api/history'),
    ]);

    if (fileRes.status === 401) {
      router.push('/login');
      return;
    }

    if (fileRes.ok) {
      const data = await fileRes.json() as AppData;
      setAppData(data);
    }

    if (histRes.ok) {
      const data = await histRes.json() as { history: HistoryItem[] };
      setHistory(data.history || []);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!appData) return null;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center md:py-6 md:px-4">
      <div className="w-full md:max-w-5xl flex flex-col rounded-none md:rounded-2xl overflow-hidden shadow-none md:shadow-lg border-0 md:border md:border-gray-200">
        {/* Top Nav */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between text-sm">
          <span className="font-semibold text-gray-800">Emirates File Share</span>
          <div className="flex items-center gap-3">
            <span className="text-gray-500 hidden sm:inline">
              Signed in as <span className="font-medium text-gray-700">{appData.currentUser.userName}</span>
            </span>
            <span className="text-gray-700 font-medium sm:hidden text-xs">{appData.currentUser.userName}</span>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700 underline underline-offset-2 text-xs"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Layout: side-by-side on md+, stacked on mobile */}
        <div className="flex flex-col md:flex-row md:min-h-[520px]">
          {/* File Panel — full width on mobile, 75% on desktop */}
          <div className="w-full md:w-3/4 bg-white overflow-y-auto md:border-r border-gray-200">
            <FilePanel
              file={appData.file}
              lock={appData.lock}
              currentUser={appData.currentUser}
              onRefresh={fetchData}
            />
          </div>

          {/* History Panel — full width below on mobile, 25% sidebar on desktop */}
          <div className="w-full md:w-1/4 bg-white border-t md:border-t-0 border-gray-200 flex flex-col" style={{maxHeight: '420px', minHeight: '280px'}}>
            <HistoryPanel history={history} />
          </div>
        </div>
      </div>
    </div>
  );
}
