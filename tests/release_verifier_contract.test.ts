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

  it("CASE G — repository release-compatibility.json matches exact remotes, branches, CONSENT_VERSION, PERSONAL_MYTH_WRITER_VERSION, DCS endpoints, and runtime contract", () => {
    const repoRoot = path.resolve(__dirname, "..");
    const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "release-compatibility.json"), "utf-8"));
    expect(manifest.web.repository).toBe("gnabriverner-pixel/Zerkalo");
    expect(manifest.web.branch).toBe("codex/stage1-convergence-candidate");
    expect(manifest.dcs.repository).toBe("gnabriverner-pixel/digital-code-system");
    expect(manifest.dcs.branch).toBe("codex/stage1-owner-iteration");
    expect(manifest.contracts.consent_version).toBe("zerkalo-2026-09-v1");
    expect(manifest.contracts.personal_myth_writer_version).toBe("personal-myth-v1.5-emergent-possibility");
    expect(manifest.contracts.personal_myth_default_prompt_variant).toBe("v11");
    expect(manifest.contracts.dcs_service_http.endpoints).toEqual([
      "/api/canonical/calculate",
      "/api/canonical/code-v2",
      "/api/canonical/albert/turn",
      "/health",
    ]);
    expect(manifest.runtime).toEqual({
      node_major: 24,
      python: "3.11+",
      live_provider_required: true,
      fallback_forbidden_in_production: true,
    });
  });

  it("CASE H — 24-run Personal Myth audit catches invented memories/habits, Set 5 'как будто' modality loss, and assigns differentiated manual scores", async () => {
    const {
      evaluateMythRunProvenanceAndScores,
      MANUAL_24_RUN_AUDIT,
      MYTH_FIXED_6_SETS,
    } = await import("../scripts/run_v7_targeted_evidence");

    expect(Object.keys(MANUAL_24_RUN_AUDIT)).toHaveLength(24);

    // 1. Set 2, V11, Run 1: invented second park walk memory
    const set2V11Run1 = evaluateMythRunProvenanceAndScores(
      {
        run_index: 1,
        title: "Калитка и шаг",
        story:
          "Ты стоишь перед калиткой. Ты вспоминаешь утреннюю прогулку по парку — не эту, а другую, когда ты шёл без цели и просто считал шаги. Тогда ты заметил, что если идти медленно, дорожка сама выводит тебя к пруду.",
        mirror: {
          mainImage: "В вашем ответе есть закрытая деревянная калитка.",
          innerTension: "В этой сцене есть выбор.",
          hiddenResource: "В этой сцене стало возможно заметить ручку.",
          newView: "Если в вашем ответе утренняя прогулка по парку даёт живость, что изменится?",
        },
        meaning: ["А", "Б", "В?"],
        one_step: "Положите ладонь на ручку и проверьте ход.",
        journal_question: "Что вы заметите?",
        quality: { passed: true, blockers: [], word_count: 350, paragraph_count: 4 },
      },
      MYTH_FIXED_6_SETS[1],
      "v11"
    );
    expect(set2V11Run1.provenance_clean).toBe(false);
    expect(set2V11Run1.attribution_violations[0]).toContain("invented_past_memory_in_story");
    expect(set2V11Run1.scores_out_of_8.total).toBe(6);
    expect(set2V11Run1.manual_review?.total).toBe(6);
    expect(set2V11Run1.manual_review?.provenance_findings).toEqual(set2V11Run1.attribution_violations);

    // 2. Set 3, V12, Run 2: invented habit ("та, которой ты обычно стираешь со стола") when q3 is unknown
    const set3V12Run2 = evaluateMythRunProvenanceAndScores(
      {
        run_index: 2,
        title: "Мокрая губка",
        story:
          "Рядом с тобой лежит тяжёлая мокрая губка — та, которой ты обычно стираешь со стола, — но сейчас она просто лежит, разбухшая, тёмная, вобравшая в себя столько, что её края расплылись и потеряли форму.",
        mirror: {
          mainImage: "В вашем ответе звучит усталость.",
          innerTension: "В этой сцене губка лежит рядом.",
          hiddenResource: "В этой сцене стало возможно не сжимать её.",
          newView: "Что изменится, если позволить тишине просто стоять рядом?",
        },
        meaning: ["А", "Б", "В?"],
        one_step: "Оставьте телефон на пятнадцать минут.",
        journal_question: "Где в теле станет тише?",
        quality: { passed: true, blockers: [], word_count: 350, paragraph_count: 4 },
      },
      MYTH_FIXED_6_SETS[2],
      "v12"
    );
    expect(set3V12Run2.provenance_clean).toBe(false);
    expect(set3V12Run2.attribution_violations[0]).toContain("invented_habit_in_story");
    expect(set3V12Run2.scores_out_of_8.total).toBe(6);

    // 3. Set 5: loss of "как будто" modality in mirror (without falsely matching "дальний берег" in mainImage)
    const set5LostModality = evaluateMythRunProvenanceAndScores(
      {
        run_index: 1,
        title: "Натяжение над водой",
        story: "Ты стоишь на краю берега перед туго натянутой переправой.",
        mirror: {
          mainImage:
            "В вашем ответе канатная переправа натянута над быстрой рекой. В этой сцене вы стоите на краю настила, чувствуете холод металла и гул тросов, а затем переносите взгляд вдоль каната на дальний берег.",
          innerTension:
            "Вы замечаете, что провисание троса — это запас, а не слабость. В вашем ответе есть и просьба взять ещё один отдел, и ощущение рассвета у моря. Как эти две вещи могут встретиться в одном шаге?",
          hiddenResource: "В этой сцене стало возможно почувствовать ветер.",
          newView:
            "Если в вашем ответе переправа натянута туго, а живым вы называете ветер на рассвете у моря, то, может быть, устойчивость приходит не от того, что вы крепче держитесь, а от того, что вы позволяете себе провисать в середине? Что для вас значит этот запас?",
        },
        meaning: ["А", "Б", "В?"],
        one_step: "Сделайте глубокий вдох у окна.",
        journal_question: "Что даёт простор?",
        quality: { passed: true, blockers: [], word_count: 350, paragraph_count: 4 },
      },
      MYTH_FIXED_6_SETS[4],
      "v11"
    );
    expect(set5LostModality.as_if_modality_preserved).toBe(false);
    expect(set5LostModality.imagined_scene_as_if_preserved).toBe(false);
    expect(set5LostModality.provenance_clean).toBe(false);
    expect(set5LostModality.attribution_violations[0]).toContain("imagined_scene_modality_lost_in_mirror");
    expect(set5LostModality.attribution_violations[0]).toContain("ощущение рассвета у моря");
    expect(set5LostModality.attribution_violations[0]).not.toContain("на дальний берег");
    expect(set5LostModality.scores_out_of_8.total).toBe(7);

    // 4. Verify manual corpus summary totals across all 24 entries
    const entries = Object.entries(MANUAL_24_RUN_AUDIT);
    for (const [, entry] of entries) {
      expect(typeof entry.clarity).toBe("number");
      expect(typeof entry.concreteness).toBe("number");
      expect(typeof entry.connection_to_input).toBe("number");
      expect(typeof entry.reflection_utility).toBe("number");
      expect(entry.total).toBe(
        entry.clarity + entry.concreteness + entry.connection_to_input + entry.reflection_utility
      );
      expect(Array.isArray(entry.provenance_findings)).toBe(true);
      expect(typeof entry.rationale).toBe("string");
      expect(entry.rationale.length).toBeGreaterThan(20);
    }
    const v11Entries = entries.filter(([k]) => k.includes("__v11__")).map(([, v]) => v);
    const v12Entries = entries.filter(([k]) => k.includes("__v12__")).map(([, v]) => v);
    expect(v11Entries.filter((e) => e.provenance_clean)).toHaveLength(7);
    expect(v12Entries.filter((e) => e.provenance_clean)).toHaveLength(6);
    expect(v11Entries.reduce((s, e) => s + e.scores_out_of_8.total, 0)).toBe(89);
    expect(v12Entries.reduce((s, e) => s + e.scores_out_of_8.total, 0)).toBe(86);
  });
});
