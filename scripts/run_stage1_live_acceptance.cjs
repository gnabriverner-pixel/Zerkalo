#!/usr/bin/env node
const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { chromium, expect } = require("@playwright/test");

const webRoot = path.resolve(__dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  let outDirArg = "";
  let dcsRootArg = "";
  let webPort = Number(process.env.PORT || process.env.STAGE1_WEB_PORT || 3018);
  let dcsPort = Number(process.env.DCS_PORT || process.env.STAGE1_DCS_PORT || 39500);
  let allowDirty = false;

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if ((a === "--OutputDir" || a === "--out-dir" || a === "--output-dir") && args[i + 1]) {
      outDirArg = path.resolve(args[i + 1]);
      i += 1;
    } else if (a === "--dcs-root" && args[i + 1]) {
      dcsRootArg = path.resolve(args[i + 1]);
      i += 1;
    } else if ((a === "--web-port" || a === "--port") && args[i + 1]) {
      webPort = Number(args[i + 1]);
      i += 1;
    } else if (a === "--dcs-port" && args[i + 1]) {
      dcsPort = Number(args[i + 1]);
      i += 1;
    } else if (a === "--allow-dirty") {
      allowDirty = true;
    }
  }
  return { outDirArg, dcsRootArg, webPort, dcsPort, allowDirty };
}

function git(cwd, ...gitArgs) {
  return execFileSync("git", gitArgs, { cwd, encoding: "utf8" }).trim();
}

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
  return { status: response.status, ok: response.ok, body: await response.json().catch(() => null) };
}

const synthetic = {
  dob: "06.05.1986",
  answers: [
    "Я готовлю небольшой творческий проект и откладываю показ первой версии, потому что хочу довести каждую деталь.",
    "Это похоже на комнату с большим окном: на столе лежат разные эскизы, и мне трудно выбрать один.",
    "Вчера я сделал один простой набросок без исправлений и почувствовал интерес и спокойствие.",
    "Хочу позволить себе показать незавершённую работу и услышать отклик, сохранив свой замысел.",
  ],
  question: "Я не согласен, что мне всегда трудно выбирать. В знакомых задачах я решаю быстро. Помоги уточнить гипотезу.",
  note: "В знакомых задачах я решаю быстро; хочу проверить, где пауза действительно полезна.",
};

async function ensurePairRunning({ dcsRoot, webPort, dcsPort, actualWebSha, actualDcsSha, allowDirty }) {
  const webUrl = `http://127.0.0.1:${webPort}`;
  const dcsUrl = `http://127.0.0.1:${dcsPort}`;
  try {
    const [wh, dh] = await Promise.all([getJson(`${webUrl}/health`), getJson(`${dcsUrl}/health`)]);
    if (wh.ok && dh.ok && wh.body?.release_sha === actualWebSha && dh.body?.sha === actualDcsSha) {
      return { managedProc: null, webUrl, dcsUrl };
    }
  } catch {}

  const pairArgs = [
    path.join(__dirname, "run_stage1_pair.cjs"),
    "--dcs-root",
    dcsRoot,
    "--web-port",
    String(webPort),
    "--dcs-port",
    String(dcsPort),
  ];
  if (allowDirty) pairArgs.push("--allow-dirty");

  const managedProc = spawn(process.execPath, pairArgs, {
    cwd: webRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for run_stage1_pair.cjs to boot")), 25000);
    let logBuf = "";
    managedProc.stdout.on("data", (chunk) => {
      logBuf += chunk.toString();
      if (logBuf.includes("PAIR_RUNNING")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    managedProc.stderr.on("data", (chunk) => {
      logBuf += chunk.toString();
    });
    managedProc.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`run_stage1_pair.cjs exited early (${code}): ${logBuf.slice(-500)}`));
    });
  });

  return { managedProc, webUrl, dcsUrl };
}

