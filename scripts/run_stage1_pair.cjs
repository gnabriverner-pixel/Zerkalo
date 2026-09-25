#!/usr/bin/env node
const { spawn, execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const dotenv = require("dotenv");

const webRoot = path.resolve(__dirname, "..");
const webEnvPath = path.join(webRoot, ".env");
const webEnvFileExists = fs.existsSync(webEnvPath);
if (webEnvFileExists) {
  dotenv.config({ path: webEnvPath, override: false });
}

function parseValidPort(rawValue, label) {
  const str = String(rawValue ?? "").trim();
  if (!/^\d+$/.test(str)) {
    throw new Error(`[stage1-pair] Invalid ${label} "${rawValue}": port must be an integer between 1024 and 65535.`);
  }
  const num = Number(str);
  if (!Number.isSafeInteger(num) || num < 1024 || num > 65535) {
    throw new Error(`[stage1-pair] Invalid ${label} "${rawValue}": port must be in range 1024..65535.`);
  }
  return num;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let dcsRootArg = "";
  let webShaArg = "";
  let dcsShaArg = "";
  let rawWebPort = process.env.PORT || process.env.STAGE1_WEB_PORT || "3018";
  let rawDcsPort = process.env.DCS_PORT || process.env.STAGE1_DCS_PORT || "39500";
  let statusFile = "";
  let checkOnly = false;
  let allowDirty = false;
  let autoPorts = false;

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--dcs-root" && args[i + 1] !== undefined) {
      dcsRootArg = path.resolve(args[i + 1]);
      i += 1;
    } else if ((a === "--web-sha" || a === "--expected-web-sha") && args[i + 1] !== undefined) {
      webShaArg = args[i + 1].trim();
      i += 1;
    } else if ((a === "--dcs-sha" || a === "--expected-dcs-sha") && args[i + 1] !== undefined) {
      dcsShaArg = args[i + 1].trim();
      i += 1;
    } else if ((a === "--web-port" || a === "--port") && args[i + 1] !== undefined) {
      rawWebPort = args[i + 1];
      i += 1;
    } else if (a === "--dcs-port" && args[i + 1] !== undefined) {
      rawDcsPort = args[i + 1];
      i += 1;
    } else if ((a === "--StatusFile" || a === "--status-file") && args[i + 1] !== undefined) {
      statusFile = path.resolve(args[i + 1]);
      i += 1;
    } else if (a === "--check-only") {
      checkOnly = true;
    } else if (a === "--allow-dirty") {
      allowDirty = true;
    } else if (a === "--auto-ports") {
      autoPorts = true;
    } else if (/^[0-9a-f]{40}$/.test(a)) {
      if (!webShaArg) webShaArg = a;
      else if (!dcsShaArg) dcsShaArg = a;
    }
  }

  const webPort = parseValidPort(rawWebPort, "webPort");
  const dcsPort = parseValidPort(rawDcsPort, "dcsPort");
  if (webPort === dcsPort) {
    throw new Error(`[stage1-pair] Invalid port configuration: webPort (${webPort}) and dcsPort (${dcsPort}) must be distinct.`);
  }

  return { dcsRootArg, webShaArg, dcsShaArg, webPort, dcsPort, statusFile, checkOnly, allowDirty, autoPorts };
}

function git(cwd, ...gitArgs) {
  return execFileSync("git", gitArgs, { cwd, encoding: "utf8" }).trim();
}

function canConnectTcp(host, port, timeoutMs = 250) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let settled = false;
    const finish = (connected) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(connected);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

function canBindPort(host, port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.listen(port, host, () => srv.close(() => resolve(true)));
  });
}

async function isPortAvailable(port) {
  if (await canConnectTcp("127.0.0.1", port)) return false;
  if (await canConnectTcp("::1", port)) return false;
  if (!(await canBindPort("127.0.0.1", port))) return false;
  return true;
}

async function allocateFreePort(excludePort = null) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const port = await new Promise((resolve, reject) => {
      const srv = net.createServer();
      srv.once("error", reject);
      srv.listen(0, "127.0.0.1", () => {
        const addr = srv.address();
        const selected = typeof addr === "object" && addr ? addr.port : 0;
        srv.close(() => resolve(selected));
      });
    });
    if (port >= 1024 && port <= 65535 && port !== excludePort && (await isPortAvailable(port))) {
      return port;
    }
  }
  throw new Error("[stage1-pair] Unable to allocate a free local TCP port in range 1024..65535.");
}

