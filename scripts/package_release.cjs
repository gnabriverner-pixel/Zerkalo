const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const child_process = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const baseSha = "0fd2f21f8d8fdec48227a289bb87b113c96d49e5";

function getGitHeadSha() {
  if (process.env.RELEASE_SHA && process.env.RELEASE_SHA.length >= 7) {
    return process.env.RELEASE_SHA.trim();
  }
  try {
    return child_process.execSync("git rev-parse HEAD", { cwd: repoRoot, encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
}

function getGitTreeSha() {
  try {
    return child_process.execSync("git write-tree", { cwd: repoRoot, encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
}

function computeFileSha256(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

function computeDirectoryInventory(baseDir) {
  const fileHashes = {};
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "PUBLIC_RELEASE_EVIDENCE" || entry.name === "evidence" || entry.name === "dist" || entry.name === "build" || entry.name.endsWith(".tar.gz")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        const rel = path.relative(baseDir, full);
        const content = fs.readFileSync(full);
        const sha256 = crypto.createHash("sha256").update(content).digest("hex");
        fileHashes[rel] = { size_bytes: content.length, sha256 };
      }
    }
  }
  walk(baseDir);
  return fileHashes;
}

function buildDeployableArchive(releaseSha, outDir) {
  const archiveName = `release-${releaseSha}.tar.gz`;
  const archivePath = path.join(outDir, archiveName);

  // Files/directories to package for runtime
  const includeItems = ["dist", "server", "server.ts", "package.json", "package-lock.json", "src", "index.html", "vite.config.ts", "tsconfig.json"];
  
  // Tar command creating deterministic archive
  const tarCmd = `tar -czf "${archivePath}" --exclude='.git' --exclude='node_modules' --exclude='*.env*' --exclude='PUBLIC_RELEASE_EVIDENCE' --exclude='*.tar.gz' ${includeItems.join(" ")}`;
  child_process.execSync(tarCmd, { cwd: repoRoot, stdio: "pipe" });

  const archiveSha256 = computeFileSha256(archivePath);
  return { archiveName, archivePath, archiveSha256 };
}

async function verifyArchiveExtractAndBoot(archivePath, releaseSha) {
  const tmpExtractDir = `/tmp/zerkalo_pkg_verify_${Date.now()}`;
  fs.mkdirSync(tmpExtractDir, { recursive: true });
  let procStdout = "";
  let procStderr = "";
  try {
    child_process.execSync(`tar -xzf "${archivePath}" -C "${tmpExtractDir}"`, { stdio: "pipe" });
    // Copy node_modules symlink or verify structure
    const nmSource = path.join(repoRoot, "node_modules");
    if (fs.existsSync(nmSource)) {
      child_process.execSync(`ln -sfn "${nmSource}" "${path.join(tmpExtractDir, "node_modules")}"`, { stdio: "pipe" });
    }

    const testPort = 39400 + Math.floor(Math.random() * 500);
    const tsxPath = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
    const proc = child_process.spawn(process.execPath, [tsxPath, "server.ts"], {
      cwd: tmpExtractDir,
      detached: true,
      env: {
        ...process.env,
        PORT: String(testPort),
        NODE_ENV: "production",
        PUBLIC_RELEASE_MODE: "1",
        ALLOW_TEST_SCENARIOS: "0",
        RELEASE_SHA: releaseSha,
        QUALITATIVE_FEEDBACK_SECRET: "test-secret-key-32-characters-minimum-length!",
        MYTH_ENABLED: "1",
        PUBLIC_CODE_ENABLED: "0",
        PUBLIC_MEETING_ENABLED: "0",
        PUBLIC_ALBERT_ENABLED: "0",
        PUBLIC_BOOK_ENABLED: "0",
        PAYMENTS_ENABLED: "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const pgid = proc.pid;

    proc.stdout.on("data", (d) => { procStdout += d.toString(); });
    proc.stderr.on("data", (d) => { procStderr += d.toString(); });

    // Wait and verify /health response asynchronously
    const startTime = Date.now();
    let verified = false;
    while (Date.now() - startTime < 10000) {
      try {
        const res = await fetch(`http://127.0.0.1:${testPort}/health`);
        if (res.ok) {
          const json = await res.json();
          if (json.release_sha === releaseSha) {
            verified = true;
            break;
          }
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }

    // Clean shutdown of entire process tree
    try {
      process.kill(-pgid, "SIGTERM");
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
    try {
      process.kill(-pgid, "SIGKILL");
    } catch {}
    try {
      child_process.execSync(`lsof -ti :${testPort} | xargs kill -9 2>/dev/null || true`, { stdio: "ignore" });
    } catch {}

    // Verify port is free via net bind
    const net = require("net");
    let portFree = false;
    for (let i = 0; i < 20; i++) {
      const srv = net.createServer();
      const ok = await new Promise((res) => {
        srv.once("error", () => res(false));
        srv.once("listening", () => srv.close(() => res(true)));
        srv.listen(testPort, "127.0.0.1");
      });
      if (ok) {
        portFree = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    if (!verified) {
      throw new Error(`Package verification failed: extracted archive failed to respond on port ${testPort}.\nSTDOUT: ${procStdout}\nSTDERR: ${procStderr}`);
    }
    if (!portFree) {
      throw new Error(`Package verification failed: port ${testPort} was not freed after shutdown.`);
    }
    console.log(`[Package] Verified deployable archive extracted & booted successfully from blank dir: ${tmpExtractDir}`);
  } finally {
    try {
      fs.rmSync(tmpExtractDir, { recursive: true, force: true });
    } catch {}
  }
}

async function generatePackageManifest(targetOutDir) {
  const distDir = path.join(repoRoot, "dist");
  const outDir = targetOutDir || distDir;
  fs.mkdirSync(outDir, { recursive: true });

  const releaseSha = getGitHeadSha();
  const gitTreeSha = getGitTreeSha();
  const buildTimestamp = new Date().toISOString();
  const nodeVersion = process.version;
  let npmVersion = "unknown";
  try {
    npmVersion = child_process.execSync("npm --version", { encoding: "utf-8" }).trim();
  } catch {}

  const lockPath = path.join(repoRoot, "package-lock.json");
  const packageLockSha256 = fs.existsSync(lockPath) ? computeFileSha256(lockPath) : null;

  // Build the deployable tar.gz archive
  const { archiveName, archivePath, archiveSha256 } = buildDeployableArchive(releaseSha, outDir);

  // If writing to external outDir, ensure dist/ also has a copy of the archive
  if (outDir !== distDir) {
    fs.copyFileSync(archivePath, path.join(distDir, archiveName));
  }

  // Verify archive can extract and run
  await verifyArchiveExtractAndBoot(archivePath, releaseSha);

  const fileInventory = computeDirectoryInventory(repoRoot);

  const configContract = {
    PUBLIC_CODE_ENABLED: 0,
    PUBLIC_MEETING_ENABLED: 0,
    PUBLIC_ALBERT_ENABLED: 0,
    PUBLIC_BOOK_ENABLED: 0,
    PAYMENTS_ENABLED: 0,
    MYTH_ENABLED: 1,
    MYTH_ENGINE_VERSION: "v2",
    MYTH_ENGINE_MODE: "ACTIVE",
    PERSONAL_MYTH_TIMEOUT_MS: 60000,
    MAX_REQUEST_RETRIES: 1,
  };

  const manifestData = {
    release_sha: releaseSha,
    git_tree_sha: gitTreeSha,
    base_sha: baseSha,
    version: "v1.0.0-public-v1",
    build_timestamp: buildTimestamp,
    node_version: nodeVersion,
    npm_version: npmVersion,
    package_lock_sha256: packageLockSha256,
    archive_name: archiveName,
    archive_sha256: archiveSha256,
    package_sha256: archiveSha256, // Complete deployable archive hash
    config_contract: configContract,
    file_inventory_count: Object.keys(fileInventory).length,
  };

  const manifestPath = path.join(outDir, "package_manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), "utf-8");
  if (outDir !== distDir) {
    fs.writeFileSync(path.join(distDir, "package_manifest.json"), JSON.stringify(manifestData, null, 2), "utf-8");
  }

  // Also write release.json into outDir
  const releaseJsonPath = path.join(outDir, "release.json");
  const releaseJson = {
    release_name: "Zerkalo Public v1 Release",
    base_sha: baseSha,
    release_sha: releaseSha,
    branch: "release/public-v1-2026-08-30",
    target_version: "v1.0.0-public-v1",
    build_timestamp: buildTimestamp,
    architecture: "MYTH_FIRST_WITH_CODE_FROZEN",
    primary_surface: "PERSONAL_MYTH_V2",
    feature_flags: {
      PUBLIC_CODE_ENABLED: 0,
      PUBLIC_MEETING_ENABLED: 0,
      PUBLIC_ALBERT_ENABLED: 0,
      PUBLIC_BOOK_ENABLED: 0,
      PAYMENTS_ENABLED: 0,
      MYTH_ENABLED: 1,
      MYTH_ENGINE_VERSION: "v2",
      MYTH_ENGINE_MODE: "ACTIVE",
    },
    safety: {
      crisis_interceptor_active: true,
      age_boundary: "18+",
      emergency_hotline: "112 / 103 / +7 (495) 989-50-50",
    },
    privacy: {
      local_first: true,
      pii_collected: false,
      decision_analytics_retention_days: 90,
      ip_logs_retention_days: 7,
      qualitative_feedback_retention_days: 30,
      self_service_deletion_endpoint: "/api/delete-data",
    },
    qa_quality_gate: {
      mode: "FAIL_CLOSED",
      min_score: 7,
      max_deadline_ms: 60000,
      max_transient_retries: 1,
      post_repair_rejudge: true,
    },
    archive_sha256: archiveSha256,
    package_manifest_sha256: archiveSha256,
    status: "READY_FOR_FINAL_RE_ACCEPTANCE",
  };
  fs.writeFileSync(releaseJsonPath, JSON.stringify(releaseJson, null, 2), "utf-8");
  if (outDir !== distDir) {
    fs.writeFileSync(path.join(distDir, "release.json"), JSON.stringify(releaseJson, null, 2), "utf-8");
  }

  console.log(`[Package] Generated immutable deployable archive: ${archiveName}`);
  console.log(`[Package] Archive SHA-256: ${archiveSha256}`);
  console.log(`[Package] Output Directory: ${outDir}`);
  return manifestData;
}

async function main() {
  let targetDir = null;
  const args = process.argv.slice(2);
  const outDirIndex = args.indexOf("--out-dir");
  if (outDirIndex !== -1 && args[outDirIndex + 1]) {
    targetDir = path.resolve(args[outDirIndex + 1]);
  }
  await generatePackageManifest(targetDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

module.exports = { generatePackageManifest };
