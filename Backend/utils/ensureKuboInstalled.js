const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const https = require('https');
const unzipper = require('unzipper');
const { IPFS_BIN, KUBO_PATH } = require('../config/paths');

async function ensureKuboInstalled() {
  if (fs.existsSync(IPFS_BIN)) {
    console.log(' Kubo este deja instalat.');
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
        console.error(` Eroare la descărcare Kubo: HTTP ${response.statusCode}`);
        return reject(new Error(`HTTP ${response.statusCode}`));
      }
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      console.error(' Eroare de rețea la descărcare Kubo:', err.message);
      reject(err);
    });
  });

  console.log(' Extrahem arhiva...');
  await fs.createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: KUBO_PATH }))
    .promise();

  console.log(' Ștergem arhiva temporară...');
  await fsp.unlink(zipPath).catch(() => {});
  console.log(' Kubo instalat cu succes!');
}

module.exports = { ensureKuboInstalled };