async function assertPortFree(port, label) {
  if (!(await isPortAvailable(port))) {
    throw new Error(
      `[stage1-pair] ${label} port ${port} is already occupied. Refusing to kill unknown process or reuse foreign runtime. Specify free ports via --web-port and --dcs-port.`
    );
  }
}

function loadOrCreateRuntimeSecrets(runtimeDir) {
  fs.mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
  const secretsFile = path.join(runtimeDir, "stage1-pair-secrets.json");
  let stored = {};
  if (fs.existsSync(secretsFile)) {
    try {
      stored = JSON.parse(fs.readFileSync(secretsFile, "utf8")) || {};
    } catch {
      stored = {};
    }
  }

  const isValidSecret = (val) => typeof val === "string" && val.trim().length >= 32;
  const continuationClaimSecret = isValidSecret(process.env.CONTINUATION_CLAIM_SECRET)
    ? process.env.CONTINUATION_CLAIM_SECRET.trim()
    : isValidSecret(stored.CONTINUATION_CLAIM_SECRET)
      ? stored.CONTINUATION_CLAIM_SECRET.trim()
      : crypto.randomBytes(32).toString("hex");

  const deletionLookupSecret = isValidSecret(process.env.DELETION_LOOKUP_SECRET)
    ? process.env.DELETION_LOOKUP_SECRET.trim()
    : isValidSecret(stored.DELETION_LOOKUP_SECRET)
      ? stored.DELETION_LOOKUP_SECRET.trim()
      : crypto.randomBytes(32).toString("hex");

  const payload = {
    CONTINUATION_CLAIM_SECRET: continuationClaimSecret,
    DELETION_LOOKUP_SECRET: deletionLookupSecret,
    updated_at: new Date().toISOString(),
  };
  fs.writeFileSync(secretsFile, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(secretsFile, 0o600);

  const scopesFile = path.join(runtimeDir, "deletion_scopes.json");
  if (fs.existsSync(scopesFile)) {
    try {
      const parsedScopes = JSON.parse(fs.readFileSync(scopesFile, "utf8"));
      const expectedFp = crypto
        .createHmac("sha256", deletionLookupSecret)
        .update("deletion_scope_secret_fingerprint_v1")
        .digest("hex")
        .slice(0, 16);
      if (parsedScopes?.secret_fingerprint && parsedScopes.secret_fingerprint !== expectedFp) {
        fs.unlinkSync(scopesFile);
      }
    } catch {
      try {
        fs.unlinkSync(scopesFile);
      } catch {}
    }
  }

  return {
    continuationClaimSecret,
    deletionLookupSecret,
    secretsFile,
  };
}

async function waitHttpJson(url, timeoutMs = 20000, shouldAbort = () => false) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (shouldAbort()) return null;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
      const body = await res.json().catch(() => null);
      if (body) return { status: res.status, ok: res.ok, body };
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

const children = [];
let shuttingDown = false;

function isChildRunning(child) {
  return Boolean(child && child.exitCode === null && child.signalCode === null);
}

async function stopAllChildren() {
  for (const child of children) {
    if (isChildRunning(child)) {
      try {
        child.kill("SIGTERM");
      } catch {}
    }
  }
  const deadline = Date.now() + 1500;
  while (Date.now() < deadline && children.some((c) => isChildRunning(c))) {
    await new Promise((r) => setTimeout(r, 50));
  }
  for (const child of children) {
    if (isChildRunning(child)) {
      try {
        child.kill("SIGKILL");
      } catch {}
    }
  }
}

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  await stopAllChildren();
  process.exit(code);
}

