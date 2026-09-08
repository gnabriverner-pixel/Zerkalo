import crypto from "crypto";

/** Same provenance DTO as DCS RecognitionEvidence. No browser/model reaction
 * can be authorized here: DCS alone verifies and issues human-event receipts. */
export function machineClaim(text: string, source: string, sourceRef: string, now: string) {
  const version = crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
  return {
    claim_id: crypto.createHash("sha256").update(`${source}:${sourceRef}:${version}`).digest("hex").slice(0, 24),
    claim_version: version, claim_summary: text, source, source_ref: sourceRef,
    status: "unreviewed", recorded_at: now, evidence_event_id: null,
  };
}

export function meetingEvidence(summary: string, myth: string, parallels: any[], divergences: any[], now: string) {
  return [
    ...(summary ? [machineClaim(summary, "meeting", "meeting.summary", now)] : []),
    ...(myth ? [machineClaim(myth, "myth", "myth.mainImage", now)] : []),
    ...parallels.filter(p => p.theme).map(p => machineClaim(
      `Резонанс [${p.theme}]: ${p.synthesis || p.codeAnchor || ""}`, "resonance", `meeting.parallel:${p.theme}`, now)),
    ...divergences.filter(d => d.theme).map(d => machineClaim(
      `Контраст [${d.theme}]: ${d.reflection || d.codeAspect || ""}`, "divergence", `meeting.divergence:${d.theme}`, now)),
  ];
}

export interface TruthState { evidence: Record<string, any>[]; expiresAt: string }

/** Transport only. A receipt-looking string is NOT verification. */
export function mergeTruthEvidence(machine: any[], state?: TruthState): any[] {
  if (!state || !Array.isArray(state.evidence) || Date.parse(state.expiresAt) <= Date.now() || !Number.isFinite(Date.parse(state.expiresAt))) return machine;
  // Do not let an unsigned client replacement even remove an original claim.
  const carried = state.evidence.filter(e => e && typeof e.receipt === "string");
  return [...machine, ...carried];
}
