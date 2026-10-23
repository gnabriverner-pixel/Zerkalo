// Карточки Кода V2 рендерятся как обычный текст: убираем разметку markdown,
// которая иногда просачивается из DCS ("### Заголовок", "* **Ключ:**", **жирный**).
export function stripMarkdown(text: string): string {
  if (!/[#*_]/.test(text)) return text;
  return text
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]*[*-][ \t]+/gm, "• ")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1");
}

export function stripMarkdownDeep<T>(value: T): T {
  if (typeof value === "string") return stripMarkdown(value) as unknown as T;
  if (Array.isArray(value)) return value.map(stripMarkdownDeep) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = stripMarkdownDeep(v);
    return out as T;
  }
  return value;
}
