/**
 * Provider WebSocket Server
 * Handles real-time communication with Provider Agents
 */

const WebSocket = require('ws');
const StorageProvider = require('../models/StorageProvider');

class ProviderSocketServer {
    constructor() {
        this.wss = null;
        this.connectedProviders = new Map(); // providerId -> { ws, provider }
        this.server = null;
    }

    /**
     * Initialize WebSocket server
     */
    initialize(server) {
        this.server = server;

        this.wss = new WebSocket.Server({
            server,
            path: '/provider-ws',
            clientTracking: true
        });

        this.wss.on('connection', (ws, req) => {
            this.handleConnection(ws, req);
        });

        // Heartbeat check every 30 seconds
        this.startHeartbeatCheck();

        console.log('✅ Provider WebSocket server initialized on /provider-ws');
    }

    /**
     * Handle new provider connection
     */
    handleConnection(ws, req) {
        console.log('🔌 New WebSocket connection attempt...');

        // Extract token from query string
        const url = new URL(req.url, `http://${req.headers.host}`);
        const token = url.searchParams.get('token');

        if (!token) {
            console.log('❌ Connection rejected: Missing token');
            ws.close(1008, 'Missing authentication token');
            return;
        }

        // Validate token and get provider
        const provider = StorageProvider.getProviderByToken(token);
        if (!provider) {
            console.log('❌ Connection rejected: Invalid token');
            ws.close(1008, 'Invalid token');
            return;
        }

        const providerId = provider.id;
        console.log(`✅ Provider connected: ${provider.name} (${providerId})`);

        // Store connection
        this.connectedProviders.set(providerId, {
            ws,
            provider,
            lastPing: Date.now(),
            connectedAt: Date.now()
        });

        // Update provider status
        StorageProvider.updateStatus(providerId, 'online');
        StorageProvider.updateHeartbeat(providerId);

        // Setup WebSocket event handlers
        ws.isAlive = true;

        ws.on('pong', () => {
            ws.isAlive = true;
            const conn = this.connectedProviders.get(providerId);
            if (conn) {
                conn.lastPing = Date.now();
            }
        });

        ws.on('message', (data) => {
            this.handleMessage(providerId, data);
        });

        ws.on('close', () => {
            console.log(`❌ Provider disconnected: ${provider.name} (${providerId})`);
            this.connectedProviders.delete(providerId);
            StorageProvider.updateStatus(providerId, 'offline');
        });

        ws.on('error', (error) => {
            console.error(`❌ WebSocket error for ${providerId}:`, error.message);
        });

        // Send welcome message
        this.sendToProvider(providerId, 'welcome', {
            message: 'Connected successfully to Distributed Cloud Backend',
            providerId: providerId,
            providerName: provider.name,
            timestamp: Date.now()
        });
    }

    /**
     * Handle incoming messages from provider
     */
    handleMessage(providerId, data) {
        try {
            const message = JSON.parse(data.toString());
            const { type, data: messageData } = message;

            console.log(`📨 Message from ${providerId}: ${type}`);

            switch (type) {
                case 'register':
                    // Provider registration/re-registration
                    this.handleRegister(providerId, messageData);
                    break;

                case 'ping':
                    // Manual ping from provider
                    this.sendToProvider(providerId, 'pong', { timestamp: Date.now() });
                    break;

                case 'pong':
                    // Heartbeat response
                    StorageProvider.updateHeartbeat(providerId);
                    break;

                case 'capacity_update':
                    // Update provider capacity
                    this.handleCapacityUpdate(providerId, messageData);
                    break;

                case 'pin_confirmed':
                    // Provider confirmed pin
                    this.handlePinConfirmed(providerId, messageData);
                    break;

                case 'pin_failed':
                    // Provider failed to pin
                    this.handlePinFailed(providerId, messageData);
                    break;

                case 'unpin_confirmed':
                    // Provider confirmed unpin
                    this.handleUnpinConfirmed(providerId, messageData);
                    break;

                case 'contract_accepted':
                    // Provider accepted storage contract
                    this.handleContractAccepted(providerId, messageData);
                    break;

                case 'contract_failed':
                    // Provider failed to accept contract
                    this.handleContractFailed(providerId, messageData);
                    break;

                case 'going_offline':
                    // Provider is shutting down gracefully
                    console.log(`👋 Provider ${providerId} going offline`);
                    StorageProvider.updateStatus(providerId, 'offline');
                    break;

                default:
                    console.log(`❓ Unknown message type from ${providerId}: ${type}`);
            }
        } catch (error) {
            console.error(`❌ Error handling message from ${providerId}:`, error.message);
        }
    }

