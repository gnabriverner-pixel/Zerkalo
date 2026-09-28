// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  buildShortJuxtapositionOpenerPrompt,
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

describe("Stage A Acceptance Gate (A1-A5)", () => {
  beforeEach(() => {
    clearAlbertConversation();
    deletePersonalChapterSample();
    deleteLaunchInterestRecord();
  });

  describe("A1: Short juxtaposition opener & provenance separation", () => {
    it("builds a 3-part short juxtaposition prompt starting with 'Что ' and ending with '?' without digits 1, 2, 3", () => {
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
      expect(promptWithMyth).toContain("первое");
      expect(promptWithMyth).toContain("второе");
      expect(promptWithMyth).toContain("третье");
      expect(promptWithMyth).toContain("как будто");

      const promptCodeOnly = buildShortJuxtapositionOpenerPrompt({
        userQuestion: "Как распределить силы на ближайший месяц?",
        codeCalculation: { soul: 4, expression: 1, path: 8, direction: 3, result: 7 } as any,
      });

      expect(promptCodeOnly.startsWith("Что ")).toBe(true);
      expect(promptCodeOnly.endsWith("?")).toBe(true);
      expect(promptCodeOnly).not.toMatch(/[0-9]/);
      expect(promptCodeOnly).toContain("Цифрового Кода");
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
    it("computes deterministic sourceStateVersion and marks opener stale when any input changes", () => {
      const baseInput = {
        codeDate: "14.08.1988",
        codeResult: { soul: 5, expression: 9, path: 4, direction: 9, result: 9 } as any,
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

      // Change user question -> version changes -> opener is marked stale
      const v2 = computeSourceStateVersion({
        ...baseInput,
        userQuestion: "Другой вопрос: стоит ли переезжать?",
      });
      expect(v2).not.toBe(v1);
      expect(isOpenerStale(loaded, v2)).toBe(true);
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

  describe("A3: Typography (20px / 1.6) & UI contracts in source components", () => {
    it("enforces 20px font size and 1.6 line-height on Albert responses and includes all required testids", () => {
      const albertComponentSource = fs.readFileSync(
        path.resolve(process.cwd(), "src/components/AlbertDialogue.tsx"),
        "utf8"
      );
      expect(albertComponentSource).toContain("albert-message-text");
      expect(albertComponentSource).toContain("text-[20px] leading-[1.6]");
      expect(albertComponentSource).toContain("fontSize: msg.sender === 'albert' ? '20px'");
      expect(albertComponentSource).toContain("lineHeight: msg.sender === 'albert' ? 1.6");
      expect(albertComponentSource).toContain('data-testid="albert-stale-state-banner"');
      expect(albertComponentSource).toContain('data-testid="albert-refresh-stale-opener-btn"');
      expect(albertComponentSource).toContain('data-testid="albert-retry-btn"');
      expect(albertComponentSource).toContain('data-testid="albert-crisis-banner"');
      expect(albertComponentSource).toContain('data-testid="albert-conclusion-panel"');

      const mythComponentSource = fs.readFileSync(
        path.resolve(process.cwd(), "src/components/PersonalMyth.tsx"),
        "utf8"
      );
      expect(mythComponentSource).toContain("Что это значит для моего вопроса?");
      expect(mythComponentSource).toContain('data-testid="myth-to-albert-juxtaposition-btn"');
      expect(mythComponentSource).toContain('data-testid="myth-return-to-code-btn"');
      expect(isShortJuxtapositionEnabled()).toBe(true);
    });
  });

  describe("A4: Personal Chapter Sample (6 parts, single source Web+PDF, user correction priority)", () => {
    it("builds all 6 mandatory parts, prioritizes user corrections, and permanently excludes rejected statements from Web and PDF", async () => {
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
      expect(pdfBuffer.subarray(0, 8).toString("latin1")).toContain("%PDF-1.4");
      const pdfText = pdfBuffer.toString("utf8");
      expect(pdfText).toContain(updatedSample.sampleId);
      expect(pdfText).toContain(updatedSample.sourceStateVersion);
      expect(pdfText).toContain(updatedSample.currentQuestion);
      expect(pdfText).toContain(updatedSample.userOwnPhrase);
      expect(pdfText).not.toContain(rejectedMachineClaim);
      expect(pdfText).not.toContain("26.05.1976");
    });
  });

  describe("A5: Full package offer ('Личная глава' — 4 900 ₽), separate storage & analytics privacy", () => {
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
