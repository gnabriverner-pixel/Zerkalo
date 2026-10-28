import type { Express, NextFunction, Request, Response } from "express";

/** Endpoints that no live screen calls any more. Off by default (404); LEGACY_ENDPOINTS_ENABLED=true brings them back. */
export const DISABLED_LEGACY_ENDPOINTS: readonly string[] = [
  "/api/generate",
  "/api/launch-interest",
  "/api/chapter-sample/pdf",
  "/api/handoff/create-claim",
  "/api/privacy/register-session",
];

export function legacyEndpointsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.LEGACY_ENDPOINTS_ENABLED === "true";
}

export function installLegacyEndpointGate(app: Express, env: NodeJS.ProcessEnv = process.env): void {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!legacyEndpointsEnabled(env) && DISABLED_LEGACY_ENDPOINTS.includes(req.path)) {
      return res.status(404).json({ status: "error", code: "not_found" });
    }
    next();
  });
}
