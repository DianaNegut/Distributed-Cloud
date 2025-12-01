const express = require('express');
const router = express.Router();
const { execPromise } = require('../utils/execPromise');
const { ensureKuboInstalled } = require('../utils/ensureKuboInstalled');
const { KUBO_PATH, IPFS_PATH } = require('../config/paths');
const fs = require('fs');
const path = require('path');

const fileMetadataPath = path.join(IPFS_PATH, 'cluster-metadata.json');

function loadMetadata() {
  try {
    if (fs.existsSync(fileMetadataPath)) {
      return JSON.parse(fs.readFileSync(fileMetadataPath, 'utf8'));
    }
  } catch (error) {
    console.error('[METADATA] Eroare la citire:', error.message);
  }
  return {};
}

function saveMetadata(data) {
  try {
    fs.writeFileSync(fileMetadataPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[METADATA] Eroare la salvare:', error.message);
  }
}


router.post('/init', async (req, res) => {
  try {
    await ensureKuboInstalled();
    const { clusterName = 'ipfs-cluster', replicationFactor = 3 } = req.body;
    const clusterConfigPath = path.join(IPFS_PATH, 'cluster-config.json');
    const clusterConfig = {
      cluster: {
        name: clusterName,
        replicationFactorMin: replicationFactor,
        replicationFactorMax: replicationFactor + 1,
        monitorInterval: '5s'
      },
      storage: {
        type: 'ipfs-only',
        redundancy: `${replicationFactor}x`
      },
      created: new Date().toISOString()
    };
    fs.writeFileSync(clusterConfigPath, JSON.stringify(clusterConfig, null, 2));
    res.json({ 
      success: true, 
      message: 'Cluster IPFS initializat cu succes',
      config: clusterConfig
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


router.post('/add', async (req, res) => {
  console.log('[CLUSTER] Procesare cerere de adăugare în cluster...');
  try {
    await ensureKuboInstalled();

    const { fileHash, fileName, description = '', tags = [] } = req.body;
    if (!fileHash) {
      return res.status(400).json({ success: false, error: 'fileHash obligatoriu' });
    }

  
    const fileInfo = await execPromise(`ipfs files stat /ipfs/${fileHash}`, { cwd: KUBO_PATH });
    const hashData = JSON.parse(fileInfo.stdout);

   
    const pinResult = await execPromise(`ipfs pin add ${fileHash}`, { cwd: KUBO_PATH });
    

    const metadata = loadMetadata();
    metadata[fileHash] = {
      name: fileName || `file-${fileHash.substring(0, 8)}`,
      hash: fileHash,
      size: hashData.CumulativeSize,
      description,
      tags,
      addedAt: new Date().toISOString(),
      replicationType: 'pinned',
      availability: 'available'
    };
    saveMetadata(metadata);

    console.log(`[CLUSTER] Fișier pinuit și înregistrat: ${fileHash}`);

    res.json({
      success: true,
      message: 'Fișier adăugat în cluster cu replicare',
      file: metadata[fileHash]
    });
  } catch (error) {
    console.error('[CLUSTER] Eroare:', error.stderr || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});


router.get('/status', async (req, res) => {
  console.log('[CLUSTER] Procesare cerere status cluster...');
  try {
    await ensureKuboInstalled();

   
    const pinsResult = await execPromise('ipfs pin ls --type recursive', { cwd: KUBO_PATH });
    const pins = pinsResult.stdout.split('\n').filter(p => p.trim()).map(p => {
      const [hash, type] = p.split(' ');
      return { hash, type };
    });

  
    const peersResult = await execPromise('ipfs swarm peers', { cwd: KUBO_PATH });
    const peers = peersResult.stdout.split('\n').filter(p => p.trim());

   
    const idResult = await execPromise('ipfs id', { cwd: KUBO_PATH });
    const nodeData = JSON.parse(idResult.stdout);

  
    const metadata = loadMetadata();
    const filesList = Object.values(metadata).map(f => ({
      ...f,
      hash: f.hash.substring(0, 12) + '...'
    }));

    res.json({
      success: true,
      cluster: {
        nodeId: nodeData.ID.substring(0, 12) + '...',
        nodeName: nodeData.AgentVersion,
        pinnedItems: pins.length,
        connectedPeers: peers.length,
        filesInCluster: Object.keys(metadata).length,
        replicatedFiles: pins.length,
        peers: peers.slice(0, 10),
        files: filesList.slice(0, 10)
      }
    });
  } catch (error) {
    console.error('[CLUSTER] Eroare la status:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});


router.get('/availability/:fileHash', async (req, res) => {
  console.log(`[CLUSTER] Verificare disponibilitate: ${req.params.fileHash}`);
  try {
    await ensureKuboInstalled();

    const { fileHash } = req.params;
    
    
    const localPinsResult = await execPromise('ipfs pin ls --type recursive', { cwd: KUBO_PATH });
    const isPinned = localPinsResult.stdout.includes(fileHash);

    
    const findProvidersResult = await execPromise(`ipfs dht findprovs ${fileHash}`, { cwd: KUBO_PATH });
    const providers = findProvidersResult.stdout.split('\n').filter(p => p.trim());

    
    const metadata = loadMetadata();
    const fileMetadata = metadata[fileHash];

    res.json({
      success: true,
      availability: {
        fileHash: fileHash.substring(0, 12) + '...',
        fileName: fileMetadata?.name || 'Unknown',
        pinnedLocally: isPinned,
        providersCount: providers.length,
        replicationStatus: isPinned && providers.length >= 1 ? 'REPLICATED' : 'PARTIAL',
        redundancy: `${providers.length} copii disponibile`,
        providers: providers.slice(0, 5),
        fileMetadata
      }
    });
  } catch (error) {
    console.error('[CLUSTER] Eroare la verificare disponibilitate:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});


router.post('/set-replication', async (req, res) => {
  console.log('[CLUSTER] Setare replication factor...');
  try {
    await ensureKuboInstalled();

    const { fileHash, replicationFactor } = req.body;
    
    if (!fileHash || !replicationFactor) {
      return res.status(400).json({ success: false, error: 'fileHash și replicationFactor obligatorii' });
    }

    if (replicationFactor < 1 || replicationFactor > 10) {
      return res.status(400).json({ success: false, error: 'replicationFactor trebuie să fie între 1 și 10' });
    }

 
    await execPromise(`ipfs pin add ${fileHash}`, { cwd: KUBO_PATH });

    
    const metadata = loadMetadata();
    if (metadata[fileHash]) {
      metadata[fileHash].replicationFactor = replicationFactor;
      metadata[fileHash].lastUpdated = new Date().toISOString();
      saveMetadata(metadata);
    }

    res.json({
      success: true,
      message: `Replication factor setat la ${replicationFactor}`,
      fileHash: fileHash.substring(0, 12) + '...',
      replicationFactor
    });
  } catch (error) {
    console.error('[CLUSTER] Eroare:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});


router.get('/files', async (req, res) => {
  console.log('[CLUSTER] Lista fișiere din cluster...');
  try {
    const metadata = loadMetadata();
    const files = Object.entries(metadata).map(([hash, data]) => ({
      ...data,
      hashShort: hash.substring(0, 12) + '...'
    }));

    res.json({
      success: true,
      totalFiles: files.length,
      files: files.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
    });
  } catch (error) {
    console.error('[CLUSTER] Eroare:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});


router.delete('/files/:fileHash', async (req, res) => {
  console.log(`[CLUSTER] Ștergere fișier: ${req.params.fileHash}`);
  try {
    await ensureKuboInstalled();

    const { fileHash } = req.params;

  
    await execPromise(`ipfs pin rm ${fileHash}`, { cwd: KUBO_PATH });

    
    const metadata = loadMetadata();
    delete metadata[fileHash];
    saveMetadata(metadata);

    console.log(`[CLUSTER] Fișier șters: ${fileHash}`);

    res.json({
      success: true,
      message: 'Fișier șters din cluster',
      fileHash: fileHash.substring(0, 12) + '...'
    });
  } catch (error) {
    console.error('[CLUSTER] Eroare:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});


router.get('/health', async (req, res) => {
  console.log('[CLUSTER] Health check...');
  try {
    await ensureKuboInstalled();

    let repoStats = { RepoSize: 0, NumObjects: 0 };
    let peersCount = 0;
    let pinsCount = 0;

    try {
      const repoSizeResult = await execPromise('ipfs repo stat', { cwd: KUBO_PATH });
      const output = repoSizeResult.stdout;
      
      const numMatch = output.match(/NumObjects:\s*(\d+)/);
      const sizeMatch = output.match(/RepoSize:\s*(\d+)/);
      if (numMatch) repoStats.NumObjects = parseInt(numMatch[1]);
      if (sizeMatch) repoStats.RepoSize = parseInt(sizeMatch[1]);
    } catch (e) {
      console.warn('[CLUSTER] Nu pot obține repo stats:', e.message);
    }

    try {
      const peersResult = await execPromise('ipfs swarm peers', { cwd: KUBO_PATH });
      peersCount = peersResult.stdout.split('\n').filter(p => p.trim()).length;
    } catch (e) {
      console.warn('[CLUSTER] Nu pot obține peers:', e.message);
    }

    try {
      const pinsResult = await execPromise('ipfs pin ls --type recursive', { cwd: KUBO_PATH });
      pinsCount = pinsResult.stdout.split('\n').filter(p => p.trim()).length;
    } catch (e) {
      console.warn('[CLUSTER] Nu pot obține pins:', e.message);
    }

    const health = {
      status: peersCount > 0 ? 'HEALTHY' : 'DEGRADED',
      repoSize: repoStats.RepoSize ? (repoStats.RepoSize / 1024 / 1024).toFixed(2) + ' MB' : 'N/A',
      numObjects: repoStats.NumObjects || 0,
      pinnedItems: pinsCount,
      connectedPeers: peersCount,
      timestamp: new Date().toISOString()
    };

    res.json({ success: true, health });
  } catch (error) {
    console.error('[CLUSTER] Eroare la health check:', error.message);
    res.status(500).json({ 
      success: false, 
      health: { status: 'UNHEALTHY', error: error.message }
    });
  }
});

module.exports = router;