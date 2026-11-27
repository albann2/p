import type { Candidate, CandidateInput } from '../types'

const DB_NAME = 'prix-candidats'
const DB_VERSION = 1
const STORE_CANDIDATES = 'candidates'
const STORE_QUEUE = 'sync_queue'
const STORE_META = 'meta'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_CANDIDATES)) {
        const store = db.createObjectStore(STORE_CANDIDATES, { keyPath: 'id' })
        store.createIndex('last_name', 'last_name', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'candidateId' })
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | void
): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode)
    const s = t.objectStore(store)
    let req: IDBRequest<T> | void
    try {
      req = fn(s)
    } catch (e) {
      reject(e)
      return
    }
    t.oncomplete = () => resolve(req ? (req as IDBRequest<T>).result : (undefined as unknown as T))
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
  })
}

export async function cacheCandidates(rows: Candidate[]): Promise<void> {
  await tx(STORE_CANDIDATES, 'readwrite', (s) => {
    s.clear()
    for (const r of rows) s.put(r)
  })
  await tx(STORE_META, 'readwrite', (s) => {
    s.put(new Date().toISOString(), 'lastSyncAt')
  })
}

export async function getCachedCandidates(): Promise<Candidate[]> {
  const rows = await tx<Candidate[]>(STORE_CANDIDATES, 'readonly', (s) => s.getAll() as IDBRequest<Candidate[]>)
  rows.sort(
    (a, b) =>
      (a.last_name ?? '').localeCompare(b.last_name ?? '', 'fr') ||
      (a.first_name ?? '').localeCompare(b.first_name ?? '', 'fr')
  )
  return rows
}

export async function getCachedCandidate(id: string): Promise<Candidate | undefined> {
  return tx<Candidate | undefined>(STORE_CANDIDATES, 'readonly', (s) =>
    s.get(id) as IDBRequest<Candidate | undefined>
  )
}

export async function updateCachedCandidate(id: string, patch: CandidateInput): Promise<void> {
  const c = await getCachedCandidate(id)
  if (!c) return
  await tx(STORE_CANDIDATES, 'readwrite', (s) => s.put({ ...c, ...patch }))
}

export interface PendingChange {
  candidateId: string
  status: Candidate['status']
  savedAt: string
}

export async function queueStatusChange(change: PendingChange): Promise<void> {
  await tx(STORE_QUEUE, 'readwrite', (s) => s.put(change))
}

export async function getPendingChanges(): Promise<PendingChange[]> {
  return tx<PendingChange[]>(STORE_QUEUE, 'readonly', (s) => s.getAll() as IDBRequest<PendingChange[]>)
}

export async function removePendingChange(candidateId: string): Promise<void> {
  await tx(STORE_QUEUE, 'readwrite', (s) => s.delete(candidateId))
}

export async function clearPendingChanges(): Promise<void> {
  await tx(STORE_QUEUE, 'readwrite', (s) => s.clear())
}

export async function setOfflineEnabled(v: boolean): Promise<void> {
  await tx(STORE_META, 'readwrite', (s) => {
    s.put(v, 'offlineEnabled')
  })
}

export async function getOfflineEnabled(): Promise<boolean> {
  return tx<boolean>(STORE_META, 'readonly', (s) => s.get('offlineEnabled') as IDBRequest<boolean>)
    .then((v) => Boolean(v))
}

export async function getLastSyncAt(): Promise<string | null> {
  return tx<string | null>(STORE_META, 'readonly', (s) => s.get('lastSyncAt') as IDBRequest<string | null>)
}

/** Vide tout le cache local (après suppression admin, par ex.). */
export async function clearAllLocalData(): Promise<void> {
  await tx(STORE_CANDIDATES, 'readwrite', (s) => {
    s.clear()
  })
  await tx(STORE_QUEUE, 'readwrite', (s) => {
    s.clear()
  })
}
