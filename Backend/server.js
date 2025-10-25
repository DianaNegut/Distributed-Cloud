const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const https = require('https');
const unzipper = require('unzipper');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// LOG ADĂUGAT: Middleware de logging pentru fiecare cerere
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ➡️ ${req.method} ${req.originalUrl}`);
  next();
});

// Configurare path-uri
const IPFS_PATH = process.env.IPFS_PATH || 'C:\\Users\\Admin\\.ipfs';
const KUBO_PATH = process.env.KUBO_PATH || 'C:\\Users\\Admin\\Desktop\\Diana\\kubo';
const IPFS_BIN = path.join(KUBO_PATH, 'ipfs.exe');

// 🔧 Helper: verifică și instalează automat Kubo dacă lipsește
async function ensureKuboInstalled() {
  if (fs.existsSync(IPFS_BIN)) {
    console.log('✅ Kubo este deja instalat.');
    return;
  }

  console.log('⬇️ Kubo lipsește — se descarcă automat...');
  await fsp.mkdir(KUBO_PATH, { recursive: true });

  const version = 'v0.30.0';
  const url = `https://dist.ipfs.tech/kubo/${version}/kubo_${version}_windows-amd64.zip`;
  const zipPath = path.join(KUBO_PATH, 'kubo.zip');

  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(zipPath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        // LOG ADĂUGAT
        console.error(`❌ Eroare la descărcare Kubo: HTTP Status ${response.statusCode}`);
        return reject(new Error(`HTTP ${response.statusCode}`));
      }
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => { // LOG ADĂUGAT (îmbunătățit)
      console.error('❌ Eroare de rețea la descărcare Kubo:', err.message);
      reject(err);
    });
  });

  console.log('📦 Extrahem arhiva...');
  await fs.createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: KUBO_PATH }))
    .promise();

  console.log('🧹 Ștergem arhiva temporară...');
  await fsp.unlink(zipPath).catch(() => {});

  console.log('✅ Kubo instalat cu succes!');
}

// 🔧 Helper pentru execuție comenzi
function execPromise(command, options = {}) {
  return new Promise((resolve, reject) => {
    const execOptions = {
      ...options,
      shell: true,
      windowsHide: true,
      env: { ...process.env, ...options.env }
    };

    console.log(`[EXEC] Executare: ${command}`); // Log-ul existent a fost prefixat
    exec(command, execOptions, (error, stdout, stderr) => {
      if (error) {
        console.error(`[EXEC] ❌ Eroare la: ${command}`);
        console.error(stderr);
        reject({ error: error.message, stderr });
      } else {
        console.log(`[EXEC] ✅ Succes: ${command}`);
        resolve({ stdout, stderr });
      }
    });
  });
}

// Middleware pentru API Key
app.use((req, res, next) => {
  if (req.path === '/api/health' || req.path === '/api/join-network' || req.path === '/api/bootstrap-info') {
    return next();
  }
  const token = req.headers['x-api-key'];
  const expected = process.env.API_KEY || 'supersecret';
  if (!token || token !== expected) {
    // LOG ADĂUGAT
    console.warn(`[AUTH] 🚫 Acces interzis pentru ${req.method} ${req.originalUrl} - API Key invalid sau lipsă.`);
    return res.status(403).json({ success: false, error: 'Acces interzis' });
  }
  next();
});

