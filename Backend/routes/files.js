const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { execPromise } = require('../utils/execPromise');
const { ensureKuboInstalled } = require('../utils/ensureKuboInstalled');
const { KUBO_PATH, IPFS_PATH } = require('../config/paths');

// Configurare multer pentru upload fișiere
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(IPFS_PATH, 'uploads');
    await fsp.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

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
router.post('/upload', upload.single('file'), async (req, res) => {
  console.log('[FILES] Procesare upload fișier...');
  try {
    await ensureKuboInstalled();

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Niciun fișier încărcat' });
    }

    const filePath = req.file.path;
    const { description = '', tags = '' } = req.body;

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

    // Salvează metadata (folosim doar informațiile de la multer)
    const metadata = loadFilesMetadata();
    const parsedTags = typeof tags === 'string' && tags.trim() 
      ? tags.split(',').map(t => t.trim()).filter(t => t) 
      : [];

    metadata[fileHash] = {
      hash: fileHash,
      name: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      description: description.trim(),
      tags: parsedTags,
      uploadedAt: new Date().toISOString(),
      pinned: true
    };
    saveFilesMetadata(metadata);

    // Șterge fișierul temporar
    await fsp.unlink(filePath).catch(err => {
      console.warn('[FILES] Nu s-a putut șterge fișierul temporar:', err.message);
    });

    console.log(`[FILES] ✓ Fișier adăugat cu succes: ${fileHash}`);
    res.json({
      success: true,
      message: 'Fișier adăugat în IPFS cu succes',
      file: metadata[fileHash]
    });

  } catch (error) {
    console.error('[FILES] Eroare la upload:', error.message);
    
    // Încearcă să ștergi fișierul temporar chiar și în caz de eroare
    if (req.file?.path) {
      await fsp.unlink(req.file.path).catch(() => {});
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

module.exports = router;