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
}

export const storageDB = new StorageDB();
