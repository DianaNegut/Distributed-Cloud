const fs = require('fs');
const path = require('path');
const { IPFS_PATH } = require('../config/paths');

const USER_STORAGE_FILE = path.join(IPFS_PATH, 'user-storage.json');

const DEFAULT_STORAGE_LIMIT_GB = 1;
const DEFAULT_STORAGE_LIMIT_BYTES = DEFAULT_STORAGE_LIMIT_GB * 1024 * 1024 * 1024;

const WARNING_THRESHOLD = 0.8;

const CRITICAL_THRESHOLD = 0.95;

class UserStorage {
  constructor() {
    this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(USER_STORAGE_FILE)) {
        this.data = JSON.parse(fs.readFileSync(USER_STORAGE_FILE, 'utf8'));
      } else {
        this.data = {
          users: {},
          lastUpdated: new Date().toISOString()
        };
        this.saveData();
      }
    } catch (error) {
      console.error('[USER-STORAGE] Eroare la incarcare date:', error.message);
      this.data = { users: {}, lastUpdated: new Date().toISOString() };
    }
  }

  saveData() {
    try {
      this.data.lastUpdated = new Date().toISOString();
      fs.writeFileSync(USER_STORAGE_FILE, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('[USER-STORAGE] Eroare la salvare date:', error.message);
    }
  }

  getOrCreateUser(peerId) {
    if (!this.data.users[peerId]) {
      this.data.users[peerId] = {
        peerId: peerId,
        createdAt: new Date().toISOString(),
        storage: {
          usedBytes: 0,
          limitBytes: DEFAULT_STORAGE_LIMIT_BYTES,
          limitGB: DEFAULT_STORAGE_LIMIT_GB,
          isDefault: true, 
          files: [] 
        },
        contracts: [], 
        lastActivity: new Date().toISOString()
      };
      this.saveData();
      console.log(`[USER-STORAGE] User nou creat: ${peerId} cu limita default de ${DEFAULT_STORAGE_LIMIT_GB}GB`);
    }
    return this.data.users[peerId];
  }

  getUserStorageInfo(peerId) {
    const user = this.getOrCreateUser(peerId);
    const usedGB = user.storage.usedBytes / (1024 * 1024 * 1024);
    const limitGB = user.storage.limitBytes / (1024 * 1024 * 1024);
    const usagePercent = (user.storage.usedBytes / user.storage.limitBytes) * 100;
    const remainingBytes = user.storage.limitBytes - user.storage.usedBytes;
    const remainingGB = remainingBytes / (1024 * 1024 * 1024);

    let status = 'ok';
    let warning = null;

    if (usagePercent >= CRITICAL_THRESHOLD * 100) {
      status = 'critical';
      warning = `Atentie! Ai folosit ${usagePercent.toFixed(1)}% din spatiul de stocare. Achizitioneaza mai mult spatiu din Piata.`;
    } else if (usagePercent >= WARNING_THRESHOLD * 100) {
      status = 'warning';
      warning = `Ai folosit ${usagePercent.toFixed(1)}% din spatiul de stocare. Considera achizitionarea de spatiu suplimentar.`;
    }

    return {
      peerId,
      storage: {
        usedBytes: user.storage.usedBytes,
        usedGB: parseFloat(usedGB.toFixed(3)),
        limitBytes: user.storage.limitBytes,
        limitGB: parseFloat(limitGB.toFixed(1)),
        remainingBytes,
        remainingGB: parseFloat(remainingGB.toFixed(3)),
        usagePercent: parseFloat(usagePercent.toFixed(1)),
        isDefault: user.storage.isDefault,
        filesCount: user.storage.files.length
      },
      status,
      warning,
      contracts: user.contracts,
      lastActivity: user.lastActivity
    };
  }

  canUpload(peerId, fileSizeBytes) {
    const user = this.getOrCreateUser(peerId);
    const newUsed = user.storage.usedBytes + fileSizeBytes;
    const wouldExceed = newUsed > user.storage.limitBytes;
    
    const usageAfterUpload = (newUsed / user.storage.limitBytes) * 100;
    let warning = null;
    let status = 'ok';

    if (wouldExceed) {
      const exceededBy = newUsed - user.storage.limitBytes;
      const exceededByMB = (exceededBy / (1024 * 1024)).toFixed(2);
      return {
        allowed: false,
        reason: `Limita de stocare depasita! Ai nevoie de inca ${exceededByMB} MB. Limita ta actuala este de ${user.storage.limitGB} GB.`,
        currentUsed: user.storage.usedBytes,
        limit: user.storage.limitBytes,
        wouldUse: newUsed,
        suggestion: 'Achizitioneaza spatiu suplimentar din Piata sau sterge fisiere existente.'
      };
    }

    if (usageAfterUpload >= CRITICAL_THRESHOLD * 100) {
      status = 'critical';
      warning = `Dupa acest upload vei folosi ${usageAfterUpload.toFixed(1)}% din spatiu. Aproape de limita!`;
    } else if (usageAfterUpload >= WARNING_THRESHOLD * 100) {
      status = 'warning';
      warning = `Dupa acest upload vei folosi ${usageAfterUpload.toFixed(1)}% din spatiu.`;
    }

    return {
      allowed: true,
      currentUsed: user.storage.usedBytes,
      limit: user.storage.limitBytes,
      wouldUse: newUsed,
      usageAfterUpload: parseFloat(usageAfterUpload.toFixed(1)),
      status,
      warning
    };
  }

  recordUpload(peerId, cid, sizeBytes, fileName) {
    const user = this.getOrCreateUser(peerId);

    const existingFile = user.storage.files.find(f => f.cid === cid);
    if (existingFile) {
      console.log(`[USER-STORAGE] Fisier deja inregistrat: ${cid}`);
      return { success: true, alreadyExists: true };
    }

    user.storage.usedBytes += sizeBytes;
    user.storage.files.push({
      cid,
      name: fileName,
      sizeBytes,
      uploadedAt: new Date().toISOString()
    });
    user.lastActivity = new Date().toISOString();

    this.saveData();
    console.log(`[USER-STORAGE] Fisier inregistrat pentru ${peerId}: ${fileName} (${sizeBytes} bytes)`);

    return {
      success: true,
      newUsedBytes: user.storage.usedBytes,
      newUsedGB: (user.storage.usedBytes / (1024 * 1024 * 1024)).toFixed(3)
    };
  }

  recordDeletion(peerId, cid) {
    const user = this.data.users[peerId];
    if (!user) {
      console.log(`[USER-STORAGE] User inexistent: ${peerId}`);
      return { success: false, error: 'User not found' };
    }

    const fileIndex = user.storage.files.findIndex(f => f.cid === cid);
    if (fileIndex === -1) {
      console.log(`[USER-STORAGE] Fisier negasit pentru user ${peerId}: ${cid}`);
      return { success: false, error: 'File not found for this user' };
    }

    const file = user.storage.files[fileIndex];
    user.storage.usedBytes -= file.sizeBytes;
    user.storage.files.splice(fileIndex, 1);
    user.lastActivity = new Date().toISOString();

    if (user.storage.usedBytes < 0) {
      user.storage.usedBytes = 0;
    }

    this.saveData();
    console.log(`[USER-STORAGE] Fisier sters pentru ${peerId}: ${cid}`);

    return {
      success: true,
      freedBytes: file.sizeBytes,
      newUsedBytes: user.storage.usedBytes
    };
  }

  addContractStorage(peerId, contractId, additionalGB) {
    const user = this.getOrCreateUser(peerId);
    const additionalBytes = additionalGB * 1024 * 1024 * 1024;

    user.storage.limitBytes += additionalBytes;
    user.storage.limitGB = user.storage.limitBytes / (1024 * 1024 * 1024);
    user.storage.isDefault = false;
    
    if (!user.contracts.includes(contractId)) {
      user.contracts.push(contractId);
    }

    this.saveData();
    console.log(`[USER-STORAGE] Stocare adaugata pentru ${peerId}: +${additionalGB}GB din contract ${contractId}`);

    return {
      success: true,
      newLimitGB: user.storage.limitGB,
      newLimitBytes: user.storage.limitBytes
    };
  }

  removeContractStorage(peerId, contractId, removedGB) {
    const user = this.data.users[peerId];
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const removedBytes = removedGB * 1024 * 1024 * 1024;
    user.storage.limitBytes -= removedBytes;

    if (user.storage.limitBytes < DEFAULT_STORAGE_LIMIT_BYTES) {
      user.storage.limitBytes = DEFAULT_STORAGE_LIMIT_BYTES;
    }

    user.storage.limitGB = user.storage.limitBytes / (1024 * 1024 * 1024);

    const contractIndex = user.contracts.indexOf(contractId);
    if (contractIndex > -1) {
      user.contracts.splice(contractIndex, 1);
    }

    if (user.contracts.length === 0) {
      user.storage.isDefault = true;
    }

    this.saveData();
    console.log(`[USER-STORAGE] Stocare eliminata pentru ${peerId}: -${removedGB}GB, contract ${contractId}`);

    return {
      success: true,
      newLimitGB: user.storage.limitGB
    };
  }

  getAllUsers() {
    return Object.values(this.data.users).map(user => ({
      peerId: user.peerId,
      usedGB: (user.storage.usedBytes / (1024 * 1024 * 1024)).toFixed(3),
      limitGB: user.storage.limitGB,
      filesCount: user.storage.files.length,
      isDefault: user.storage.isDefault,
      contracts: user.contracts.length
    }));
  }

  removeFileFromAllUsers(cid) {
    let removed = false;
    
    for (const peerId in this.data.users) {
      const user = this.data.users[peerId];
      const fileIndex = user.storage.files.findIndex(f => f.cid === cid);
      
      if (fileIndex !== -1) {
        const file = user.storage.files[fileIndex];
        user.storage.usedBytes -= file.sizeBytes;
        user.storage.files.splice(fileIndex, 1);
        
        if (user.storage.usedBytes < 0) {
          user.storage.usedBytes = 0;
        }
        
        removed = true;
        console.log(`[USER-STORAGE] Fisier ${cid} eliminat de la user ${peerId}`);
      }
    }

    if (removed) {
      this.saveData();
    }

    return { success: true, removed };
  }
}

module.exports = new UserStorage();
