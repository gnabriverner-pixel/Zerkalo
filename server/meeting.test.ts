import { describe, expect, it, vi } from "vitest";
import { generateMeetingOfMirrors } from "./meeting";
import { DeepSeekClient } from "./deepseek";
import type { CalculationResult } from "../src/types";

const mockCalc: CalculationResult = {
  soul: 7,
  soulComposite: "16/7",
  path: 4,
  pathComposite: "22/4",
  direction: 9,
  directionComposite: "18/9",
  expression: 2,
  expressionComposite: "11/2",
  result: 5,
  resultComposite: "14/5",
  baseMatrix: { "1": 2, "2": 1, "4": 1, "5": 1, "7": 1, "9": 1 },
  detailedMatrix: { "1": 2, "2": 1, "4": 1, "5": 1, "7": 1, "9": 1 },
};

const mockStory = {
  storyInputs: {
    q1: "напряжение",
    q2: "старый маяк",
    q3: "прогулка",
    q4: "ясность",
  },
  storyResult: {
    title: "Маяк у моря",
    story: "Текст истории...",
    mirror: {
      mainImage: "Маяк",
      innerTension: "Одиночество",
      hiddenResource: "Стойкость",
      newView: "Ориентир",
    },
    meaning: ["Свет", "Путь"],
    one_step: "Записать одну мысль.",
    journal_question: "Что светит мне?",
    disclaimer: "Дисклеймер.",
  },
};

describe("Meeting of Mirrors DeepSeek Migration", () => {
  it("parses valid DeepSeek JSON meeting response", async () => {
    const validMeetingJson = {
      status: "ok",
      result: {
        summary: "Два зеркала встретились.",
        hasStrongParallels: true,
        confidenceNote: "Высокий резонанс.",
        parallels: [
          {
            theme: "Поиск опоры",
            codeAnchor: "Число Пути 4",
            mythAnchor: "Образ маяка",
            synthesis: "Стремление к устойчивости.",
          },
        ],
        divergences: [
          {
            theme: "Темп",
            codeAspect: "Быстрый расчет",
            mythAspect: "Медленное созерцание",
            reflection: "Разные грани.",
          },
        ],
        albertInsight: "Единое поле.",
        reflectiveQuestion: "Где вы находите равновесие?",
        disclaimer: "Дисклеймер.",
      },
    };

    const client = new DeepSeekClient({
      DEEPSEEK_API_KEY: "sk-12345678901234567890",
    });

    vi.spyOn(client, "call").mockResolvedValue(JSON.stringify(validMeetingJson));

    const response = await generateMeetingOfMirrors({
      codeData: { calc: mockCalc },
      storyData: mockStory,
      client,
      model: "deepseek-v4-pro",
    });

    expect(response.status).toBe("ok");
    expect(response.provider).toBe("deepseek");
    expect(response.model).toBe("deepseek-v4-pro");
    expect(response.result.parallels).toHaveLength(1);
    expect(response.result.divergences).toHaveLength(1);
  });

  it("accepts valid zero-resonance meeting synthesis without errors", async () => {
    const zeroResonanceJson = {
      status: "ok",
      result: {
        summary: "Две линзы показывают совершенно разные плоскости.",
        hasStrongParallels: false,
        confidenceNote: "Контраст разных граней.",
        parallels: [],
        divergences: [
          {
            theme: "Структура против образа",
            codeAspect: "Аналитический расчет",
            mythAspect: "Свободная метафора",
            reflection: "Отражения не спорят, а дополняют друг друга.",
          },
        ],
        albertInsight: "Два взгляда обогащают восприятие.",
        reflectiveQuestion: "Как соединяются эти две стороны в вашей жизни?",
        disclaimer: "Дисклеймер.",
      },
    };

    const client = new DeepSeekClient({
      DEEPSEEK_API_KEY: "sk-12345678901234567890",
    });

    vi.spyOn(client, "call").mockResolvedValue(JSON.stringify(zeroResonanceJson));

    const response = await generateMeetingOfMirrors({
      codeData: { calc: mockCalc },
      storyData: mockStory,
      client,
      model: "deepseek-v4-pro",
    });

    expect(response.status).toBe("ok");
    expect(response.result.hasStrongParallels).toBe(false);
    expect(response.result.parallels).toHaveLength(0);
    expect(response.result.divergences).toHaveLength(1);
  });

  it("throws meeting_provider_not_ready when DeepSeek client is not configured", async () => {
    const client = new DeepSeekClient({ DEEPSEEK_API_KEY: "" });

    await expect(
      generateMeetingOfMirrors({
        codeData: { calc: mockCalc },
        storyData: mockStory,
        client,
      })
    ).rejects.toThrow("meeting_provider_not_ready");
  });
});
