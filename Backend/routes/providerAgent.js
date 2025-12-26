/**
 * Provider Agent Routes
 * Handles communication with Provider Agent applications running on provider machines
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const StorageProvider = require('../models/StorageProvider');

// File-based pending pins storage (shared with providerNetworkRouter)
const pendingPinsPath = path.join(__dirname, '../data/pending-pins.json');

function loadPendingPins() {
    try {
        if (fs.existsSync(pendingPinsPath)) {
            return JSON.parse(fs.readFileSync(pendingPinsPath, 'utf8'));
        }
    } catch (e) {
        console.error('[PROVIDER-AGENT] Error loading pending pins:', e.message);
    }
    return {};
}

function savePendingPins(data) {
    try {
        const dataDir = path.dirname(pendingPinsPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(pendingPinsPath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('[PROVIDER-AGENT] Error saving pending pins:', e.message);
    }
}

/**
 * POST /api/provider-agent/register
 * Provider Agent registers/updates with IPFS peer info
 * Supports both providerToken (preferred) and username (legacy) authentication
 */
router.post('/register', async (req, res) => {
    console.log('[PROVIDER-AGENT] Registration request received');

    try {
        const { providerToken, username, ipfsPeerId, multiaddress, capacityGB, agentVersion } = req.body;

        if (!ipfsPeerId) {
            return res.status(400).json({
                success: false,
                error: 'ipfsPeerId is required'
            });
        }

        if (!providerToken && !username) {
            return res.status(400).json({
                success: false,
                error: 'providerToken or username is required'
            });
        }

        // Find provider by token (preferred) or username (legacy)
        let provider;
        if (providerToken) {
            provider = StorageProvider.getProviderByToken(providerToken);
            if (!provider) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid providerToken. Download a fresh config from the web interface.'
                });
            }
        } else {
            // Legacy username-based lookup
            const data = StorageProvider.loadProviders();
            provider = data.providers.find(p => p.peerId === username);
            if (!provider) {
                return res.status(404).json({
                    success: false,
                    error: `No provider found for username: ${username}. Register as provider first via the web interface.`
                });
            }
        }

        // Update provider with IPFS info
        const updates = {
            ipfsPeerId: ipfsPeerId,
            multiaddress: multiaddress || null,
            agentVersion: agentVersion || 'unknown',
            agentStatus: 'online',
            lastHeartbeat: new Date().toISOString(),
            lastSeen: new Date().toISOString()
        };

        const updated = StorageProvider.updateProvider(provider.id, updates);

        console.log(`[PROVIDER-AGENT] Provider ${provider.peerId} registered with IPFS Peer ID: ${ipfsPeerId.substring(0, 20)}...`);

        res.json({
            success: true,
            message: 'Provider agent registered successfully',
            provider: {
                id: updated.id,
                name: updated.name,
                username: updated.peerId,
                ipfsPeerId: updated.ipfsPeerId,
                status: updated.status,
                agentStatus: updated.agentStatus
            }
        });
    } catch (error) {
        console.error('[PROVIDER-AGENT] Registration error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/provider-agent/heartbeat
 * Provider Agent sends periodic heartbeat
 */
router.post('/heartbeat', async (req, res) => {
    try {
        const { username, ipfsPeerId, repoStats, pinnedFiles, status } = req.body;

        if (!username) {
            return res.status(400).json({ success: false, error: 'username required' });
        }

        // Find provider
        const data = StorageProvider.loadProviders();
        const provider = data.providers.find(p => p.peerId === username);

        if (!provider) {
            return res.status(404).json({ success: false, error: 'Provider not found' });
        }

        // Update heartbeat info
        const agentStatus = status === 'offline' ? 'offline' : 'online';

        const updates = {
            agentStatus: agentStatus,
            lastHeartbeat: new Date().toISOString(),
            lastSeen: new Date().toISOString()
        };

        // Update repo stats if provided
        if (repoStats) {
            updates.ipfsRepoStats = {
                repoSizeGB: repoStats.repoSizeGB,
                numObjects: repoStats.numObjects,
                updatedAt: new Date().toISOString()
            };
        }

        if (pinnedFiles !== undefined) {
            updates.pinnedFilesCount = pinnedFiles;
        }

        StorageProvider.updateProvider(provider.id, updates);

        res.json({
            success: true,
            message: 'Heartbeat received',
            agentStatus: agentStatus,
            hasPendingPins: (loadPendingPins()[username] || []).length > 0
        });
    } catch (error) {
        console.error('[PROVIDER-AGENT] Heartbeat error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/provider-agent/pending-pins
 * Get list of files the provider should pin
 */
router.get('/pending-pins', (req, res) => {
    try {
        const { username } = req.query;

        if (!username) {
            return res.status(400).json({ success: false, error: 'username required' });
        }

        const allPins = loadPendingPins();
        const pins = allPins[username] || [];

        res.json({
            success: true,
            pins: pins
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/provider-agent/confirm-pin
 * Provider confirms a file has been pinned
 */
router.post('/confirm-pin', (req, res) => {
    try {
        const { username, cid } = req.body;

        if (!username || !cid) {
            return res.status(400).json({ success: false, error: 'username and cid required' });
        }

        // Remove from pending (file-based)
        const allPins = loadPendingPins();
        const pins = allPins[username] || [];
        allPins[username] = pins.filter(p => p.cid !== cid);
        savePendingPins(allPins);

        console.log(`[PROVIDER-AGENT] Pin confirmed by ${username}: ${cid}`);

        res.json({
            success: true,
            message: 'Pin confirmed'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/provider-agent/request-pin
 * Backend requests provider to pin a file (called by upload flow)
 */
router.post('/request-pin', (req, res) => {
    try {
        const { username, cid, contractId, fileSize } = req.body;

        if (!username || !cid) {
            return res.status(400).json({ success: false, error: 'username and cid required' });
        }

        // Add to pending pins for this provider (file-based)
        const allPins = loadPendingPins();
        if (!allPins[username]) {
            allPins[username] = [];
        }
        allPins[username].push({
            cid: cid,
            contractId: contractId,
            fileSize: fileSize,
            requestedAt: new Date().toISOString()
        });
        savePendingPins(allPins);

        console.log(`[PROVIDER-AGENT] Pin request added for ${username}: ${cid}`);

        res.json({
            success: true,
            message: 'Pin request queued'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/provider-agent/status/:username
 * Check if a provider agent is online
 */
router.get('/status/:username', (req, res) => {
    try {
        const { username } = req.params;

        const data = StorageProvider.loadProviders();
        const provider = data.providers.find(p => p.peerId === username);

        if (!provider) {
            return res.status(404).json({ success: false, error: 'Provider not found' });
        }

        // Check if heartbeat is recent (within 60 seconds)
        const lastHeartbeat = provider.lastHeartbeat ? new Date(provider.lastHeartbeat) : null;
        const isOnline = lastHeartbeat && (Date.now() - lastHeartbeat.getTime()) < 60000;

        res.json({
            success: true,
            username: username,
            isOnline: isOnline,
            agentStatus: provider.agentStatus || 'unknown',
            ipfsPeerId: provider.ipfsPeerId || null,
            lastHeartbeat: provider.lastHeartbeat,
            pinnedFilesCount: provider.pinnedFilesCount || 0
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/provider-agent/config/:token
 * Get provider configuration by token (for Magic Link setup)
 * This endpoint is used by ProviderAgent to auto-configure itself
 */
router.get('/config/:token', (req, res) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).json({ success: false, error: 'Token required' });
        }

        // Find provider by token
        const provider = StorageProvider.getProviderByToken(token);

        if (!provider) {
            return res.status(404).json({
                success: false,
                error: 'Invalid token. Please get a new setup link from the web interface.'
            });
        }

        console.log(`[PROVIDER-AGENT] Config request for provider: ${provider.peerId}`);

        // Return config for ProviderAgent
        res.json({
            success: true,
            config: {
                BACKEND_URL: `http://${req.get('host')?.replace(':3001', ':3001')}/api` || 'http://localhost:3001/api',
                PROVIDER_TOKEN: provider.providerToken,
                PROVIDER_USERNAME: provider.peerId,
                API_KEY: process.env.API_KEY || 'supersecret'
            },
            provider: {
                id: provider.id,
                name: provider.name,
                username: provider.peerId
            }
        });
    } catch (error) {
        console.error('[PROVIDER-AGENT] Config error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
