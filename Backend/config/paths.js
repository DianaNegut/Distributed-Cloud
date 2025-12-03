const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const fs = require('fs');

function findIpfsBinary() {
  try {
    const cmd = process.platform === 'win32' ? 'where ipfs' : 'which ipfs';
    const ipfsPath = execSync(cmd).toString().trim();
    console.log(`IPFS gasit la: ${ipfsPath}`);
    return ipfsPath;
  } catch {
    console.warn('IPFS nu a fost gasit in PATH.');
    return null;
  }
}

const homeDir = os.homedir();
const IPFS_PATH = process.env.IPFS_PATH || path.join(homeDir, '.ipfs');
const IPFS_BIN = process.env.IPFS_BIN || findIpfsBinary();
const KUBO_PATH = IPFS_BIN ? path.dirname(IPFS_BIN) : null;

module.exports = { IPFS_PATH, KUBO_PATH, IPFS_BIN };
