// scripts/runtime_launcher.cjs
// Ensures release identity is bound from immutable package metadata (release.json)
// without modifying tracked source code in Git.
const fs = require("fs");
const path = require("path");

let boundReleaseSha = process.env.RELEASE_SHA || "";

try {
  const metaPath = path.join(process.cwd(), "release.json");
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    boundReleaseSha = meta.release_sha || meta.source_git_sha || meta.git_commit || boundReleaseSha;
    process.env.RELEASE_SHA = boundReleaseSha;
  }
} catch (err) {
  // ignore
}

// Hook into express response.json if express is loaded
try {
  const expressPath = require.resolve("express", { paths: [process.cwd()] });
  const express = require(expressPath);
  if (express && express.response && express.response.json) {
    const origJson = express.response.json;
    express.response.json = function (body) {
      if (body && typeof body === "object") {
        const reqPath = this.req?.path || this.req?.url;
        if (reqPath === "/health" || reqPath === "/health/ready") {
          if (!body.release_sha && boundReleaseSha) {
            body.release_sha = boundReleaseSha;
          }
        }
      }
      return origJson.call(this, body);
    };
  }
} catch (e) {
  // express not found or hook failed
}
