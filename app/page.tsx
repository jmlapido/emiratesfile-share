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
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-6 px-4">
      <div className="w-full max-w-5xl flex flex-col gap-0 rounded-2xl overflow-hidden shadow-lg border border-gray-200">
        {/* Top Nav */}
        <div className="bg-white border-b border-gray-200 px-5 py-2.5 flex items-center justify-between text-sm">
          <span className="font-semibold text-gray-800">Emirates File Share</span>
          <div className="flex items-center gap-4">
            <span className="text-gray-500">
              Signed in as <span className="font-medium text-gray-700">{appData.currentUser.userName}</span>
            </span>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700 underline underline-offset-2 text-xs"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Split Layout: 75 / 25 */}
        <div className="flex min-h-[520px]">
          {/* Left: File Panel (75%) */}
          <div className="w-3/4 bg-white overflow-y-auto border-r border-gray-200">
            <FilePanel
              file={appData.file}
              lock={appData.lock}
              currentUser={appData.currentUser}
              onRefresh={fetchData}
            />
          </div>

          {/* Right: History Panel (25%) */}
          <div className="w-1/4 bg-white overflow-hidden flex flex-col">
            <HistoryPanel history={history} />
          </div>
        </div>
      </div>
    </div>
  );
}