async function main() {
  const { outDirArg, dcsRootArg, webPort, dcsPort, allowDirty } = parseArgs();
  const outDir =
    outDirArg ||
    path.resolve(process.env.STAGE1_EVIDENCE_DIR || path.join(webRoot, "../../outputs/convergence-evidence/live-run"));
  fs.mkdirSync(outDir, { recursive: true });

  const dcsRoot = dcsRootArg || process.env.DCS_ROOT || path.resolve(webRoot, "../dcs-canonical-732");
  const actualWebSha = git(webRoot, "rev-parse", "HEAD");
  const actualDcsSha = git(dcsRoot, "rev-parse", "HEAD");
  const webDirty = git(webRoot, "status", "--porcelain") !== "";
  const dcsDirty = git(dcsRoot, "status", "--porcelain") !== "";

  if (!allowDirty && (webDirty || dcsDirty)) {
    throw new Error(`dirty_tree_rejected: webDirty=${webDirty} dcsDirty=${dcsDirty}`);
  }

  const startedAt = new Date().toISOString();
  const { managedProc, webUrl, dcsUrl } = await ensurePairRunning({
    dcsRoot,
    webPort,
    dcsPort,
    actualWebSha,
    actualDcsSha,
    allowDirty,
  });

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.route("https://t.me/**", (route) => route.abort());
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const apiCalls = [];
  const steps = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("response", async (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/health")) {
      let body = null;
      try {
        body = await response.json();
      } catch {}
      apiCalls.push({
        method: response.request().method(),
        path: url.pathname,
        status: response.status(),
        code: body?.code || body?.error_code || body?.error || null,
        request_id: body?.request_id || null,
        downstream_status: body?.diagnostic?.downstream_status ?? body?.downstream_status ?? null,
        downstream_error: body?.diagnostic?.downstream_error ?? body?.downstream_code ?? null,
        provider_outcome: body?.diagnostic?.provider_outcome ?? body?.provider_outcome ?? null,
        provider: body?.provider || null,
        model: body?.model || null,
      });
    }
  });

  const shot = async (name) => {
    const file = path.join(outDir, `${name}.png`);
    await page.screenshot({ path: file, animations: "disabled" });
    return file;
  };

  let stage = "sha_identity_verification";
  let readyBefore = null;
  let readyAfterMyth = null;
  let readyAfter = null;

  try {
    const webHealth = await getJson(`${webUrl}/health`);
    const dcsHealth = await getJson(`${dcsUrl}/health`);
    readyBefore = await getJson(`${webUrl}/health/ready`);

    if (webHealth.body?.release_sha !== actualWebSha || dcsHealth.body?.sha !== actualDcsSha) {
      throw new Error(
        `served_sha_mismatch: web=${webHealth.body?.release_sha}/${actualWebSha} dcs=${dcsHealth.body?.sha}/${actualDcsSha}`
      );
    }
    if (!readyBefore.body?.canonical_bridge?.verified || readyBefore.body?.canonical_bridge?.actual_sha !== actualDcsSha) {
      throw new Error("canonical_bridge_unverified");
    }
    if ("url" in (readyBefore.body?.canonical_bridge || {})) {
      throw new Error("internal_bridge_url_leaked_in_health_ready");
    }
    steps.push({
      name: "pair_sha_identity",
      status: "PASS",
      web_sha: actualWebSha,
      dcs_sha: actualDcsSha,
      web_dirty: webDirty,
      dcs_dirty: dcsDirty,
      transport_ready: readyBefore.body.transport_ready,
      provider_configured: readyBefore.body.provider_configured,
    });

    // 1. Verify ?dob= in URL and restored session do NOT auto-POST
    stage = "url_dob_no_auto_post";
    const protectedPostsBeforeConsent = [];
    const postListener = (req) => {
      if (
        req.method() === "POST" &&
        ["/api/code-v2", "/api/calculate", "/api/personal-myth", "/api/meeting-of-mirrors", "/api/albert/dialogue"].some(
          (p) => req.url().endsWith(p)
        )
      ) {
        protectedPostsBeforeConsent.push(req.url());
      }
    };
    page.on("request", postListener);

    await page.goto(`${webUrl}/?preview=v2&dob=06.05.1986`, { waitUntil: "networkidle" });
    if (page.url().includes("dob=")) throw new Error("url_dob_not_sanitized");
    if (protectedPostsBeforeConsent.length > 0) throw new Error("auto_post_triggered_on_url_dob");

    // 2. Verify landing -> date entry -> consent modal unchecked -> decline preserves input and sends 0 POSTs
    stage = "consent_boundary_verification";
    await page.goto(`${webUrl}/`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Зеркало себя", exact: true }).waitFor();
    await shot("01-landing");

    const [day, month, year] = synthetic.dob.split(".");
    await page.getByPlaceholder("ДД", { exact: true }).fill(day);
    await page.getByPlaceholder("ММ", { exact: true }).fill(month);
    await page.getByPlaceholder("ГГГГ", { exact: true }).fill(year);
    await page.getByRole("button", { name: "Рассчитать код", exact: true }).click();
    await page.getByRole("button", { name: "Открыть мой Код", exact: true }).waitFor();
    if (protectedPostsBeforeConsent.length > 0) throw new Error("auto_post_before_consent_modal");

    await page.getByRole("button", { name: "Открыть мой Код", exact: true }).click();
    const consentDialog = page.getByRole("dialog", { name: "Ваш опыт остаётся вашим" });
    await consentDialog.waitFor();
    await expect(consentDialog.getByRole("checkbox")).not.toBeChecked();
    await expect(page.getByRole("button", { name: "Согласиться и продолжить" })).toBeDisabled();
    await shot("02-core-consent-unchecked");

    // Decline consent -> verify input preserved and 0 protected POSTs sent
    await page.getByRole("button", { name: "Сейчас не хочу" }).click();
    await expect(page.getByPlaceholder("ГГГГ", { exact: true })).toHaveValue(year);
    if (protectedPostsBeforeConsent.length > 0) throw new Error("protected_post_sent_after_decline");
    page.off("request", postListener);

    steps.push({
      name: "consent_and_no_auto_post_guards",
      status: "PASS",
      protected_posts_before_consent: protectedPostsBeforeConsent.length,
    });

    // 3. Accept consent and execute real canonical Code V2 calculation
    stage = "code_v2";
    await page.getByRole("button", { name: "Открыть мой Код", exact: true }).click();
    await consentDialog.waitFor();
    await consentDialog.getByRole("checkbox").check();
    const codeRespPromise = page.waitForResponse((r) => r.url().endsWith("/api/code-v2"), { timeout: 30000 });
    await page.getByRole("button", { name: "Согласиться и продолжить" }).click();
    const codeResp = await codeRespPromise;
    if (codeResp.status() !== 200) throw new Error(`code_v2_failed:${codeResp.status()}`);
    await page.getByRole("button", { name: "Перейти к Личному мифу" }).waitFor({ timeout: 30000 });
    await shot("03-code-v2");
    steps.push({ name: "code_v2", http: codeResp.status(), status: "ok" });

    // Check if RouterAI key is configured before attempting live LLM stages
    if (!readyBefore.body?.provider_configured) {
      // Also probe canonical DCS Albert diagnostic directly to verify diagnostic contract
      const diagResp = await page.evaluate(async () => {
        const r = await fetch("/api/albert/dialogue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "Проверка диагностики Альберта." }),
        });
        return { status: r.status, body: await r.json().catch(() => null) };
      });
      steps.push({
        name: "albert_unconfigured_guard",
        http: diagResp.status,
        code: diagResp.body?.code || null,
      });

      const result = {
        status: "BLOCKED_MISSING_LOCAL_ENV",
        reason: "work/zerkalo-current-main/.env with ROUTERAI_API_KEY is not present. Pair SHA identity, consent guards, no-auto-POST guards, and canonical Code V2 passed on the live Web+DCS pair; generative stages (Myth, Meeting, Albert) require ROUTERAI_API_KEY.",
        startedAt,
        finishedAt: new Date().toISOString(),
        web_sha: actualWebSha,
        dcs_sha: actualDcsSha,
        web_dirty: webDirty,
        dcs_dirty: dcsDirty,
        readyBefore: readyBefore.body,
        steps,
        apiCalls,
        consoleErrors,
        pageErrors,
      };
      fs.writeFileSync(path.join(outDir, "result.json"), JSON.stringify(result, null, 2));
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = 2;
      return;
    }

    // 4. Live Personal Myth
    stage = "personal_myth";
    await page.getByRole("button", { name: "Перейти к Личному мифу" }).click();
    await page.getByRole("button", { name: "Войти через образы", exact: true }).click();
    const tags = [
      "01 / 04 · Ситуация",
      "02 / 04 · Образ состояния",
      "03 / 04 · Точка живости",
      "04 / 04 · Искомое качество",
    ];
    for (let i = 0; i < synthetic.answers.length; i += 1) {
      await page.getByText(tags[i]).waitFor();
      await page.locator("textarea").fill(synthetic.answers[i]);
      const mythRespPromise =
        i === 3 ? page.waitForResponse((r) => r.url().endsWith("/api/personal-myth"), { timeout: 95000 }) : null;
      await page.getByRole("button", { name: i === 3 ? "Соткать историю" : "Далее", exact: true }).click();
      if (mythRespPromise) {
        const mythResp = await mythRespPromise;
        const mythJson = await mythResp.json().catch(() => ({}));
        if (mythResp.status() !== 200 || mythJson.status !== "ok") {
          throw new Error(`personal_myth_failed:${mythResp.status()}:${mythJson.code || "unknown"}`);
        }
        steps.push({ name: "personal_myth", http: mythResp.status(), status: mythJson.status, model: mythJson.model });
      }
    }
    await page.locator("article").waitFor({ timeout: 95000 });
    await shot("04-personal-myth");

    // Verify premature readiness does NOT happen after only Myth succeeds
    readyAfterMyth = await getJson(`${webUrl}/health/ready`);
    if (readyAfterMyth.status !== 503 || readyAfterMyth.body?.live_generation_verified_since_start === true) {
      throw new Error("premature_readiness_after_myth_only");
    }

    // 5. Live Meeting of Mirrors (strictly via canonical /api/meeting-of-mirrors)
    stage = "meeting_of_mirrors";
    await page.getByRole("button", { name: "Открыть Встречу зеркал", exact: true }).click();
    const meetingRespPromise = page.waitForResponse((r) => r.url().endsWith("/api/meeting-of-mirrors"), {
      timeout: 95000,
    });
    await page.getByRole("button", { name: "Провести Встречу зеркал", exact: true }).click();
    const meetingResp = await meetingRespPromise;
    const meetingJson = await meetingResp.json().catch(() => ({}));
    if (meetingResp.status() !== 200 || meetingJson.status !== "ok") {
      throw new Error(`meeting_failed:${meetingResp.status()}:${meetingJson.code || "unknown"}`);
    }
    await page.getByRole("button", { name: "Диалог на сайте", exact: true }).waitFor({ timeout: 95000 });
    await shot("05-meeting-of-mirrors");
    steps.push({ name: "meeting_of_mirrors", http: meetingResp.status(), status: meetingJson.status });

    // 6. Live Albert Dialogue via canonical DCS orchestrator
    stage = "albert_dialogue";
    await page.getByRole("button", { name: "Диалог на сайте", exact: true }).click();
    const albertInput = page.getByPlaceholder("Задайте вопрос Альберту о вашей карте и встрече зеркал...");
    await albertInput.waitFor();
    await albertInput.fill(synthetic.question);
    const albertRespPromise = page.waitForResponse((r) => r.url().endsWith("/api/albert/dialogue"), { timeout: 95000 });
    await albertInput.press("Enter");
    const albertResp = await albertRespPromise;
    const albertJson = await albertResp.json().catch(() => null);
    if (albertResp.status() !== 200 || albertJson?.status !== "ok" || !albertJson?.message?.trim()) {
      throw new Error(
        `albert_failed:${albertResp.status()}:${albertJson?.code || "unknown"}:${albertJson?.diagnostic?.downstream_error || ""}`
      );
    }
    await expect(page.getByText(albertJson.message, { exact: true })).toBeVisible();
    await shot("06-albert-dialogue");
    steps.push({
      name: "albert_dialogue",
      http: albertResp.status(),
      status: albertJson.status,
      provider: albertJson.provider,
      model: albertJson.model,
    });

    // Verify readiness is now 200 OK (all 3 generative stages passed on this pair)
    readyAfter = await getJson(`${webUrl}/health/ready`);
    if (readyAfter.status !== 200 || !readyAfter.body?.ready || !readyAfter.body?.live_generation_verified_since_start) {
      throw new Error(`final_readiness_not_200:${readyAfter.status}`);
    }

    // 7. Save distinction/note and reload continuity
    stage = "saved_distinction_and_reload";
    await page.getByRole("textbox", { name: "Моя мысль после разговора" }).fill(synthetic.note);
    await page.getByRole("button", { name: "Закрыть диалог" }).click();
    await page.getByRole("button", { name: "Сохранить на этом устройстве", exact: true }).click();
    await expect(page.getByText("Сохранено в этом браузере", { exact: true })).toBeVisible();
    await shot("07-saved-distinction");

    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Продолжить с того места", exact: true }).click();
    await expect(page.getByRole("button", { name: "Диалог на сайте", exact: true })).toBeVisible();
    await expect(
      page.getByPlaceholder("Что здесь похоже на ваш опыт, а что хочется уточнить или отвергнуть?")
    ).toHaveValue(synthetic.note);
    await shot("08-reload-restored");
    steps.push({ name: "saved_distinction_and_reload", status: "PASS" });

    const result = {
      status: "PASSED",
      startedAt,
      finishedAt: new Date().toISOString(),
      web_sha: actualWebSha,
      dcs_sha: actualDcsSha,
      web_dirty: webDirty,
      dcs_dirty: dcsDirty,
      readyBefore: readyBefore.body,
      readyAfterMyth: readyAfterMyth.body,
      readyAfter: readyAfter.body,
      steps,
      apiCalls,
      consoleErrors,
      pageErrors,
    };
    fs.writeFileSync(path.join(outDir, "result.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    await shot(`failed-${stage}`).catch(() => {});
    const result = {
      status: "FAILED",
      startedAt,
      finishedAt: new Date().toISOString(),
      failedStage: stage,
      error: String(err?.message || err),
      web_sha: actualWebSha,
      dcs_sha: actualDcsSha,
      readyBefore: readyBefore?.body || null,
      readyAfterMyth: readyAfterMyth?.body || null,
      readyAfter: readyAfter?.body || null,
      steps,
      apiCalls,
      consoleErrors,
      pageErrors,
    };
    fs.writeFileSync(path.join(outDir, "result.json"), JSON.stringify(result, null, 2));
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
    if (managedProc) {
      try {
        managedProc.kill("SIGTERM");
      } catch {}
    }
  }
}

main();
