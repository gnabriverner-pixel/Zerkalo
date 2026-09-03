import { containsCrisisLanguage } from "./myth";
import type { StoryInputs } from "../src/types";

export interface CrisisCheckResult {
  isCrisis: boolean;
  safeMessage: string;
}

export const CRISIS_SAFE_MESSAGE =
  "Похоже, сейчас важнее не литературный разбор, а безопасность и поддержка.\n\n" +
  "Непосредственная угроза жизни и здоровью:\n" +
  "• 112 (Единая служба спасения)\n" +
  "• 103 (Скорая медицинская помощь)\n\n" +
  "Неотложная психологическая помощь для взрослых:\n" +
  "• +7 (495) 989-50-50 (Горячая линия психологической помощи ЦЭПП МЧС России)";

export function checkCrisisAndHazardousAction(inputs: StoryInputs | string | unknown): CrisisCheckResult {
  let answers: StoryInputs;
  if (typeof inputs === "string") {
    answers = { q1: inputs, q2: "", q3: "", q4: "" };
  } else if (inputs && typeof inputs === "object") {
    const obj = inputs as Record<string, unknown>;
    answers = {
      q1: String(obj.q1 || ""),
      q2: String(obj.q2 || ""),
      q3: String(obj.q3 || ""),
      q4: String(obj.q4 || ""),
    };
  } else {
    answers = { q1: "", q2: "", q3: "", q4: "" };
  }
  const isCrisis = containsCrisisLanguage(answers);
  return {
    isCrisis,
    safeMessage: CRISIS_SAFE_MESSAGE,
  };
}

export function validateAgeAndConsent(body: Record<string, unknown> | null | undefined): { valid: boolean; error?: string } {
  if (!body || typeof body !== "object") {
    return {
      valid: false,
      error: "Неверный формат запроса.",
    };
  }

  if (body.is_adult !== true || body.age_confirmed !== true) {
    return {
      valid: false,
      error: "Сервис предназначен исключительно для совершеннолетних пользователей (18+). Требуется подтверждение возраста.",
    };
  }

  if (body.consent_given !== true) {
    return {
      valid: false,
      error: "Для использования сервиса необходимо явное согласие с условиями и политикой обработки данных.",
    };
  }

  return { valid: true };
}
