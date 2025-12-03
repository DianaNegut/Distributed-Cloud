const { execPromise } = require('./execPromise');
const { IPFS_BIN, KUBO_PATH } = require('../config/paths');

/**
 * Get the size of the IPFS repository in GB
 * @returns {Promise<{repoSizeGB: number, storageMax: number, numObjects: number}>}
 */
async function getIPFSRepoSize() {
  try {
    const command = `${IPFS_BIN} repo stat --size-only`;
    const result = await execPromise(command, { cwd: KUBO_PATH });
    
    // Output format: "RepoSize: 12345678"
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
    
    // Fallback: try alternative method with full stat
    try {
      const command = `${IPFS_BIN} repo stat`;
      const result = await execPromise(command, { cwd: KUBO_PATH });
      
      // Parse JSON output if available
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
