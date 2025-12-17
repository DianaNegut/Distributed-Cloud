const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { execPromise } = require('../utils/execPromise');
const { ensureKuboInstalled } = require('../utils/ensureKuboInstalled');
const { KUBO_PATH, IPFS_PATH } = require('../config/paths');
const fileOwnership = require('../models/FileOwnership');
const { requireAuth } = require('../middleware/solidAuth');

const fileMetadataPath = path.join(IPFS_PATH, 'files-metadata.json');

function loadFilesMetadata() {
  try {
    if (fs.existsSync(fileMetadataPath)) {
      return JSON.parse(fs.readFileSync(fileMetadataPath, 'utf8'));
    }
  } catch (error) {
    console.error('[FILES] Eroare la citire metadata:', error.message);
  }
  return {};
}

function saveFilesMetadata(data) {
  try {
    fs.writeFileSync(fileMetadataPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[FILES] Eroare la salvare metadata:', error.message);
  }
}

router.post('/upload', requireAuth, async (req, res) => {
  console.log('[FILES] Procesare upload fisier...');
  try {
    const webId = req.session?.webId;
    if (!webId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    await ensureKuboInstalled();

    if (!req.files || !req.files.file) {
      return res.status(400).json({ success: false, error: 'Niciun fisier incarcat' });
    }

    const uploadedFile = req.files.file;
    const filePath = uploadedFile.tempFilePath;
    const { description = '', tags = '', keepPrivate = 'false' } = req.body;
    const isPrivate = keepPrivate === 'true';

    console.log(`[FILES] Fisier primit: ${uploadedFile.name}, ${uploadedFile.size} bytes`);

    console.log(`[FILES] Adaugare in IPFS: ${filePath}`);
    const addResult = await execPromise(`ipfs add "${filePath}"`, { cwd: KUBO_PATH });
    
    const hashMatch = addResult.stdout.match(/added (\w+)/);
    if (!hashMatch) {
      throw new Error('Nu s-a putut extrage hash-ul IPFS');
    }
    const fileHash = hashMatch[1];

    await execPromise(`ipfs pin add ${fileHash}`, { cwd: KUBO_PATH });
    console.log(`[FILES] Fisier pinuit: ${fileHash}`);

    const metadata = loadFilesMetadata();
    const parsedTags = typeof tags === 'string' && tags.trim() 
      ? tags.split(',').map(t => t.trim()).filter(t => t) 
      : [];

    metadata[fileHash] = {
      hash: fileHash,
      name: uploadedFile.name,
      size: uploadedFile.size,
      mimetype: uploadedFile.mimetype,
      description: description.trim(),
      tags: parsedTags,
      uploadedAt: new Date().toISOString(),
      pinned: true,
      isPrivate: isPrivate,
      distributedToPeers: !isPrivate ? 0 : null
    };
    saveFilesMetadata(metadata);

    // Register ownership
    fileOwnership.registerFile(fileHash, webId, {
      filename: uploadedFile.name,
      size: uploadedFile.size,
      mimeType: uploadedFile.mimetype
    });

    console.log(`[FILES] ✓ Fisier adaugat cu succes: ${fileHash} (${isPrivate ? 'PRIVAT' : 'PUBLIC'})`);
    
    await fsp.unlink(filePath).catch(err => {
      console.warn('[FILES] Nu s-a putut sterge fisierul temporar:', err.message);
    });
    
    res.json({
      success: true,
      message: `Fisier adaugat in IPFS cu succes ${isPrivate ? '(privat - doar tu il ai)' : '(va fi distribuit in retea)'}`,
      file: metadata[fileHash],
      nextStep: isPrivate ? null : 'Fisierul va fi distribuit automat catre peers conectati'
    });

  } catch (error) {
    console.error('[FILES] Eroare la upload:', error.message);
    console.error('[FILES] Stack:', error.stack);
    
    if (req.files?.file?.tempFilePath) {
      await fsp.unlink(req.files.file.tempFilePath).catch(() => {});
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/list', async (req, res) => {
  console.log('[FILES] Listare fisiere...');
  try {
    const metadata = loadFilesMetadata();
    const files = Object.entries(metadata).map(([hash, data]) => ({
      ...data,
      hashShort: hash.substring(0, 12) + '...'
    }));

    res.json({
      success: true,
      totalFiles: files.length,
      files: files.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
    });
  } catch (error) {
    console.error('[FILES] Eroare la listare:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/download/:fileHash', async (req, res) => {
  console.log(`[FILES] Procesare download: ${req.params.fileHash}`);
  try {
    await ensureKuboInstalled();

    const { fileHash } = req.params;
    const metadata = loadFilesMetadata();
    const fileInfo = metadata[fileHash];

    if (!fileInfo) {
      return res.status(404).json({ success: false, error: 'Fisier negasit in metadata' });
    }

    const tempDir = path.join(IPFS_PATH, 'temp-downloads');
    await fsp.mkdir(tempDir, { recursive: true });
    
    const tempFilePath = path.join(tempDir, `${fileHash}-${fileInfo.name}`);

    console.log(`[FILES] Descarcare din IPFS: ${fileHash}`);
    await execPromise(`ipfs get ${fileHash} -o "${tempFilePath}"`, { cwd: KUBO_PATH });

    res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.name}"`);
    res.setHeader('Content-Type', fileInfo.mimetype || 'application/octet-stream');

    const fileStream = fs.createReadStream(tempFilePath);
    fileStream.pipe(res);

    fileStream.on('end', async () => {
      await fsp.unlink(tempFilePath).catch(() => {});
    });

    fileStream.on('error', async (err) => {
      console.error('[FILES] Eroare la stream:', err);
      await fsp.unlink(tempFilePath).catch(() => {});
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Eroare la trimitere fisier' });
      }
    });

  } catch (error) {
    console.error('[FILES] Eroare la download:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

router.get('/info/:fileHash', async (req, res) => {
  console.log(`[FILES] Info fisier: ${req.params.fileHash}`);
  try {
    await ensureKuboInstalled();

    const { fileHash } = req.params;
    const metadata = loadFilesMetadata();
    const fileInfo = metadata[fileHash];

    if (!fileInfo) {
      return res.status(404).json({ success: false, error: 'Fisier negasit' });
    }

    let isPinned = false;
    try {
      const pinsResult = await execPromise('ipfs pin ls --type recursive', { cwd: KUBO_PATH });
      isPinned = pinsResult.stdout.includes(fileHash);
    } catch (e) {
      console.warn('[FILES] Nu s-a putut verifica pinning:', e.message);
    }

    let providers = [];
    try {
      const providersResult = await execPromise(`ipfs dht findprovs ${fileHash}`, { 
        cwd: KUBO_PATH
      });
      providers = providersResult.stdout.split('\n').filter(p => p.trim());
    } catch (e) {
      console.warn('[FILES] Nu s-au putut gasi provideri:', e.message);
    }

    res.json({
      success: true,
      file: {
        ...fileInfo,
        isPinned,
        providersCount: providers.length,
        providers: providers.slice(0, 5)
      }
    });

  } catch (error) {
    console.error('[FILES] Eroare la info:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/delete/:fileHash', async (req, res) => {
  console.log(`[FILES] stergere fisier: ${req.params.fileHash}`);
  try {
    await ensureKuboInstalled();

    const { fileHash } = req.params;
    const metadata = loadFilesMetadata();
    
    if (!metadata[fileHash]) {
      return res.status(404).json({ success: false, error: 'Fisier negasit' });
    }

    try {
      await execPromise(`ipfs pin rm ${fileHash}`, { cwd: KUBO_PATH });
    } catch (e) {
      console.warn('[FILES] Nu s-a putut unpin (posibil deja unpinned):', e.message);
    }

    const fileName = metadata[fileHash].name;
    delete metadata[fileHash];
    saveFilesMetadata(metadata);

    console.log(`[FILES] ✓ Fisier sters: ${fileHash}`);
    res.json({
      success: true,
      message: `Fisier sters cu succes: ${fileName}`,
      fileHash: fileHash.substring(0, 12) + '...'
    });

  } catch (error) {
    console.error('[FILES] Eroare la stergere:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/distribute/:fileHash', async (req, res) => {
  console.log(`[FILES] Distribuire fisier: ${req.params.fileHash}`);
  try {
    await ensureKuboInstalled();

    const { fileHash } = req.params;
    const metadata = loadFilesMetadata();
    const fileInfo = metadata[fileHash];

    if (!fileInfo) {
      return res.status(404).json({ success: false, error: 'Fisier negasit' });
    }

    if (!fileInfo.isPrivate) {
      return res.json({ 
        success: true, 
        message: 'Fisierul este deja public',
        alreadyDistributed: true 
      });
    }

    const peersResult = await execPromise('ipfs swarm peers', { cwd: KUBO_PATH });
    const peers = peersResult.stdout.split('\n').filter(p => p.trim());

    if (peers.length === 0) {
      return res.json({
        success: false,
        error: 'Nu exista peers conectati pentru distributie'
      });
    }

    metadata[fileHash].isPrivate = false;
    metadata[fileHash].distributedToPeers = 0;
    metadata[fileHash].distributionStarted = new Date().toISOString();
    saveFilesMetadata(metadata);

    console.log(`[FILES] ✓ Fisier marcat pentru distributie: ${fileHash} catre ${peers.length} peers`);

    res.json({
      success: true,
      message: `Fisier marcat ca PUBLIC. Peers pot acum sa-l descarce.`,
      availablePeers: peers.length,
      fileHash: fileHash.substring(0, 12) + '...',
      note: 'Peers trebuie sa ruleze "ipfs get ' + fileHash + '" pentru a-l descarca'
    });

  } catch (error) {
    console.error('[FILES] Eroare la distributie:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/distribution-status/:fileHash', async (req, res) => {
  console.log(`[FILES] Status distributie: ${req.params.fileHash}`);
  try {
    await ensureKuboInstalled();

    const { fileHash } = req.params;
    const metadata = loadFilesMetadata();
    const fileInfo = metadata[fileHash];

    if (!fileInfo) {
      return res.status(404).json({ success: false, error: 'Fisier negasit' });
    }

    let providers = [];
    try {
      const providersResult = await execPromise(`ipfs dht findprovs ${fileHash}`, { 
        cwd: KUBO_PATH 
      });
      providers = providersResult.stdout.split('\n').filter(p => p.trim());
    } catch (e) {
      console.warn('[FILES] Nu s-au putut gasi provideri:', e.message);
    }

    const distributionInfo = {
      isPrivate: fileInfo.isPrivate,
      providersCount: providers.length,
      providers: providers.slice(0, 5),
      status: fileInfo.isPrivate ? 'PRIVATE' : 
              providers.length > 1 ? 'DISTRIBUTED' : 'AVAILABLE',
      distributionStarted: fileInfo.distributionStarted || null
    };

    res.json({
      success: true,
      distribution: distributionInfo
    });

  } catch (error) {
    console.error('[FILES] Eroare la verificare distributie:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/test-transfer', async (req, res) => {
  console.log('[FILES] Test transfer intre noduri...');
  try {
    await ensureKuboInstalled();

    const testContent = `Test file - ${new Date().toISOString()}`;
    const testFilePath = path.join(IPFS_PATH, 'test-transfer.txt');
    await fsp.writeFile(testFilePath, testContent);

    const addResult = await execPromise(`ipfs add "${testFilePath}"`, { cwd: KUBO_PATH });
    const hashMatch = addResult.stdout.match(/added (\w+)/);
    if (!hashMatch) {
      throw new Error('Nu s-a putut extrage hash-ul');
    }
    const testHash = hashMatch[1];

    const peersResult = await execPromise('ipfs swarm peers', { cwd: KUBO_PATH });
    const peers = peersResult.stdout.split('\n').filter(p => p.trim());
    const peerCount = peers.length;

    await new Promise(resolve => setTimeout(resolve, 3000));

    let providers = [];
    try {
      const providersResult = await execPromise(`ipfs dht findprovs ${testHash}`, { 
        cwd: KUBO_PATH,
        timeout: 10000 
      });
      providers = providersResult.stdout.split('\n').filter(p => p.trim());
    } catch (e) {
      console.warn('[FILES] Nu s-au gasit provideri DHT:', e.message);
    }

    await fsp.unlink(testFilePath).catch(() => {});

    res.json({
      success: true,
      test: {
        hash: testHash,
        peersConnected: peerCount,
        providersFound: providers.length,
        canTransfer: peerCount > 0,
        status: peerCount > 0 ? 'READY' : 'NO_PEERS',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[FILES] Eroare la test transfer:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/transfer-stats', async (req, res) => {
  console.log('[FILES] Obtinere statistici transfer...');
  try {
    await ensureKuboInstalled();

    const metadata = loadFilesMetadata();
    const files = Object.values(metadata);

    let peerCount = 0;
    try {
      const peersResult = await execPromise('ipfs swarm peers', { cwd: KUBO_PATH });
      peerCount = peersResult.stdout.split('\n').filter(p => p.trim()).length;
    } catch (e) {
      console.warn('[FILES] Nu s-au putut obtine peers:', e.message);
    }

    const totalFiles = files.length;
    const pinnedFiles = files.filter(f => f.pinned).length;
    const privateFiles = files.filter(f => f.isPrivate).length;
    const publicFiles = totalFiles - privateFiles;
    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);

    res.json({
      success: true,
      stats: {
        totalFiles,
        pinnedFiles,
        privateFiles,
        publicFiles,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        peersConnected: peerCount,
        networkActive: peerCount > 0,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[FILES] Eroare la obtinere statistici:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;