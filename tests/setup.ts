class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string): string | null { return this.store.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null; }
  removeItem(key: string): void { this.store.delete(key); }
  setItem(key: string, value: string): void { this.store.set(key, String(value)); }
}

const local = new MemoryStorage();
const session = new MemoryStorage();

Object.defineProperty(globalThis, 'localStorage', { value: local, writable: true, configurable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: session, writable: true, configurable: true });
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { value: local, writable: true, configurable: true });
  Object.defineProperty(window, 'sessionStorage', { value: session, writable: true, configurable: true });
}
