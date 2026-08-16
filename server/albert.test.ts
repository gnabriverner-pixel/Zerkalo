import { describe, expect, it, vi } from "vitest";
import {
  buildAlbertSystemPrompt,
  formatAlbertDialogueMessages,
  generateAlbertDialogue,
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
});
