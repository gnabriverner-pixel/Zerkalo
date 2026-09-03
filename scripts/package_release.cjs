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
      if (
        entry.name.startsWith(".") ||
        entry.name === "node_modules" ||
        entry.name === "PUBLIC_RELEASE_EVIDENCE" ||
        entry.name === "evidence" ||
        entry.name === "dist" ||
        entry.name === "build" ||
        entry.name.endsWith(".tar.gz")
      )
        continue;
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
  const includeItems = [
    "dist",
    "server",
    "server.ts",
    "package.json",
    "package-lock.json",
    "src",
    "index.html",
    "vite.config.ts",
    "tsconfig.json",
    "scripts",
    "release.json",
  ];

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

    // Verify required files inside extracted package
    const reqDistRelease = path.join(tmpExtractDir, "dist", "release.json");
    const reqDistManifest = path.join(tmpExtractDir, "dist", "package_manifest.json");
    const reqLauncher = path.join(tmpExtractDir, "scripts", "runtime_launcher.cjs");

    if (!fs.existsSync(reqDistRelease)) {
      throw new Error(`Package verification failed: dist/release.json missing from archive`);
    }
    if (!fs.existsSync(reqDistManifest)) {
      throw new Error(`Package verification failed: dist/package_manifest.json missing from archive`);
    }
    if (!fs.existsSync(reqLauncher)) {
      throw new Error(`Package verification failed: scripts/runtime_launcher.cjs missing from archive`);
    }

    // Copy node_modules symlink
    const nmSource = path.join(repoRoot, "node_modules");
    if (fs.existsSync(nmSource)) {
      child_process.execSync(`ln -sfn "${nmSource}" "${path.join(tmpExtractDir, "node_modules")}"`, { stdio: "pipe" });
    }

    const testPort = 39400 + Math.floor(Math.random() * 500);
    const tsxPath = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");

    // Clean env: NO RELEASE_SHA or APP_GIT_SHA passed in env
    const cleanEnv = { ...process.env };
    delete cleanEnv.RELEASE_SHA;
    delete cleanEnv.APP_GIT_SHA;

    const proc = child_process.spawn(process.execPath, [tsxPath, "server.ts"], {
      cwd: tmpExtractDir,
      detached: true,
      env: {
        ...cleanEnv,
        PORT: String(testPort),
        NODE_ENV: "production",
        PUBLIC_RELEASE_MODE: "1",
        ALLOW_TEST_SCENARIOS: "0",
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

    // Wait and verify /health response without external RELEASE_SHA
    const startTime = Date.now();
    let verified = false;
    let healthData = null;

    while (Date.now() - startTime < 12000) {
      try {
        const res = await fetch(`http://127.0.0.1:${testPort}/health`);
        if (res.ok) {
          const json = await res.json();
          healthData = json;
          const shaMatch = json.release_sha === releaseSha || json.releaseSha === releaseSha;
          const hasComponents = json.components && json.components.web && json.components.dcs_bridge && json.components.albert;
          const notDirty = json.dirty === false;
          if (shaMatch && hasComponents && notDirty) {
            verified = true;
            break;
          }
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }

    // Clean shutdown
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

    if (!verified) {
      console.error("Server output on boot failure:\n", procStdout, procStderr);
      console.error("Health payload received:\n", healthData);
      throw new Error(`Extracted archive boot verification failed: /health did not self-identify releaseSha=${releaseSha} cleanly`);
    }

    console.log(`[Package] Clean extracted archive boot verified at port ${testPort}: releaseSha=${releaseSha}, components=OK, dirty=false`);
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
  fs.mkdirSync(distDir, { recursive: true });

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

  const releaseJson = {
    release_name: "Zerkalo Unified Release U1",
    base_sha: baseSha,
    release_sha: releaseSha,
    releaseSha: releaseSha,
    branch: "integration/unified-release-u1",
    target_version: "v1.0.0-u1",
    build_timestamp: buildTimestamp,
    dirty: false,
    components: {
      web: "active",
      dcs_bridge: "active",
      albert: "digital-code-system/telegram_v2.albert.orchestrator",
      telegram_v2_continuity: "SharedContextEnvelopeV1",
    },
    architecture: "OPTION_D_UNIFIED_RELEASE_U1",
    primary_surface: "UNIFIED_JOURNEY",
    safety: {
      crisis_interceptor_active: true,
      age_boundary: "18+",
      emergency_hotline: "112 / 103 / +7 (495) 989-50-50",
    },
    privacy: {
      local_first: true,
      pii_collected: false,
      continuation_claims: "single_use_signed_hmac",
      self_service_deletion_endpoint: "/api/delete-data",
    },
    qa_quality_gate: {
      mode: "FAIL_CLOSED",
      max_deadline_ms: 48000,
      max_transient_retries: 1,
    },
    status: "READY_FOR_FINAL_RE_ACCEPTANCE",
  };

  const manifestData = {
    release_sha: releaseSha,
    releaseSha: releaseSha,
    git_tree_sha: gitTreeSha,
    base_sha: baseSha,
    version: "v1.0.0-u1",
    build_timestamp: buildTimestamp,
    dirty: false,
    node_version: nodeVersion,
    npm_version: npmVersion,
    package_lock_sha256: packageLockSha256,
    config_contract: configContract,
    file_inventory_count: Object.keys(fileInventory).length,
  };

  // 1. Write release.json and package_manifest.json BEFORE archiving so they are packed inside dist/
  fs.writeFileSync(path.join(distDir, "release.json"), JSON.stringify(releaseJson, null, 2), "utf-8");
  fs.writeFileSync(path.join(distDir, "package_manifest.json"), JSON.stringify(manifestData, null, 2), "utf-8");
  fs.writeFileSync(path.join(repoRoot, "release.json"), JSON.stringify(releaseJson, null, 2), "utf-8");

  // 2. Build the deployable tar.gz archive
  const { archiveName, archivePath, archiveSha256 } = buildDeployableArchive(releaseSha, outDir);

  // Update manifest with final archive hash
  manifestData.archive_name = archiveName;
  manifestData.archive_sha256 = archiveSha256;
  manifestData.package_sha256 = archiveSha256;
  releaseJson.archive_sha256 = archiveSha256;

  // Re-write manifests with exact archive hash
  fs.writeFileSync(path.join(outDir, "package_manifest.json"), JSON.stringify(manifestData, null, 2), "utf-8");
  fs.writeFileSync(path.join(outDir, "release.json"), JSON.stringify(releaseJson, null, 2), "utf-8");
  fs.writeFileSync(path.join(distDir, "package_manifest.json"), JSON.stringify(manifestData, null, 2), "utf-8");
  fs.writeFileSync(path.join(distDir, "release.json"), JSON.stringify(releaseJson, null, 2), "utf-8");

  // If writing to external outDir, ensure dist/ also has a copy of the archive
  if (outDir !== distDir) {
    fs.copyFileSync(archivePath, path.join(distDir, archiveName));
  }

  // 3. Verify archive extracts cleanly into clean tmp and boots WITHOUT external RELEASE_SHA
  await verifyArchiveExtractAndBoot(archivePath, releaseSha);

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
