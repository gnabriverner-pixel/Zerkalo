import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCanonicalEnvelopeFromWebContext } from "./albert";

const webRoot = path.resolve(__dirname, "..");
const pairScript = path.join(webRoot, "scripts", "run_stage1_pair.cjs");
const liveScript = path.join(webRoot, "scripts", "run_stage1_live_acceptance.cjs");

function resolveDcsRoot(): string {
  const candidates = [
    process.env.DCS_ROOT || "",
    path.resolve(webRoot, "../dcs-canonical-732"),
    path.resolve(webRoot, "../digital-code-system"),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(path.join(c, "engine.py"))) {
      return c;
    }
  }
  return path.resolve(webRoot, "../dcs-canonical-732");
}

function allocateFreePort(exclude?: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => {
        if (port === exclude) {
          allocateFreePort(exclude).then(resolve, reject);
        } else {
          resolve(port);
        }
      });
    });
  });
}

function isPidAlive(pid: number | null | undefined): boolean {
  if (!pid || typeof pid !== "number" || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function runNodeScript(
  scriptPath: string,
  args: string[],
  envOverrides: Record<string, string> = {},
  timeoutMs = 35000
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: webRoot,
      env: { ...process.env, ...envOverrides },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {}
      reject(new Error(`Timed out running ${path.basename(scriptPath)}: stdout=${stdout} stderr=${stderr}`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

describe("Stage 1 Runner Lifecycle, Key Source & Contract Regression Gate", () => {
  it("validates ports strictly as integers in 1024..65535 before any actions", async () => {
    for (const invalidArgs of [
      ["--web-port", "abc"],
      ["--web-port", "80"],
      ["--dcs-port", "70000"],
      ["--web-port", "3018.5"],
      ["--web-port", "4100", "--dcs-port", "4100"],
    ]) {
      const res = await runNodeScript(pairScript, invalidArgs, {}, 5000);
      expect(res.code).toBe(1);
      expect(res.stderr).toMatch(/Invalid (webPort|dcsPort|port configuration)/);
    }
  });

  it("never kills a foreign process occupying a port and fails closed with a clear error", async () => {
    const occupiedPort = await allocateFreePort();
    const freeDcsPort = await allocateFreePort(occupiedPort);

    const holderProc = spawn(
      process.execPath,
      [
        "-e",
        `const http = require("node:http");
         const srv = http.createServer((_req, res) => { res.writeHead(200); res.end("foreign-alive"); });
         srv.listen(${occupiedPort}, "127.0.0.1", () => console.log("HOLDER_LISTENING"));`,
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    try {
      await new Promise<void>((resolve, reject) => {
        holderProc.stdout.on("data", (chunk) => {
          if (chunk.toString().includes("HOLDER_LISTENING")) resolve();
        });
        holderProc.on("exit", (c) => reject(new Error(`Holder exited early: ${c}`)));
      });

      expect(isPidAlive(holderProc.pid)).toBe(true);

      const res = await runNodeScript(
        pairScript,
        ["--web-port", String(occupiedPort), "--dcs-port", String(freeDcsPort), "--allow-dirty"],
        {},
        10000
      );

      expect(res.code).toBe(1);
      expect(res.stderr).toContain(`port ${occupiedPort} is already occupied`);
      expect(isPidAlive(holderProc.pid)).toBe(true);
      const checkResp = await fetch(`http://127.0.0.1:${occupiedPort}`);
      expect(await checkResp.text()).toBe("foreign-alive");
    } finally {
      try {
        holderProc.kill("SIGTERM");
      } catch {}
    }
  });

  it("cleans up already-started DCS child process if startup fails before pair completion", async () => {
    const dcsRoot = resolveDcsRoot();
    expect(fs.existsSync(path.join(dcsRoot, "engine.py"))).toBe(true);

    const dcsPort = await allocateFreePort();
    const webPort = await allocateFreePort(dcsPort);

    const res = await runNodeScript(
      pairScript,
      ["--dcs-root", dcsRoot, "--web-port", String(webPort), "--dcs-port", String(dcsPort), "--allow-dirty"],
      { STAGE1_FAIL_AFTER_DCS_START: "1" },
      25000
    );

    expect(res.code).toBe(1);
    const match = res.stderr.match(/dcs_pid=(\d+)/);
    expect(match).not.toBeNull();
    const dcsPid = Number(match![1]);
    expect(dcsPid).toBeGreaterThan(0);

    await new Promise((r) => setTimeout(r, 200));
    expect(isPidAlive(dcsPid)).toBe(false);
  }, 30000);

  it("generates cryptographic 64-hex secrets in .runtime/stage1-pair-secrets.json with 0600 mode and never logs secret values", async () => {
    const dcsRoot = resolveDcsRoot();
    expect(fs.existsSync(path.join(dcsRoot, "engine.py"))).toBe(true);

    const secretsPath = path.join(webRoot, ".runtime", "stage1-pair-secrets.json");
    if (fs.existsSync(secretsPath)) {
      fs.unlinkSync(secretsPath);
    }

    const statusFile = path.join(os.tmpdir(), `stage1-pair-status-${Date.now()}.json`);
    const res = await runNodeScript(
      pairScript,
      ["--dcs-root", dcsRoot, "--auto-ports", "--check-only", "--allow-dirty", "--StatusFile", statusFile],
      {
        CONTINUATION_CLAIM_SECRET: "",
        DELETION_LOOKUP_SECRET: "",
      },
      35000
    );

    expect(res.code).toBe(0);
    expect(fs.existsSync(secretsPath)).toBe(true);

    const stat = fs.statSync(secretsPath);
    expect(stat.mode & 0o777).toBe(0o600);

    const secrets = JSON.parse(fs.readFileSync(secretsPath, "utf8"));
    expect(secrets.CONTINUATION_CLAIM_SECRET).toMatch(/^[0-9a-f]{64}$/);
    expect(secrets.DELETION_LOOKUP_SECRET).toMatch(/^[0-9a-f]{64}$/);
    expect(secrets.CONTINUATION_CLAIM_SECRET).not.toBe(secrets.DELETION_LOOKUP_SECRET);

    expect(res.stdout).not.toContain(secrets.CONTINUATION_CLAIM_SECRET);
    expect(res.stderr).not.toContain(secrets.CONTINUATION_CLAIM_SECRET);
    const statusContent = fs.readFileSync(statusFile, "utf8");
    expect(statusContent).not.toContain(secrets.CONTINUATION_CLAIM_SECRET);
    fs.unlinkSync(statusFile);
  }, 40000);

  it("live acceptance rejects --allow-dirty in normal mode, spawns its own fresh pair with initial live_generation=false, and cleans up on browser launch failure", async () => {
    const dcsRoot = resolveDcsRoot();
    expect(fs.existsSync(path.join(dcsRoot, "engine.py"))).toBe(true);

    // 1. Verify --allow-dirty is strictly forbidden for normal runs
    const dirtyRejectRes = await runNodeScript(liveScript, ["--allow-dirty"], {}, 5000);
    expect(dirtyRejectRes.code).toBe(1);
    expect(dirtyRejectRes.stderr).toContain("allow_dirty_forbidden_for_live_acceptance");

    // 2. Start a fake server claiming live_generation_verified_since_start: true
    const fakeServer = http.createServer((_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          status: "ready",
          ready: true,
          live_generation_verified_since_start: true,
          live_generation: { personal_myth: true, meeting: true, albert: true },
        })
      );
    });
    await new Promise<void>((resolve) => fakeServer.listen(0, "127.0.0.1", () => resolve()));

    const tmpOutDir = fs.mkdtempSync(path.join(os.tmpdir(), "stage1-live-test-"));
    try {
      const res = await runNodeScript(
        liveScript,
        ["--dcs-root", dcsRoot, "--OutputDir", tmpOutDir],
        {
          STAGE1_LIFECYCLE_SELF_TEST: "1",
          STAGE1_SIMULATE_BROWSER_LAUNCH_FAILURE: "1",
        },
        40000
      );

      expect(res.code).toBe(1);
      const resultJson = JSON.parse(fs.readFileSync(path.join(tmpOutDir, "result.json"), "utf8"));
      expect(resultJson.failedStage).toBe("browser_launch");
      expect(resultJson.managedProcesses.reusedExistingPair).toBe(false);
      expect(resultJson.managedProcesses.webPid).toBeGreaterThan(0);
      expect(resultJson.managedProcesses.dcsPid).toBeGreaterThan(0);
      expect(resultJson.initialLiveGeneration).toEqual({
        personal_myth: false,
        meeting: false,
        albert: false,
      });
      expect(resultJson.managedProcesses.terminatedOnExit).toBe(true);
      expect(resultJson.managedProcesses.allChildrenStopped).toBe(true);
      expect(isPidAlive(resultJson.managedProcesses.webPid)).toBe(false);
      expect(isPidAlive(resultJson.managedProcesses.dcsPid)).toBe(false);
    } finally {
      fakeServer.close();
      fs.rmSync(tmpOutDir, { recursive: true, force: true });
    }
  }, 45000);

  it("documents PR #115 central_motif object incompatibility against current Web envelope builder", () => {
    const canonicalEnv = buildCanonicalEnvelopeFromWebContext(
      {
        codeV2Payload: {
          calculation: { five_numbers: { soul: 6, path: 8, direction: 5, expression: 2, result: 7 } },
          central_motif: "Каноническая строка центрального мотива (DCS 732c148).",
        },
      } as any,
      []
    );
    expect(
      canonicalEnv.evidence.some((e: any) => e.source === "code_interpretation" && e.source_ref === "code.central_motif")
    ).toBe(true);

    const pr115Env = buildCanonicalEnvelopeFromWebContext(
      {
        codeV2Payload: {
          calculation: { five_numbers: { soul: 6, path: 8, direction: 5, expression: 2, result: 7 } },
          central_motif: {
            heading: "PR #115 Object Heading",
            body: "PR #115 changes central_motif from string to {heading, body} object.",
          },
        },
      } as any,
      []
    );
    expect(
      pr115Env.evidence.some((e: any) => e.source === "code_interpretation" && e.source_ref === "code.central_motif")
    ).toBe(false);
  });
});
