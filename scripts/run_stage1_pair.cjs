#!/usr/bin/env node
const { spawn, execFileSync, execSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const dotenv = require("dotenv");

const webRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(webRoot, ".env") });

function parseArgs() {
  const args = process.argv.slice(2);
  let dcsRootArg = "";
  let webShaArg = "";
  let dcsShaArg = "";
  let webPort = Number(process.env.PORT || process.env.STAGE1_WEB_PORT || 3018);
  let dcsPort = Number(process.env.DCS_PORT || process.env.STAGE1_DCS_PORT || 39500);
  let statusFile = "";
  let checkOnly = false;
  let allowDirty = false;

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--dcs-root" && args[i + 1]) {
      dcsRootArg = path.resolve(args[i + 1]);
      i += 1;
    } else if ((a === "--web-sha" || a === "--expected-web-sha") && args[i + 1]) {
      webShaArg = args[i + 1].trim();
      i += 1;
    } else if ((a === "--dcs-sha" || a === "--expected-dcs-sha") && args[i + 1]) {
      dcsShaArg = args[i + 1].trim();
      i += 1;
    } else if ((a === "--web-port" || a === "--port") && args[i + 1]) {
      webPort = Number(args[i + 1]);
      i += 1;
    } else if (a === "--dcs-port" && args[i + 1]) {
      dcsPort = Number(args[i + 1]);
      i += 1;
    } else if ((a === "--StatusFile" || a === "--status-file") && args[i + 1]) {
      statusFile = path.resolve(args[i + 1]);
      i += 1;
    } else if (a === "--check-only") {
      checkOnly = true;
    } else if (a === "--allow-dirty") {
      allowDirty = true;
    } else if (/^[0-9a-f]{40}$/.test(a)) {
      if (!webShaArg) webShaArg = a;
      else if (!dcsShaArg) dcsShaArg = a;
    }
  }
  return { dcsRootArg, webShaArg, dcsShaArg, webPort, dcsPort, statusFile, checkOnly, allowDirty };
}

function git(cwd, ...gitArgs) {
  return execFileSync("git", gitArgs, { cwd, encoding: "utf8" }).trim();
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.listen(port, "127.0.0.1", () => srv.close(() => resolve(true)));
  });
}

async function freePortIfOccupied(port) {
  if (await isPortAvailable(port)) return;
  try {
    execSync(`lsof -ti :${port} | xargs kill -9 2>/dev/null || true`, { stdio: "ignore" });
    await new Promise((r) => setTimeout(r, 400));
  } catch {}
  if (!(await isPortAvailable(port))) {
    throw new Error(`Port ${port} is occupied and could not be freed.`);
  }
}

