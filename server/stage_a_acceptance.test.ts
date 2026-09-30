// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import fs from "node:fs";
import path from "node:path";
import {
  buildPreviousThreePartOpenerPrompt,
  buildShortJuxtapositionOpenerPrompt,
  buildMissingQuestionOpenerResponse,
  isAlbertNatureQuestion,
  ALBERT_AI_NATURE_DISCLOSURE_RESPONSE,
  buildCanonicalEnvelopeFromWebContext,
  sanitizeVisibleAlbertText,
  checkSafety,
  generateAlbertDialogue,
} from "./albert.ts";
import {
  computeSourceStateVersion,
  isShortJuxtapositionEnabled,
  loadAlbertConversation,
  saveAlbertConversation,
  clearAlbertConversation,
  isOpenerStale,
  isOpenerRequestInFlight,
  markOpenerRequestInFlight,
} from "../src/services/albertOpenerState.ts";
import {
  buildPersonalChapterSample,
  updatePersonalChapterSample,
  renderPersonalChapterSampleHtml,
  extractPersonalChapterSampleSections,
  savePersonalChapterSample,
  loadPersonalChapterSample,
  deletePersonalChapterSample,
  loadLaunchInterestRecord,
  deleteLaunchInterestRecord,
  PAID_CHAPTER_SAMPLE_STORAGE_KEY,
  PAID_LAUNCH_INTEREST_STORAGE_KEY,
  PERSONAL_CHAPTER_NINE_ITEMS,
  PERSONAL_CHAPTER_HONEST_LIMITATIONS,
  PERSONAL_CHAPTER_VOICE_PREVIEW,
} from "../src/services/personalChapterSample.ts";
import {
  generateChapterSamplePdfBuffer,
  handleRecordLaunchInterest,
} from "./chapterOffer.ts";
import { recordEvent, FORBIDDEN_ANALYTICS_KEYS } from "./analytics.ts";
import { PersonalChapterOfferModal } from "../src/components/PersonalChapterOfferModal.tsx";
import { AlbertDialogue } from "../src/components/AlbertDialogue.tsx";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

