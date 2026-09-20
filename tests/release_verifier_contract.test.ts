import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

describe("T4.3 Release Verifier Contract: Metadata Release Child vs Application Pin", () => {
  const tmpDir = path.join("/tmp", `test_verifier_contract_${Date.now()}`);
  const scriptPath = path.resolve(__dirname, "..", "scripts", "verify_metadata_contract.sh");

  let appSha = "";
  let validMetaSha = "";
  let invalidAppChangeSha = "";
  let nonDirectChildSha = "";
  let wrongDcsPinSha = "";
  let wrongAppPinSha = "";

  const canonicalDcsSha = "de78eb346a32da5b9f2fe6b5d40e10c85309c93f";

  beforeAll(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    const run = (cmd: string, cwd = tmpDir) =>
      execSync(cmd, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();

    run("git init -b main");
    run("git config user.name 'Verifier Tester'");
    run("git config user.email 'tester@example.com'");

    // 1. Initial application commit (appSha)
    fs.writeFileSync(path.join(tmpDir, "server.ts"), "// Application code v1\nexport const app = 'active';\n");
    fs.writeFileSync(
      path.join(tmpDir, "release-compatibility.json"),
      JSON.stringify(
        {
          web: { pinned_sha: "0000000000000000000000000000000000000000" },
          dcs: { pinned_sha: canonicalDcsSha },
        },
        null,
        2
      ) + "\n"
    );
    run("git add server.ts release-compatibility.json");
    run("git commit -m 'feat: initial application code'");
    const rawAppSha = run("git rev-parse HEAD");

    // Set pinned_sha to its own app commit and amend
    fs.writeFileSync(
      path.join(tmpDir, "release-compatibility.json"),
      JSON.stringify(
        {
          web: { pinned_sha: rawAppSha },
          dcs: { pinned_sha: canonicalDcsSha },
        },
        null,
        2
      ) + "\n"
    );
    run("git add release-compatibility.json");
    run("git commit --amend --no-edit");
    appSha = run("git rev-parse HEAD");

    // Re-pin to final appSha
    fs.writeFileSync(
      path.join(tmpDir, "release-compatibility.json"),
      JSON.stringify(
        {
          web: { pinned_sha: appSha },
          dcs: { pinned_sha: canonicalDcsSha },
        },
        null,
        2
      ) + "\n"
    );
    run("git add release-compatibility.json");
    run("git commit --amend --no-edit");
    appSha = run("git rev-parse HEAD");

    // 2. CASE B: Valid metadata release commit (direct child of appSha, only release-compatibility.json changed)
    fs.writeFileSync(
      path.join(tmpDir, "release-compatibility.json"),
      JSON.stringify(
        {
          web: { pinned_sha: appSha },
          dcs: { pinned_sha: canonicalDcsSha },
          updated_at: "2026-09-21",
        },
        null,
        2
      ) + "\n"
    );
    run("git add release-compatibility.json");
    run("git commit -m 'chore(release): pin metadata candidate'");
    validMetaSha = run("git rev-parse HEAD");

    // 3. CASE C: Child commit modifying application code in addition to metadata
    run(`git checkout -b branch-case-c ${appSha}`);
    fs.writeFileSync(
      path.join(tmpDir, "release-compatibility.json"),
      JSON.stringify(
        {
          web: { pinned_sha: appSha },
          dcs: { pinned_sha: canonicalDcsSha },
          updated_at: "2026-09-21",
        },
        null,
        2
      ) + "\n"
    );
    fs.writeFileSync(path.join(tmpDir, "server.ts"), "// Sneaky modification in metadata commit!\n");
    run("git add release-compatibility.json server.ts");
    run("git commit -m 'bad commit modifying application code'");
    invalidAppChangeSha = run("git rev-parse HEAD");

    // 4. CASE D: Non-direct child (two commits ahead of appSha)
    run(`git checkout -b branch-case-d ${validMetaSha}`);
    fs.writeFileSync(
      path.join(tmpDir, "release-compatibility.json"),
      JSON.stringify(
        {
          web: { pinned_sha: appSha },
          dcs: { pinned_sha: canonicalDcsSha },
          updated_at: "2026-09-22",
        },
        null,
        2
      ) + "\n"
    );
    run("git add release-compatibility.json");
    run("git commit -m 'second commit ahead of appSha'");
    nonDirectChildSha = run("git rev-parse HEAD");

    // 5. CASE E: Child commit with wrong DCS pin in tree
    run(`git checkout -b branch-case-e ${appSha}`);
    fs.writeFileSync(
      path.join(tmpDir, "release-compatibility.json"),
      JSON.stringify(
        {
          web: { pinned_sha: appSha },
          dcs: { pinned_sha: "0000000000000000000000000000000000000000" },
        },
        null,
        2
      ) + "\n"
    );
    run("git add release-compatibility.json");
    run("git commit -m 'wrong dcs pin'");
    wrongDcsPinSha = run("git rev-parse HEAD");

    // 6. CASE F: Child commit with wrong application pin in tree
    run(`git checkout -b branch-case-f ${appSha}`);
    fs.writeFileSync(
      path.join(tmpDir, "release-compatibility.json"),
      JSON.stringify(
        {
          web: { pinned_sha: "1111111111111111111111111111111111111111" },
          dcs: { pinned_sha: canonicalDcsSha },
        },
        null,
        2
      ) + "\n"
    );
    run("git add release-compatibility.json");
    run("git commit -m 'wrong app pin'");
    wrongAppPinSha = run("git rev-parse HEAD");

    // Switch back to main
    run("git checkout main");
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  function executeContractCheck(args: {
    webSha: string;
    webPin: string;
    dcsSha: string;
    dcsPin: string;
  }): { ok: boolean; exitCode: number; output: string } {
    try {
      const out = execSync(
        `bash "${scriptPath}" --repo-root "${tmpDir}" --web-sha "${args.webSha}" --web-pin "${args.webPin}" --dcs-sha "${args.dcsSha}" --dcs-pin "${args.dcsPin}"`,
        { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
      );
      return { ok: true, exitCode: 0, output: out };
    } catch (err: any) {
      return {
        ok: false,
        exitCode: err.status ?? 1,
        output: (err.stdout ?? "") + (err.stderr ?? ""),
      };
    }
  }

  it("CASE A — legacy/direct candidate (WEB_SHA == WEB_PIN) passes", () => {
    const res = executeContractCheck({
      webSha: appSha,
      webPin: appSha,
      dcsSha: canonicalDcsSha,
      dcsPin: canonicalDcsSha,
    });
    expect(res.ok).toBe(true);
    expect(res.exitCode).toBe(0);
    expect(res.output).toContain("LEGACY_DIRECT_MATCH");
  });

  it("CASE B — valid metadata release commit (direct child of app SHA, manifest-only delta) passes", () => {
    const res = executeContractCheck({
      webSha: validMetaSha,
      webPin: appSha,
      dcsSha: canonicalDcsSha,
      dcsPin: canonicalDcsSha,
    });
    expect(res.ok).toBe(true);
    expect(res.exitCode).toBe(0);
    expect(res.output).toContain("METADATA_CHILD_MATCH");
  });

  it("CASE C — release SHA is child, but modified application code fails closed", () => {
    const res = executeContractCheck({
      webSha: invalidAppChangeSha,
      webPin: appSha,
      dcsSha: canonicalDcsSha,
      dcsPin: canonicalDcsSha,
    });
    expect(res.ok).toBe(false);
    expect(res.exitCode).not.toBe(0);
    expect(res.output).toContain("FAIL_CLOSED: application-code changes detected outside release-compatibility.json");
  });

  it("CASE D — release SHA is not a direct child of pinned application SHA fails closed", () => {
    const res = executeContractCheck({
      webSha: nonDirectChildSha,
      webPin: appSha,
      dcsSha: canonicalDcsSha,
      dcsPin: canonicalDcsSha,
    });
    expect(res.ok).toBe(false);
    expect(res.exitCode).not.toBe(0);
    expect(res.output).toContain("FAIL_CLOSED: release commit is not an immediate direct child of application pin");
  });

  it("CASE E — DCS pin inside release tree does not match requested DCS SHA fails closed", () => {
    const res = executeContractCheck({
      webSha: wrongDcsPinSha,
      webPin: appSha,
      dcsSha: canonicalDcsSha,
      dcsPin: canonicalDcsSha,
    });
    expect(res.ok).toBe(false);
    expect(res.exitCode).not.toBe(0);
    expect(res.output).toContain("FAIL_CLOSED: tree DCS pin mismatch");
  });

  it("CASE F — metadata release tree contains invalid application pin fails closed", () => {
    const res = executeContractCheck({
      webSha: wrongAppPinSha,
      webPin: appSha,
      dcsSha: canonicalDcsSha,
      dcsPin: canonicalDcsSha,
    });
    expect(res.ok).toBe(false);
    expect(res.exitCode).not.toBe(0);
    expect(res.output).toContain("FAIL_CLOSED: tree application pin mismatch");
  });
});
