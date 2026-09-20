import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";

describe("Scenario: Bridge-Only Production Topology (DCS_BRIDGE_URL without local DCS_ROOT)", () => {
  const originalEnv = { ...process.env };
  let existsSyncSpy: any;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.DCS_ROOT;
    process.env.DCS_BRIDGE_URL = "http://127.0.0.1:39500";
    process.env.PYTHON_BIN = "python3";

    // Simulate production server environment:
    // NO sibling DCS, NO local /Users/.../code/digital-code-system checkout
    existsSyncSpy = vi.spyOn(fs, "existsSync").mockImplementation((checkPath: fs.PathLike) => {
      const p = String(checkPath);
      if (p.includes("digital-code-system") || p.includes("zerkalo_bridge.py")) {
        return false;
      }
      return true;
    });
  });

  afterEach(() => {
    existsSyncSpy?.mockRestore();
    process.env = { ...originalEnv };
  });

  it("allows probeDcsBridge to succeed via HTTP without local DCS_ROOT", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sha: "fe67002ce2a2f9d05fa9faf205ef45264f05a931" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { probeDcsBridge } = await import("./dcsBridge");
    const health = await probeDcsBridge();

    expect(health).toEqual({
      state: "ready",
      sha: "fe67002ce2a2f9d05fa9faf205ef45264f05a931",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:39500/health",
      expect.anything()
    );
  });

  it("allows calculateCanonicalDigitalCode to succeed via HTTP without local DCS_ROOT", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ok",
        result: {
          soul: 6,
          soulComposite: "6",
          path: 8,
          pathComposite: "8",
          direction: 5,
          directionComposite: "5",
          expression: 2,
          expressionComposite: "2",
          result: 1,
          resultComposite: "1",
          baseMatrix: { "1": 1 },
          detailedMatrix: { "1": 1 },
          missingNumbers: [3, 4],
          financialCode: "6-5-8-1",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { calculateCanonicalDigitalCode } = await import("./dcsBridge");
    const res = await calculateCanonicalDigitalCode("06.05.1986");

    expect(res.canonicalAuthority).toBe("digital-code-system/engine.py::full_analysis");
    expect(res.soul).toBe(6);
    expect(res.path).toBe(8);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:39500/api/canonical/calculate",
      expect.anything()
    );
  });

  it("allows calculateCanonicalCodeV2 to succeed via HTTP without local DCS_ROOT", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ok",
        payload: {
          calculation: { date: "06.05.1986", primary: 6 },
          positions: [],
          shadow: {},
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { calculateCanonicalCodeV2 } = await import("./dcsBridge");
    const res = await calculateCanonicalCodeV2("06.05.1986");

    expect(res.calculation).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:39500/api/canonical/code-v2",
      expect.anything()
    );
  });

  it("fails closed when HTTP is down and no local DCS_ROOT exists for CLI fallback", async () => {
    // HTTP bridge returns network failure
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchMock);

    const { calculateCanonicalDigitalCode } = await import("./dcsBridge");
    await expect(calculateCanonicalDigitalCode("07.07.1990")).rejects.toThrow(
      "dcs_canonical_engine_unavailable"
    );
  });

  it("fails closed immediately when DCS_ROOT points to forbidden stale clone", async () => {
    process.env.DCS_ROOT = "/some/path/to/digital-code-product-journey";
    const { calculateCanonicalDigitalCode } = await import("./dcsBridge");
    await expect(calculateCanonicalDigitalCode("08.08.1988")).rejects.toThrow(
      "dcs_canonical_engine_unavailable"
    );
  });

  it("ensures probeDcsBridge safely reports unavailable without throwing when HTTP bridge is unreachable", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchMock);

    const { probeDcsBridge } = await import("./dcsBridge");
    const health = await probeDcsBridge();
    expect(health).toEqual({ state: "unavailable", sha: "unknown" });
  });
});
