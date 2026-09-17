import { describe, expect, it } from "vitest";
import { machineClaim, meetingEvidence, mergeTruthEvidence } from "./truthEvidence";
import { buildCanonicalEnvelopeFromWebContext } from "./albert";
import { buildMeetingOfMirrorsPrompt } from "../src/services/mythPrompts";
import { loadTruthState, saveTruthState, hasTruthCorrections, persistTruthState } from "../src/services/albertTruthState";
import { deleteMyMirrorSnapshot, clearTransientDraft } from "../src/services/myMirrorStorage";

describe("claim provenance", () => {
  it("suppresses the machine-summary greeting after a persisted correction", () => {
    expect(hasTruthCorrections({evidence:[{source:'user_correction', status:'unreviewed', receipt:'opaque'}]})).toBe(true);
    expect(hasTruthCorrections({evidence:[{source:'resonance', status:'unreviewed'}]})).toBe(false);
    expect(hasTruthCorrections(undefined)).toBe(false);
  });
  it("has stable versioned IDs, no automatic user recognition", () => {
    const a = machineClaim("Тишина", "resonance", "meeting.theme", "2026-09-08");
    expect(machineClaim("Тишина", "resonance", "meeting.theme", "later").claim_id).toBe(a.claim_id);
    expect(machineClaim("Напор", "resonance", "meeting.theme", "later").claim_id).not.toBe(a.claim_id);
    const items = meetingEvidence("Синтез", "Образ", [{ theme: "Тишина", status: "confirmed" }], [{ theme: "Напор", status: "partial" }], "now");
    expect(items.map(i => i.source)).toEqual(["meeting", "myth", "resonance", "divergence"]);
    expect(items.every(i => i.status === "unreviewed" && i.evidence_event_id === null)).toBe(true);
  });

  it("does not invent missing calculations or place numbers in recognition", () => {
    expect(buildCanonicalEnvelopeFromWebContext().derived_code).toBeNull();
    const env = buildCanonicalEnvelopeFromWebContext({codeAnchors: {numbers: {soul: 7}}});
    expect(env.derived_code.components).toEqual([{component_key: "mind", value_summary: "7"}]);
    expect(env.evidence).toEqual([]);
  });

  it("does not accept client confirmed without receipt; receipt verification remains DCS authority", () => {
    const machine = machineClaim("Тишина", "resonance", "theme", "now");
    expect(mergeTruthEvidence([machine], { evidence: [{...machine, status: "confirmed"}], expiresAt: new Date(Date.now() + 60_000).toISOString() })).toEqual([machine]);
  });

  it("preserves the opaque ledger on reload and scopes it to the journey with expiry", () => {
    const state = { evidence: [{claim_id: "x", status: "rejected", receipt: "opaque"}], expiresAt: new Date(Date.now() + 60_000).toISOString() };
    saveTruthState("journey-a", state);
    localStorage.setItem("zerkalo.myMirror.v1", JSON.stringify({journeyId: "journey-a"}));
    persistTruthState("journey-a"); // explicit save, then browser restart
    sessionStorage.clear();
    expect(loadTruthState("journey-a")).toEqual(state);
    expect(loadTruthState("journey-b")).toBeUndefined();
    saveTruthState("journey-a", {...state, expiresAt: "2000-01-01"});
    expect(loadTruthState("journey-a")).toBeUndefined();
    saveTruthState("journey-a", state);
    deleteMyMirrorSnapshot();
    expect(loadTruthState("journey-a")).toBeUndefined();
    saveTruthState("journey-a", state);
    clearTransientDraft();
    expect(loadTruthState("journey-a")).toBeUndefined();
  });

  it("synthesis permits genuine disagreement and separates human words from generated myth", () => {
    const prompt = buildMeetingOfMirrorsPrompt({calc: {} as any}, {storyInputs: {q1:"Я не лидер",q2:"сад",q3:"дома",q4:"тишина"},storyResult:{title:"Сад"}});
    expect(prompt).not.toContain("в этом нет противоречия: дата говорит о потенциальной структуре");
    expect(prompt).toContain("реальное расхождение");
    expect(prompt).toContain("художественная история Мифа");
    expect(prompt).toContain("Несогласие не подтверждает гипотезу");
    expect(prompt).toContain("Я не лидер");
  });
});
