/**
 * Provider Agent HTTP Server
 * Allows backend to send files directly to this provider
 */

const express = require('express');
const fileUpload = require('express-fileupload');
const chalk = require('chalk');
const config = require('./config');
const ipfsManager = require('./ipfsManager');

const app = express();
const PORT = config.AGENT_HTTP_PORT || 4000;

// Middleware
app.use(express.json());
app.use(fileUpload({
    useTempFiles: true,
    tempFileDir: require('os').tmpdir(),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
}));

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        success: true,
        agent: 'Provider Agent',
        username: config.PROVIDER_USERNAME,
        status: 'online',
        timestamp: new Date().toISOString()
    });
});

/**
 * GET /setup - Magic Link setup endpoint
 * Receives token from browser, fetches config from backend, saves it locally
 */
app.get('/setup', async (req, res) => {
    const { token } = req.query;

    console.log(chalk.cyan('🔗 Magic Link setup request received'));

    if (!token) {
        return res.status(400).send(`
            <!DOCTYPE html>
            <html><head><title>Setup Error</title>
            <style>body{font-family:Arial,sans-serif;max-width:600px;margin:50px auto;padding:20px;background:#1a1a2e;color:#fff;}</style>
            </head><body>
            <h1>❌ Setup Error</h1>
            <p>Missing token parameter. Please use the correct setup link from the web interface.</p>
            </body></html>
        `);
    }

    try {
        const axios = require('axios');
        const fs = require('fs');
        const path = require('path');

        // Fetch config from backend
        const backendUrl = config.BACKEND_URL || 'http://localhost:3001/api';
        console.log(chalk.gray(`   Fetching config from: ${backendUrl}/provider-agent/config/${token.substring(0, 8)}...`));

        const response = await axios.get(`${backendUrl}/provider-agent/config/${token}`, {
            timeout: 10000
        });

        if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to get config');
        }

        const newConfig = response.data.config;
        const providerInfo = response.data.provider;

        // Save config to file
        const configPath = path.join(__dirname, 'provider-config.json');
        fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));

        console.log(chalk.green(`   ✓ Config saved for provider: ${providerInfo.username}`));
        console.log(chalk.cyan('   🔄 Auto-restarting ProviderAgent...'));

        // Return success page
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Setup Complete!</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Arial, sans-serif;
                        max-width: 600px;
                        margin: 50px auto;
                        padding: 20px;
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        color: #fff;
                        min-height: 100vh;
                    }
                    .success-box {
                        background: rgba(16, 185, 129, 0.2);
                        border: 1px solid #10b981;
                        border-radius: 12px;
                        padding: 30px;
                        text-align: center;
                    }
                    h1 { color: #10b981; margin-bottom: 20px; }
                    .provider-name { 
                        font-size: 24px; 
                        color: #8b5cf6; 
                        margin: 20px 0;
                    }
                    .instruction {
                        background: rgba(139, 92, 246, 0.2);
                        border-radius: 8px;
                        padding: 15px;
                        margin-top: 20px;
                    }
                    .restart-info {
                        background: rgba(59, 130, 246, 0.2);
                        border: 1px solid #3b82f6;
                        border-radius: 8px;
                        padding: 15px;
                        margin-top: 20px;
                    }
                    .spinner {
                        display: inline-block;
                        width: 20px;
                        height: 20px;
                        border: 3px solid #3b82f6;
                        border-top: 3px solid transparent;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    }
                    .connected {
                        background: rgba(16, 185, 129, 0.3);
                        border: 1px solid #10b981;
                    }
                    .connected .spinner { display: none; }
                    .connected .checkmark { display: inline-block; }
                    .checkmark { 
                        display: none; 
                        color: #10b981; 
                        font-size: 24px; 
                    }
                </style>
            </head>
            <body>
                <div class="success-box">
                    <h1>✅ Setup Complete!</h1>
                    <p>Provider Agent has been configured successfully.</p>
                    <div class="provider-name">
                        👤 ${providerInfo.name}<br>
                        <small style="color:#888">@${providerInfo.username}</small>
                    </div>
                    <div id="status-box" class="restart-info">
                        <span class="spinner"></span>
                        <span class="checkmark">✓</span>
                        <p id="status-text"><strong>Provider Agent se repornește...</strong></p>
                        <p id="status-detail" style="font-size:14px;color:#888">Verificăm conexiunea...</p>
                    </div>
                </div>
                <script>
                    let attempts = 0;
                    const maxAttempts = 20;
                    
                    function checkHealth() {
                        attempts++;
                        fetch('http://localhost:4000/health')
                            .then(res => res.json())
                            .then(data => {
                                if (data.success) {
                                    // Connected!
                                    document.getElementById('status-box').classList.add('connected');
                                    document.getElementById('status-text').innerHTML = '<strong>✅ Provider Agent conectat!</strong>';
                                    document.getElementById('status-detail').innerHTML = 'Poți închide această fereastră.';
                                }
                            })
                            .catch(err => {
                                // Still restarting...
                                if (attempts < maxAttempts) {
                                    document.getElementById('status-detail').innerHTML = 'Se repornește... (' + attempts + 's)';
                                    setTimeout(checkHealth, 1000);
                                } else {
                                    document.getElementById('status-text').innerHTML = '<strong>⚠️ Timeout</strong>';
                                    document.getElementById('status-detail').innerHTML = 'Verifică terminalul manual.';
                                }
                            });
                    }
                    
                    // Start checking after 3 seconds (give time for restart)
                    setTimeout(checkHealth, 3000);
                </script>
            </body>
            </html>
        `);

        // Hot-reload: clear config cache and run main again
        setTimeout(async () => {
            console.log(chalk.cyan('🔄 Hot-reloading ProviderAgent with new config...'));
            console.log('');

            // Clear the config module cache to force reload
            delete require.cache[require.resolve('./config')];

            // Re-run the main startup sequence
            const main = require('./index').runMain;
            if (main) {
                await main();
            } else {
                // Fallback: if runMain not exported, just log success
                console.log(chalk.green('✅ Config loaded! Agent is now configured.'));
                console.log(chalk.yellow('   Note: Full functionality requires manual restart.'));
            }
        }, 1500);

    } catch (error) {
        console.log(chalk.red(`   ✗ Setup failed: ${error.message}`));
        res.status(500).send(`
            <!DOCTYPE html>
            <html><head><title>Setup Failed</title>
            <style>
                body{font-family:Arial,sans-serif;max-width:600px;margin:50px auto;padding:20px;background:#1a1a2e;color:#fff;}
                .error{background:rgba(239,68,68,0.2);border:1px solid #ef4444;border-radius:8px;padding:20px;}
            </style>
            </head><body>
            <div class="error">
                <h1>❌ Setup Failed</h1>
                <p>${error.message}</p>
                <p>Please try again or download the config file manually from the web interface.</p>
            </div>
            </body></html>
        `);
    }
});

/**
 * Get provider capacity info
 */
app.get('/capacity', async (req, res) => {
    try {
        const repoStats = await ipfsManager.getRepoStats();
        const pins = await ipfsManager.listPins();

        res.json({
            success: true,
            capacity: {
                offeredGB: config.OFFERED_CAPACITY_GB,
                usedGB: parseFloat(repoStats.repoSizeGB),
                availableGB: config.OFFERED_CAPACITY_GB - parseFloat(repoStats.repoSizeGB),
                pinnedFiles: pins.length
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /upload - Receive file directly from backend
 * This is the main endpoint for provider-first uploads
 */
app.post('/upload', async (req, res) => {
    console.log(chalk.blue('📥 Direct upload request received'));

    if (!req.files || !req.files.file) {
        return res.status(400).json({
            success: false,
            error: 'No file uploaded'
        });
    }

    const uploadedFile = req.files.file;
    console.log(chalk.gray(`   File: ${uploadedFile.name} (${uploadedFile.size} bytes)`));

    try {
        // Check capacity
        const repoStats = await ipfsManager.getRepoStats();
        const usedGB = parseFloat(repoStats.repoSizeGB);
        const availableGB = config.OFFERED_CAPACITY_GB - usedGB;
        const requiredGB = uploadedFile.size / (1024 * 1024 * 1024);

        if (requiredGB > availableGB) {
            console.log(chalk.yellow(`   ⚠️ Insufficient capacity: need ${requiredGB.toFixed(3)}GB, have ${availableGB.toFixed(3)}GB`));
            return res.status(507).json({
                success: false,
                error: 'Insufficient storage capacity',
                required: requiredGB,
                available: availableGB
            });
        }

        // Add file to IPFS
        const fs = require('fs');
        const FormData = require('form-data');
        const axios = require('axios');

        const form = new FormData();
        form.append('file', fs.createReadStream(uploadedFile.tempFilePath), {
            filename: uploadedFile.name,
            contentType: uploadedFile.mimetype
        });

        const ipfsApiUrl = `http://${config.IPFS.API_HOST}:${config.IPFS.API_PORT}/api/v0/add`;
        const response = await axios.post(ipfsApiUrl, form, {
            headers: form.getHeaders(),
            timeout: 60000
        });

        const cid = response.data.Hash;
        console.log(chalk.green(`   ✓ File added to IPFS: ${cid}`));

        // Clean up temp file
        if (fs.existsSync(uploadedFile.tempFilePath)) {
            fs.unlinkSync(uploadedFile.tempFilePath);
        }

        // Get updated stats
        const newRepoStats = await ipfsManager.getRepoStats();

        res.json({
            success: true,
            message: 'File uploaded to provider IPFS node',
            cid: cid,
            file: {
                name: uploadedFile.name,
                size: uploadedFile.size,
                mimetype: uploadedFile.mimetype
            },
            storage: {
                usedGB: parseFloat(newRepoStats.repoSizeGB),
                availableGB: config.OFFERED_CAPACITY_GB - parseFloat(newRepoStats.repoSizeGB)
            }
        });

    } catch (error) {
        console.log(chalk.red(`   ✗ Upload failed: ${error.message}`));
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /pin - Pin a CID that exists in the network
 */
app.post('/pin', async (req, res) => {
    const { cid } = req.body;

    if (!cid) {
        return res.status(400).json({ success: false, error: 'CID required' });
    }

    console.log(chalk.blue(`📌 Pin request: ${cid}`));

    try {
        await ipfsManager.pinFile(cid);
        console.log(chalk.green(`   ✓ Pinned: ${cid}`));
        res.json({ success: true, cid: cid });
    } catch (error) {
        console.log(chalk.red(`   ✗ Pin failed: ${error.message}`));
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Start the HTTP server
 */
function startServer() {
    return new Promise((resolve, reject) => {
        const server = app.listen(PORT, () => {
            console.log(chalk.cyan(`🌐 HTTP Server listening on port ${PORT}`));
            console.log(chalk.gray(`   Upload endpoint: http://localhost:${PORT}/upload`));
            resolve(server);
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(chalk.yellow(`⚠️ Port ${PORT} is in use, HTTP server disabled`));
                resolve(null);
            } else {
                reject(err);
            }
        });
    });
}

module.exports = { app, startServer, PORT };
