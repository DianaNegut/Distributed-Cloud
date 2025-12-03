const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const UserStorage = require('../models/UserStorage');
const { IPFS_PATH } = require('../config/paths');

const metadataPath = path.join(IPFS_PATH, 'cluster-files-metadata.json');

function loadClusterMetadata() {
  try {
    if (fs.existsSync(metadataPath)) {
      return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }
  } catch (error) {
    console.error('[USER-STORAGE] Eroare la citire metadata cluster:', error.message);
  }
  return {};
}

router.post('/:peerId/sync', async (req, res) => {
  console.log(`[USER-STORAGE] Sincronizare stocare pentru: ${req.params.peerId}`);
  try {
    const { peerId } = req.params;
    const { files } = req.body; 
    
    if (!peerId || peerId === 'undefined') {
      return res.status(400).json({
        success: false,
        error: 'PeerId este necesar'
      });
    }

    const clusterMetadata = loadClusterMetadata();

    const user = UserStorage.getOrCreateUser(peerId);
    
    let syncedFiles = 0;
    let totalBytes = 0;

    if (files && Array.isArray(files)) {
      for (const file of files) {
        
        const existingFile = user.storage.files.find(f => f.cid === file.cid);
        if (!existingFile) {
          
          let sizeBytes = 0;

          if (clusterMetadata[file.cid] && typeof clusterMetadata[file.cid].size === 'number') {
            sizeBytes = clusterMetadata[file.cid].size;
          } 
          
          else if (file.size && !isNaN(parseInt(file.size)) && file.size !== 'Unknown') {
            sizeBytes = parseInt(file.size);
          }

          const fileName = clusterMetadata[file.cid]?.name || file.name || 'Unknown';
          
          user.storage.files.push({
            cid: file.cid,
            name: fileName,
            sizeBytes: sizeBytes,
            uploadedAt: clusterMetadata[file.cid]?.uploadedAt || file.uploadedAt || new Date().toISOString()
          });
          totalBytes += sizeBytes;
          syncedFiles++;
          console.log(`[USER-STORAGE] Sincronizat fisier: ${file.cid} - ${fileName} (${sizeBytes} bytes)`);
        }
      }

      user.storage.usedBytes = user.storage.files.reduce((sum, f) => sum + (f.sizeBytes || 0), 0);
      user.lastActivity = new Date().toISOString();
      
      UserStorage.saveData();
    }

    const storageInfo = UserStorage.getUserStorageInfo(peerId);
    
    res.json({
      success: true,
      message: `Sincronizate ${syncedFiles} fisiere noi`,
      syncedFiles,
      totalBytesAdded: totalBytes,
      ...storageInfo
    });
  } catch (error) {
    console.error('[USER-STORAGE] Eroare sincronizare:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:peerId', (req, res) => {
  console.log(`[USER-STORAGE] Obtinere info stocare pentru: ${req.params.peerId}`);
  try {
    const { peerId } = req.params;
    
    if (!peerId || peerId === 'undefined') {
      return res.status(400).json({
        success: false,
        error: 'PeerId este necesar'
      });
    }

    const storageInfo = UserStorage.getUserStorageInfo(peerId);
    
    res.json({
      success: true,
      ...storageInfo
    });
  } catch (error) {
    console.error('[USER-STORAGE] Eroare:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/check-upload', (req, res) => {
  console.log('[USER-STORAGE] Verificare permisiune upload...');
  try {
    const { peerId, fileSizeBytes } = req.body;
    
    if (!peerId || !fileSizeBytes) {
      return res.status(400).json({
        success: false,
        error: 'peerId si fileSizeBytes sunt necesare'
      });
    }

    const checkResult = UserStorage.canUpload(peerId, parseInt(fileSizeBytes));
    
    res.json({
      success: true,
      ...checkResult
    });
  } catch (error) {
    console.error('[USER-STORAGE] Eroare:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', (req, res) => {
  console.log('[USER-STORAGE] Obtinere toti utilizatorii...');
  try {
    const users = UserStorage.getAllUsers();
    
    res.json({
      success: true,
      totalUsers: users.length,
      users
    });
  } catch (error) {
    console.error('[USER-STORAGE] Eroare:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:peerId/add-storage', (req, res) => {
  console.log(`[USER-STORAGE] Adaugare stocare pentru: ${req.params.peerId}`);
  try {
    const { peerId } = req.params;
    const { additionalGB, contractId } = req.body;
    
    if (!additionalGB) {
      return res.status(400).json({
        success: false,
        error: 'additionalGB este necesar'
      });
    }

    const result = UserStorage.addContractStorage(
      peerId, 
      contractId || `manual-${Date.now()}`, 
      parseFloat(additionalGB)
    );
    
    const newInfo = UserStorage.getUserStorageInfo(peerId);
    
    res.json({
      success: true,
      message: `Adaugat ${additionalGB} GB pentru ${peerId}`,
      ...result,
      storageInfo: newInfo
    });
  } catch (error) {
    console.error('[USER-STORAGE] Eroare:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