    /**
     * Handle provider registration
     */
    handleRegister(providerId, data) {
        console.log(`📝 Provider ${providerId} registered (version: ${data.version})`);
        StorageProvider.updateHeartbeat(providerId);
    }

    /**
     * Handle capacity update
     */
    handleCapacityUpdate(providerId, data) {
        const { totalGB, usedGB, availableGB, pinnedFiles } = data;

        // Safely convert to numbers
        const totalGBNum = parseFloat(totalGB) || 0;
        const usedGBNum = parseFloat(usedGB) || 0;
        const availableGBNum = parseFloat(availableGB) || 0;
        const pinnedFilesNum = parseInt(pinnedFiles) || 0;

        console.log(`📊 Capacity update from ${providerId}: ${usedGBNum.toFixed(2)}/${totalGBNum} GB, ${pinnedFilesNum} files`);

        StorageProvider.updateCapacity(providerId, {
            totalGB: totalGBNum,
            usedGB: usedGBNum,
            availableGB: availableGBNum,
            pinnedFiles: pinnedFilesNum,
            lastUpdate: new Date().toISOString()
        });

        StorageProvider.updateHeartbeat(providerId);
    }

    /**
     * Handle pin confirmed
     */
    handlePinConfirmed(providerId, data) {
        const { cid, originalFileId, contractId, filename } = data;
        console.log(`✅ Pin confirmed by ${providerId}: ${cid}`);

        // Update contract with actual CID
        const StorageContract = require('../models/StorageContract');
        if (contractId && originalFileId) {
            // Update file CID in contract
            const contract = StorageContract.getContract(contractId);
            if (contract) {
                const fileIndex = contract.files.findIndex(f => f.cid === originalFileId);
                if (fileIndex !== -1) {
                    contract.files[fileIndex].ipfsCID = cid;
                    contract.files[fileIndex].pinnedAt = new Date().toISOString();
                    StorageContract.updateContract(contractId, { files: contract.files });
                    console.log(`📝 Updated contract ${contractId} with IPFS CID: ${cid}`);
                }
            }
        }

        // Trigger payment to provider
        const paymentTrigger = require('../services/paymentTrigger');
        const StorageProvider = require('../models/StorageProvider');

        const provider = StorageProvider.getProvider(providerId);
        if (provider && provider.walletAddress) {
            paymentTrigger.triggerPayment(contractId, providerId, cid, provider.walletAddress)
                .then(result => {
                    if (result.success) {
                        console.log(`💰 Payment sent: ${result.amount} FIL (tx: ${result.txHash})`);

                        // Notify provider of payment
                        this.sendToProvider(providerId, 'payment_received', {
                            amount: `${result.amount} FIL`,
                            txHash: result.txHash,
                            contractId: contractId,
                            cid: cid
                        });

                        // Update provider earnings
                        StorageProvider.updateEarnings(providerId, result.amount);
                    } else {
                        console.warn(`⚠️ Payment failed: ${result.error}`);
                    }
                })
                .catch(error => {
                    console.error(`❌ Payment error: ${error.message}`);
                });
        } else {
            console.log(`ℹ️ Provider ${providerId} has no wallet address, skipping payment`);
        }
    }

    /**
     * Handle pin failed
     */
    handlePinFailed(providerId, data) {
        const { cid, contractId, error } = data;
        console.error(`❌ Pin failed by ${providerId}: ${cid} - ${error}`);

        // TODO: Reassign to another provider, notify client, etc.
    }

