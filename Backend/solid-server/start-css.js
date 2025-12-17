/**
 * Community Solid Server Starter
 * 
 * Pornește CSS cu configurația custom IPFS
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('[CSS] Starting Community Solid Server with IPFS backend...');
console.log('[CSS] 📡 Port: 3002');
console.log('[CSS] 🗄️  Storage: IPFS Cluster (http://localhost:9094)');
console.log('[CSS] 📚 Data folder: ./solid-data');
console.log('');

// Start CSS using the CLI
const cssPath = path.join(__dirname, '../node_modules/.bin/community-solid-server');
const dataPath = path.join(__dirname, '../solid-data');

const args = [
  '-p', '3002',
  '-b', 'http://localhost:3002/',
  '-c', path.join(__dirname, 'css-config.json'),
  '-f', dataPath,
  '--logging', 'info'
];

console.log('[CSS] Command: community-solid-server', args.join(' '));
console.log('');

const cssProcess = spawn('npx', ['community-solid-server', ...args], {
  stdio: 'inherit',
  shell: true,
  cwd: path.join(__dirname, '..')
});

cssProcess.on('error', (error) => {
  console.error('[CSS] ❌ Failed to start CSS:', error);
  process.exit(1);
});

cssProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error(`[CSS] ❌ CSS exited with code ${code}`);
    process.exit(code);
  }
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[CSS] Shutting down...');
  cssProcess.kill('SIGTERM');
  setTimeout(() => process.exit(0), 1000);
});

process.on('SIGTERM', () => {
  console.log('\n[CSS] Shutting down...');
  cssProcess.kill('SIGTERM');
  setTimeout(() => process.exit(0), 1000);
});
