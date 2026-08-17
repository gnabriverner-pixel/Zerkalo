import { describe, expect, it, vi } from "vitest";
import {
  buildAlbertSystemPrompt,
  formatAlbertDialogueMessages,
  generateAlbertDialogue,
  validateAlbertResponse,
  type AlbertDialogueRequest,
} from "./albert";
import { DeepSeekClient } from "./deepseek";

describe("Albert Web Dialogue Server (RP-1 DeepSeek)", () => {
  const sampleRequest: AlbertDialogueRequest = {
    message: "Почему код и миф так по-разному видят мою энергию?",
    history: [
      { sender: "user", text: "Здравствуйте, Альберт." },
      { sender: "albert", text: "Здравствуйте. Я готов обсудить встречу ваших двух зеркал. О чем хотите спросить?" },
    ],
    context: {
      meetingSummary: "Код указывает на структурный стержень, а миф — на поиск тишины.",
      confidenceNote: "Тонкий резонанс двух граней.",
      centralQuestion: "Где вы находите равновесие?",
      resonances: [
        {
          theme: "Потребность в тишине",
          codeAnchor: "Число Души 7",
          mythAnchor: "Образ туманного сада",
          synthesis: "Желание слышать себя глубже.",
        },
      ],
      divergences: [
        {
          theme: "Внешний напор",
          codeAspect: "Путь 1",
          mythAspect: "Замедление",
          reflection: "Контраст динамики и покоя.",
        },
      ],
      codeAnchors: {
        numbers: { soul: 7, path: 1, direction: 8, expression: 9, result: 5 },
        keyInsight: "Соединение глубины и действия.",
      },
      mythAnchors: {
        title: "Сад у воды",
        mainImage: "Туманный сад",
        innerTension: "Развилка",
        hiddenResource: "Спокойный шаг",
        newView: "Право на неспешность",
      },
    },
  };

  it("constructs grounded RP-1 prompt incorporating Meeting and lens anchors", () => {
    const prompt = buildAlbertSystemPrompt(sampleRequest.context);

    expect(prompt).toContain("Альберт Анатольевич Вяземский");
    expect(prompt).toContain("LISTEN → REFLECT → GROUND → OPEN → MOVE");
    expect(prompt).toContain("Обращайтесь к человеку строго на «вы»");
    expect(prompt).toContain("Потребность в тишине");
    expect(prompt).toContain("Число Души 7");
    expect(prompt).toContain("Сад у воды");
    expect(prompt).toContain("Внешний напор");
    expect(prompt).toContain("Никакой терапии, диагнозов");
  });

  it("formats bounded message history and user message", () => {
    const messages = formatAlbertDialogueMessages(sampleRequest);

    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
    expect(messages[1].content).toBe("Здравствуйте, Альберт.");
    expect(messages[2].role).toBe("assistant");
    expect(messages[messages.length - 1].role).toBe("user");
    expect(messages[messages.length - 1].content).toBe(sampleRequest.message);
  });

  it("generates real provider dialogue response", async () => {
    const client = new DeepSeekClient({
      DEEPSEEK_API_KEY: "sk-12345678901234567890",
    });

    vi.spyOn(client, "call").mockResolvedValue(
      "Вы чувствуете этот контраст между динамикой и необходимостью тишины. Какое действие сегодня даст вам эту опору?"
    );

    const response = await generateAlbertDialogue(
      sampleRequest,
      client,
      "deepseek-v4-pro"
    );

    expect(response.status).toBe("ok");
    expect(response.provider).toBe("deepseek");
    expect(response.model).toBe("deepseek-v4-pro");
    expect(response.message).toContain("Вы чувствуете этот контраст");
  });

  it("throws albert_provider_not_ready when client is unconfigured", async () => {
    const client = new DeepSeekClient({ DEEPSEEK_API_KEY: "" });

    await expect(
      generateAlbertDialogue(sampleRequest, client)
    ).rejects.toThrow("albert_provider_not_ready");
  });

  it("rejects empty user message", async () => {
    const client = new DeepSeekClient({
      DEEPSEEK_API_KEY: "sk-12345678901234567890",
    });

    await expect(
      generateAlbertDialogue({ message: "   " }, client)
    ).rejects.toThrow("invalid_message");
  });

  describe("Mechanical Format Validation (validateAlbertResponse)", () => {
    it("accepts valid concise response with single final question mark", () => {
      const validText = "Вы обратили внимание на важное расхождение между ритмом действия и потребностью в покое. Что сейчас кажется вам более надежной опорой?";
      const report = validateAlbertResponse(validText);
      expect(report.valid).toBe(true);
      expect(report.blockers).toHaveLength(0);
      expect(report.questionCount).toBe(1);
    });

    it("rejects response with multiple question marks", () => {
      const multiQ = "Почему это происходит? Вы чувствуете напряжение? Каков ваш следующий шаг?";
      const report = validateAlbertResponse(multiQ);
      expect(report.valid).toBe(false);
      expect(report.blockers).toContain("multiple_questions");
    });

    it("rejects response not ending with a question mark", () => {
      const noEndQ = "Вы чувствуете напряжение, но это нормально. Сделайте один шаг.";
      const report = validateAlbertResponse(noEndQ);
      expect(report.valid).toBe(false);
      expect(report.blockers).toContain("missing_question");
      expect(report.blockers).toContain("does_not_end_with_question");
    });

    it("rejects response exceeding 180 words", () => {
      const longText = Array.from({ length: 190 }, (_, i) => `слово${i}`).join(" ") + "?";
      const report = validateAlbertResponse(longText);
      expect(report.valid).toBe(false);
      expect(report.blockers).toContain("over_word_limit");
    });
  });

  describe("Editorial Format Repair in generateAlbertDialogue", () => {
    it("successfully repairs invalid response on second attempt", async () => {
      const client = new DeepSeekClient({
        DEEPSEEK_API_KEY: "sk-12345678901234567890",
      });

      // Attempt 1: fails (no question mark)
      // Attempt 2 (repair): succeeds
      const callSpy = vi.spyOn(client, "call")
        .mockResolvedValueOnce("Вы чувствуете этот контраст между динамикой и покоем.")
        .mockResolvedValueOnce("Вы чувствуете этот контраст между динамикой и покоем. Что сейчас дает вам уверенность?");

      const response = await generateAlbertDialogue(sampleRequest, client, "deepseek-v4-pro");
      expect(response.status).toBe("ok");
      expect(response.message).toContain("Что сейчас дает вам уверенность?");
      expect(callSpy).toHaveBeenCalledTimes(2);
    });

    it("fails closed when both initial and repair attempts violate format", async () => {
      const client = new DeepSeekClient({
        DEEPSEEK_API_KEY: "sk-12345678901234567890",
      });

      vi.spyOn(client, "call")
        .mockResolvedValueOnce("Первый некорректный ответ.")
        .mockResolvedValueOnce("Второй некорректный ответ тоже без вопроса.");

      await expect(
        generateAlbertDialogue(sampleRequest, client, "deepseek-v4-pro")
      ).rejects.toThrow("albert_contract_violation");
    });
  });
});
