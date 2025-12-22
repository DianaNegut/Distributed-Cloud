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