async function waitHttpJson(url, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
      const body = await res.json().catch(() => null);
      if (body) return { status: res.status, ok: res.ok, body };
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

async function main() {
  const { dcsRootArg, webShaArg, dcsShaArg, webPort, dcsPort, statusFile, checkOnly, allowDirty } = parseArgs();

  const nodeMajor = process.versions.node.split(".")[0];
  if (nodeMajor !== "24") {
    console.error(`[stage1-pair] Canonical runtime is Node 24 (got ${process.version}). Use PATH="$(brew --prefix node@24)/bin:$PATH".`);
    process.exit(1);
  }

  const dcsRoot = dcsRootArg || process.env.DCS_ROOT || path.resolve(webRoot, "../dcs-canonical-732");
  if (!dcsRoot || !fs.existsSync(path.join(dcsRoot, "engine.py"))) {
    console.error(`[stage1-pair] Canonical DCS root not found at "${dcsRoot}". Pass --dcs-root /path/to/dcs-canonical-732`);
    process.exit(1);
  }

  dotenv.config({ path: path.join(dcsRoot, ".env") });

  const actualWebSha = git(webRoot, "rev-parse", "HEAD");
  const actualDcsSha = git(dcsRoot, "rev-parse", "HEAD");
  const webDirty = git(webRoot, "status", "--porcelain") !== "";
  const dcsDirty = git(dcsRoot, "status", "--porcelain") !== "";

  if (!allowDirty && (webDirty || dcsDirty)) {
    console.error(`[stage1-pair] Working tree must be clean before starting candidate pair (webDirty=${webDirty}, dcsDirty=${dcsDirty}).`);
    process.exit(1);
  }
  if (webShaArg && webShaArg !== actualWebSha) {
    console.error(`[stage1-pair] Web SHA mismatch: expected ${webShaArg}, actual ${actualWebSha}`);
    process.exit(1);
  }
  if (dcsShaArg && dcsShaArg !== actualDcsSha) {
    console.error(`[stage1-pair] DCS SHA mismatch: expected ${dcsShaArg}, actual ${actualDcsSha}`);
    process.exit(1);
  }

  // Strictly require DCS's own release-local .venv (never borrow from another repo)
  const pythonBin = path.join(dcsRoot, ".venv", "bin", "python");
  if (!fs.existsSync(pythonBin)) {
    console.error(`[stage1-pair] Release-local virtualenv missing at ${pythonBin}. Borrowing .venv is forbidden.`);
    process.exit(1);
  }
  const pyVersion = execFileSync(pythonBin, ["--version"], { encoding: "utf8" }).trim();
  if (!pyVersion.startsWith("Python 3.12.")) {
    console.error(`[stage1-pair] DCS Python must be 3.12.x (got "${pyVersion}").`);
    process.exit(1);
  }
  const verifyEnvScript = path.join(dcsRoot, "scripts", "verify_release_env.sh");
  if (fs.existsSync(verifyEnvScript)) {
    execFileSync("bash", [verifyEnvScript, "--verify-packages", dcsRoot], { cwd: dcsRoot, stdio: "pipe" });
  }

  await freePortIfOccupied(dcsPort);
  await freePortIfOccupied(webPort);

  const bridgeUrl = `http://127.0.0.1:${dcsPort}`;
  const webUrl = `http://127.0.0.1:${webPort}`;
  const runtimeDir = path.join(webRoot, ".runtime");
  fs.mkdirSync(runtimeDir, { recursive: true });

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
    DELETION_SCOPES_PATH: path.join(runtimeDir, "deletion_scopes.json"),
    CONTINUATION_CLAIM_SECRET:
      process.env.CONTINUATION_CLAIM_SECRET || "stage1-local-pair-continuation-claim-secret-32c",
    DELETION_LOOKUP_SECRET:
      process.env.DELETION_LOOKUP_SECRET || "stage1-synthetic-quality-secret-32chars",
  };

  const hasRouterAiKey = Boolean(env.ROUTERAI_API_KEY && String(env.ROUTERAI_API_KEY).trim());
  console.log(
    `[stage1-pair] Starting verified pair: Web=${actualWebSha.slice(0, 7)} (port ${webPort}), DCS=${actualDcsSha.slice(0, 7)} (port ${dcsPort}), ROUTERAI_API_KEY=${hasRouterAiKey ? "present" : "MISSING"}`
  );

  const children = [];
  let shuttingDown = false;
  function shutdown(code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children) {
      try {
        child.kill("SIGTERM");
      } catch {}
    }
    process.exit(code);
  }
  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));

  const dcsProc = spawn(
    pythonBin,
    ["-m", "integration.dcs_service", "--host", "127.0.0.1", "--port", String(dcsPort)],
    { cwd: dcsRoot, env: { ...env, RELEASE_SHA: actualDcsSha, DCS_RELEASE_SHA: actualDcsSha }, stdio: "inherit" }
  );
  children.push(dcsProc);

  const dcsHealthResp = await waitHttpJson(`${bridgeUrl}/health`, 15000);
  if (!dcsHealthResp?.ok || dcsHealthResp.body?.sha !== actualDcsSha) {
    console.error("[stage1-pair] DCS canonical service failed SHA identity check:", {
      expected: actualDcsSha,
      actual: dcsHealthResp?.body,
    });
    shutdown(1);
    return;
  }

  const tsxCli = path.join(webRoot, "node_modules", "tsx", "dist", "cli.mjs");
  const webProc = spawn(process.execPath, [tsxCli, "server.ts"], { cwd: webRoot, env, stdio: "inherit" });
  children.push(webProc);

  const webHealthResp = await waitHttpJson(`${webUrl}/health`, 20000);
  const webReadyResp = await waitHttpJson(`${webUrl}/health/ready`, 10000);

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
    shutdown(1);
    return;
  }

  const pairStatus = {
    started_at: new Date().toISOString(),
    web_root: webRoot,
    dcs_root: dcsRoot,
    web_sha: actualWebSha,
    dcs_sha: actualDcsSha,
    web_dirty: webDirty,
    dcs_dirty: dcsDirty,
    node_version: process.version,
    python_version: pyVersion,
    web_url: webUrl,
    dcs_bridge_state: webHealthResp.body.components.dcs_bridge,
    provider_configured: Boolean(webReadyResp.body.provider_configured),
    transport_ready: Boolean(webReadyResp.body.transport_ready),
    preflight_ready: Boolean(webReadyResp.body.preflight_ready),
    live_generation_verified_since_start: Boolean(webReadyResp.body.live_generation_verified_since_start),
    health_ready_http: webReadyResp.status,
    health_ready_body: webReadyResp.body,
  };

  if (statusFile) {
    fs.mkdirSync(path.dirname(statusFile), { recursive: true });
    fs.writeFileSync(statusFile, JSON.stringify(pairStatus, null, 2));
  }

  console.log(
    `PAIR_RUNNING web=${actualWebSha} dcs=${actualDcsSha} web_url=${webUrl} transport_ready=${pairStatus.transport_ready} provider_configured=${pairStatus.provider_configured}`
  );

  if (checkOnly) {
    shutdown(0);
    return;
  }

  webProc.on("exit", (code) => shutdown(code ?? 0));
}

main().catch((err) => {
  console.error("[stage1-pair] Fatal error:", err);
  process.exit(1);
});
