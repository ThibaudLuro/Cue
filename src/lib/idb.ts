// Tiny IndexedDB key-value store: everything Cue keeps between visits lives here.
const DB = 'cue'
const VERSION = 5
export type StoreName = 'keys' | 'analyses' | 'corrections' | 'embeddings' | 'names' | 'waves' | 'cues'
const STORES: StoreName[] = ['keys', 'analyses', 'corrections', 'embeddings', 'names', 'waves', 'cues']

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, VERSION)
    request.onupgradeneeded = () => {
      for (const store of STORES) {
        if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function run<T>(store: StoreName, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(store, mode).objectStore(store))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

// Storage can be blocked (private window, cleared site data): Cue then simply forgets.
export async function idbGet<T>(store: StoreName, key: string) {
  try {
    return (await run(store, 'readonly', (s) => s.get(key))) as T | undefined
  } catch {
    return undefined
  }
}

export async function idbGetAll<T>(store: StoreName) {
  try {
    const [keys, values] = await Promise.all([
      run(store, 'readonly', (s) => s.getAllKeys()),
      run(store, 'readonly', (s) => s.getAll()),
    ])
    return Object.fromEntries(keys.map((key, i) => [String(key), values[i] as T]))
  } catch {
    return {} as Record<string, T>
  }
}

export async function idbSet(store: StoreName, key: string, value: unknown) {
  try {
    await run(store, 'readwrite', (s) => s.put(value, key))
  } catch {
    // See idbGet.
  }
}

export async function idbDelete(store: StoreName, key: string) {
  try {
    await run(store, 'readwrite', (s) => s.delete(key))
  } catch {
    // See idbGet.
  }
}
