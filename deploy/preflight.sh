#!/usr/bin/env bash
set -euo pipefail

echo "=============================================="
echo " [PREFLIGHT] Zerkalo Public Release v1 Quality Gate"
echo "=============================================="

# 1. Check Node & NPM
echo "--> Checking Node and NPM environment..."
node -v
npm -v

# 2. Check Directory Structure
echo "--> Verifying runtime data directories..."
mkdir -p data/events data/feedback_qualitative dist

# 3. Check Git Status & Authoritative Release SHA
CURRENT_SHA=$(git rev-parse HEAD)
echo "--> Current Git HEAD SHA: ${CURRENT_SHA}"

# 4. Check Environment & Default-Off Flags
echo "--> Verifying release defaults and security flags..."
export PUBLIC_CODE_ENABLED="${PUBLIC_CODE_ENABLED:-1}"
export PUBLIC_MEETING_ENABLED="${PUBLIC_MEETING_ENABLED:-1}"
export PUBLIC_ALBERT_ENABLED="${PUBLIC_ALBERT_ENABLED:-1}"
export PUBLIC_BOOK_ENABLED="${PUBLIC_BOOK_ENABLED:-0}"
export PAYMENTS_ENABLED="${PAYMENTS_ENABLED:-0}"
export MYTH_ENABLED="${MYTH_ENABLED:-1}"
export MYTH_ENGINE_MODE="${MYTH_ENGINE_MODE:-ACTIVE}"
export PERSONAL_MYTH_TIMEOUT_MS="${PERSONAL_MYTH_TIMEOUT_MS:-60000}"

if [ "${PUBLIC_CODE_ENABLED}" != "1" ]; then
  echo "[PREFLIGHT ERROR] PUBLIC_CODE_ENABLED must be 1 in Unified Release U1!"
  exit 1
fi
if [ "${PUBLIC_MEETING_ENABLED}" != "1" ]; then
  echo "[PREFLIGHT ERROR] PUBLIC_MEETING_ENABLED must be 1 in Unified Release U1!"
  exit 1
fi
if [ "${PUBLIC_ALBERT_ENABLED}" != "1" ]; then
  echo "[PREFLIGHT ERROR] PUBLIC_ALBERT_ENABLED must be 1 in Unified Release U1!"
  exit 1
fi
if [ "${PUBLIC_BOOK_ENABLED}" != "0" ]; then
  echo "[PREFLIGHT ERROR] PUBLIC_BOOK_ENABLED must be 0 in Unified Release U1!"
  exit 1
fi
if [ "${PAYMENTS_ENABLED}" != "0" ]; then
  echo "[PREFLIGHT ERROR] PAYMENTS_ENABLED must be 0 in Public v1!"
  exit 1
fi
if [ "${MYTH_ENGINE_MODE}" != "ACTIVE" ]; then
  echo "[PREFLIGHT ERROR] MYTH_ENGINE_MODE must be ACTIVE in Public v1!"
  exit 1
fi
if [ "${PERSONAL_MYTH_TIMEOUT_MS}" -gt 60000 ]; then
  echo "[PREFLIGHT ERROR] PERSONAL_MYTH_TIMEOUT_MS cannot exceed 60000ms!"
  exit 1
fi

# Fault Injection Must Be Strictly Disabled in Release / Preflight
export ALLOW_TEST_SCENARIOS="${ALLOW_TEST_SCENARIOS:-0}"
export ACCEPTANCE_TEST_MODE="${ACCEPTANCE_TEST_MODE:-0}"
if [ "${ALLOW_TEST_SCENARIOS}" != "0" ] || [ "${ACCEPTANCE_TEST_MODE}" != "0" ]; then
  echo "[PREFLIGHT ERROR] ALLOW_TEST_SCENARIOS and ACCEPTANCE_TEST_MODE must be 0 in public release preflight!"
  exit 1
fi
export PUBLIC_RELEASE_MODE="1"

# Check Encryption Secret (Must be provided externally; fail closed if absent or invalid)
if [ -z "${QUALITATIVE_FEEDBACK_SECRET:-}" ]; then
  echo "[PREFLIGHT ERROR] QUALITATIVE_FEEDBACK_SECRET is required and cannot be empty!"
  exit 1
