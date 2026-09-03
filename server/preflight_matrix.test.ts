import { describe, it, expect } from "vitest";
import child_process from "child_process";
import path from "path";

const repoRoot = path.resolve(__dirname, "..");
const preflightScript = path.join(repoRoot, "deploy", "preflight.sh");

function runPreflightWithEnv(customEnv: Record<string, string>): { status: number; output: string } {
  try {
    const output = child_process.execSync(`bash ${preflightScript}`, {
      cwd: repoRoot,
      env: {
        ...process.env,
        ...customEnv,
      },
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { status: 0, output };
  } catch (err: any) {
    return { status: err.status || 1, output: (err.stdout || "") + "\n" + (err.stderr || "") };
  }
}

describe("Preflight Failure Matrix Tests", () => {
  it("fails preflight when PUBLIC_CODE_ENABLED=0", () => {
    const res = runPreflightWithEnv({ PUBLIC_CODE_ENABLED: "0" });
    expect(res.status).not.toBe(0);
    expect(res.output).toContain("PUBLIC_CODE_ENABLED must be 1");
  });

  it("fails preflight when PUBLIC_MEETING_ENABLED=0", () => {
    const res = runPreflightWithEnv({ PUBLIC_MEETING_ENABLED: "0" });
    expect(res.status).not.toBe(0);
    expect(res.output).toContain("PUBLIC_MEETING_ENABLED must be 1");
  });

  it("fails preflight when PUBLIC_ALBERT_ENABLED=0", () => {
    const res = runPreflightWithEnv({ PUBLIC_ALBERT_ENABLED: "0" });
    expect(res.status).not.toBe(0);
    expect(res.output).toContain("PUBLIC_ALBERT_ENABLED must be 1");
  });

  it("fails preflight when PUBLIC_BOOK_ENABLED=1", () => {
    const res = runPreflightWithEnv({ PUBLIC_BOOK_ENABLED: "1" });
    expect(res.status).not.toBe(0);
    expect(res.output).toContain("PUBLIC_BOOK_ENABLED must be 0");
  });

  it("fails preflight when PAYMENTS_ENABLED=1", () => {
    const res = runPreflightWithEnv({ PAYMENTS_ENABLED: "1" });
    expect(res.status).not.toBe(0);
    expect(res.output).toContain("PAYMENTS_ENABLED must be 0");
  });

  it("fails preflight when MYTH_ENGINE_MODE=SHADOW", () => {
    const res = runPreflightWithEnv({ MYTH_ENGINE_MODE: "SHADOW" });
    expect(res.status).not.toBe(0);
    expect(res.output).toContain("MYTH_ENGINE_MODE must be ACTIVE");
  });

  it("fails preflight when PERSONAL_MYTH_TIMEOUT_MS > 60000", () => {
    const res = runPreflightWithEnv({ PERSONAL_MYTH_TIMEOUT_MS: "90000" });
    expect(res.status).not.toBe(0);
    expect(res.output).toContain("PERSONAL_MYTH_TIMEOUT_MS cannot exceed 60000ms");
  });

  it("fails preflight when QUALITATIVE_FEEDBACK_SECRET is missing or empty", () => {
    const res = runPreflightWithEnv({ QUALITATIVE_FEEDBACK_SECRET: "" });
    expect(res.status).not.toBe(0);
    expect(res.output).toContain("QUALITATIVE_FEEDBACK_SECRET is required");
  });

  it("fails preflight when QUALITATIVE_FEEDBACK_SECRET is short (< 16 chars)", () => {
    const res = runPreflightWithEnv({ QUALITATIVE_FEEDBACK_SECRET: "short_secret" });
    expect(res.status).not.toBe(0);
    expect(res.output).toContain("QUALITATIVE_FEEDBACK_SECRET must be at least 16 characters");
  });

  it("fails preflight when DELETION_LOOKUP_SECRET is missing or empty", () => {
    const res = runPreflightWithEnv({
      QUALITATIVE_FEEDBACK_SECRET: "test-secret-key-32-characters-minimum-length!",
      DELETION_LOOKUP_SECRET: "",
    });
    expect(res.status).not.toBe(0);
    expect(res.output).toContain("DELETION_LOOKUP_SECRET is required");
  });

  it("fails preflight when DELETION_LOOKUP_SECRET is short (< 16 chars)", () => {
    const res = runPreflightWithEnv({
      QUALITATIVE_FEEDBACK_SECRET: "test-secret-key-32-characters-minimum-length!",
      DELETION_LOOKUP_SECRET: "short_del_sec",
    });
    expect(res.status).not.toBe(0);
    expect(res.output).toContain("DELETION_LOOKUP_SECRET must be at least 16 characters");
  });

  it("fails preflight when DELETION_LOOKUP_SECRET mismatches persisted scopes", () => {
    const fs = require("fs");
    const scopesFile = path.join(repoRoot, "data", "deletion_scopes.json");
    const backupFile = path.join(repoRoot, "data", "deletion_scopes.json.bak.test");
    if (fs.existsSync(scopesFile)) {
      fs.copyFileSync(scopesFile, backupFile);
    }
    try {
      fs.writeFileSync(
        scopesFile,
        JSON.stringify({
          version: "1",
          secret_fingerprint: "0123456789abcdef",
          scopes: [{ lookup_key: "abc" }],
        })
      );
      const res = runPreflightWithEnv({
        QUALITATIVE_FEEDBACK_SECRET: "test-secret-key-32-characters-minimum-length!",
        DELETION_LOOKUP_SECRET: "completely-different-secret-32-chars-long!",
      });
      expect(res.status).not.toBe(0);
      expect(res.output).toContain("DELETION_LOOKUP_SECRET mismatch with active persisted scopes");
    } finally {
      if (fs.existsSync(backupFile)) {
        fs.copyFileSync(backupFile, scopesFile);
        fs.unlinkSync(backupFile);
      } else if (fs.existsSync(scopesFile)) {
        fs.unlinkSync(scopesFile);
      }
    }
  });

  it("fails preflight when ALLOW_TEST_SCENARIOS=1 is passed", () => {
    const res = runPreflightWithEnv({
      QUALITATIVE_FEEDBACK_SECRET: "test-secret-key-32-characters-minimum-length!",
      DELETION_LOOKUP_SECRET: "test-deletion-secret-32-characters-long!",
      ALLOW_TEST_SCENARIOS: "1",
    });
    expect(res.status).not.toBe(0);
    expect(res.output).toContain("ALLOW_TEST_SCENARIOS and ACCEPTANCE_TEST_MODE must be 0");
  });

  it("fails preflight when ACCEPTANCE_TEST_MODE=1 is passed", () => {
    const res = runPreflightWithEnv({
      QUALITATIVE_FEEDBACK_SECRET: "test-secret-key-32-characters-minimum-length!",
      DELETION_LOOKUP_SECRET: "test-deletion-secret-32-characters-long!",
      ACCEPTANCE_TEST_MODE: "1",
    });
    expect(res.status).not.toBe(0);
    expect(res.output).toContain("ALLOW_TEST_SCENARIOS and ACCEPTANCE_TEST_MODE must be 0");
  });
});
