import { describe, expect, it } from "vitest";
import { DeepSeekClient } from "./deepseek";
import { DeepSeekMythProvider } from "./myth";

describe("Production Consolidation & Security Rules", () => {
  it("does not require GEMINI_API_KEY for DeepSeek components", () => {
    const envWithoutGemini: NodeJS.ProcessEnv = {
      DEEPSEEK_API_KEY: "sk-12345678901234567890",
      PERSONAL_MYTH_MODEL: "deepseek-v4-pro",
      MEETING_MODEL: "deepseek-v4-pro",
      ALBERT_MODEL: "deepseek-v4-pro",
    };

    const client = new DeepSeekClient(envWithoutGemini);
    const myth = new DeepSeekMythProvider(envWithoutGemini, client);

    expect(client.isReady()).toBe(true);
    expect(myth.isReady()).toBe(true);
    expect(client.apiKey).toBe("sk-12345678901234567890");
    expect(client.defaultModel).toBe("deepseek-v4-pro");
  });

  it("ensures source code in src/ does not embed server secrets", async () => {
    const fs = await import("fs/promises");
    const path = await import("path");

    async function scanDir(dir: string): Promise<string[]> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...(await scanDir(full)));
        } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
          files.push(full);
        }
      }
      return files;
    }

    const srcFiles = await scanDir(path.join(process.cwd(), "src"));
    for (const file of srcFiles) {
      const content = await fs.readFile(file, "utf-8");
      expect(content).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
      expect(content).not.toMatch(/process\.env\.DEEPSEEK_API_KEY/);
      expect(content).not.toMatch(/process\.env\.GEMINI_API_KEY/);
    }
  });
});
