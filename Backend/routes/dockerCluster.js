const express = require('express');
const router = express.Router();
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const clusterClient = require('../utils/dockerClusterClient');
const { IPFS_PATH } = require('../config/paths');
const UserStorage = require('../models/UserStorage');

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

  const peerId = req.body.peerId || req.headers['x-peer-id'] || 'default-user';

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
    const form = new FormData();
    form.append('file', fs.createReadStream(tempPath), {
      filename: uploadedFile.name,
      contentType: uploadedFile.mimetype
    });

    console.log(`[DOCKER-CLUSTER] Upload fisier: ${uploadedFile.name} (${uploadedFile.size} bytes)`);
    
    const responseData = await clusterClient.post('/add', form, {
      headers: form.getHeaders(),
      timeout: 60000
    });

    console.log('[DOCKER-CLUSTER] Raspuns cluster RAW:', JSON.stringify(responseData, null, 2));
    console.log('[DOCKER-CLUSTER] Tip raspuns:', typeof responseData);
    console.log('[DOCKER-CLUSTER] Chei raspuns:', responseData ? Object.keys(responseData) : 'null');

    const cid = clusterClient.extractCID(responseData);

    if (!cid) {
      console.error('[DOCKER-CLUSTER] Nu s-a putut extrage CID din raspuns');
      console.error('[DOCKER-CLUSTER] Raspuns complet:', JSON.stringify(responseData, null, 2));
      throw new Error('Nu s-a putut extrage CID-ul din raspuns');
    }

    console.log(`[DOCKER-CLUSTER] Fisier adaugat cu CID: ${cid}`);

    UserStorage.recordUpload(peerId, cid, uploadedFile.size, uploadedFile.name);

    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    let pinStatus = null;
    let pinnedPeers = 0;
    try {
      pinStatus = await clusterClient.get(`/pins/${cid}`);
      if (pinStatus && pinStatus.peer_map) {
        pinnedPeers = Object.values(pinStatus.peer_map).filter(p => p.status === 'pinned').length;
      }
    } catch (e) {
      console.warn('[DOCKER-CLUSTER] Nu s-a putut obtine status pin:', e.message);
    }

    const gateways = clusterClient.getIPFSGateways();
    const accessUrls = gateways.map(gw => `${gw}/ipfs/${cid}`);

    const metadata = loadMetadata();
    const { description = '', tags = '' } = req.body;
    const parsedTags = typeof tags === 'string' && tags.trim() 
      ? tags.split(',').map(t => t.trim()).filter(t => t) 
      : [];

    metadata[cid] = {
      cid: cid,
      name: uploadedFile.name,
      size: uploadedFile.size,
      mimetype: uploadedFile.mimetype,
      description: description.trim(),
      tags: parsedTags,
      uploadedAt: new Date().toISOString(),
      pinnedOn: pinnedPeers,
      uploadedBy: peerId
    };
    saveMetadata(metadata);

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
        uploadedAt: new Date().toISOString()
      },
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
    const pinsData = await clusterClient.get('/pins');
    const metadata = loadMetadata();
    
    let cidList = [];
    
    if (pinsData && typeof pinsData === 'object') {
      cidList = Object.keys(pinsData).filter(key => 
        key.startsWith('Qm') || key.startsWith('baf') || key.startsWith('bafy')
      );
    }

    const filesWithMetadata = cidList.map(cid => {
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
        pinnedOn: meta.pinnedOn || 0
      };
    });
    
    console.log(`[DOCKER-CLUSTER] ${filesWithMetadata.length} fisiere gasite in cluster`);
    
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
    await clusterClient.delete(`/pins/${cid}`);

    UserStorage.removeFileFromAllUsers(cid);

    const metadata = loadMetadata();
    if (metadata[cid]) {
      delete metadata[cid];
      saveMetadata(metadata);
    }
    
    console.log(`[DOCKER-CLUSTER] ✓ Fisier unpinuit: ${cid}`);
    
    res.json({
      success: true,
      message: 'Fisier sters din cluster',
      cid: cid,
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