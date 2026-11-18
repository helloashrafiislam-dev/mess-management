import { getOfflineQueue, saveOfflineQueue } from './offlineQueue.js';

const TOKEN_KEY = 'messflow_session_token';

export function getSessionToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSessionToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function apiRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function flushOfflineQueue(): Promise<{ synced: number; failed: number }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const updated = [...queue];

  for (let i = 0; i < updated.length; i++) {
    const item = updated[i];
    if (item.status === 'synced') continue;
    updated[i] = { ...item, status: 'sync_pending' };
    saveOfflineQueue(updated);

    try {
      await apiRequest(item.endpoint, {
        method: item.method,
        body: JSON.stringify(item.payload),
      });
      updated[i] = { ...item, status: 'synced', errorMessage: undefined };
      synced++;
    } catch (err: any) {
      updated[i] = {
        ...item,
        status: 'sync_failed',
        errorMessage: err?.message || 'Sync error',
      };
      failed++;
    }
    saveOfflineQueue(updated);
  }

  return { synced, failed };
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (cell: string | number) => {
    const s = String(cell ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
