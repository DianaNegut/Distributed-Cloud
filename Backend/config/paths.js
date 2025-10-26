const path = require('path');

const IPFS_PATH = process.env.IPFS_PATH || 'C:\\Users\\Admin\\.ipfs';
const KUBO_PATH = process.env.KUBO_PATH || 'C:\\Users\\Admin\\Desktop\\Diana\\kubo';
const IPFS_BIN = path.join(KUBO_PATH, 'ipfs.exe');

module.exports = { IPFS_PATH, KUBO_PATH, IPFS_BIN };
