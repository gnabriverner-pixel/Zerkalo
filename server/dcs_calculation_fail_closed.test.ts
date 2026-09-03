import { describe, it, expect } from "vitest";
import { calculateCanonicalDigitalCode } from "./dcsBridge";

describe("Calculation Authority Proof: Strict DCS Engine & Fail-Closed", () => {
  it("succeeds with genuine canonical authority when DCS bridge is up", async () => {
    const res = await calculateCanonicalDigitalCode("06.05.1986");
    expect(res.canonicalAuthority).toBe("digital-code-system/engine.py::full_analysis");
    expect(res.soul).toBe(6);
    expect(res.path).toBe(8);
  });

  it("fails closed when DCS bridge is intentionally down (never falls back to TS engine)", async () => {
    const originalUrl = process.env.DCS_BRIDGE_URL;
    const originalRoot = process.env.DCS_ROOT;
    const originalPy = process.env.PYTHON_BIN;

    try {
      // Point to a non-existent port and invalid script path to simulate DCS offline
      process.env.DCS_BRIDGE_URL = "http://127.0.0.1:49999";
      process.env.DCS_ROOT = "/tmp/non_existent_dcs_dir";
      process.env.PYTHON_BIN = "non_existent_python_binary_xyz";

      // Test with fresh date not in cache
      const freshDob = "19.08.1991";
      await expect(calculateCanonicalDigitalCode(freshDob)).rejects.toThrow(
        "dcs_canonical_engine_unavailable"
      );
    } finally {
      process.env.DCS_BRIDGE_URL = originalUrl;
      process.env.DCS_ROOT = originalRoot;
      process.env.PYTHON_BIN = originalPy;
    }
  });
});
