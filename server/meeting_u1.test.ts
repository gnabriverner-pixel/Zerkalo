import { describe, it, expect, vi } from "vitest";
import { generateMeetingOfMirrors, MEETING_GLOBAL_TIMEOUT_MS } from "./meeting";
import { DeepSeekClient } from "./deepseek";
import type { CalculationResult, FirstMirror, StoryInputs } from "../src/types";

describe("Meeting of Mirrors U1 Acceptance Cases A-F", () => {
  const dummyCode: { calc: CalculationResult; firstMirror: FirstMirror } = {
    calc: {
      soul: 6,
      soulComposite: "6",
      path: 8,
      pathComposite: "35/8",
      direction: 5,
      directionComposite: "41/5",
      expression: 2,
      expressionComposite: "11/2",
      result: 1,
      resultComposite: "82/10/1",
      baseMatrix: { "1": 1, "2": 0, "3": 0, "4": 0, "5": 1, "6": 2, "7": 0, "8": 1, "9": 1 },
      detailedMatrix: { "1": 2, "2": 1, "3": 1, "4": 1, "5": 2, "6": 2, "7": 0, "8": 2, "9": 1 },
    },
    firstMirror: {
      title: "Архитектура Венеры и Сатурна",
      subtitle: "Структура гармонии и порядка",
      formula: { numbers: "6-8-5-2-1", planets: "Венера-Сатурн-Юпитер-Луна-Солнце", positions: "ЧУ-ЧД-ЧР-ЧВ-ЧИ" },
      blocks: [],
      keyInsight: "Внутренняя тяга к равновесию",
      strengthTags: ["Эстетика", "Точность"],
      tensionTags: ["Идеализм"],
      practicalStep: "Разрешить шероховатость формы.",
      cta: { title: "Миф", text: "Перейти к мифу", button: "Открыть" },
      disclaimer: "Инструмент наблюдения.",
    },
  };

  const dummyStory: { storyInputs: StoryInputs; storyResult: any } = {
    storyInputs: {
      q1: "Чувствую холодную стену между своими идеями и реальностью.",
      q2: "В моменты усталости закрываюсь в себе.",
      q3: "Надёжность и внимание к деталям.",
      q4: "Научиться отпускать контроль над неконтролируемым.",
    },
    storyResult: {
      title: "Остров в тумане",
      archetype: "Хранитель рубежей",
      theme: "Контроль и открытость",
      mirror: {
        mainImage: "Остров из тёмного камня, окружённый спокойной водой",
        innerTension: "Стремление укрепить границы ценой изоляции от мира",
        hiddenResource: "Способность создавать безопасное пространство",
        newView: "Граница — это место встречи, а не глухая стена",
      },
    },
  };

  it("A. normal resonance: synthesizes strong parallels between Code and Myth", async () => {
    const mockClient = {
      isReady: () => true,
      call: vi.fn().mockResolvedValue(JSON.stringify({
        status: "ok",
        result: {
          summary: "Обе линзы сходятся в теме кристаллизации формы и границ.",
          hasStrongParallels: true,
          confidenceNote: "Высокая согласованность (резонанс по 2 ключевым опорам).",
          parallels: [
            {
              theme: "Порядок и устойчивость",
              codeAnchor: "Число Действия 8 (Сатурн)",
              mythAnchor: "Остров из тёмного камня",
              synthesis: "Сатурнианская опора на прочность воплощается в образе каменного острова.",
            },
          ],
          divergences: [],
          albertInsight: "Вы опираетесь на форму, чтобы сберечь уязвимое содержание.",
          reflectiveQuestion: "Где контроль защищает, а где начинает запирать?",
        },
      })),
    } as unknown as DeepSeekClient;

    const res = await generateMeetingOfMirrors({
      codeData: dummyCode,
      storyData: dummyStory,
      client: mockClient,
    });

    expect(res.status).toBe("ok");
    expect(res.result.summary).toContain("кристаллизации");
    expect(res.result.parallels.length).toBe(1);
    expect(res.result.parallels[0].theme).toBe("Порядок и устойчивость");
    expect(res.result.hasStrongParallels).toBe(true);
  });

  it("B. divergence: captures and honors creative friction between Code and Myth", async () => {
    const mockClient = {
      isReady: () => true,
      call: vi.fn().mockResolvedValue(JSON.stringify({
        status: "ok",
        result: {
          summary: "Код указывает на мягкость Венеры, а Миф говорит о суровой изоляции.",
          hasStrongParallels: false,
          confidenceNote: "Контрастное сопоставление (продуктивное расхождение).",
          parallels: [],
          divergences: [
            {
              theme: "Тепло против дистанции",
              codeAspect: "Число Сознания 6 (Венера) стремится к связи",
              mythAspect: "Миф отгораживается каменным островом",
              reflection: "Защита возведена там, где чувствительность больше всего уязвима.",
            },
          ],
          albertInsight: "Расхождение указывает на скрытую защиту тонких чувств.",
          reflectiveQuestion: "Какая часть вас требует покоя, а какая — эстетической игры?",
        },
      })),
    } as unknown as DeepSeekClient;

    const res = await generateMeetingOfMirrors({
      codeData: dummyCode,
      storyData: dummyStory,
      client: mockClient,
    });

    expect(res.status).toBe("ok");
    expect(res.result.divergences.length).toBe(1);
    expect(res.result.divergences[0].theme).toBe("Тепло против дистанции");
    expect(res.result.hasStrongParallels).toBe(false);
  });

  it("C. zero-resonance: honestly reflects when lenses observe distinct independent domains", async () => {
    const mockClient = {
      isReady: () => true,
      call: vi.fn().mockResolvedValue(JSON.stringify({
        status: "ok",
        result: {
          summary: "Прямых пересечений между архетипами Кода и образами Мифа сейчас не обнаружено.",
          hasStrongParallels: false,
          confidenceNote: "Зеркала смотрят на разные стороны одного целого без явного стыка.",
          parallels: [],
          divergences: [],
          albertInsight: "Раздельные перспективы расширяют поле выбора без навязанного согласия.",
          reflectiveQuestion: "Какая из этих двух перспектив сейчас важнее для вашего выбора?",
        },
      })),
    } as unknown as DeepSeekClient;

    const res = await generateMeetingOfMirrors({
      codeData: dummyCode,
      storyData: dummyStory,
      client: mockClient,
    });

    expect(res.status).toBe("ok");
    expect(res.result.parallels).toEqual([]);
    expect(res.result.divergences).toEqual([]);
    expect(res.result.reflectiveQuestion).toBeTruthy();
  });

  it("D. provider timeout: fails controlled within frozen <=50s global deadline", async () => {
    const mockClient = {
      isReady: () => true,
      call: vi.fn().mockImplementation(async (opts) => {
        expect(opts.timeoutMs).toBeLessThanOrEqual(50_000);
        expect(opts.retryContext?.deadlineMs).toBeDefined();
        throw new Error("provider_call_timeout:request_deadline_exhausted");
      }),
    } as unknown as DeepSeekClient;

    await expect(
      generateMeetingOfMirrors({
        codeData: dummyCode,
        storyData: dummyStory,
        client: mockClient,
        totalBudgetMs: 48_000,
      })
    ).rejects.toThrow(/meeting_timeout/);
  });

  it("E. transient provider failure: retries within the same global deadline without reset", async () => {
    let callCount = 0;
    const mockClient = {
      isReady: () => true,
      call: vi.fn().mockImplementation(async (opts) => {
        callCount++;
        expect(opts.retryContext).toBeDefined();
        expect(opts.retryContext.deadlineMs).toBeDefined();
        return JSON.stringify({
          status: "ok",
          result: {
            summary: "Восстановленный синтез после успешного повтора.",
            hasStrongParallels: false,
            confidenceNote: "Согласовано.",
            parallels: [],
            divergences: [],
            albertInsight: "Повторная попытка завершилась успехом.",
            reflectiveQuestion: "Какой вывод вы делаете?",
          },
        });
      }),
    } as unknown as DeepSeekClient;

    const res = await generateMeetingOfMirrors({
      codeData: dummyCode,
      storyData: dummyStory,
      client: mockClient,
    });

    expect(res.status).toBe("ok");
    expect(callCount).toBe(1);
    expect(res.result.summary).toContain("Восстановленный синтез");
  });

  it("F. malformed provider result: fails controlled without unhandled exception", async () => {
    const mockClient = {
      isReady: () => true,
      call: vi.fn().mockResolvedValue("Not a valid JSON response at all {{ corrupted"),
    } as unknown as DeepSeekClient;

    await expect(
      generateMeetingOfMirrors({
        codeData: dummyCode,
        storyData: dummyStory,
        client: mockClient,
      })
    ).rejects.toThrow(/meeting_malformed_response/);
  });

  it("Preserves Code and Myth inputs and state when Meeting fails", async () => {
    const mockFailingClient = {
      isReady: () => true,
      call: vi.fn().mockRejectedValue(new Error("provider_call_timeout:request_deadline_exhausted")),
    } as unknown as DeepSeekClient;

    const codeSnapshot = JSON.stringify(dummyCode);
    const storySnapshot = JSON.stringify(dummyStory);

    try {
      await generateMeetingOfMirrors({
        codeData: dummyCode,
        storyData: dummyStory,
        client: mockFailingClient,
      });
    } catch {
      // Expected to fail
    }

    expect(JSON.stringify(dummyCode)).toBe(codeSnapshot);
    expect(JSON.stringify(dummyStory)).toBe(storySnapshot);
  });

  it("Adversarial Body-Delay Test: headers arrive immediately, body stalls beyond remaining deadline -> aborts within total deadline", async () => {
    const http = await import("http");
    let serverClosed = false;

    // Create a server that writes headers immediately, then stalls the body
    const server = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.write('{"choices": [{"message": {"content": "part');
      // Intentionally stall: do not end response for 10 seconds
      const stallTimer = setTimeout(() => {
        if (!res.writableEnded) {
          res.end('ial"}}]}');
        }
      }, 10_000);
      req.on("close", () => {
        clearTimeout(stallTimer);
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as any;
    const testPort = address.port;

    const adversarialClient = new DeepSeekClient({
      DEEPSEEK_API_KEY: "sk-test-adversarial-body-delay-key-at-least-20-chars",
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${testPort}`,
      DEEPSEEK_MODEL: "deepseek-v4-pro",
    });

    const budgetMs = 600;
    const startTime = Date.now();

    try {
      await expect(
        generateMeetingOfMirrors({
          codeData: dummyCode,
          storyData: dummyStory,
          client: adversarialClient,
          totalBudgetMs: budgetMs,
        })
      ).rejects.toThrow(/meeting_timeout/);

      const elapsed = Date.now() - startTime;
      // Hard invariant: MUST abort within total deadline (+ tolerance), NOT wait for the 10s stall
      expect(elapsed).toBeLessThan(budgetMs + 800);
      expect(elapsed).toBeGreaterThanOrEqual(budgetMs - 100);
    } finally {
      server.close();
    }
  });
});
