const express = require('express');
const router = express.Router();
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const DockerClusterClient = require('../utils/dockerClusterClient');
const clusterClient = DockerClusterClient.default;
const { IPFS_PATH } = require('../config/paths');
const UserStorage = require('../models/UserStorage');
const providerRouter = require('../utils/providerNetworkRouter');

const metadataPath = path.join(IPFS_PATH, 'cluster-files-metadata.json');

function loadMetadata() {
  try {
    if (fs.existsSync(metadataPath)) {
      return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }
  } catch (error) {
    console.error('[DOCKER-CLUSTER] Eroare la citire metadata:', error.message);
  }
  return {};
}

function saveMetadata(data) {
  try {
    fs.writeFileSync(metadataPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[DOCKER-CLUSTER] Eroare la salvare metadata:', error.message);
  }
}

router.get('/status', async (req, res) => {
  console.log('[DOCKER-CLUSTER] Obtinere status cluster...');
  try {
    const clusterInfo = await clusterClient.getClusterInfo();
    const peers = clusterInfo.peers || [];
    const pinsData = clusterInfo.pins || {};

    console.log('[DOCKER-CLUSTER] pinsData type:', typeof pinsData);
    console.log('[DOCKER-CLUSTER] pinsData is object:', typeof pinsData === 'object');
    console.log('[DOCKER-CLUSTER] pinsData keys count:', Object.keys(pinsData).length);
    console.log('[DOCKER-CLUSTER] pinsData keys:', Object.keys(pinsData));

    let pinsList = [];
    if (Array.isArray(pinsData)) {
      console.log('[DOCKER-CLUSTER] pinsData is array, using directly');
      pinsList = pinsData;
    } else if (typeof pinsData === 'object' && pinsData !== null) {
      console.log('[DOCKER-CLUSTER] pinsData is object, converting to array');
      pinsList = Object.entries(pinsData).map(([cid, pinInfo]) => {
        console.log(`[DOCKER-CLUSTER] Processing pin: ${cid}`, pinInfo);
        return {
          cid: cid,
          name: pinInfo.name || 'File',
          ...pinInfo
        };
      });
    }

    console.log(`[DOCKER-CLUSTER] Final pinsList length: ${pinsList.length}`);
    console.log(`[DOCKER-CLUSTER] Final pinsList:`, JSON.stringify(pinsList, null, 2));

    const responseData = {
      success: true,
      cluster: {
        totalNodes: clusterInfo.totalNodes,
        peers: Array.isArray(peers) ? peers.length : 0,
        pinnedFiles: pinsList.length,
        peersList: peers,
        pinsList: pinsList,
        nodesHealth: clusterInfo.nodesHealth,
        nodes: clusterInfo.nodes
      }
    };

    console.log('[DOCKER-CLUSTER] Sending response:', JSON.stringify(responseData, null, 2));
    res.json(responseData);
  } catch (error) {
    console.error('[DOCKER-CLUSTER] Eroare la status:', error.message);
    res.status(500).json({
      success: false,
      error: 'Cluster-ul nu este disponibil. Asigura-te ca Docker Compose ruleaza.',
      details: error.message
    });
  }
});

router.get('/peers', async (req, res) => {
  console.log('[DOCKER-CLUSTER] Obtinere peers...');
  try {
    const peers = await clusterClient.get('/peers');

    res.json({
      success: true,
      totalPeers: Array.isArray(peers) ? peers.length : 0,
      peers: peers || []
    });
  } catch (error) {
    console.error('[DOCKER-CLUSTER] Eroare la peers:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/add', async (req, res) => {
  console.log('[DOCKER-CLUSTER] Adaugare fisier in cluster...');
  console.log('[DOCKER-CLUSTER] req.files:', req.files);
  console.log('[DOCKER-CLUSTER] req.body:', req.body);

  if (!req.files || !req.files.file) {
    console.error('[DOCKER-CLUSTER] Niciun fisier gasit in request');
    return res.status(400).json({
      success: false,
      error: 'Niciun fisier nu a fost incarcat'
    });
  }

  const uploadedFile = req.files.file;
  const tempPath = uploadedFile.tempFilePath;

  // Get the actual owner from request body, then headers, then fallback
  const peerId = req.body.owner || req.body.uploadedBy || req.headers['x-user-id'] || req.body.peerId || 'default-user';

  console.log(`[DOCKER-CLUSTER] Verificare limita stocare pentru ${peerId}, fisier: ${uploadedFile.size} bytes`);
  const storageCheck = UserStorage.canUpload(peerId, uploadedFile.size);

  if (!storageCheck.allowed) {
    console.log(`[DOCKER-CLUSTER] Upload refuzat - limita depasita pentru ${peerId}`);

    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    return res.status(400).json({
      success: false,
      error: storageCheck.reason,
      storageExceeded: true,
      currentUsedBytes: storageCheck.currentUsed,
      limitBytes: storageCheck.limit,
      wouldUseBytes: storageCheck.wouldUse,
      suggestion: storageCheck.suggestion
    });
  }

  let storageWarning = null;
  if (storageCheck.warning) {
    storageWarning = {
      status: storageCheck.status,
      message: storageCheck.warning,
      usageAfterUpload: storageCheck.usageAfterUpload
    };
    console.log(`[DOCKER-CLUSTER] Avertizare stocare: ${storageCheck.warning}`);
  }

  try {
    // ========================================
    // PROVIDER-FIRST UPLOAD STRATEGY
    // ========================================
    const contractId = req.body.contractId;
    let cid = null;
    let storedOn = 'cluster'; // Default
    let providerUploadResult = null;

    // Default values for cluster-specific variables
    let replicationFactor = parseInt(req.body.replicationFactor) || 3;
    let replicationStatus = 'N/A';
    let pinnedPeers = 0;
    let responseData = { allocations: [] };

    // Step 1: Check if upload is for a contract - use provider storage
    if (contractId) {
      console.log(`[DOCKER-CLUSTER] 🎯 Contract-based upload detected: ${contractId}`);

      try {
        const StorageContract = require('../models/StorageContract');
        const StorageProvider = require('../models/StorageProvider');
        const StorageReservation = require('../models/StorageReservationManager');
        const crypto = require('crypto');

        // 1. Validate contract
        const contract = StorageContract.getContract(contractId);
        if (!contract) {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          return res.status(404).json({ success: false, error: 'Contract not found' });
        }

        if (contract.status !== 'active') {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          return res.status(400).json({
            success: false,
            error: `Contract is not active (status: ${contract.status})`
          });
        }

        // 2. Check storage quota
        const fileSizeGB = uploadedFile.size / (1024 * 1024 * 1024);
        const newUsedGB = contract.storage.usedGB + fileSizeGB;

        if (newUsedGB > contract.storage.allocatedGB) {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          return res.status(400).json({
            success: false,
            error: `Storage quota exceeded. Allocated: ${contract.storage.allocatedGB}GB, Used: ${contract.storage.usedGB.toFixed(3)}GB, File: ${fileSizeGB.toFixed(3)}GB`,
            quota: {
              allocatedGB: contract.storage.allocatedGB,
              usedGB: contract.storage.usedGB,
              availableGB: contract.storage.allocatedGB - contract.storage.usedGB,
              requestedGB: fileSizeGB
            }
          });
        }

        // 3. Get provider storage path
        const providerPath = StorageReservation.getProviderStoragePath(contract.providerId);

        if (!providerPath) {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          return res.status(500).json({
            success: false,
            error: 'Provider storage path not found. Provider may not be properly registered.'
          });
        }

        // 4. Write file to provider folder
        const timestamp = Date.now();
        const hash = crypto.createHash('md5').update(uploadedFile.name + timestamp).digest('hex').substring(0, 8);
        const safeFilename = `${timestamp}-${hash}-${uploadedFile.name}`;
        const filePath = path.join(providerPath, safeFilename);

        // Copy from temp to provider folder
        fs.copyFileSync(tempPath, filePath);
        console.log(`[DOCKER-CLUSTER] ✅ File written to provider storage: ${filePath}`);

        // Clean up temp file
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

        // 5. Update contract metadata
        const fileId = `file-${timestamp}-${hash}`;
        const result = StorageContract.addFileToContract(contractId, {
          cid: fileId,
          name: uploadedFile.name,
          sizeBytes: uploadedFile.size,
          mimetype: uploadedFile.mimetype,
          localPath: filePath,
          safeFilename: safeFilename
        });

        if (!result.success) {
          // Rollback: delete the file
          try {
            fs.unlinkSync(filePath);
          } catch (unlinkError) {
            console.error('[DOCKER-CLUSTER] Failed to rollback file:', unlinkError);
          }
          return res.status(400).json(result);
        }


        // 6. Update provider tracking
        StorageReservation.updateUsedSpace(contract.providerId, newUsedGB);
        StorageProvider.updateUsedStorage(contract.providerId, newUsedGB);

        // ========================================
        // 7. Send pin request to provider via WebSocket
        // ========================================
        try {
          const providerSocketServer = require('../websocket/providerSocket');

          // Check if provider is connected via WebSocket
          if (providerSocketServer.isProviderConnected(contract.providerId)) {
            console.log(`[DOCKER-CLUSTER] 📌 Sending pin request to provider via WebSocket...`);

            // Send pin request with file info
            const pinSent = providerSocketServer.requestPin(
              contract.providerId,
              fileId, // Using fileId as CID for now
              contractId
            );

            if (pinSent) {
              console.log(`[DOCKER-CLUSTER] ✅ Pin request sent to provider ${contract.providerId}`);
            } else {
              console.log(`[DOCKER-CLUSTER] ⚠️ Failed to send pin request (provider may be offline)`);
            }
          } else {
            console.log(`[DOCKER-CLUSTER] ℹ️ Provider ${contract.providerId} not connected via WebSocket, file stored locally`);
          }
        } catch (wsError) {
          console.warn(`[DOCKER-CLUSTER] WebSocket pin request failed: ${wsError.message}`);
          // Continue anyway - file is already stored locally
        }

        // 8. Record upload for user storage tracking
        UserStorage.recordUpload(peerId, fileId, uploadedFile.size, uploadedFile.name);

        // 8. Save metadata
        const metadata = loadMetadata();
        const { description = '', tags = '', encryption } = req.body;
        const parsedTags = typeof tags === 'string' && tags.trim()
          ? tags.split(',').map(t => t.trim()).filter(t => t)
          : [];

        let encryptionInfo = null;
        if (encryption) {
          try {
            encryptionInfo = typeof encryption === 'string' ? JSON.parse(encryption) : encryption;
          } catch (e) {
            console.warn('[DOCKER-CLUSTER] Invalid encryption metadata:', e.message);
          }
        }

        metadata[fileId] = {
          cid: fileId,
          name: uploadedFile.name,
          size: uploadedFile.size,
          mimetype: uploadedFile.mimetype,
          description: description.trim(),
          tags: parsedTags,
          uploadedAt: new Date().toISOString(),
          uploadedBy: peerId,
          contractId: contractId,
          storedOn: 'provider',
          localPath: filePath,
          providerId: contract.providerId,
          encryption: encryptionInfo
        };
        saveMetadata(metadata);

        const updatedStorageInfo = UserStorage.getUserStorageInfo(peerId);
        const provider = StorageProvider.getProvider(contract.providerId);

        console.log(`[DOCKER-CLUSTER] ✅ File uploaded to provider storage successfully: ${fileId}`);

        // Return response in same format as IPFS upload for compatibility
        return res.json({
          success: true,
          message: 'File uploaded to provider storage successfully',
          cid: fileId, // Use fileId as "CID" for compatibility
          file: {
            name: uploadedFile.name,
            cid: fileId,
            size: uploadedFile.size,
            mimetype: uploadedFile.mimetype,
            description: description.trim(),
            tags: parsedTags,
            uploadedAt: new Date().toISOString(),
            accessUrls: [], // No IPFS URLs for provider storage
            encryption: encryptionInfo ? {
              enabled: true,
              algorithm: encryptionInfo.algorithm,
              originalName: encryptionInfo.originalName
            } : { enabled: false }
          },
          providerRouting: {
            sentToProvider: true,
            providerName: provider?.name || 'Unknown',
            providerStatus: 'stored',
            storagePath: providerPath,
            message: `✓ File stored in provider folder: ${provider?.name || contract.providerId}`
          },
          contract: {
            id: contract.id,
            usedGB: newUsedGB.toFixed(3),
            allocatedGB: contract.storage.allocatedGB,
            availableGB: (contract.storage.allocatedGB - newUsedGB).toFixed(3),
            filesCount: result.contract.storage.files.length
          },
          storageInfo: {
            usedGB: updatedStorageInfo.storage.usedGB,
            limitGB: updatedStorageInfo.storage.limitGB,
            usagePercent: updatedStorageInfo.storage.usagePercent,
            remainingGB: updatedStorageInfo.storage.remainingGB
          },
          storageWarning: storageWarning
        });

      } catch (contractError) {
        console.error('[DOCKER-CLUSTER] Contract upload error:', contractError);
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        return res.status(500).json({
          success: false,
          error: `Contract upload failed: ${contractError.message}`
        });
      }
    }

    // Step 2: Fallback to cluster if provider upload failed or no contract
    if (!cid) {
      console.log(`[DOCKER-CLUSTER] 📦 Uploading to backup cluster...`);

      const form = new FormData();
      form.append('file', fs.createReadStream(tempPath), {
        filename: uploadedFile.name,
        contentType: uploadedFile.mimetype
      });

      const responseData = await clusterClient.post('/add', form, {
        headers: form.getHeaders(),
        timeout: 60000
      });

      console.log('[DOCKER-CLUSTER] Raspuns cluster RAW:', JSON.stringify(responseData, null, 2));
      console.log('[DOCKER-CLUSTER] Tip raspuns:', typeof responseData);
      console.log('[DOCKER-CLUSTER] Chei raspuns:', responseData ? Object.keys(responseData) : 'null');

      cid = clusterClient.extractCID(responseData);

      if (!cid) {
        console.error('[DOCKER-CLUSTER] Nu s-a putut extrage CID din raspuns');
        console.error('[DOCKER-CLUSTER] Raspuns complet:', JSON.stringify(responseData, null, 2));
        throw new Error('Nu s-a putut extrage CID-ul din raspuns');
      }

      storedOn = 'cluster';
      console.log(`[DOCKER-CLUSTER] Fisier adaugat cu CID: ${cid}`);

      UserStorage.recordUpload(peerId, cid, uploadedFile.size, uploadedFile.name);

      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }

      replicationFactor = parseInt(req.body.replicationFactor) || 3;
      console.log(`[DOCKER-CLUSTER] 📋 Configurare replicare: ${replicationFactor} copii...`);

      try {
        await clusterClient.post(`/pins/${cid}`, {
          replication_factor_min: Math.min(replicationFactor, 2),
          replication_factor_max: replicationFactor,
          name: uploadedFile.name,
          mode: 'recursive',
          pin_options: {
            replication: replicationFactor
          }
        });
        console.log(`[DOCKER-CLUSTER] ✓ Replicare configurată: ${replicationFactor} noduri`);
      } catch (repError) {
        console.warn('[DOCKER-CLUSTER] ⚠️ Eroare la configurare replicare:', repError.message);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      let pinStatus = null;
      pinnedPeers = 0;
      replicationStatus = 'pending';
      try {
        pinStatus = await clusterClient.get(`/pins/${cid}`);
        if (pinStatus && pinStatus.peer_map) {
          const pinnedNodes = Object.values(pinStatus.peer_map).filter(p => p.status === 'pinned');
          pinnedPeers = pinnedNodes.length;

          if (pinnedPeers >= replicationFactor) {
            replicationStatus = 'complete';
            console.log(`[DOCKER-CLUSTER] ✓ Replicare completă: ${pinnedPeers}/${replicationFactor} noduri`);
          } else if (pinnedPeers > 0) {
            replicationStatus = 'partial';
            console.log(`[DOCKER-CLUSTER] ⏳ Replicare parțială: ${pinnedPeers}/${replicationFactor} noduri`);
          }
        }
      } catch (e) {
        console.warn('[DOCKER-CLUSTER] Nu s-a putut obtine status pin:', e.message);
      }

    } // End of if (!cid) block - cluster fallback

    // At this point we should have a valid CID (from provider or cluster)
    if (!cid) {
      throw new Error('Failed to upload file to both provider and cluster');
    }

    // Clean up temp file
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    // Record upload
    UserStorage.recordUpload(peerId, cid, uploadedFile.size, uploadedFile.name);

    // Get gateways for access URLs
    const gateways = clusterClient.getIPFSGateways();
    const accessUrls = gateways.map(gw => `${gw}/ipfs/${cid}`);

    const metadata = loadMetadata();
    const { description = '', tags = '', encryption } = req.body;
    const parsedTags = typeof tags === 'string' && tags.trim()
      ? tags.split(',').map(t => t.trim()).filter(t => t)
      : [];

    let encryptionInfo = null;
    if (encryption) {
      try {
        encryptionInfo = typeof encryption === 'string' ? JSON.parse(encryption) : encryption;
      } catch (e) {
        console.warn('[DOCKER-CLUSTER] Invalid encryption metadata:', e.message);
      }
    }

    metadata[cid] = {
      cid: cid,
      name: uploadedFile.name,
      size: uploadedFile.size,
      mimetype: uploadedFile.mimetype,
      description: description.trim(),
      tags: parsedTags,
      uploadedAt: new Date().toISOString(),
      pinnedOn: pinnedPeers,
      uploadedBy: peerId,
      contractId: req.body.contractId || null,
      replication: {
        factor: replicationFactor,
        status: replicationStatus,
        nodes: pinnedPeers
      },
      encryption: encryptionInfo
    };
    saveMetadata(metadata);

    // Provider routing info (already set during upload)
    let providerRouting = null;
    if (storedOn === 'provider' && providerUploadResult) {
      providerRouting = {
        sentToProvider: true,
        providerName: providerUploadResult.providerName,
        providerStatus: 'online',
        message: `✓ File stored on provider: ${providerUploadResult.providerName}`
      };
    } else {
      providerRouting = {
        sentToProvider: false,
        storedOn: storedOn,
        message: '📦 File stored in backup cluster'
      };
    }

    const updatedStorageInfo = UserStorage.getUserStorageInfo(peerId);

    res.json({
      success: true,
      message: 'Fisier adaugat in cluster cu succes',
      cid: cid,
      file: {
        name: uploadedFile.name,
        cid: cid,
        size: uploadedFile.size,
        mimetype: uploadedFile.mimetype,
        description: description.trim(),
        tags: parsedTags,
        pinnedOn: pinnedPeers,
        allocations: responseData.allocations || [],
        accessUrls: accessUrls,
        uploadedAt: new Date().toISOString(),
        replication: {
          factor: replicationFactor,
          status: replicationStatus,
          nodes: pinnedPeers,
          message: pinnedPeers >= replicationFactor
            ? `✓ Fișier replicat pe ${pinnedPeers} noduri`
            : `⏳ Replicare în curs: ${pinnedPeers}/${replicationFactor} noduri`
        },
        encryption: encryptionInfo ? {
          enabled: true,
          algorithm: encryptionInfo.algorithm,
          originalName: encryptionInfo.originalName
        } : { enabled: false }
      },
      providerRouting: providerRouting,
      storageInfo: {
        usedGB: updatedStorageInfo.storage.usedGB,
        limitGB: updatedStorageInfo.storage.limitGB,
        usagePercent: updatedStorageInfo.storage.usagePercent,
        remainingGB: updatedStorageInfo.storage.remainingGB
      },
      storageWarning: storageWarning
    });

  } catch (error) {
    console.error('[DOCKER-CLUSTER] Eroare la add:', error.message);

    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (cleanupError) {
        console.error('[DOCKER-CLUSTER] Eroare la cleanup:', cleanupError.message);
      }
    }

    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Verifica ca clusterul Docker ruleaza (docker-compose ps in folderul Infrastructura)'
    });
  }
});

router.get('/pins', async (req, res) => {
  console.log('[DOCKER-CLUSTER] Obtinere lista fisiere pinuite...');
  try {
    const metadata = loadMetadata();
    let cidList = [];

    // Try to get cluster pins, but don't fail if cluster is unavailable
    try {
      const pinsData = await clusterClient.get('/pins');
      if (pinsData && typeof pinsData === 'object') {
        cidList = Object.keys(pinsData).filter(key =>
          key.startsWith('Qm') || key.startsWith('baf') || key.startsWith('bafy')
        );
      }
    } catch (clusterError) {
      console.warn('[DOCKER-CLUSTER] Cluster unavailable, using metadata only:', clusterError.message);
    }

    // Also include CIDs from metadata that might be on provider (not in cluster)
    const metadataCids = Object.keys(metadata).filter(key =>
      key.startsWith('Qm') || key.startsWith('baf') || key.startsWith('bafy')
    );

    // Merge unique CIDs from both sources
    const allCids = [...new Set([...cidList, ...metadataCids])];
    console.log(`[DOCKER-CLUSTER] Total CIDs: ${allCids.length} (${cidList.length} from cluster, ${metadataCids.length} from metadata)`);

    const filesWithMetadata = allCids.map(cid => {
      const meta = metadata[cid] || {};
      return {
        hash: cid,
        cid: cid,
        name: meta.name || `${cid.substring(0, 12)}...`,
        size: meta.size || 'Unknown',
        mimetype: meta.mimetype || 'application/octet-stream',
        description: meta.description || '',
        tags: meta.tags || [],
        uploadedAt: meta.uploadedAt || new Date().toISOString(),
        pinnedOn: meta.pinnedOn || 0,
        encryption: meta.encryption || null,
        contractId: meta.contractId || null,
        uploadedBy: meta.uploadedBy || null,
        storedOn: cidList.includes(cid) ? 'cluster' : 'provider'
      };
    });

    console.log(`[DOCKER-CLUSTER] ${filesWithMetadata.length} fisiere gasite total`);

    res.json({
      success: true,
      totalPins: filesWithMetadata.length,
      pins: filesWithMetadata
    });
  } catch (error) {
    console.error('[DOCKER-CLUSTER] Eroare la pins:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/pin/:cid', async (req, res) => {
  console.log(`[DOCKER-CLUSTER] Verificare status pin pentru ${req.params.cid}...`);
  try {
    const { cid } = req.params;
    const status = await clusterClient.get(`/pins/${cid}`);

    res.json({
      success: true,
      cid: cid,
      replicationCount: Array.isArray(status) ? status.length : 0,
      status: status
    });
  } catch (error) {
    console.error('[DOCKER-CLUSTER] Eroare la pin status:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/pin/:cid', async (req, res) => {
  console.log(`[DOCKER-CLUSTER] Unpin fisier ${req.params.cid}...`);
  try {
    const { cid } = req.params;
    const metadata = loadMetadata();
    const fileInfo = metadata[cid];

    let unpinnedFromCluster = false;
    let unpinnedFromProvider = false;

    // Check if file is stored on provider or cluster
    const isProviderFile = fileInfo && (fileInfo.storedOn === 'provider' || !fileInfo.pinnedOn);

    // Try to unpin from cluster (if it's there)
    try {
      await clusterClient.delete(`/pins/${cid}`);
      unpinnedFromCluster = true;
      console.log(`[DOCKER-CLUSTER] ✓ Unpinned from cluster: ${cid}`);
    } catch (clusterError) {
      // 404 means file isn't in cluster - that's OK for provider files
      if (clusterError.message?.includes('404')) {
        console.log(`[DOCKER-CLUSTER] File not in cluster (expected for provider files): ${cid}`);
      } else {
        console.warn(`[DOCKER-CLUSTER] Cluster unpin warning: ${clusterError.message}`);
      }
    }

    // If it's a provider file, try to unpin from provider
    if (isProviderFile && fileInfo?.contractId) {
      try {
        const contract = require('../models/StorageContract').getContract(fileInfo.contractId);
        if (contract?.providerId) {
          const provider = require('../models/StorageProvider').getProvider(contract.providerId);
          if (provider?.agentEndpoint) {
            const axios = require('axios');
            await axios.post(`${provider.agentEndpoint}/unpin`, { cid }, { timeout: 10000 });
            unpinnedFromProvider = true;
            console.log(`[DOCKER-CLUSTER] ✓ Unpinned from provider: ${cid}`);
          }
        }
      } catch (providerError) {
        console.warn(`[DOCKER-CLUSTER] Provider unpin warning: ${providerError.message}`);
        // Continue - we'll still remove from metadata
      }
    }

    // Remove from user storage
    UserStorage.removeFileFromAllUsers(cid);

    // Remove from metadata
    if (metadata[cid]) {
      delete metadata[cid];
      saveMetadata(metadata);
      console.log(`[DOCKER-CLUSTER] ✓ Removed from metadata: ${cid}`);
    }

    console.log(`[DOCKER-CLUSTER] ✓ Fisier sters: ${cid}`);

    res.json({
      success: true,
      message: 'Fisier sters',
      cid: cid,
      unpinnedFrom: {
        cluster: unpinnedFromCluster,
        provider: unpinnedFromProvider
      },
      deletedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[DOCKER-CLUSTER] Eroare la unpin:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});


router.get('/download/:cid', async (req, res) => {
  console.log(`[DOCKER-CLUSTER] Download fisier ${req.params.cid}...`);
  try {
    const { cid } = req.params;
    const axios = require('axios');
    const gateways = clusterClient.getIPFSGateways();

    const metadata = loadMetadata();
    const fileInfo = metadata[cid];
    let filename = fileInfo?.name || cid;

    console.log(`[DOCKER-CLUSTER] Filename din metadata: ${filename}`);

    let lastError;
    for (const gateway of gateways) {
      try {
        const gatewayUrl = `${gateway}/ipfs/${cid}`;
        console.log(`[DOCKER-CLUSTER] Descarcare de la: ${gatewayUrl}`);

        const response = await axios.get(gatewayUrl, {
          responseType: 'stream',
          timeout: 30000,
          validateStatus: (status) => status === 200
        });

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', fileInfo?.mimetype || response.headers['content-type'] || 'application/octet-stream');
        if (response.headers['content-length']) {
          res.setHeader('Content-Length', response.headers['content-length']);
        }

        response.data.pipe(res);
        return;

      } catch (err) {
        lastError = err;
        console.warn(`[DOCKER-CLUSTER] Gateway ${gateway} indisponibil, incerc urmatorul...`);
        continue;
      }
    }

    throw lastError || new Error('Toate gateway-urile IPFS sunt indisponibile');

  } catch (error) {
    console.error('[DOCKER-CLUSTER] Eroare la download:', error.message);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Nu s-a putut descarca fisierul',
        details: error.message,
        suggestion: 'Verifica ca nodurile IPFS din cluster ruleaza (docker-compose ps)'
      });
    }
  }
});

router.get('/health', async (req, res) => {
  console.log('[DOCKER-CLUSTER] Health check...');

  try {
    const nodesHealth = await clusterClient.checkAllNodes();
    const nodeStatuses = Object.entries(nodesHealth).map(([node, healthy]) => ({
      url: node,
      status: healthy ? 'online' : 'offline',
      healthy: healthy
    }));

    const onlineNodes = nodeStatuses.filter(n => n.healthy).length;
    const totalNodes = nodeStatuses.length;
    const isHealthy = onlineNodes >= Math.ceil(totalNodes / 2);

    res.json({
      success: true,
      health: {
        status: isHealthy ? 'HEALTHY' : (onlineNodes > 0 ? 'DEGRADED' : 'DOWN'),
        totalNodes: totalNodes,
        onlineNodes: onlineNodes,
        offlineNodes: totalNodes - onlineNodes,
        healthPercentage: Math.round((onlineNodes / totalNodes) * 100),
        nodes: nodeStatuses,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[DOCKER-CLUSTER] Eroare la health check:', error.message);
    res.status(500).json({
      success: false,
      health: {
        status: 'ERROR',
        error: error.message
      }
    });
  }
});

router.get('/file/:cid', async (req, res) => {
  const { cid } = req.params;
  console.log(`[DOCKER-CLUSTER] Cerere descarcare fisier: ${cid}`);

  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execPromise = promisify(exec);
    const fileType = require('file-type');

    let fileName = cid;
    let mimeType = 'application/octet-stream';

    try {
      const pinInfo = await clusterClient.get(`/pins/${cid}`);
      if (pinInfo && pinInfo.name) {
        fileName = pinInfo.name;
      }
    } catch (e) {
      console.log('[DOCKER-CLUSTER] Nu s-au putut obtine informatii despre pin');
    }

    const containers = ['ipfs-node-1', 'ipfs-node-2', 'ipfs-node-3', 'ipfs-node-4', 'ipfs-node-5'];

    for (const container of containers) {
      try {
        console.log(`[DOCKER-CLUSTER] incercare descarcare de la container: ${container}`);

        const command = `docker exec ${container} ipfs cat ${cid}`;
        const { stdout, stderr } = await execPromise(command, {
          encoding: 'buffer',
          maxBuffer: 100 * 1024 * 1024
        });

        if (stderr && stderr.length > 0) {
          console.warn(`[DOCKER-CLUSTER] Stderr de la ${container}:`, stderr.toString());
        }

        try {
          const detectedType = await fileType.fromBuffer(stdout);
          if (detectedType) {
            mimeType = detectedType.mime;
            if (!fileName.includes('.')) {
              fileName = `${fileName}.${detectedType.ext}`;
            }
            console.log(`[DOCKER-CLUSTER] Tip detectat: ${mimeType}, extensie: ${detectedType.ext}`);
          }
        } catch (e) {
          console.log('[DOCKER-CLUSTER] Nu s-a putut detecta tipul fisierului');
        }

        const inline = req.query.inline === 'true';
        const disposition = inline ? 'inline' : 'attachment';

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `${disposition}; filename="${fileName}"`);
        res.setHeader('Content-Length', stdout.length);

        res.send(stdout);
        console.log(`[DOCKER-CLUSTER] Fisier servit cu succes de la ${container} (${stdout.length} bytes, ${mimeType})`);
        return;

      } catch (containerError) {
        console.warn(`[DOCKER-CLUSTER] Container ${container} esuat:`, containerError.message);
        continue;
      }
    }

    console.error(`[DOCKER-CLUSTER] Niciun container IPFS nu poate servi CID-ul: ${cid}`);
    res.status(404).json({
      success: false,
      error: 'Fisierul nu poate fi accesat prin niciun nod IPFS disponibil',
      cid: cid,
      hint: 'Verifica ca fisierul este pinned in cluster'
    });

  } catch (error) {
    console.error('[DOCKER-CLUSTER] Eroare la descarcare fisier:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;