describe("Stage A Acceptance Gate (A1-A5)", () => {
  beforeEach(() => {
    clearAlbertConversation();
    deletePersonalChapterSample();
    deleteLaunchInterestRecord();
  });

  describe("A1: Focused 1-point opener, provenance separation & AI persona disclosure", () => {
    it("builds a focused 1-unresolved-point opener prompt starting with 'Что ' and ending with '?' without digits, while preserving previous 3-part prompt for comparison", () => {
      const promptWithMyth = buildShortJuxtapositionOpenerPrompt({
        userQuestion: "Стоит ли сейчас менять команду или сначала пересобрать роль?",
        codeCalculation: { soul: 2, expression: 7, path: 5, direction: 9, result: 5 } as any,
        mythAnchors: {
          title: "Мастерская у воды",
          mainImage: "Дверь мастерской приоткрыта к воде",
        },
      });

      expect(promptWithMyth.startsWith("Что ")).toBe(true);
      expect(promptWithMyth.endsWith("?")).toBe(true);
      expect(promptWithMyth).not.toMatch(/[0-9]/);
      expect(promptWithMyth).toContain("главным нерешённым моментом или различением относительно моего вопроса");
      expect(promptWithMyth).toContain("не пересказывай уже прочитанные результаты");
      expect(promptWithMyth).toContain("как будто");
      expect(promptWithMyth).toContain("один конкретный вопрос");

      const prevPrompt = buildPreviousThreePartOpenerPrompt({
        userQuestion: "Стоит ли сейчас менять команду или сначала пересобрать роль?",
        codeCalculation: { soul: 2, expression: 7, path: 5, direction: 9, result: 5 } as any,
        mythAnchors: {
          title: "Мастерская у воды",
          mainImage: "Дверь мастерской приоткрыта к воде",
        },
      });
      expect(prevPrompt).toContain("первое");
      expect(prevPrompt).toContain("второе");
      expect(prevPrompt).toContain("третье");

      const promptCodeOnly = buildShortJuxtapositionOpenerPrompt({
        userQuestion: "Как распределить силы на ближайший месяц?",
        codeCalculation: { soul: 4, expression: 1, path: 8, direction: 3, result: 7 } as any,
      });

      expect(promptCodeOnly.startsWith("Что ")).toBe(true);
      expect(promptCodeOnly.endsWith("?")).toBe(true);
      expect(promptCodeOnly).not.toMatch(/[0-9]/);
      expect(promptCodeOnly).toContain("Цифрового Кода");
    });

    it("invites the user to formulate a question first when no initial question is present, without calling DCS", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const res = await generateAlbertDialogue({
        actionType: "short_juxtaposition_opener",
        context: {
          codeCalculation: { soul: 6, expression: 2, path: 3, direction: 9, result: 9 } as any,
        },
      });
      expect(res.status).toBe("ok");
      expect(res.provider).toBe("albert_opener_guard");
      expect(res.response).toContain("исходный вопрос для разбора пока не указан");
      expect(res.response).toContain("между какими вариантами вы выбираете");
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it("answers direct questions about Albert's nature honestly without fictional human biography", async () => {
      expect(isAlbertNatureQuestion("Кто ты? Ты живой человек или ИИ?")).toBe(true);
      expect(isAlbertNatureQuestion("Расскажи про свою биографию, ты настоящий психолог?")).toBe(true);
      expect(isAlbertNatureQuestion("Как мне выбрать между двумя задачами?")).toBe(false);

      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const res = await generateAlbertDialogue({
        actionType: "user_message",
        message: "Скажи честно, ты живой человек или искусственный интеллект?",
        context: {
          userQuestion: "Как распределить время?",
        },
      });
      expect(res.status).toBe("ok");
      expect(res.provider).toBe("albert_identity_disclosure");
      expect(res.response).toBe(ALBERT_AI_NATURE_DISCLOSURE_RESPONSE);
      expect(res.response).toContain("ИИ-собеседник проекта «Зеркало»");
      expect(res.response).toContain("Имя «Альберт» и образ собеседника вымышлены");
      expect(res.response).toContain("у меня нет собственной биографии");
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it("passes storyInputs and all Myth mirror facets into SharedContextEnvelopeV1 without leaking q1-q4 or mainPattern", () => {
      const envelope = buildCanonicalEnvelopeFromWebContext({
        userQuestion: "Почему я откладываю запуск своего проекта?",
        mainPattern: "mainPattern: Стремление всё выверить заранее",
        codeCalculation: { soul: 7, expression: 4, path: 2, direction: 8, result: 3 } as any,
        storyInputs: {
          q1: "В моей сцене это как будто закрытая мастерская у воды",
          q2: "Ржавая щеколда на внутренней двери",
          q3: "Старый деревянный верстак",
          q4: "Спокойно открыть створку без ожидания идеальной погоды",
        },
        mythAnchors: {
          title: "Мастерская у тихой пристани",
          mainImage: "Закрытая мастерская у воды, где свет падает на верстак",
          innerTension: "Ожидание полной готовности удерживает руку на щеколде",
          hiddenResource: "Прочный верстак, выдерживающий первую пробу",
          newView: "Створку можно приоткрыть на один палец уже сегодня",
        },
      });

      const serialized = JSON.stringify(envelope);
      expect(serialized).not.toMatch(/\bmainPattern\b/i);
      expect(serialized).not.toMatch(/\bq[1-4]\b/i);
      expect(serialized).not.toMatch(/\bcodeAnchor\b/i);
      expect(serialized).not.toMatch(/\bmythAnchor\b/i);
      expect(serialized).not.toContain("Заминка или трещина");
      expect(serialized).toContain("Образ состояния");

      // Must preserve "как будто" modality from user's own storyInputs
      expect(serialized).toContain("как будто закрытая мастерская у воды");

      // Must NOT manufacture a completed Meeting summary when Meeting was not run
      expect(envelope.experience_state.meeting_summary).toBeNull();

      // Must include all Myth mirror facets with explicit source: "myth"
      const mythEvidence = envelope.evidence.filter((e: any) => e.source === "myth");
      expect(mythEvidence.length).toBeGreaterThanOrEqual(5);
    });

    it("sanitizes visible Albert text from internal field and schema names", () => {
      const dirty =
        "В вашем mainPattern и в ответе q2 (а также q1, q3, q4) виден codeAnchor и mythAnchor.";
      const clean = sanitizeVisibleAlbertText(dirty);
      expect(clean).not.toMatch(/\bmainPattern\b/i);
      expect(clean).not.toMatch(/\bq[1-4]\b/i);
      expect(clean).not.toMatch(/\bcodeAnchor\b/i);
      expect(clean).not.toMatch(/\bmythAnchor\b/i);
    });
  });

  describe("A2: Data preservation, deduplication, stale state detection & crisis intercept", () => {
    it("computes deterministic sourceStateVersion and marks opener stale when question, codeReactions, myth step, or note changes", () => {
      const baseInput = {
        codeDate: "14.08.1988",
        codeResult: { soul: 5, expression: 9, path: 4, direction: 9, result: 9 } as any,
        codeReactions: { central_motif: "confirmed" as const },
        storyInputs: { q1: "Кабинет", q2: "Туман", q3: "Лампа", q4: "Ясность" },
        storyResult: {
          title: "Свет лампы",
          story: "Текст мифа",
          mirror: {
            mainImage: "Лампа на столе",
            innerTension: "Туман за окном",
            hiddenResource: "Тёплый свет",
            newView: "Виден край стола",
          },
          meaning: [],
          one_step: "Включить лампу",
          journal_question: "Что освещает лампа?",
          disclaimer: "Художественный миф",
        },
        userQuestion: "Как выбрать одну задачу?",
        userNote: "Первая заметка",
      };

      const v1 = computeSourceStateVersion(baseInput);
      const v1Repeat = computeSourceStateVersion({ ...baseInput });
      expect(v1).toBe(v1Repeat);
      expect(v1).toMatch(/^v1_[0-9a-f]{8}$/);

      saveAlbertConversation({
        version: 1,
        sourceStateVersion: v1,
        messages: [{ id: "m1", sender: "albert", text: "Короткое сопоставление", timestamp: new Date() }],
        openerRecord: {
          version: 1,
          sourceStateVersion: v1,
          openerText: "Короткое сопоставление",
          createdAt: new Date().toISOString(),
          lensesUsed: { hasCode: true, hasMyth: true, hasQuestion: true },
        },
        updatedAt: new Date().toISOString(),
      });

      const loaded = loadAlbertConversation();
      expect(loaded).not.toBeNull();
      expect(isOpenerStale(loaded, v1)).toBe(false);
      expect(isOpenerStale(loaded, baseInput)).toBe(false);

      // 1. Change user question -> version changes -> opener is marked stale
      const vQuestionChanged = computeSourceStateVersion({
        ...baseInput,
        userQuestion: "Другой вопрос: стоит ли переезжать?",
      });
      expect(vQuestionChanged).not.toBe(v1);
      expect(isOpenerStale(loaded, vQuestionChanged)).toBe(true);

      // 2. Change codeReactions ("Похоже" -> "Не похоже" or new position reaction) -> version changes -> opener is marked stale
      const vReactionRejected = computeSourceStateVersion({
        ...baseInput,
        codeReactions: { central_motif: "rejected" },
      });
      expect(vReactionRejected).not.toBe(v1);
      expect(isOpenerStale(loaded, vReactionRejected)).toBe(true);

      const vPositionReactionAdded = computeSourceStateVersion({
        ...baseInput,
        codeReactions: { central_motif: "confirmed", soul: "rejected" },
      });
      expect(vPositionReactionAdded).not.toBe(v1);
      expect(isOpenerStale(loaded, vPositionReactionAdded)).toBe(true);

      // 3. Change Myth step (storyResult.one_step / mythAnchors.oneStep) -> version changes -> opener is marked stale
      const vMythStepChanged = computeSourceStateVersion({
        ...baseInput,
        storyResult: {
          ...baseInput.storyResult,
          one_step: "Открыть окно и убрать лишние бумаги со стола",
        },
      });
      expect(vMythStepChanged).not.toBe(v1);
      expect(isOpenerStale(loaded, vMythStepChanged)).toBe(true);

      // 4. Change userNote or mainPattern -> version changes -> opener is marked stale
      const vNoteChanged = computeSourceStateVersion({
        ...baseInput,
        userNote: "Обновлённая заметка после размышления",
      });
      expect(vNoteChanged).not.toBe(v1);
      expect(isOpenerStale(loaded, vNoteChanged)).toBe(true);
    });

    it("renders stale banner in AlbertDialogue when codeReactions changes without auto-sending a network request", async () => {
      const calc = { soul: 5, expression: 9, path: 4, direction: 9, result: 9 } as any;
      const initialVersion = computeSourceStateVersion({
        codeDate: "14.08.1988",
        codeResult: calc,
        codeReactions: { central_motif: "confirmed" },
        userQuestion: "Как распределить внимание?",
      });

      saveAlbertConversation({
        version: 1,
        sourceStateVersion: initialVersion,
        messages: [
          {
            id: "opener_1",
            sender: "albert",
            text: "Прежнее сопоставление по вашему вопросу.",
            timestamp: new Date(),
            isOpener: true,
            sourceStateVersion: initialVersion,
          },
        ],
        openerRecord: {
          version: 1,
          sourceStateVersion: initialVersion,
          openerText: "Прежнее сопоставление по вашему вопросу.",
          createdAt: new Date().toISOString(),
          lensesUsed: { hasCode: true, hasMyth: false, hasQuestion: true },
        },
        updatedAt: new Date().toISOString(),
      });

      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(
          React.createElement(AlbertDialogue, {
            isOpen: true,
            codeDate: "14.08.1988",
            calc,
            codeReactions: { central_motif: "rejected" },
            userQuestion: "Как распределить внимание?",
          })
        );
      });

      const staleBanner = container.querySelector('[data-testid="albert-stale-state-banner"]');
      const refreshBtn = container.querySelector('[data-testid="albert-refresh-stale-opener-btn"]');
      expect(staleBanner).not.toBeNull();
      expect(refreshBtn).not.toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();

      await act(async () => {
        root.unmount();
      });
      container.remove();
      fetchSpy.mockRestore();
    });

    it("prevents duplicate in-flight opener requests for the same sourceStateVersion", () => {
      const version = "v1_deadbeef";
      expect(isOpenerRequestInFlight(version)).toBe(false);
      markOpenerRequestInFlight(version, true);
      expect(isOpenerRequestInFlight(version)).toBe(true);
      markOpenerRequestInFlight(version, false);
      expect(isOpenerRequestInFlight(version)).toBe(false);
    });

    it("intercepts crisis signals before calling DCS and suppresses commercial offer", async () => {
      const crisisCheck = checkSafety({
        message: "Что это значит?",
        context: {
          userQuestion: "Я не хочу жить, хочу покончить с собой",
        },
      });
      expect(crisisCheck.isCrisis).toBe(true);

      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const result = await generateAlbertDialogue({
        actionType: "short_juxtaposition_opener",
        context: {
          userQuestion: "Я не хочу жить, хочу покончить с собой",
        },
      });

      expect(result.status).toBe("crisis");
      expect(result.isCrisis).toBe(true);
      expect(result.suppressCommercialOffer).toBe(true);
      expect(result.response).toContain("112");
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });

  describe("A3: Typography (20px / 1.6), AI persona disclosure & unambiguous main route", () => {
    it("enforces 20px font size and 1.6 line-height on Albert responses, renders AI disclosure before first message, and keeps legacy Meeting behind comparison mode", async () => {
      const albertComponentSource = fs.readFileSync(
        path.resolve(process.cwd(), "src/components/AlbertDialogue.tsx"),
        "utf8"
      );
      expect(albertComponentSource).toContain("albert-message-text");
      expect(albertComponentSource).toContain("text-[20px] leading-[1.6]");
      expect(albertComponentSource).toContain("fontSize: msg.sender === 'albert' ? '20px'");
      expect(albertComponentSource).toContain("lineHeight: msg.sender === 'albert' ? 1.6");
      expect(albertComponentSource).toContain('data-testid="albert-header-title"');
      expect(albertComponentSource).toContain("Альберт · ИИ-собеседник");
      expect(albertComponentSource).toContain('data-testid="albert-ai-disclosure"');
      expect(albertComponentSource).toContain(
        "Альберт — ИИ-собеседник «Зеркала». Имя и образ вымышлены; ваши смыслы остаются вашими."
      );
      expect(albertComponentSource).toContain('data-testid="albert-stale-state-banner"');
      expect(albertComponentSource).toContain('data-testid="albert-refresh-stale-opener-btn"');
      expect(albertComponentSource).toContain('data-testid="albert-retry-btn"');
      expect(albertComponentSource).toContain('data-testid="albert-crisis-banner"');
      expect(albertComponentSource).toContain('data-testid="albert-conclusion-panel"');

      // Render AlbertDialogue before any message is sent and verify disclosure is visible without a mandatory modal
      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      await act(async () => {
        root.render(
          React.createElement(AlbertDialogue, {
            isOpen: true,
            userQuestion: "Какой шаг сделать первым?",
          })
        );
      });
      const headerTitle = container.querySelector('[data-testid="albert-header-title"]');
      const aiDisclosure = container.querySelector('[data-testid="albert-ai-disclosure"]');
      expect(headerTitle?.textContent).toContain("Альберт · ИИ-собеседник");
      expect(aiDisclosure?.textContent).toContain(
        "Альберт — ИИ-собеседник «Зеркала». Имя и образ вымышлены; ваши смыслы остаются вашими."
      );
      await act(async () => {
        root.unmount();
      });
      container.remove();

      const mythComponentSource = fs.readFileSync(
        path.resolve(process.cwd(), "src/components/PersonalMyth.tsx"),
        "utf8"
      );
      expect(mythComponentSource).toContain("Что это значит для моего вопроса?");
      expect(mythComponentSource).toContain('data-testid="myth-to-albert-juxtaposition-btn"');
      expect(mythComponentSource).toContain('data-testid="myth-return-to-code-btn"');
      expect(mythComponentSource).toContain('data-testid="legacy-meeting-comparison-banner"');

      const meetingComponentSource = fs.readFileSync(
        path.resolve(process.cwd(), "src/components/MeetingOfMirrors.tsx"),
        "utf8"
      );
      expect(meetingComponentSource).toContain('data-testid="meeting-open-albert-juxtaposition-btn"');
      expect(meetingComponentSource).toContain('data-testid="legacy-meeting-comparison-banner"');
      expect(isShortJuxtapositionEnabled()).toBe(true);
    });
  });

  describe("A4: Personal Chapter Sample (6 parts, single source Web+PDF, Unicode font & PDF failure path)", () => {
    it("builds all 6 mandatory parts, embeds Unicode Cyrillic TrueType font in PDF without mojibake, and excludes rejected statements", async () => {
      const rejectedMachineClaim = "Система считает, что вы боитесь публичной ответственности.";
      const initialSample = buildPersonalChapterSample({
        sourceStateVersion: "v1_12345678",
        userQuestion: "Как перестать распыляться между тремя проектами?",
        stance: "rejected",
        systemHypothesis: rejectedMachineClaim,
        userOwnPhrase: "Дело не в страхе ответственности, а в том, что два проекта уже потеряли смысл.",
        chosenStepOrQuestion: "В понедельник закрыть один устаревший проект и зафиксировать реакцию.",
        storyResult: {
          title: "Мост через тихую реку",
          story: "Художественная сцена о мосте...",
          mirror: {
            mainImage: "Каменный мост с тремя фонарями, из которых горит только один",
            innerTension: "Попытка нести три связки ключей одновременно",
            hiddenResource: "Опора на центральный пролёт моста",
            newView: "Оставить только ту связку, которая открывает живую мастерскую",
          },
          meaning: [],
          one_step: "Отложить две лишние связки",
          journal_question: "Какая связка открывает мастерскую?",
          disclaimer: "Художественный миф",
        },
      });

      // 1. Verify 6 mandatory sections exist
      const sections = extractPersonalChapterSampleSections(initialSample);
      expect(sections).toHaveLength(6);
      expect(initialSample.sampleStatusLabel).toBe("Персональный образец будущей главы");
      expect(initialSample.isPaidProductComplete).toBe(false);
      expect(initialSample.mythImage.explicitLabel).toContain("художественная сцена");

      // 2. Verify rejected machine claim is recorded in rejectedStatements and absent from visible sections
      expect(initialSample.rejectedStatements).toContain(rejectedMachineClaim);
      expect(initialSample.usefulDistinctions.join(" ")).not.toContain(rejectedMachineClaim);
      expect(initialSample.userOwnPhrase).toContain("два проекта уже потеряли смысл");

      // 3. Even if updated later with stance='confirmed' and the same rejected statement is passed, it never returns
      const updatedSample = updatePersonalChapterSample(initialSample, {
        stance: "confirmed",
        usefulDistinctions: [
          rejectedMachineClaim,
          "Различать живую задачу и инерцию старого обязательства.",
        ],
        userNote: "Проверил через два дня: закрытие старого проекта освободило утро.",
      });
      expect(updatedSample.usefulDistinctions.join(" ")).not.toContain(rejectedMachineClaim);
      expect(updatedSample.usefulDistinctions).toContain(
        "Различать живую задачу и инерцию старого обязательства."
      );
      expect(updatedSample.subsequentNoteSpace.userNote).toContain("освободило утро");

      // 4. Verify Web HTML and PDF buffer are generated from the exact same PersonalChapterSampleV1
      const html = renderPersonalChapterSampleHtml(updatedSample);
      expect(html).toContain("Персональный образец будущей главы");
      expect(html).toContain(updatedSample.currentQuestion);
      expect(html).toContain(updatedSample.userOwnPhrase);
      expect(html).toContain("Различать живую задачу и инерцию старого обязательства.");
      expect(html).toContain(updatedSample.mythImage.imageText);
      expect(html).toContain(updatedSample.chosenStepOrQuestion);
      expect(html).toContain("освободило утро");
      expect(html).not.toContain(rejectedMachineClaim);
      expect(html).not.toContain("26.05.1976");
      expect(html).not.toContain("Марианна");

      const pdfBuffer = await generateChapterSamplePdfBuffer(updatedSample);
      const pdfLatin1 = pdfBuffer.toString("latin1");
      expect(pdfBuffer.subarray(0, 8).toString("latin1")).toContain("%PDF-1.4");
      // Must embed TrueType Unicode font (Lora) with Identity-H and ToUnicode cmap, never raw UTF-16BE \xfe\xff strings in Type1 Helvetica
      expect(pdfLatin1).toContain("/BaseFont /Lora");
      expect(pdfLatin1).toContain("/Identity-H");
      expect(pdfLatin1).toContain("/ToUnicode");
      expect(pdfLatin1).not.toContain("(\xfe\xff");
      // Must fit all 6 sections and footer on a single page (/Count 1), never spilling the footer onto page 2
      expect(pdfLatin1).toMatch(/\/Type\s*\/Pages[\s\S]*?\/Count\s+1\b/);

      const pdfText = pdfBuffer.toString("utf8");
      expect(pdfText).toContain(updatedSample.sampleId);
      expect(pdfText).toContain(updatedSample.sourceStateVersion);
      expect(pdfText).toContain(updatedSample.currentQuestion);
      expect(pdfText).toContain(updatedSample.userOwnPhrase);
      expect(pdfText).not.toContain(rejectedMachineClaim);
      expect(pdfText).not.toContain("26.05.1976");
    });

    it("shows explicit PDF export error + retry on API failure without downloading HTML as .pdf or showing false success", async () => {
      const sample = buildPersonalChapterSample({
        sourceStateVersion: "v1_pdf_err_1",
        userQuestion: "Как сохранить ясность при смене приоритетов?",
        stance: "confirmed",
        systemHypothesis: "Опираться на одно ключевое решение в день.",
        userOwnPhrase: "Сначала закрываю главный вопрос утра.",
      });
      const validPdfBytes = await generateChapterSamplePdfBuffer(sample);

      let shouldFailPdf = true;
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input: any) => {
        const url = typeof input === "string" ? input : input?.url || "";
        if (url.includes("/api/chapter-sample/pdf")) {
          if (shouldFailPdf) {
            return new Response(JSON.stringify({ error: "pdf_render_failed" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(new Uint8Array(validPdfBytes), {
            status: 200,
            headers: { "Content-Type": "application/pdf" },
          });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      });

      const createObjectURLSpy = vi
        .spyOn(URL, "createObjectURL")
        .mockReturnValue("blob:http://localhost/real-pdf");
      const revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(
          React.createElement(PersonalChapterOfferModal, {
            isOpen: true,
            onClose: () => {},
            sourceStateVersion: sample.sourceStateVersion,
            userQuestion: sample.currentQuestion,
            stance: "confirmed",
            systemHypothesis: "Опираться на одно ключевое решение в день.",
            userOwnPhrase: sample.userOwnPhrase,
          })
        );
      });

      const downloadBtn = container.querySelector(
        '[data-testid="download-sample-pdf-btn"]'
      ) as HTMLButtonElement;
      expect(downloadBtn).not.toBeNull();

      // 1. Trigger PDF download when API returns 500 -> must show error + retry, NEVER false success or blob download
      await act(async () => {
        downloadBtn.click();
      });

      expect(container.querySelector('[data-testid="sample-pdf-export-error"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="retry-sample-pdf-btn"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="sample-pdf-export-status"]')).toBeNull();
      expect(createObjectURLSpy).not.toHaveBeenCalled();

      // 2. Retry when API succeeds -> error clears, real PDF blob is downloaded, and success status is shown
      shouldFailPdf = false;
      const retryBtn = container.querySelector(
        '[data-testid="retry-sample-pdf-btn"]'
      ) as HTMLButtonElement;
      await act(async () => {
        retryBtn.click();
      });

      expect(container.querySelector('[data-testid="sample-pdf-export-error"]')).toBeNull();
      expect(container.querySelector('[data-testid="sample-pdf-export-status"]')).not.toBeNull();
      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);

      await act(async () => {
        root.unmount();
      });
      container.remove();
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
      fetchSpy.mockRestore();
    });
  });

  describe("A5: Full package offer ('Личная глава' — 4 900 ₽), separate storage, analytics privacy & launch interest failure path", () => {
    it("exposes the single 'Личная глава' 4 900 ₽ offer with 9 items, voice sample preview, and explicit non-promises", () => {
      expect(PERSONAL_CHAPTER_NINE_ITEMS).toHaveLength(9);
      expect(PERSONAL_CHAPTER_NINE_ITEMS.join(" ")).toContain("12 месяцев");
      expect(PERSONAL_CHAPTER_NINE_ITEMS.join(" ")).toContain("До 2 обновлений редакции");
      expect(PERSONAL_CHAPTER_NINE_ITEMS.join(" ")).toContain("1 день, 30 дней и 90 дней");

      expect(PERSONAL_CHAPTER_VOICE_PREVIEW.title).toBeTruthy();
      expect(PERSONAL_CHAPTER_VOICE_PREVIEW.transcript.length).toBeGreaterThanOrEqual(3);

      expect(PERSONAL_CHAPTER_HONEST_LIMITATIONS.length).toBeGreaterThanOrEqual(4);
      expect(PERSONAL_CHAPTER_HONEST_LIMITATIONS.join(" ")).toContain("безлимитный чат");
      expect(PERSONAL_CHAPTER_HONEST_LIMITATIONS.join(" ")).toContain("подпиской");
    });

    it("shows explicit error + retry on /api/launch-interest failure without fake local confirmation, preserving user input", async () => {
      let shouldFailInterest = true;
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input: any) => {
        const url = typeof input === "string" ? input : input?.url || "";
        if (url.includes("/api/launch-interest")) {
          if (shouldFailInterest) {
            return new Response(JSON.stringify({ error: "launch_interest_failed" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(
            JSON.stringify({
              status: "ok",
              record: {
                schemaVersion: "launch_interest.v1",
                interestId: "li_server_verified_1",
                createdAt: new Date().toISOString(),
                sampleId: "sample_test_1",
                sourceStateVersion: "v1_interest_1",
                productCode: "personal_chapter_single",
                productTitle: "Личная глава",
                displayedPriceRub: 4900,
                actionKind: "launch_interest_only",
                isPaymentOrPreorder: false,
                preferredChannel: "telegram",
                contactOrNote: "@kept_user_input",
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      });

      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(
          React.createElement(PersonalChapterOfferModal, {
            isOpen: true,
            onClose: () => {},
            sourceStateVersion: "v1_interest_1",
            userQuestion: "Вопрос для проверки интереса к запуску",
            stance: "confirmed",
            systemHypothesis: "Гипотеза системы",
            userOwnPhrase: "Фраза человека",
          })
        );
      });

      const telegramChannelBtn = container.querySelector(
        '[data-testid="interest-channel-telegram"]'
      ) as HTMLButtonElement;
      const contactInput = container.querySelector(
        '[data-testid="launch-interest-note-input"]'
      ) as HTMLInputElement;
      const submitBtn = container.querySelector(
        '[data-testid="submit-launch-interest-btn"]'
      ) as HTMLButtonElement;

      await act(async () => {
        telegramChannelBtn.click();
      });
      await act(async () => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        nativeInputValueSetter?.call(contactInput, "@kept_user_input");
        contactInput.dispatchEvent(new Event("input", { bubbles: true }));
        contactInput.dispatchEvent(new Event("change", { bubbles: true }));
      });

      // 1. Submit when /api/launch-interest fails with 500 -> must show error + retry, NEVER confirmed, and preserve input
      await act(async () => {
        submitBtn.click();
      });

      expect(container.querySelector('[data-testid="launch-interest-error"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="retry-launch-interest-btn"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="launch-interest-confirmed"]')).toBeNull();
      expect(loadLaunchInterestRecord()).toBeNull();
      expect(
        (container.querySelector('[data-testid="launch-interest-note-input"]') as HTMLInputElement)
          ?.value
      ).toBe("@kept_user_input");

      // 2. Retry when /api/launch-interest succeeds -> error clears, confirmed block appears, server record saved
      shouldFailInterest = false;
      const retryInterestBtn = container.querySelector(
        '[data-testid="retry-launch-interest-btn"]'
      ) as HTMLButtonElement;
      await act(async () => {
        retryInterestBtn.click();
      });

      expect(container.querySelector('[data-testid="launch-interest-error"]')).toBeNull();
      expect(container.querySelector('[data-testid="launch-interest-confirmed"]')).not.toBeNull();
      expect(loadLaunchInterestRecord()?.interestId).toBe("li_server_verified_1");

      await act(async () => {
        root.unmount();
      });
      container.remove();
      fetchSpy.mockRestore();
    });

    it("stores paid sample and launch interest separately from free session and enforces analytics privacy", async () => {
      expect(PAID_CHAPTER_SAMPLE_STORAGE_KEY).toBe("zerkalo.paid.chapterSample.v1");
      expect(PAID_LAUNCH_INTEREST_STORAGE_KEY).toBe("zerkalo.paid.launchInterest.v1");

      const sample = buildPersonalChapterSample({
        sourceStateVersion: "v1_abcdef01",
        userQuestion: "Секретный личный вопрос человека",
        stance: "confirmed",
        systemHypothesis: "Гипотеза системы",
        userOwnPhrase: "Секретная фраза человека",
      });
      savePersonalChapterSample(sample);
      expect(loadPersonalChapterSample()?.sampleId).toBe(sample.sampleId);

      const req: any = {
        body: {
          sampleId: sample.sampleId,
          sourceStateVersion: sample.sourceStateVersion,
          preferredChannel: "telegram",
          contactOrNote: "@secret_user_handle",
        },
      };
      let statusCode = 0;
      let responseBody: any = null;
      const res: any = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(payload: any) {
          responseBody = payload;
          return this;
        },
      };

      await handleRecordLaunchInterest(req, res);
      expect(statusCode).toBe(200);
      expect(responseBody.status).toBe("ok");
      expect(responseBody.record.productCode).toBe("personal_chapter_single");
      expect(responseBody.record.displayedPriceRub).toBe(4900);
      expect(responseBody.record.actionKind).toBe("launch_interest_only");
      expect(responseBody.record.isPaymentOrPreorder).toBe(false);
      expect(responseBody.analytics_recorded).toBe(true);

      // Verify FORBIDDEN_ANALYTICS_KEYS includes all Stage A sensitive fields
      for (const forbiddenKey of [
        "dob",
        "birth_date",
        "userQuestion",
        "story_text",
        "note",
        "chapter_title",
        "personal_chapter_title",
        "access_token",
        "token",
        "user_own_phrase",
        "subsequent_note",
        "myth_image",
        "contact_or_note",
        "email",
        "phone",
        "telegram_username",
      ]) {
        expect(FORBIDDEN_ANALYTICS_KEYS).toContain(forbiddenKey);
      }

      // Verify analytics privacy: attempt to pass forbidden personal fields into recordEvent -> must reject!
      const rejectedByPrivacy = await recordEvent("launch_interest_submitted", {
        sample_id_hash: "h_1234",
        displayed_price_rub: 4900,
        dob: "14.08.1988",
        userQuestion: "Секретный личный вопрос человека",
        myth_image: "Секретный образ мифа",
        user_own_phrase: "Секретная фраза человека",
        subsequent_note: "Секретная заметка",
        personal_chapter_title: "Личный заголовок главы",
        access_token: "secret_token_xyz",
        contact_or_note: "@secret_user_handle",
      } as any);
      expect(rejectedByPrivacy.valid).toBe(false);

      const eventsPath = path.resolve(process.cwd(), "data/events/events.jsonl");
      const eventsLog = fs.existsSync(eventsPath) ? fs.readFileSync(eventsPath, "utf8") : "";
      expect(eventsLog).not.toContain("14.08.1988");
      expect(eventsLog).not.toContain("Секретный личный вопрос человека");
      expect(eventsLog).not.toContain("Секретный образ мифа");
      expect(eventsLog).not.toContain("Секретная фраза человека");
      expect(eventsLog).not.toContain("Секретная заметка");
      expect(eventsLog).not.toContain("Личный заголовок главы");
      expect(eventsLog).not.toContain("secret_token_xyz");
      expect(eventsLog).not.toContain("@secret_user_handle");
    });
  });
});
