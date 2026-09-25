import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

// Fail-closed DCS test environment resolution
const canonicalWorktreeDcs = path.resolve(process.cwd(), "..", "dcs-canonical-732");
const canonicalSiblingDcs = path.resolve(process.cwd(), "..", "digital-code-system");
if (!process.env.DCS_ROOT) {
  if (fs.existsSync(canonicalWorktreeDcs)) {
    process.env.DCS_ROOT = canonicalWorktreeDcs;
  } else if (fs.existsSync(canonicalSiblingDcs)) {
    process.env.DCS_ROOT = canonicalSiblingDcs;
  } else {
    // Poison stale legacy fallback so dcsBridge.ts never silently uses obsolete clone
    process.env.DCS_ROOT = "/dev/null/dcs_not_configured";
  }
} else if (process.env.DCS_ROOT.includes("digital-code-product-journey")) {
  throw new Error(
    `[Test Setup] Stale DCS clone detected in DCS_ROOT: "${process.env.DCS_ROOT}". Canonical repo is digital-code-system.`
  );
}

// Deterministic Python 3.12+ binary resolution for tests
if (!process.env.PYTHON_BIN) {
  const dcsVenvPython = path.join(process.env.DCS_ROOT || "", ".venv", "bin", "python");
  const brewPython = "/opt/homebrew/bin/python3.12";
  if (fs.existsSync(dcsVenvPython)) {
    process.env.PYTHON_BIN = dcsVenvPython;
  } else if (fs.existsSync(brewPython)) {
    process.env.PYTHON_BIN = brewPython;
  }
}

// Ensure DELETION_LOOKUP_SECRET is configured for all test suites
if (!process.env.DELETION_LOOKUP_SECRET || process.env.DELETION_LOOKUP_SECRET.length < 16) {
  process.env.DELETION_LOOKUP_SECRET = "test-deletion-secret-at-least-32-chars-long!";
}

// Isolate deletion scopes storage per test worker process to prevent parallel collisions
if (!process.env.DELETION_SCOPES_FILE) {
  process.env.DELETION_SCOPES_FILE = path.join(os.tmpdir(), `zerkalo_test_scopes_${process.pid}.json`);
}