    /**
     * Handle unpin confirmed
     */
    handleUnpinConfirmed(providerId, data) {
        const { cid } = data;
        console.log(`✅ Unpin confirmed by ${providerId}: ${cid}`);
    }

    /**
     * Handle contract accepted
     */
    handleContractAccepted(providerId, data) {
        const { contractId, storageGB, duration } = data;
        console.log(`✅ Contract accepted by ${providerId}: ${contractId} (${storageGB}GB for ${duration} days)`);

        // TODO: Update contract status in database
    }

    /**
     * Handle contract failed
     */
    handleContractFailed(providerId, data) {
        const { contractId, error } = data;
        console.error(`❌ Contract failed by ${providerId}: ${contractId} - ${error}`);

        // TODO: Find alternative provider
    }

    /**
     * Send message to specific provider
     */
    sendToProvider(providerId, type, data = {}) {
        const conn = this.connectedProviders.get(providerId);
        if (conn && conn.ws.readyState === WebSocket.OPEN) {
            const message = JSON.stringify({ type, data });
            conn.ws.send(message);
            console.log(`📤 Sent to ${providerId}: ${type}`);
            return true;
        } else {
            console.warn(`⚠️ Cannot send to ${providerId} - not connected`);
            return false;
        }
    }

    /**
     * Send storage job to provider
     */
    assignStorageJob(providerId, contractData) {
        console.log(`📦 Assigning storage job to ${providerId}: ${contractData.contractId}`);
        return this.sendToProvider(providerId, 'storage_job', contractData);
    }

    /**
     * Send pin request to provider
     */
    requestPin(providerId, cid, contractId) {
        console.log(`📌 Requesting pin from ${providerId}: ${cid}`);
        return this.sendToProvider(providerId, 'pin_request', {
            cid,
            contractId,
            timestamp: Date.now()
        });
    }

    /**
     * Send unpin request to provider
     */
    requestUnpin(providerId, cid) {
        console.log(`🗑️ Requesting unpin from ${providerId}: ${cid}`);
        return this.sendToProvider(providerId, 'unpin_request', {
            cid,
            timestamp: Date.now()
        });
    }

    /**
     * Request capacity update from provider
     */
    requestCapacityUpdate(providerId) {
        return this.sendToProvider(providerId, 'capacity_request', {
            timestamp: Date.now()
        });
    }

    /**
     * Broadcast to all connected providers
     */
    broadcast(type, data) {
        let sent = 0;
        this.connectedProviders.forEach((conn, providerId) => {
            if (this.sendToProvider(providerId, type, data)) {
                sent++;
            }
        });
        console.log(`📡 Broadcast ${type} to ${sent} providers`);
        return sent;
    }

    /**
     * Get online providers
     */
    getOnlineProviders() {
        return Array.from(this.connectedProviders.keys());
    }

    /**
     * Get provider connection info
     */
    getProviderConnection(providerId) {
        return this.connectedProviders.get(providerId);
    }

    /**
     * Check if provider is connected
     */
    isProviderConnected(providerId) {
        const conn = this.connectedProviders.get(providerId);
        return conn && conn.ws.readyState === WebSocket.OPEN;
    }

    /**
     * Get connection stats
     */
    getStats() {
        return {
            totalConnections: this.connectedProviders.size,
            providers: Array.from(this.connectedProviders.entries()).map(([id, conn]) => ({
                id,
                name: conn.provider.name,
                connectedAt: conn.connectedAt,
                lastPing: conn.lastPing,
                uptime: Date.now() - conn.connectedAt
            }))
        };
    }

    /**
     * Start heartbeat check interval
     */
    startHeartbeatCheck() {
        setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (ws.isAlive === false) {
                    console.log('💔 Terminating dead connection');
                    return ws.terminate();
                }

                ws.isAlive = false;
                ws.ping();
            });
        }, 30000); // Every 30 seconds
    }
}

// Singleton instance
const providerSocketServer = new ProviderSocketServer();

module.exports = providerSocketServer;
