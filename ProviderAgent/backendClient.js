/**
 * Backend Client
 * Handles communication with the central backend server
 */

const axios = require('axios');
const config = require('./config');

class BackendClient {
    constructor() {
        this.baseUrl = config.BACKEND_URL;
        this.apiKey = config.API_KEY;
        this.providerId = null;
    }

    /**
     * Create axios instance with auth headers
     */
    getClient() {
        return axios.create({
            baseURL: this.baseUrl,
            headers: {
                'x-api-key': this.apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
    }

    /**
     * Register or update provider with IPFS peer info
     * Uses providerToken (preferred) or username (legacy) for authentication
     */
    async registerProvider(providerData) {
        try {
            const client = this.getClient();
            const response = await client.post('/provider-agent/register', {
                providerToken: config.PROVIDER_TOKEN || undefined,
                username: providerData.username,
                ipfsPeerId: providerData.ipfsPeerId,
                multiaddress: providerData.multiaddress,
                capacityGB: providerData.capacityGB,
                agentVersion: providerData.agentVersion
            });

            if (response.data.success) {
                this.providerId = response.data.provider?.id;
                // Store username from response for future requests
                this.providerUsername = response.data.provider?.username;
            }

            return response.data;
        } catch (error) {
            if (error.response?.status === 401) {
                throw new Error('Invalid provider token. Download a fresh config from the web interface.');
            }
            if (error.response?.status === 404) {
                throw new Error('Provider not found. Register as provider first via the web interface.');
            }
            throw new Error(`Registration failed: ${error.response?.data?.error || error.message}`);
        }
    }

    /**
     * Send heartbeat to keep provider online
     */
    async sendHeartbeat(statusData) {
        try {
            const client = this.getClient();
            // Use stored username from registration response, or fall back to config
            const username = this.providerUsername || config.PROVIDER_USERNAME;
            const response = await client.post('/provider-agent/heartbeat', {
                username: username,
                ipfsPeerId: statusData.ipfsPeerId,
                repoStats: statusData.repoStats,
                pinnedFiles: statusData.pinnedFilesCount,
                status: statusData.status || 'online'
            });

            return response.data;
        } catch (error) {
            console.warn(`Heartbeat failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get pending pin requests for this provider
     */
    async getPendingPins() {
        try {
            const client = this.getClient();
            const username = this.providerUsername || config.PROVIDER_USERNAME;
            const response = await client.get('/provider-agent/pending-pins', {
                params: { username: username }
            });
            return response.data.pins || [];
        } catch (error) {
            console.warn(`Failed to get pending pins: ${error.message}`);
            return [];
        }
    }

    /**
     * Confirm that a file has been pinned
     */
    async confirmPin(cid) {
        try {
            const client = this.getClient();
            const username = this.providerUsername || config.PROVIDER_USERNAME;
            const response = await client.post('/provider-agent/confirm-pin', {
                username: username,
                cid: cid
            });
            return response.data;
        } catch (error) {
            console.warn(`Failed to confirm pin: ${error.message}`);
            return { success: false };
        }
    }

    /**
     * Check backend connection
     */
    async checkConnection() {
        try {
            const client = this.getClient();
            const response = await client.get('/auth/status');
            return response.data.success === true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = new BackendClient();
