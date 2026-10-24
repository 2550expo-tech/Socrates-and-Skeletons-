/**
 * Web version of slipCopies.ts: copies of slip pictures kept in this browser
 * only (IndexedDB), never on the MindPay server. Clearing the browser's site
 * data removes them. Every call is safe when the browser blocks storage.
 */
const DB_NAME = 'mypay-slips';
const STORE = 'slips';

interface Row {
  key: string;
  owner: string;
  data: string;
  bytes: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: 'key' }).createIndex('owner', 'owner');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const req = work(d.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

const keyOf = (owner: string, hash: string) => `${owner}/${hash}`;

export async function saveSlipCopy(owner: string, hash: string, base64: string): Promise<void> {
  const row: Row = { key: keyOf(owner, hash), owner, data: base64, bytes: Math.floor((base64.length * 3) / 4) };
  await run('readwrite', (s) => s.put(row));
}

export async function slipCopyUri(owner: string, hash: string): Promise<string | null> {
  try {
    const row = (await run('readonly', (s) => s.get(keyOf(owner, hash)))) as Row | undefined;
    return row ? `data:image/jpeg;base64,${row.data}` : null;
  } catch {
    return null;
  }
}

export async function deleteSlipCopy(owner: string, hash: string): Promise<void> {
  await run('readwrite', (s) => s.delete(keyOf(owner, hash)));
}

export async function slipCopyStats(owner: string): Promise<{ count: number; bytes: number }> {
  try {
    const rows = (await run('readonly', (s) => s.index('owner').getAll(owner))) as Row[];
    return { count: rows.length, bytes: rows.reduce((sum, r) => sum + r.bytes, 0) };
  } catch {
    return { count: 0, bytes: 0 };
  }
}

export async function deleteAllSlipCopies(owner: string): Promise<void> {
  const keys = (await run('readonly', (s) => s.index('owner').getAllKeys(owner))) as IDBValidKey[];
  await Promise.all(keys.map((k) => run('readwrite', (s) => s.delete(k))));
}