// 🧠 Endpoint: info bootstrap
app.get('/api/bootstrap-info', async (req, res) => {
  // LOG ADĂUGAT
  console.log('[API] Procesare cerere /api/bootstrap-info...');
  try {
    await ensureKuboInstalled();

    const swarmKeyPath = path.join(IPFS_PATH, 'swarm.key');
    const swarmKeyExists = fs.existsSync(swarmKeyPath);

    if (!swarmKeyExists) {
      // LOG ADĂUGAT
      console.warn(`[BOOTSTRAP] swarm.key nu a fost găsit la calea: ${swarmKeyPath}`);
      return res.status(404).json({
        success: false,
        error: 'swarm.key nu există pe serverul bootstrap'
      });
    }
    
    // LOG ADĂUGAT
    console.log('[BOOTSTRAP] swarm.key găsit. Se citește...');
    const swarmKeyContent = await fsp.readFile(swarmKeyPath, 'utf8');
    const lines = swarmKeyContent.trim().split('\n');
    const swarmKey = lines[lines.length - 1];

    // LOG ADĂUGAT
    console.log('[BOOTSTRAP] Se obține Peer ID...');
    const idResult = await execPromise(`${IPFS_BIN} id`, { cwd: KUBO_PATH });
    const idData = JSON.parse(idResult.stdout);
    const peerId = idData.ID;

    const ip = process.env.BOOTSTRAP_IP || '192.168.1.104';
    const bootstrapNode = `/ip4/${ip}/tcp/4001/p2p/${peerId}`;

    // LOG ADĂUGAT
    console.log('[BOOTSTRAP] Informații generate cu succes.');
    res.json({
      success: true,
      swarmKey,
      bootstrapNode
    });
  } catch (error) {
    // LOG ADĂUGAT
    console.error('❌ Eroare la /api/bootstrap-info:', error.stderr || error.message);
    res.status(500).json({
      success: false,
      error: error.stderr || error.message
    });
  }
});