process.on("SIGINT", () => {
  void shutdown(0);
});
process.on("SIGTERM", () => {
  void shutdown(0);
});
process.on("SIGHUP", () => {
  void shutdown(1);
});
process.on("uncaughtException", (err) => {
  console.error("[stage1-pair] Uncaught exception:", err?.message || err);
  void shutdown(1);
});
process.on("unhandledRejection", (err) => {
  console.error("[stage1-pair] Unhandled rejection:", err?.message || err);
  void shutdown(1);
});
process.on("exit", () => {
  for (const child of children) {
    if (isChildRunning(child)) {
      try {
        child.kill("SIGKILL");
      } catch {}
    }
  }
});

async function main() {
  const parsed = parseArgs();
  const { dcsRootArg, webShaArg, dcsShaArg, statusFile, checkOnly, allowDirty, autoPorts } = parsed;
  let { webPort, dcsPort } = parsed;

  const nodeMajor = process.versions.node.split(".")[0];
  if (nodeMajor !== "24") {
    console.error(`[stage1-pair] Canonical runtime is Node 24 (got ${process.version}). Use PATH="$(brew --prefix node@24)/bin:$PATH".`);
    await shutdown(1);
    return;
  }

  if (autoPorts) {
    dcsPort = await allocateFreePort();
    webPort = await allocateFreePort(dcsPort);
  } else {
    await assertPortFree(dcsPort, "DCS");
    await assertPortFree(webPort, "Web");
  }

  const dcsRoot = dcsRootArg || process.env.DCS_ROOT || path.resolve(webRoot, "../dcs-canonical-732");
  if (!dcsRoot || !fs.existsSync(path.join(dcsRoot, "engine.py"))) {
    console.error(`[stage1-pair] Canonical DCS root not found at "${dcsRoot}". Pass --dcs-root /path/to/dcs-canonical-732`);
    await shutdown(1);
    return;
  }

  const actualWebSha = git(webRoot, "rev-parse", "HEAD");
  const actualDcsSha = git(dcsRoot, "rev-parse", "HEAD");
  const webDirty = git(webRoot, "status", "--porcelain") !== "";
  const dcsDirty = git(dcsRoot, "status", "--porcelain") !== "";

  if (!allowDirty && (webDirty || dcsDirty)) {
    console.error(`[stage1-pair] Working tree must be clean before starting candidate pair (webDirty=${webDirty}, dcsDirty=${dcsDirty}).`);
    await shutdown(1);
    return;
  }
  if (webShaArg && webShaArg !== actualWebSha) {
    console.error(`[stage1-pair] Web SHA mismatch: expected ${webShaArg}, actual ${actualWebSha}`);
    await shutdown(1);
    return;
  }
  if (dcsShaArg && dcsShaArg !== actualDcsSha) {
    console.error(`[stage1-pair] DCS SHA mismatch: expected ${dcsShaArg}, actual ${actualDcsSha}`);
    await shutdown(1);
    return;
  }

  // Prefer DCS's own release-local .venv; allow explicit PYTHON_BIN in clean-clone verifier environments
  const localVenvPython = path.join(dcsRoot, ".venv", "bin", "python");
  const pythonBin = fs.existsSync(localVenvPython)
    ? localVenvPython
    : process.env.PYTHON_BIN && fs.existsSync(process.env.PYTHON_BIN)
      ? path.resolve(process.env.PYTHON_BIN)
      : localVenvPython;
  if (!fs.existsSync(pythonBin)) {
    console.error(`[stage1-pair] Release-local virtualenv missing at ${pythonBin}. Borrowing .venv is forbidden.`);
    await shutdown(1);
    return;
  }
  const pyVersion = execFileSync(pythonBin, ["--version"], { encoding: "utf8" }).trim();
  if (!pyVersion.startsWith("Python 3.12.")) {
    console.error(`[stage1-pair] DCS Python must be 3.12.x (got "${pyVersion}").`);
    await shutdown(1);
    return;
  }
  const verifyEnvScript = path.join(dcsRoot, "scripts", "verify_release_env.sh");
  if (fs.existsSync(localVenvPython) && fs.existsSync(verifyEnvScript)) {
    execFileSync("bash", [verifyEnvScript, "--verify-packages", dcsRoot], { cwd: dcsRoot, stdio: "pipe" });
  }

  const bridgeUrl = `http://127.0.0.1:${dcsPort}`;
  const webUrl = `http://127.0.0.1:${webPort}`;
  const runtimeDir = path.join(webRoot, ".runtime");
  const { continuationClaimSecret, deletionLookupSecret, secretsFile } = loadOrCreateRuntimeSecrets(runtimeDir);

  const routerAiKeyValue = process.env.ROUTERAI_API_KEY ? String(process.env.ROUTERAI_API_KEY).trim() : "";
  const googleApiKeyValue = process.env.GOOGLE_API_KEY ? String(process.env.GOOGLE_API_KEY).trim() : "";
  const geminiApiKeyValue = process.env.GEMINI_API_KEY ? String(process.env.GEMINI_API_KEY).trim() : "";

  // Explicitly define key variables (even when empty) so canonical dcs_service.py os.environ.setdefault
  // never falls back to reading any external or sibling .env file.
  const env = {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(webPort),
    NODE_ENV: process.env.NODE_ENV || "development",
    DISABLE_HMR: "true",
    RELEASE_SHA: actualWebSha,
    APP_GIT_SHA: actualWebSha,
    DCS_ROOT: dcsRoot,
    DCS_EXPECTED_SHA: actualDcsSha,
    DCS_RELEASE_SHA: actualDcsSha,
    DCS_BRIDGE_URL: bridgeUrl,
    PYTHON_BIN: pythonBin,
    PYTHONPATH: dcsRoot,
    SHARED_CLAIMS_DIR: path.join(runtimeDir, "claims"),
    DELETION_SCOPES_FILE: path.join(runtimeDir, "deletion_scopes.json"),
    DELETION_SCOPES_PATH: path.join(runtimeDir, "deletion_scopes.json"),
    CONTINUATION_CLAIM_SECRET: continuationClaimSecret,
    DELETION_LOOKUP_SECRET: deletionLookupSecret,
    ROUTERAI_API_KEY: routerAiKeyValue,
    GOOGLE_API_KEY: googleApiKeyValue,
    GEMINI_API_KEY: geminiApiKeyValue,
  };

  const hasRouterAiKey = Boolean(routerAiKeyValue);
  console.log(
    `[stage1-pair] Starting verified pair: Web=${actualWebSha.slice(0, 7)} (port ${webPort}), DCS=${actualDcsSha.slice(0, 7)} (port ${dcsPort}), webEnvFile=${webEnvFileExists ? "present" : "missing"}, ROUTERAI_API_KEY=${hasRouterAiKey ? "configured" : "unconfigured"}`
  );

  let childExitedEarly = false;
  const dcsProc = spawn(
    pythonBin,
    ["-m", "integration.dcs_service", "--host", "127.0.0.1", "--port", String(dcsPort)],
    { cwd: dcsRoot, env: { ...env, RELEASE_SHA: actualDcsSha, DCS_RELEASE_SHA: actualDcsSha }, stdio: "inherit" }
  );
  children.push(dcsProc);
  dcsProc.on("exit", (code, signal) => {
    childExitedEarly = true;
    if (!shuttingDown) {
      console.error(`[stage1-pair] DCS process (pid=${dcsProc.pid}) exited unexpectedly (code=${code}, signal=${signal}). Stopping pair.`);
      void shutdown(code && code !== 0 ? code : 1);
    }
  });
  dcsProc.on("error", (err) => {
    childExitedEarly = true;
    if (!shuttingDown) {
      console.error(`[stage1-pair] DCS process error:`, err);
      void shutdown(1);
    }
  });

  const dcsHealthTimeoutMs = Number(process.env.STAGE1_DCS_HEALTH_TIMEOUT_MS || 15000);
  const dcsHealthResp = await waitHttpJson(`${bridgeUrl}/health`, dcsHealthTimeoutMs, () => childExitedEarly || shuttingDown);
  if (!dcsHealthResp?.ok || dcsHealthResp.body?.sha !== actualDcsSha) {
    console.error("[stage1-pair] DCS canonical service failed SHA identity check:", {
      expected: actualDcsSha,
      actual: dcsHealthResp?.body,
    });
    await shutdown(1);
    return;
  }

  if (process.env.STAGE1_FAIL_AFTER_DCS_START === "1") {
    console.error(`[stage1-pair] Simulated failure after DCS startup (dcs_pid=${dcsProc.pid}). Cleaning up children.`);
    await shutdown(1);
    return;
  }

  const tsxCli = path.join(webRoot, "node_modules", "tsx", "dist", "cli.mjs");
  const webProc = spawn(process.execPath, [tsxCli, "server.ts"], { cwd: webRoot, env, stdio: "inherit" });
  children.push(webProc);
  webProc.on("exit", (code, signal) => {
    childExitedEarly = true;
    if (!shuttingDown) {
      console.error(`[stage1-pair] Web process (pid=${webProc.pid}) exited (code=${code}, signal=${signal}). Stopping pair.`);
      void shutdown(code && code !== 0 ? code : 1);
    }
  });
  webProc.on("error", (err) => {
    childExitedEarly = true;
    if (!shuttingDown) {
      console.error(`[stage1-pair] Web process error:`, err);
      void shutdown(1);
    }
  });

  const webHealthTimeoutMs = Number(process.env.STAGE1_WEB_HEALTH_TIMEOUT_MS || 20000);
  const webHealthResp = await waitHttpJson(`${webUrl}/health`, webHealthTimeoutMs, () => childExitedEarly || shuttingDown);
  const webReadyResp = await waitHttpJson(`${webUrl}/health/ready`, 10000, () => childExitedEarly || shuttingDown);

  if (
    !webHealthResp?.ok ||
    webHealthResp.body?.release_sha !== actualWebSha ||
    webHealthResp.body?.components?.dcs_bridge?.sha !== actualDcsSha ||
    !webReadyResp?.body?.canonical_bridge?.verified ||
    webReadyResp.body?.canonical_bridge?.actual_sha !== actualDcsSha
  ) {
    console.error("[stage1-pair] Web service failed pair identity check:", {
      expectedWebSha: actualWebSha,
      expectedDcsSha: actualDcsSha,
      webHealth: webHealthResp?.body,
      webReady: webReadyResp?.body,
    });
    await shutdown(1);
    return;
  }

  const pairStatus = {
    started_at: new Date().toISOString(),
    pair_pid: process.pid,
    web_pid: webProc.pid,
    dcs_pid: dcsProc.pid,
    web_port: webPort,
    dcs_port: dcsPort,
    web_root: webRoot,
    dcs_root: dcsRoot,
    web_sha: actualWebSha,
    dcs_sha: actualDcsSha,
    web_dirty: webDirty,
    dcs_dirty: dcsDirty,
    node_version: process.version,
    python_version: pyVersion,
    web_url: webUrl,
    dcs_url: bridgeUrl,
    web_env_file_path: webEnvPath,
    web_env_file_exists: webEnvFileExists,
    routerai_key_configured_in_env: hasRouterAiKey,
    runtime_secrets_path: path.relative(webRoot, secretsFile),
    runtime_secrets_mode: "0600",
    dcs_bridge_state: webHealthResp.body.components.dcs_bridge,
    provider_configured: Boolean(webReadyResp.body.provider_configured),
    transport_ready: Boolean(webReadyResp.body.transport_ready),
    preflight_ready: Boolean(webReadyResp.body.preflight_ready),
    live_generation_verified_since_start: Boolean(webReadyResp.body.live_generation_verified_since_start),
    initial_live_generation: webReadyResp.body.live_generation || null,
    health_ready_http: webReadyResp.status,
    health_ready_body: webReadyResp.body,
  };

  if (statusFile) {
    fs.mkdirSync(path.dirname(statusFile), { recursive: true });
    fs.writeFileSync(statusFile, JSON.stringify(pairStatus, null, 2));
  }

  console.log(
    `PAIR_RUNNING web=${actualWebSha} dcs=${actualDcsSha} web_url=${webUrl} dcs_url=${bridgeUrl} pair_pid=${process.pid} web_pid=${webProc.pid} dcs_pid=${dcsProc.pid} transport_ready=${pairStatus.transport_ready} provider_configured=${pairStatus.provider_configured}`
  );

  if (checkOnly) {
    await shutdown(0);
    return;
  }
}

main().catch(async (err) => {
  console.error("[stage1-pair] Fatal error:", err?.message || err);
  await shutdown(1);
});
