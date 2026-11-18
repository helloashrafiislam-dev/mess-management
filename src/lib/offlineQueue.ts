export type SyncStatus = 'saved_locally' | 'sync_pending' | 'synced' | 'sync_failed';

export interface OfflineQueuedAction {
  id: string;
  idempotencyKey: string;
  endpoint: string;
  method: 'POST' | 'PATCH';
  payload: Record<string, any>;
  label: string;
  status: SyncStatus;
  errorMessage?: string;
  createdAt: string;
}

const SNAPSHOT_CACHE_KEY = 'messflow_snapshot_cache_v1';
const QUEUE_STORAGE_KEY = 'messflow_offline_queue_v1';

export function saveSnapshotCache(messId: string, monthKey: string, data: unknown) {
  try {
    localStorage.setItem(
      `${SNAPSHOT_CACHE_KEY}:${messId}:${monthKey}`,
      JSON.stringify({ cachedAt: new Date().toISOString(), data })
    );
  } catch {
    // Ignore quota errors
  }
}

export function loadSnapshotCache<T>(messId: string, monthKey: string): { cachedAt: string; data: T } | null {
  try {
    const raw = localStorage.getItem(`${SNAPSHOT_CACHE_KEY}:${messId}:${monthKey}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getOfflineQueue(): OfflineQueuedAction[] {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(items: OfflineQueuedAction[]) {
  localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(items));
}

export function enqueueOfflineAction(params: {
  endpoint: string;
  method: 'POST' | 'PATCH';
  payload: Record<string, any>;
  label: string;
}): OfflineQueuedAction {
  const idempotencyKey = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const item: OfflineQueuedAction = {
    id: idempotencyKey,
    idempotencyKey,
    endpoint: params.endpoint,
    method: params.method,
    payload: { ...params.payload, idempotencyKey },
    label: params.label,
    status: 'saved_locally',
    createdAt: new Date().toISOString(),
  };
  const current = getOfflineQueue();
  saveOfflineQueue([...current, item]);
  return item;
}

export function clearSyncedQueueItems() {
  const remaining = getOfflineQueue().filter((item) => item.status !== 'synced');
  saveOfflineQueue(remaining);
}
