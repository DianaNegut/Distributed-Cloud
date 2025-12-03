const { execPromise } = require('./execPromise');
const os = require('os');
const path = require('path');
const checkDiskSpace = require('check-disk-space').default;

/**
 * Get available disk space in GB for the IPFS_PATH drive
 * @returns {Promise<{totalGB: number, freeGB: number, usedGB: number}>}
 */
async function getDiskSpace() {
  try {
    const platform = os.platform();
    
    if (platform === 'win32') {
      // Windows: Use check-disk-space package
      const ipfsPath = process.env.IPFS_PATH || path.join(os.homedir(), '.ipfs');
      const diskSpace = await checkDiskSpace(ipfsPath);
      
      const totalBytes = diskSpace.size;
      const freeBytes = diskSpace.free;
      const usedBytes = totalBytes - freeBytes;
      
      return {
        totalGB: parseFloat((totalBytes / (1024 * 1024 * 1024)).toFixed(2)),
        freeGB: parseFloat((freeBytes / (1024 * 1024 * 1024)).toFixed(2)),
        usedGB: parseFloat((usedBytes / (1024 * 1024 * 1024)).toFixed(2))
      };
    } else {
      // Linux/Mac: Use df command
      const ipfsPath = process.env.IPFS_PATH || `${os.homedir()}/.ipfs`;
      const command = `df -BG "${ipfsPath}" | tail -1 | awk '{print $2,$3,$4}'`;
      
      const result = await execPromise(command);
      const [total, used, avail] = result.stdout.trim().split(' ').map(s => parseInt(s.replace('G', '')));
      
      return {
        totalGB: total || 0,
        freeGB: avail || 0,
        usedGB: used || 0
      };
    }
  } catch (error) {
    console.error('[DISK-SPACE] Error getting disk space:', error.message);
    // Return fallback values if unable to determine
    return {
      totalGB: 0,
      freeGB: 0,
      usedGB: 0
    };
  }
}

module.exports = { getDiskSpace };
