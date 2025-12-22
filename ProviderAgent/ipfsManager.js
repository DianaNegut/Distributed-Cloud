/**
 * IPFS Manager
 * Handles communication with local IPFS daemon
 */

const { exec, spawn } = require('child_process');
const axios = require('axios');
const config = require('./config');

class IPFSManager {
    constructor() {
        this.apiUrl = `http://${config.IPFS.API_HOST}:${config.IPFS.API_PORT}/api/v0`;
        this.peerId = null;
        this.multiaddresses = [];
    }

    /**
     * Check if IPFS daemon is running
     */
    async isRunning() {
        try {
            const response = await axios.post(`${this.apiUrl}/id`, null, { timeout: 5000 });
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get IPFS node identity (Peer ID and addresses)
     */
    async getIdentity() {
        try {
            const response = await axios.post(`${this.apiUrl}/id`);
            this.peerId = response.data.ID;
            this.multiaddresses = response.data.Addresses || [];

            return {
                peerId: this.peerId,
                addresses: this.multiaddresses,
                agentVersion: response.data.AgentVersion
            };
        } catch (error) {
            throw new Error(`Failed to get IPFS identity: ${error.message}`);
        }
    }

    /**
     * Get public multiaddress for external connections
     */
    getPublicAddress() {
        // Prefer public IPv4 addresses
        const publicAddr = this.multiaddresses.find(addr =>
            !addr.includes('127.0.0.1') &&
            !addr.includes('/ip6/') &&
            addr.includes('/tcp/')
        );

        return publicAddr || this.multiaddresses[0] || null;
    }

    /**
     * Pin a file by CID
     */
    async pinFile(cid) {
        try {
            const response = await axios.post(
                `${this.apiUrl}/pin/add`,
                null,
                {
                    params: { arg: cid },
                    timeout: 60000 // 1 minute timeout for large files
                }
            );
            return { success: true, pins: response.data.Pins };
        } catch (error) {
            throw new Error(`Failed to pin ${cid}: ${error.message}`);
        }
    }

    /**
     * Unpin a file by CID
     */
    async unpinFile(cid) {
        try {
            const response = await axios.post(
                `${this.apiUrl}/pin/rm`,
                null,
                { params: { arg: cid } }
            );
            return { success: true, pins: response.data.Pins };
        } catch (error) {
            throw new Error(`Failed to unpin ${cid}: ${error.message}`);
        }
    }

    /**
     * List all pinned files
     */
    async listPins() {
        try {
            const response = await axios.post(`${this.apiUrl}/pin/ls`);
            const pins = response.data.Keys || {};
            return Object.keys(pins).map(cid => ({
                cid,
                type: pins[cid].Type
            }));
        } catch (error) {
            throw new Error(`Failed to list pins: ${error.message}`);
        }
    }

    /**
     * Get repo stats (storage usage)
     */
    async getRepoStats() {
        try {
            const response = await axios.post(`${this.apiUrl}/repo/stat`);
            return {
                repoSize: response.data.RepoSize,
                repoSizeGB: (response.data.RepoSize / (1024 * 1024 * 1024)).toFixed(2),
                storageMax: response.data.StorageMax,
                numObjects: response.data.NumObjects
            };
        } catch (error) {
            throw new Error(`Failed to get repo stats: ${error.message}`);
        }
    }

    /**
     * Connect to a specific peer
     */
    async connectToPeer(multiaddress) {
        try {
            const response = await axios.post(
                `${this.apiUrl}/swarm/connect`,
                null,
                { params: { arg: multiaddress } }
            );
            return { success: true };
        } catch (error) {
            console.warn(`Could not connect to peer: ${error.message}`);
            return { success: false };
        }
    }

    /**
     * Add file content and return CID
     */
    async addContent(content, filename) {
        try {
            const FormData = require('form-data');
            const form = new FormData();
            form.append('file', Buffer.from(content), { filename });

            const response = await axios.post(
                `${this.apiUrl}/add`,
                form,
                { headers: form.getHeaders() }
            );

            return { success: true, cid: response.data.Hash };
        } catch (error) {
            throw new Error(`Failed to add content: ${error.message}`);
        }
    }
}

module.exports = new IPFSManager();
