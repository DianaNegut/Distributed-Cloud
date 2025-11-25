const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { execPromise } = require('../utils/execPromise');
const { ensureKuboInstalled } = require('../utils/ensureKuboInstalled');
const { KUBO_PATH, IPFS_PATH } = require('../config/paths');

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

// Upload fișier în IPFS
router.post('/upload', async (req, res) => {
  console.log('[FILES] Procesare upload fișier...');
  try {
    await ensureKuboInstalled();

    // Verifică dacă există fișier (express-fileupload)
    if (!req.files || !req.files.file) {
      return res.status(400).json({ success: false, error: 'Niciun fișier încărcat' });
    }

    const uploadedFile = req.files.file;
    const filePath = uploadedFile.tempFilePath;
    const { description = '', tags = '', keepPrivate = 'false' } = req.body;
    const isPrivate = keepPrivate === 'true';

    console.log(`[FILES] Fișier primit: ${uploadedFile.name}, ${uploadedFile.size} bytes`);

    // Adaugă fișierul în IPFS
    console.log(`[FILES] Adăugare în IPFS: ${filePath}`);
    const addResult = await execPromise(`ipfs add "${filePath}"`, { cwd: KUBO_PATH });
    
    // Extrage hash-ul din output
    const hashMatch = addResult.stdout.match(/added (\w+)/);
    if (!hashMatch) {
      throw new Error('Nu s-a putut extrage hash-ul IPFS');
    }
    const fileHash = hashMatch[1];

    // Pin fișierul pentru persistență
    await execPromise(`ipfs pin add ${fileHash}`, { cwd: KUBO_PATH });
    console.log(`[FILES] Fișier pinuit: ${fileHash}`);

    // Salvează metadata (folosim informațiile de la express-fileupload)
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
      distributedToPeers: !isPrivate ? 0 : null // Counter pentru copii distribuite
    };
    saveFilesMetadata(metadata);

    console.log(`[FILES] ✓ Fișier adăugat cu succes: ${fileHash} (${isPrivate ? 'PRIVAT' : 'PUBLIC'})`);
    
    // Șterge fișierul temporar
    await fsp.unlink(filePath).catch(err => {
      console.warn('[FILES] Nu s-a putut șterge fișierul temporar:', err.message);
    });
    
    res.json({
      success: true,
      message: `Fișier adăugat în IPFS cu succes ${isPrivate ? '(privat - doar tu îl ai)' : '(va fi distribuit în rețea)'}`,
      file: metadata[fileHash],
      nextStep: isPrivate ? null : 'Fișierul va fi distribuit automat către peers conectați'
    });

  } catch (error) {
    console.error('[FILES] Eroare la upload:', error.message);
    console.error('[FILES] Stack:', error.stack);
    
    // Încearcă să ștergi fișierul temporar chiar și în caz de eroare
    if (req.files?.file?.tempFilePath) {
      await fsp.unlink(req.files.file.tempFilePath).catch(() => {});
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});

// Listează toate fișierele
router.get('/list', async (req, res) => {
  console.log('[FILES] Listare fișiere...');
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

// Descarcă fișier din IPFS
router.get('/download/:fileHash', async (req, res) => {
  console.log(`[FILES] Procesare download: ${req.params.fileHash}`);
  try {
    await ensureKuboInstalled();

    const { fileHash } = req.params;
    const metadata = loadFilesMetadata();
    const fileInfo = metadata[fileHash];

    if (!fileInfo) {
      return res.status(404).json({ success: false, error: 'Fișier negăsit în metadata' });
    }

    // Creează director temporar pentru download
    const tempDir = path.join(IPFS_PATH, 'temp-downloads');
    await fsp.mkdir(tempDir, { recursive: true });
    
    const tempFilePath = path.join(tempDir, `${fileHash}-${fileInfo.name}`);

    // Descarcă fișierul din IPFS
    console.log(`[FILES] Descărcare din IPFS: ${fileHash}`);
    await execPromise(`ipfs get ${fileHash} -o "${tempFilePath}"`, { cwd: KUBO_PATH });

    // Setează headers pentru download
    res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.name}"`);
    res.setHeader('Content-Type', fileInfo.mimetype || 'application/octet-stream');

    // Trimite fișierul
    const fileStream = fs.createReadStream(tempFilePath);
    fileStream.pipe(res);

    // Șterge fișierul temporar după trimitere
    fileStream.on('end', async () => {
      await fsp.unlink(tempFilePath).catch(() => {});
    });

    fileStream.on('error', async (err) => {
      console.error('[FILES] Eroare la stream:', err);
      await fsp.unlink(tempFilePath).catch(() => {});
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Eroare la trimitere fișier' });
      }
    });

  } catch (error) {
    console.error('[FILES] Eroare la download:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

// Obține informații despre un fișier
router.get('/info/:fileHash', async (req, res) => {
  console.log(`[FILES] Info fișier: ${req.params.fileHash}`);
  try {
    await ensureKuboInstalled();

    const { fileHash } = req.params;
    const metadata = loadFilesMetadata();
    const fileInfo = metadata[fileHash];

    if (!fileInfo) {
      return res.status(404).json({ success: false, error: 'Fișier negăsit' });
    }

    // Verifică disponibilitatea
    let isPinned = false;
    try {
      const pinsResult = await execPromise('ipfs pin ls --type recursive', { cwd: KUBO_PATH });
      isPinned = pinsResult.stdout.includes(fileHash);
    } catch (e) {
      console.warn('[FILES] Nu s-a putut verifica pinning:', e.message);
    }

    // Găsește provideri (cu timeout)
    let providers = [];
    try {
      const providersResult = await execPromise(`ipfs dht findprovs ${fileHash}`, { 
        cwd: KUBO_PATH
      });
      providers = providersResult.stdout.split('\n').filter(p => p.trim());
    } catch (e) {
      console.warn('[FILES] Nu s-au putut găsi provideri:', e.message);
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

// Șterge fișier
router.delete('/delete/:fileHash', async (req, res) => {
  console.log(`[FILES] Ștergere fișier: ${req.params.fileHash}`);
  try {
    await ensureKuboInstalled();

    const { fileHash } = req.params;
    const metadata = loadFilesMetadata();
    
    if (!metadata[fileHash]) {
      return res.status(404).json({ success: false, error: 'Fișier negăsit' });
    }

    // Unpin fișierul
    try {
      await execPromise(`ipfs pin rm ${fileHash}`, { cwd: KUBO_PATH });
    } catch (e) {
      console.warn('[FILES] Nu s-a putut unpin (posibil deja unpinned):', e.message);
    }

    // Șterge metadata
    const fileName = metadata[fileHash].name;
    delete metadata[fileHash];
    saveFilesMetadata(metadata);

    console.log(`[FILES] ✓ Fișier șters: ${fileHash}`);
    res.json({
      success: true,
      message: `Fișier șters cu succes: ${fileName}`,
      fileHash: fileHash.substring(0, 12) + '...'
    });

  } catch (error) {
    console.error('[FILES] Eroare la ștergere:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Distribuie fișier către peers (face public un fișier privat)
router.post('/distribute/:fileHash', async (req, res) => {
  console.log(`[FILES] Distribuire fișier: ${req.params.fileHash}`);
  try {
    await ensureKuboInstalled();

    const { fileHash } = req.params;
    const metadata = loadFilesMetadata();
    const fileInfo = metadata[fileHash];

    if (!fileInfo) {
      return res.status(404).json({ success: false, error: 'Fișier negăsit' });
    }

    // Verifică dacă e deja distribuit
    if (!fileInfo.isPrivate) {
      return res.json({ 
        success: true, 
        message: 'Fișierul este deja public',
        alreadyDistributed: true 
      });
    }

    // Găsește peers activi
    const peersResult = await execPromise('ipfs swarm peers', { cwd: KUBO_PATH });
    const peers = peersResult.stdout.split('\n').filter(p => p.trim());

    if (peers.length === 0) {
      return res.json({
        success: false,
        error: 'Nu există peers conectați pentru distribuție'
      });
    }

    // Actualizează metadata - marchează ca public
    metadata[fileHash].isPrivate = false;
    metadata[fileHash].distributedToPeers = 0;
    metadata[fileHash].distributionStarted = new Date().toISOString();
    saveFilesMetadata(metadata);

    console.log(`[FILES] ✓ Fișier marcat pentru distribuție: ${fileHash} către ${peers.length} peers`);

    res.json({
      success: true,
      message: `Fișier marcat ca PUBLIC. Peers pot acum să-l descarce.`,
      availablePeers: peers.length,
      fileHash: fileHash.substring(0, 12) + '...',
      note: 'Peers trebuie să ruleze "ipfs get ' + fileHash + '" pentru a-l descărca'
    });

  } catch (error) {
    console.error('[FILES] Eroare la distribuție:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Verifică statusul distribuției unui fișier
router.get('/distribution-status/:fileHash', async (req, res) => {
  console.log(`[FILES] Status distribuție: ${req.params.fileHash}`);
  try {
    await ensureKuboInstalled();

    const { fileHash } = req.params;
    const metadata = loadFilesMetadata();
    const fileInfo = metadata[fileHash];

    if (!fileInfo) {
      return res.status(404).json({ success: false, error: 'Fișier negăsit' });
    }

    // Găsește provideri
    let providers = [];
    try {
      const providersResult = await execPromise(`ipfs dht findprovs ${fileHash}`, { 
        cwd: KUBO_PATH 
      });
      providers = providersResult.stdout.split('\n').filter(p => p.trim());
    } catch (e) {
      console.warn('[FILES] Nu s-au putut găsi provideri:', e.message);
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
    console.error('[FILES] Eroare la verificare distribuție:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test transfer între noduri
router.post('/test-transfer', async (req, res) => {
  console.log('[FILES] Test transfer între noduri...');
  try {
    await ensureKuboInstalled();

    // Creează un fișier de test
    const testContent = `Test file - ${new Date().toISOString()}`;
    const testFilePath = path.join(IPFS_PATH, 'test-transfer.txt');
    await fsp.writeFile(testFilePath, testContent);

    // Adaugă în IPFS
    const addResult = await execPromise(`ipfs add "${testFilePath}"`, { cwd: KUBO_PATH });
    const hashMatch = addResult.stdout.match(/added (\w+)/);
    if (!hashMatch) {
      throw new Error('Nu s-a putut extrage hash-ul');
    }
    const testHash = hashMatch[1];

    // Obține peer-ii conectați
    const peersResult = await execPromise('ipfs swarm peers', { cwd: KUBO_PATH });
    const peers = peersResult.stdout.split('\n').filter(p => p.trim());
    const peerCount = peers.length;

    // Așteaptă câteva secunde pentru propagare
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verifică provideri
    let providers = [];
    try {
      const providersResult = await execPromise(`ipfs dht findprovs ${testHash}`, { 
        cwd: KUBO_PATH,
        timeout: 10000 
      });
      providers = providersResult.stdout.split('\n').filter(p => p.trim());
    } catch (e) {
      console.warn('[FILES] Nu s-au găsit provideri DHT:', e.message);
    }

    // Curăță fișierul de test
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

// Statistici transfer fișiere
router.get('/transfer-stats', async (req, res) => {
  console.log('[FILES] Obținere statistici transfer...');
  try {
    await ensureKuboInstalled();

    const metadata = loadFilesMetadata();
    const files = Object.values(metadata);

    // Obține statistici peers
    let peerCount = 0;
    try {
      const peersResult = await execPromise('ipfs swarm peers', { cwd: KUBO_PATH });
      peerCount = peersResult.stdout.split('\n').filter(p => p.trim()).length;
    } catch (e) {
      console.warn('[FILES] Nu s-au putut obține peers:', e.message);
    }

    // Calculează statistici
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
    console.error('[FILES] Eroare la obținere statistici:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;