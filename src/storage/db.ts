import { DB_NAME, DB_VERSION, STORES, runMigrations } from './migrations';

export class StorageDB {
  private dbPromise: Promise<IDBDatabase> | null = null;
  public isMemoryMode = false;

  public async getDB(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      this.isMemoryMode = true;
      throw new Error('IndexedDB is not supported in this environment');
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = req.result;
          runMigrations(db, e.oldVersion, e.newVersion ?? DB_VERSION);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          this.isMemoryMode = true;
          reject(req.error);
        };
      });
    }

    return this.dbPromise;
  }

  /**
   * Executes a durable write operation that resolves ONLY after transaction.oncomplete
   * commits data to non-volatile storage, preventing data loss on sudden power-off/crash.
   */
  public async writeDurably<T = void>(
    storeName: string,
    operation: (store: IDBObjectStore) => IDBRequest<T> | void
  ): Promise<T | void> {
    const db = await this.getDB();
    return new Promise<T | void>((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        let request: IDBRequest<T> | undefined;
        
        const res = operation(store);
        if (res && typeof (res as any).onsuccess !== 'undefined') {
          request = res as IDBRequest<T>;
        }

        tx.oncomplete = () => {
          resolve(request ? request.result : undefined);
        };
        tx.onerror = () => {
          reject(tx.error || new Error(`IndexedDB transaction failed on store ${storeName}`));
        };
        tx.onabort = () => {
          reject(tx.error || new Error(`IndexedDB transaction aborted on store ${storeName}`));
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Returns whether storage is durable IndexedDB or volatile in-memory fallback.
   */
  public isDurable(): boolean {
    return typeof indexedDB !== 'undefined' && !this.isMemoryMode;
  }

  public getDurabilityStatus(): { isDurable: boolean; mode: 'durable_indexeddb' | 'volatile_memory'; label: string } {
    const durable = this.isDurable();
    return {
      isDurable: durable,
      mode: durable ? 'durable_indexeddb' : 'volatile_memory',
      label: durable ? 'DURABLE (IndexedDB)' : 'LOCAL ONLY / NOT DURABLE (Volatile Fallback)',
    };
  }

  /**
   * Reads data from IndexedDB inside a readonly transaction.
   */
  public async readDurably<T>(
    storeName: string,
    operation: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T | null> {
    const db = await this.getDB();
    return new Promise<T | null>((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = operation(store);
        req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
}

export const storageDB = new StorageDB();