fi
if [ ${#QUALITATIVE_FEEDBACK_SECRET} -lt 16 ]; then
  echo "[PREFLIGHT ERROR] QUALITATIVE_FEEDBACK_SECRET must be at least 16 characters!"
  exit 1
fi

# Check Deletion Lookup Secret (Must be provided externally; NO fallback allowed; fail closed if absent or invalid)
if [ -z "${DELETION_LOOKUP_SECRET:-}" ]; then
  echo "[PREFLIGHT ERROR] DELETION_LOOKUP_SECRET is required and cannot be empty!"
  exit 1
fi
if [ ${#DELETION_LOOKUP_SECRET} -lt 16 ]; then
  echo "[PREFLIGHT ERROR] DELETION_LOOKUP_SECRET must be at least 16 characters!"
  exit 1
fi

# Verify Deletion Secret Stability (Reject startup if active persisted scopes mismatch)
echo "--> Verifying deletion secret stability against persisted scopes..."
node -e '
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const secret = process.env.DELETION_LOOKUP_SECRET;
const scopesFile = path.join(process.cwd(), "data", "deletion_scopes.json");
if (fs.existsSync(scopesFile)) {
  const parsed = JSON.parse(fs.readFileSync(scopesFile, "utf-8"));
  let list = [];
  let savedFingerprint;
  if (Array.isArray(parsed)) list = parsed;
  else if (parsed && Array.isArray(parsed.scopes)) {
    list = parsed.scopes;
    savedFingerprint = parsed.secret_fingerprint;
  }
  if (list.length > 0 && savedFingerprint) {
    const cur = crypto.createHmac("sha256", secret).update("deletion_scope_secret_fingerprint_v1").digest("hex").slice(0, 16);
    if (savedFingerprint !== cur) {
      console.error("[PREFLIGHT ERROR] DELETION_LOOKUP_SECRET mismatch with active persisted scopes!");
      process.exit(1);
    }
  }
}
'

# 5. Run TypeScript Typecheck
echo "--> Running TypeScript check (tsc --noEmit)..."
npm run lint

# 6. Run Full Test Suite
echo "--> Running automated test suite (vitest)..."
npm test

# 7. Run Production Build
echo "--> Building production bundle (vite build)..."
npm run build

# 8. Package Manifest Generation & Release Identity Consistency
echo "--> Packaging immutable release manifest..."
node scripts/package_release.cjs

# 9. Verify Release Identity in dist/release.json & dist/package_manifest.json
echo "--> Validating release manifest against Git HEAD..."
node -e '
const fs = require("fs");
const path = require("path");

const headSha = "'"${CURRENT_SHA}"'";
const relPath = path.resolve("dist/release.json");
const pkgPath = path.resolve("dist/package_manifest.json");

if (!fs.existsSync(relPath)) throw new Error("dist/release.json missing");
if (!fs.existsSync(pkgPath)) throw new Error("dist/package_manifest.json missing");

const rel = JSON.parse(fs.readFileSync(relPath, "utf-8"));
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

if (rel.release_sha !== headSha) {
  throw new Error(`release.json SHA mismatch: expected ${headSha}, got ${rel.release_sha}`);
}
if (pkg.release_sha !== headSha) {
  throw new Error(`package_manifest.json SHA mismatch: expected ${headSha}, got ${pkg.release_sha}`);
}
if (!pkg.package_sha256 || pkg.package_sha256.length < 32) {
  throw new Error("package_sha256 missing or invalid in package_manifest.json");
}
console.log("[PREFLIGHT] Manifest integrity verified for SHA:", headSha);
'

# 10. Boot-Check Process Lifecycle Validation
echo "--> Step 10: Boot-check process lifecycle validation..."
BOOT_CHECK_PORT=39499
lsof -ti :"${BOOT_CHECK_PORT}" | xargs kill -9 2>/dev/null || true

node -e '
const cp = require("child_process");
const net = require("net");
const path = require("path");

async function runBootCheck() {
  const repoRoot = process.cwd();
  const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
  const port = 39499;

  console.log(`[BOOT-CHECK] Launching controllable server on port ${port}...`);
  const proc = cp.spawn(process.execPath, [tsxCli, "server.ts"], {
    cwd: repoRoot,
    detached: true,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "production",
      PUBLIC_RELEASE_MODE: "1",
      ALLOW_TEST_SCENARIOS: "0",
      RELEASE_SHA: "'"${CURRENT_SHA}"'",
      QUALITATIVE_FEEDBACK_SECRET: "'"${QUALITATIVE_FEEDBACK_SECRET}"'",
      DELETION_LOOKUP_SECRET: "'"${DELETION_LOOKUP_SECRET}"'",
      MYTH_ENABLED: "1",
      PUBLIC_CODE_ENABLED: "1",
      PUBLIC_MEETING_ENABLED: "1",
      PUBLIC_ALBERT_ENABLED: "1",
      PUBLIC_BOOK_ENABLED: "0",
      PAYMENTS_ENABLED: "0",
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const pgid = proc.pid;
  console.log(`[BOOT-CHECK] Server launched with PID: ${proc.pid}, PGID: ${pgid}`);

  let booted = false;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) {
        const json = await res.json();
        if (json.release_sha === "'"${CURRENT_SHA}"'") {
          booted = true;
          break;
        }
      }
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }

  if (!booted) {
    try { process.kill(-pgid, "SIGKILL"); } catch {}
    throw new Error(`[BOOT-CHECK ERROR] Server failed to boot on port ${port}`);
  }

  console.log(`[BOOT-CHECK] Server responded to /health cleanly. Initiating full process tree shutdown...`);
  try { process.kill(-pgid, "SIGTERM"); } catch {}
  await new Promise(r => setTimeout(r, 250));
  try { process.kill(-pgid, "SIGKILL"); } catch {}

  // Await port release by testing bind
  let portFree = false;
  for (let i = 0; i < 30; i++) {
    const srv = net.createServer();
    const ok = await new Promise((res) => {
      srv.once("error", () => res(false));
      srv.once("listening", () => srv.close(() => res(true)));
      srv.listen(port, "127.0.0.1");
    });
    if (ok) {
      portFree = true;
      break;
    }
    await new Promise(r => setTimeout(r, 100));
  }

  if (!portFree) {
    throw new Error(`[BOOT-CHECK ERROR] Port ${port} was not freed after process termination!`);
  }

  console.log(`[BOOT-CHECK] Process group ${pgid} terminated cleanly. Port ${port} confirmed free and immediately re-bindable.`);
}

runBootCheck().catch(err => {
  console.error(err);
  process.exit(1);
});
'

echo "=============================================="
echo " [PREFLIGHT SUCCESS] All checks passed cleanly."
echo " Release candidate verified with immutable manifest."
echo "=============================================="
exit 0
