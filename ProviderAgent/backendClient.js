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
     */
    async registerProvider(providerData) {
        try {
            const client = this.getClient();
            const response = await client.post('/provider-agent/register', {
                username: providerData.username,
                ipfsPeerId: providerData.ipfsPeerId,
                multiaddress: providerData.multiaddress,
                capacityGB: providerData.capacityGB,
                agentVersion: providerData.agentVersion
            });

            if (response.data.success) {
                this.providerId = response.data.provider?.id;
            }

            return response.data;
        } catch (error) {
            if (error.response?.status === 404) {
                throw new Error('Provider agent endpoint not found. Backend may need updating.');
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
            const response = await client.post('/provider-agent/heartbeat', {
                username: config.PROVIDER_USERNAME,
                ipfsPeerId: statusData.ipfsPeerId,
                repoStats: statusData.repoStats,
                pinnedFiles: statusData.pinnedFilesCount,
                status: 'online'
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
            const response = await client.get('/provider-agent/pending-pins', {
                params: { username: config.PROVIDER_USERNAME }
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
            const response = await client.post('/provider-agent/confirm-pin', {
                username: config.PROVIDER_USERNAME,
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
