/**
 * Provider Network Router
 * Handles smart routing of files to provider nodes with fallback to Docker cluster
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const StorageProvider = require('../models/StorageProvider');

class ProviderNetworkRouter {
    constructor() {
        this.HEARTBEAT_TIMEOUT_MS = 60000; // 60 seconds - consider offline if no heartbeat
    }

    /**
     * Check if a provider agent is online
     */
    isProviderOnline(provider) {
        if (!provider.ipfsPeerId) {
            return false; // No IPFS peer ID means agent never connected
        }

        if (provider.agentStatus === 'offline') {
            return false;
        }

        if (!provider.lastHeartbeat) {
            return false;
        }

        const lastHeartbeat = new Date(provider.lastHeartbeat);
        const now = new Date();
        const timeSinceHeartbeat = now.getTime() - lastHeartbeat.getTime();

        return timeSinceHeartbeat < this.HEARTBEAT_TIMEOUT_MS;
    }

    /**
     * Get provider info with online status
     */
    getProviderStatus(username) {
        const data = StorageProvider.loadProviders();
        const provider = data.providers.find(p => p.peerId === username);

        if (!provider) {
            return null;
        }

        return {
            ...provider,
            isOnline: this.isProviderOnline(provider)
        };
    }

    /**
     * Get all online providers
     */
    getOnlineProviders() {
        const data = StorageProvider.loadProviders();
        return data.providers.filter(p => this.isProviderOnline(p));
    }

    /**
     * Send file to provider's IPFS node
     * @param {Object} provider - Provider object with ipfsPeerId and multiaddress
     * @param {string} cid - CID of the file to pin
     * @param {Object} fileInfo - File information (name, size)
     */
    async sendPinRequestToProvider(provider, cid, fileInfo) {
        // For now, we add to pending pins queue - the Provider Agent will pick it up
        // In a production system, you might use WebSocket for instant delivery

        const pendingPinsPath = require('path').join(__dirname, '../data/pending-pins.json');

        let pendingPins = {};
        try {
            if (fs.existsSync(pendingPinsPath)) {
                pendingPins = JSON.parse(fs.readFileSync(pendingPinsPath, 'utf8'));
            }
        } catch (e) {
            pendingPins = {};
        }

        const username = provider.peerId;
        if (!pendingPins[username]) {
            pendingPins[username] = [];
        }

        // Add to queue
        pendingPins[username].push({
            cid: cid,
            fileName: fileInfo.name,
            fileSize: fileInfo.size,
            requestedAt: new Date().toISOString()
        });

        // Ensure directory exists
        const dataDir = require('path').dirname(pendingPinsPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        fs.writeFileSync(pendingPinsPath, JSON.stringify(pendingPins, null, 2));

        console.log(`[PROVIDER-ROUTER] Pin request queued for ${username}: ${cid}`);

        return { success: true, queued: true };
    }

    /**
     * Get provider's HTTP server URL
     */
    getProviderHttpUrl(provider) {
        // Provider Agent runs on port 4000 by default
        // For now, assume same machine (localhost) - in production, use provider's IP
        const port = 4000;
        // If provider has a registered address, use it
        // For demo, fallback to localhost
        return `http://localhost:${port}`;
    }

    /**
     * Check provider capacity via HTTP
     */
    async checkProviderCapacity(provider) {
        try {
            const url = this.getProviderHttpUrl(provider);
            const response = await axios.get(`${url}/capacity`, { timeout: 5000 });
            return response.data;
        } catch (error) {
            console.log(`[PROVIDER-ROUTER] Cannot reach provider ${provider.name}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Upload file directly to provider's IPFS node
     * @param {Object} provider - Provider object
     * @param {string} filePath - Path to the file to upload
     * @param {Object} fileInfo - File information (name, size, mimetype)
     * @returns {Object} { success, cid } or { success: false, error }
     */
    async uploadFileToProvider(provider, filePath, fileInfo) {
        try {
            const url = this.getProviderHttpUrl(provider);
            console.log(`[PROVIDER-ROUTER] Uploading directly to provider: ${url}`);

            // Check capacity first
            const capacityCheck = await this.checkProviderCapacity(provider);
            if (!capacityCheck.success) {
                return {
                    success: false,
                    error: 'Cannot reach provider',
                    shouldFallback: true
                };
            }

            const fileSizeGB = fileInfo.size / (1024 * 1024 * 1024);
            if (fileSizeGB > capacityCheck.capacity.availableGB) {
                return {
                    success: false,
                    error: `Insufficient provider capacity: need ${fileSizeGB.toFixed(3)}GB, have ${capacityCheck.capacity.availableGB.toFixed(3)}GB`,
                    shouldFallback: true
                };
            }

            // Upload file
            const form = new FormData();
            form.append('file', fs.createReadStream(filePath), {
                filename: fileInfo.name,
                contentType: fileInfo.mimetype
            });

            const response = await axios.post(`${url}/upload`, form, {
                headers: form.getHeaders(),
                timeout: 120000, // 2 minutes for large files
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            if (response.data.success) {
                console.log(`[PROVIDER-ROUTER] ✓ File uploaded to provider: ${response.data.cid}`);
                return {
                    success: true,
                    cid: response.data.cid,
                    storedOn: 'provider',
                    providerName: provider.name
                };
            } else {
                return {
                    success: false,
                    error: response.data.error,
                    shouldFallback: true
                };
            }
        } catch (error) {
            console.log(`[PROVIDER-ROUTER] Provider upload failed: ${error.message}`);
            return {
                success: false,
                error: error.message,
                shouldFallback: true
            };
        }
    }

    /**
     * Smart routing decision: should we send to provider or cluster?
     * @param {string} contractId - The storage contract ID (optional)
     * @returns {Object} { useProvider: boolean, provider: Object|null, reason: string }
     */
    async getRoutingDecision(contractId, fileSize) {
        // If no contract, use cluster
        if (!contractId) {
            return {
                useProvider: false,
                provider: null,
                reason: 'No contract specified, using backup cluster'
            };
        }

        // Load contract to find provider
        const StorageContract = require('../models/StorageContract');
        const contract = StorageContract.getContract(contractId);

        if (!contract) {
            return {
                useProvider: false,
                provider: null,
                reason: 'Contract not found, using backup cluster'
            };
        }

        // Get provider
        const provider = StorageProvider.getProvider(contract.providerId);

        if (!provider) {
            return {
                useProvider: false,
                provider: null,
                reason: 'Provider not found, using backup cluster'
            };
        }

        // Check if provider is online
        if (!this.isProviderOnline(provider)) {
            return {
                useProvider: false,
                provider: provider,
                reason: `Provider ${provider.name} is offline, using backup cluster`
            };
        }

        // Provider is online!
        return {
            useProvider: true,
            provider: provider,
            reason: `Routing to online provider: ${provider.name}`
        };
    }

    /**
     * Get routing summary for logging/debugging
     */
    getNetworkSummary() {
        const data = StorageProvider.loadProviders();
        const online = data.providers.filter(p => this.isProviderOnline(p));
        const offline = data.providers.filter(p => !this.isProviderOnline(p));

        return {
            totalProviders: data.providers.length,
            onlineProviders: online.length,
            offlineProviders: offline.length,
            onlineList: online.map(p => ({ name: p.name, peerId: p.peerId, ipfsPeerId: p.ipfsPeerId })),
            offlineList: offline.map(p => ({ name: p.name, peerId: p.peerId }))
        };
    }
}

module.exports = new ProviderNetworkRouter();