// 🧠 Endpoint: join network
app.post('/api/join-network', async (req, res) => {
  // LOG ADĂUGAT
  console.log('[API] Procesare cerere /api/join-network...');
  try {
    await ensureKuboInstalled();

    const axios = require('axios');
    const apiUrl = `http://${process.env.BOOTSTRAP_IP || '192.168.1.104'}:${PORT}/api/bootstrap-info`;
    
    // LOG ADĂUGAT
    console.log(`[JOIN] Se contactează serverul bootstrap la: ${apiUrl}`);
    const { data } = await axios.get(apiUrl);

    if (!data.success) throw new Error('Nu s-au putut obține detaliile de rețea');
    
    // LOG ADĂUGAT
    console.log('[JOIN] Date primite de la bootstrap. Se configurează rețeaua local...');
    const { swarmKey, bootstrapNode } = data;

    const configureResponse = await fetch(`http://localhost:${PORT}/api/configure-network`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.API_KEY || 'supersecret' },
      body: JSON.stringify({ swarmKey, bootstrapNode })
    });

    const result = await configureResponse.json();
    
    // LOG ADĂUGAT
    console.log('[JOIN] Răspuns de la /api/configure-network primit. Se trimite clientului.');
    res.json(result);
  } catch (error) {
    // LOG ADĂUGAT
    console.error('❌ Eroare la /api/join-network:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🧠 Endpoint: configure network
app.post('/api/configure-network', async (req, res) => {
  // LOG ADĂUGAT
  console.log('[API] Procesare cerere /api/configure-network...');
  await ensureKuboInstalled();

  const { swarmKey, bootstrapNode } = req.body;
  if (!swarmKey || !bootstrapNode) {
    // LOG ADĂUGAT
    console.warn('[CONFIG] Cerere eșuată: swarmKey sau bootstrapNode lipsesc.');
    return res.status(400).json({ success: false, error: 'swarmKey și bootstrapNode sunt obligatorii' });
  }

  const logs = [];

  try {
    const swarmKeyContent = `/key/swarm/psk/1.0.0/\n/base16/\n${swarmKey}`;
    const swarmKeyPath = path.join(IPFS_PATH, 'swarm.key');
    await fsp.writeFile(swarmKeyPath, swarmKeyContent, 'utf8');
    
    // LOG ADĂUGAT
    console.log(`[CONFIG] ✓ swarm.key scris cu succes la ${swarmKeyPath}`);
    logs.push({ message: '✓ swarm.key scris cu succes', type: 'success' });

    const cmds = [
      'ipfs config --json AutoConf.Enabled false',
      'ipfs config --json AutoTLS.Enabled false',
      'ipfs config Routing.Type dht',
      'ipfs config --json Routing.DelegatedRouters "[]"',
      'ipfs config --json Ipns.DelegatedPublishers "[]"',
      'ipfs bootstrap rm --all',
      `ipfs bootstrap add ${bootstrapNode}`
    ];

    // LOG ADĂUGAT
    console.log('[CONFIG] Se execută comenzile de configurare IPFS...');
    for (const cmd of cmds) {
      await execPromise(cmd, { cwd: KUBO_PATH });
      // execPromise afișează deja log-uri, dar îl adăugăm și pe acesta în array-ul clientului
      logs.push({ message: `Executat: ${cmd}`, type: 'info' });
    }

    // LOG ADĂUGAT
    console.log('[CONFIG] 🎉 Rețea IPFS configurată cu succes!');
    logs.push({ message: '🎉 Rețea IPFS configurată cu succes!', type: 'success' });
    res.json({ success: true, logs });
  } catch (error) {
    // LOG ADĂUGAT
    console.error('[CONFIG] ❌ Eroare la configurarea rețelei:', error.stderr || error.message);
    logs.push({ message: `❌ Eroare: ${error.error || error.message}`, type: 'error' });
    res.status(500).json({ success: false, logs });
  }
});

// 🧠 Endpoint: status
app.get('/api/status', async (req, res) => {
  // LOG ADĂUGAT
  console.log('[API] Procesare cerere /api/status...');
  try {
    await ensureKuboInstalled();
    // LOG ADĂUGAT
    console.log('[STATUS] Se rulează `ipfs id`...');
    const result = await execPromise('ipfs id', { cwd: KUBO_PATH });
    res.json({ success: true, data: JSON.parse(result.stdout) });
  } catch (error) {
    // LOG ADĂUGAT
    console.error('[STATUS] ❌ Eroare la `ipfs id`:', error.stderr || error.message);
    res.status(500).json({ success: false, error: error.error || error.message });
  }
});

// 🧠 Endpoint: peers
app.get('/api/peers', async (req, res) => {
  // LOG ADĂUGAT
  console.log('[API] Procesare cerere /api/peers...');
  try {
    await ensureKuboInstalled();

    let result;
    try {
      // LOG ADĂUGAT
      console.log('[PEERS] Se rulează `ipfs swarm peers`...');
      result = await execPromise('ipfs swarm peers', { cwd: KUBO_PATH });
    } catch (error) {
      // LOG ADĂUGAT: Verificare de siguranță pentru error.stderr
      if (error.stderr && error.stderr.includes("ipfs daemon")) {
        console.log("⚙️ IPFS daemon oprit — pornim automat...");
        await execPromise('start "" ipfs daemon', { cwd: KUBO_PATH });
        // LOG ADĂUGAT
        console.log('[PEERS] Se așteaptă 7 secunde pornirea daemon-ului...');
        await new Promise(r => setTimeout(r, 7000));
        // LOG ADĂUGAT
        console.log('[PEERS] Se reîncearcă `ipfs swarm peers`...');
        result = await execPromise('ipfs swarm peers', { cwd: KUBO_PATH });
      } else {
        throw error;
      }
    }

    const peers = result.stdout.split('\n').filter(p => p.trim());
    // LOG ADĂUGAT
    console.log(`[PEERS] Găsiți ${peers.length} peers.`);
    res.json({ success: true, peers });
  } catch (error) {
    // LOG ADĂUGAT
    console.error('[PEERS] ❌ Eroare la `ipfs swarm peers`:', error.stderr || error.message);
    res.status(500).json({ success: false, error: error.stderr || error.message });
  }
});

// 🧠 Endpoint: health
app.get('/api/health', (req, res) => {
  // LOG ADĂUGAT
  console.log('[API] Procesare cerere /api/health...');
  res.json({
    success: true,
    message: 'Server is running',
    ipfsPath: IPFS_PATH,
    kuboPath: KUBO_PATH,
    ipfsExists: fs.existsSync(IPFS_BIN)
  });
});

// 🚀 Pornire server
app.listen(PORT, async () => {
  console.log(`🚀 Server pornit pe http://localhost:${PORT}`);
  console.log(`📁 IPFS Path: ${IPFS_PATH}`);
  console.log(`📁 Kubo Path: ${KUBO_PATH}`);
  await ensureKuboInstalled();
  console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
});