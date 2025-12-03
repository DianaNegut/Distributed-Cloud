const { execPromise } = require('./execPromise');
const { IPFS_BIN, KUBO_PATH } = require('../config/paths');

async function getIPFSRepoSize() {
  try {
    const command = `${IPFS_BIN} repo stat --size-only`;
    const result = await execPromise(command, { cwd: KUBO_PATH });

    const lines = result.stdout.trim().split('\n');
    let repoSizeBytes = 0;
    
    for (const line of lines) {
      if (line.includes('RepoSize:')) {
        repoSizeBytes = parseInt(line.split(':')[1].trim());
        break;
      }
    }
    
    const repoSizeGB = repoSizeBytes / (1024 * 1024 * 1024);
    
    return {
      repoSizeGB: parseFloat(repoSizeGB.toFixed(2)),
      repoSizeBytes: repoSizeBytes
    };
  } catch (error) {
    console.error('[IPFS-REPO] Error getting repo size:', error.message);

    try {
      const command = `${IPFS_BIN} repo stat`;
      const result = await execPromise(command, { cwd: KUBO_PATH });

      const data = JSON.parse(result.stdout);
      const repoSizeGB = data.RepoSize / (1024 * 1024 * 1024);
      
      return {
        repoSizeGB: parseFloat(repoSizeGB.toFixed(2)),
        repoSizeBytes: data.RepoSize,
        numObjects: data.NumObjects,
        storageMax: data.StorageMax
      };
    } catch (fallbackError) {
      console.error('[IPFS-REPO] Fallback also failed:', fallbackError.message);
      return {
        repoSizeGB: 0,
        repoSizeBytes: 0
      };
    }
  }
}

module.exports = { getIPFSRepoSize };
