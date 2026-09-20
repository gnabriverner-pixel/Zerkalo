import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { calculateCanonicalDigitalCode } from "../server/dcsBridge";

describe("Drift Gate: Path & Toolchain Truth (Web)", () => {
  const repoRoot = path.resolve(__dirname, "..");
  const bridgePath = path.join(repoRoot, "server", "dcsBridge.ts");

  it("ensures server/dcsBridge.ts never references legacy clones or fallbacks", () => {
    expect(fs.existsSync(bridgePath)).toBe(true);
    const content = fs.readFileSync(bridgePath, "utf-8");

    // Must not reference legacy clones
    expect(content).not.toContain("digital-code-product-journey");
    expect(content).not.toContain("Documents/New project");
    expect(content).not.toContain("Hermes_agent");
    expect(content).not.toContain("digital-code-canonical-v3");

    // Must resolve canonical sibling
    expect(content).toContain("digital-code-system");

    // Must fail closed with explicit throw
    expect(content).toContain("throw new Error");
  });

  it("ensures server/dcsBridge.ts explicitly rejects stale DCS_ROOT clones at runtime", async () => {
    const orig = process.env.DCS_ROOT;
    try {
      process.env.DCS_ROOT = "/custom/path/to/digital-code-product-journey";
      await expect(calculateCanonicalDigitalCode("01.01.2000")).rejects.toThrow();
    } finally {
      process.env.DCS_ROOT = orig;
    }
  });

  it("ensures quality scripts never reference legacy clones", () => {
    const qualityFiles = [
      path.join(repoRoot, "scripts", "quality", "local-server.ts"),
      path.join(repoRoot, "scripts", "quality", "run.ts"),
      path.join(repoRoot, "scripts", "quality", "routeraiRelease.ts"),
    ];

    for (const qf of qualityFiles) {
      if (fs.existsSync(qf)) {
        const content = fs.readFileSync(qf, "utf-8");
        expect(content, `${qf} contains legacy clone reference`).not.toContain("digital-code-product-journey");
        expect(content, `${qf} contains legacy path reference`).not.toContain("Documents/New project");
        expect(content, `${qf} does not reference canonical sibling`).toContain("digital-code-system");
      }
    }
  });

  it("ensures zero prohibited path patterns exist in tracked source files", () => {
    const prohibitedPatterns = [
      "digital-code-product-journey",
      "Documents/New project",
      "Hermes_agent/zerkalo-lab",
      "digital-code-canonical-v3-owner-only",
    ];

    const trackedFiles = execSync("git ls-files", { cwd: repoRoot, encoding: "utf-8" })
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f.length > 0)
      .filter((f) => !f.startsWith("docs/CANONICAL_ENGINEERING_TRUTH.md"))
      .filter((f) => !f.startsWith("docs/ENGINEERING_DRIFT_REGISTRY.md"))
      .filter((f) => !f.startsWith("docs/archive/"))
      .filter((f) => !f.startsWith("archive/"))
      .filter((f) => f !== "tests/setup.ts");

    for (const pattern of prohibitedPatterns) {
      const violations: string[] = [];
      for (const relFile of trackedFiles) {
        const fullPath = path.join(repoRoot, relFile);
        if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) continue;
        const fileContent = fs.readFileSync(fullPath, "utf-8");
        if (fileContent.includes(pattern)) {
          violations.push(`${relFile} matches prohibited pattern "${pattern}"`);
        }
      }
      expect(violations, `Found violations for pattern "${pattern}"`).toEqual([]);
    }
  });

  it("ensures package.json exposes drift:check script", () => {
    const pkgPath = path.join(repoRoot, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    expect(pkg.scripts["drift:check"]).toBe("bash scripts/drift_gate.sh");
  });
});
