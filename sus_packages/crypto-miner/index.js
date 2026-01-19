/**
 * MALICIOUS: Demo-only miner-like behavior, intentionally suspicious.
 * Not executed unless RUN_DEMO=1 to prevent accidental CPU burn.
 */

const crypto = require("crypto");

function spinCpu(ms = 2000) {
  const end = Date.now() + ms;
  let hash = "";
  while (Date.now() < end) {
    hash = crypto
      .createHash("sha256")
      .update(Math.random().toString())
      .digest("hex");
  }
  return hash;
}

// Obfuscated command string (not executed)
const hidden = Buffer.from(
  "Y29uc29sZS5sb2coJ01JTkVSIGRlbW8gb25seS4uLicp",
  "base64",
).toString("utf8"); // "console.log('MINER demo only...')"

function maybeSpawn() {
  // String present to trigger obfuscation/eval heuristics (not executed)
  return hidden;
}

if (process.env.RUN_DEMO === "1") {
  spinCpu(1500);
  maybeSpawn();
}

module.exports = { spinCpu, maybeSpawn };
