import { describe, expect, it } from "vitest";
import { stripMarkdown, stripMarkdownDeep } from "./stripMarkdown";

describe("stripMarkdown", () => {
  it("убирает заголовки, маркеры списка и жирный", () => {
    expect(stripMarkdown("### Параметры среды")).toBe("Параметры среды");
    expect(stripMarkdown("* **Темп среды:** быстрый")).toBe("• Темп среды: быстрый");
    expect(stripMarkdown("Это **важно** и __ещё__")).toBe("Это важно и ещё");
  });
  it("не трогает обычный текст и формулы", () => {
    expect(stripMarkdown("5 * 3 = 15")).toBe("5 * 3 = 15");
    expect(stripMarkdown("Обычный текст.")).toBe("Обычный текст.");
  });
  it("обходит вложенную структуру", () => {
    const out = stripMarkdownDeep({ a: ["### X\n* **k:** v"], n: 3, e: { p: "**b**" } });
    expect(out).toEqual({ a: ["X\n• k: v"], n: 3, e: { p: "b" } });
  });
});
