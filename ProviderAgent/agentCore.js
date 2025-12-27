/**
 * Agent Core - Main Orchestrator
 * Coordinates all provider agent components
 */

const WebSocketClient = require('./websocketClient');
const IPFSManager = require('./ipfsManager');
const JobQueue = require('./jobQueue');
const config = require('./config');
const chalk = require('chalk');

class AgentCore {
    constructor() {
        this.wsClient = null;
        this.ipfsManager = null;
        this.jobQueue = new JobQueue();
        this.isRunning = false;
        this.identity = null;
        this.providerId = null;
    }

    /**
     * Initialize and start the agent
     */
    async start() {
        console.log(chalk.cyan('\n🚀 Starting Provider Agent Core...\n'));

        // Step 1: Initialize IPFS Manager
        console.log('📦 Initializing IPFS Manager...');
        this.ipfsManager = require('./ipfsManager');

        const ipfsRunning = await this.ipfsManager.isRunning();
        if (!ipfsRunning) {
            throw new Error('IPFS daemon not running. Please start: ipfs daemon');
        }

        this.identity = await this.ipfsManager.getIdentity();
        console.log(chalk.green(`✅ IPFS Peer ID: ${this.identity.peerId.substring(0, 20)}...\n`));

        // Step 2: Initialize Wallet Manager
        console.log('💼 Initializing Wallet Manager...');
        const WalletManager = require('./walletManager');
        this.walletManager = new WalletManager();

        try {
            await this.walletManager.loadWallet();
            const walletInfo = await this.walletManager.getInfo();
            console.log(chalk.green(`✅ Wallet: ${walletInfo.address}`));
            console.log(chalk.gray(`   Balance: ${walletInfo.balance}\n`));
        } catch (error) {
            console.warn(chalk.yellow(`⚠️ Wallet initialization failed: ${error.message}\n`));
        }

        // Step 3: Initialize WebSocket Client
        console.log('🔌 Initializing WebSocket connection...');
        this.wsClient = new WebSocketClient();

        // Setup event handlers
        this.setupEventHandlers();

        // Connect to backend
        this.wsClient.connect();

        this.isRunning = true;
        console.log(chalk.green('\n✅ Provider Agent Core initialized!\n'));
    }

    /**
     * Setup all event handlers
     */
    setupEventHandlers() {
        // ========================================
        // WebSocket Events
        // ========================================

        this.wsClient.on('connected', () => {
            console.log(chalk.green('✅ Connected to backend'));
            this.sendCapacityUpdate();
        });

        this.wsClient.on('disconnected', () => {
            console.log(chalk.yellow('⚠️ Disconnected from backend'));
        });

        this.wsClient.on('welcome', (data) => {
            console.log(chalk.cyan(`👋 ${data.message}`));
            if (data.providerId) {
                this.providerId = data.providerId;
                console.log(chalk.gray(`   Provider ID: ${data.providerId}`));
            }
        });

        this.wsClient.on('storage_job', (job) => {
            console.log(chalk.blue(`📥 New storage job: ${job.contractId}`));
            this.jobQueue.addJob({
                id: job.contractId,
                type: 'storage_contract',
                data: job
            });
        });

        this.wsClient.on('pin_request', (data) => {
            console.log(chalk.blue(`📌 Pin request: ${data.cid}`));
            this.jobQueue.addJob({
                id: data.cid,
                type: 'pin',
                data: data
            });
        });

        this.wsClient.on('unpin_request', (data) => {
            console.log(chalk.yellow(`🗑️ Unpin request: ${data.cid}`));
            this.jobQueue.addJob({
                id: data.cid,
                type: 'unpin',
                data: data
            });
        });

        this.wsClient.on('payment_received', (payment) => {
            console.log(chalk.green(`💰 Payment received: ${payment.amount} FIL`));
            this.showNotification(`Received ${payment.amount} FIL`);
        });

        this.wsClient.on('capacity_request', () => {
            console.log(chalk.gray('📊 Capacity update requested'));
            this.sendCapacityUpdate();
        });

        // ========================================
        // Job Queue Events
        // ========================================

        this.jobQueue.on('execute_pin', async ({ cid, contractId, jobId }) => {
            try {
                console.log(chalk.gray(`   Retrieving file ${cid} from provider folder...`));

                // Get provider storage path using provider ID
                let providerPath;

                // Use provider ID from welcome message (stored in this.providerId)
                if (this.providerId) {
                    const path = require('path');
                    const os = require('os');
                    const ipfsPath = process.env.IPFS_PATH || path.join(os.homedir(), '.ipfs');
                    providerPath = path.join(ipfsPath, 'provider-storage', this.providerId);
                    console.log(chalk.gray(`   Using path: ${providerPath}`));
                } else {
                    throw new Error('Provider ID not set - wait for WebSocket welcome message');
                }

                // Retrieve file from provider folder and add to IPFS
                const result = await this.ipfsManager.retrieveFromProviderFolder(cid, providerPath);
                const actualCID = result.cid;

                console.log(chalk.gray(`   Pinning ${actualCID}...`));
                await this.ipfsManager.pinFile(actualCID);

                // Notify backend with actual CID
                this.wsClient.send('pin_confirmed', {
                    cid: actualCID,
                    originalFileId: cid,
                    contractId,
                    filename: result.filename,
                    timestamp: Date.now()
                });

                console.log(chalk.green(`   ✅ Pinned successfully`));
                this.jobQueue.emit(`pin_complete_${cid}`, { success: true, cid: actualCID });

            } catch (error) {
                console.error(chalk.red(`   ❌ Pin failed: ${error.message}`));

                this.wsClient.send('pin_failed', {
                    cid,
                    contractId,
                    error: error.message
                });

                this.jobQueue.emit(`pin_failed_${cid}`, error);
            }
        });

        this.jobQueue.on('execute_unpin', async ({ cid, jobId }) => {
            try {
                console.log(chalk.gray(`   Unpinning ${cid}...`));
                await this.ipfsManager.unpinFile(cid);

                this.wsClient.send('unpin_confirmed', {
                    cid,
                    timestamp: Date.now()
                });

                console.log(chalk.green(`   ✅ Unpinned successfully`));
                this.jobQueue.emit(`unpin_complete_${cid}`, { success: true });

            } catch (error) {
                console.error(chalk.red(`   ❌ Unpin failed: ${error.message}`));

                this.wsClient.send('unpin_failed', {
                    cid,
                    error: error.message
                });

                this.jobQueue.emit(`unpin_failed_${cid}`, error);
            }
        });

        this.jobQueue.on('execute_storage_contract', async ({ contractId, storageGB, duration, jobId }) => {
            try {
                console.log(chalk.gray(`   Processing storage contract ${contractId}...`));

                // For now, just acknowledge the contract
                // In future: reserve space, setup monitoring, etc.

                this.wsClient.send('contract_accepted', {
                    contractId,
                    storageGB,
                    duration,
                    timestamp: Date.now()
                });

                console.log(chalk.green(`   ✅ Contract accepted`));
                this.jobQueue.emit(`contract_complete_${contractId}`, { success: true });

            } catch (error) {
                console.error(chalk.red(`   ❌ Contract failed: ${error.message}`));

                this.wsClient.send('contract_failed', {
                    contractId,
                    error: error.message
                });

                this.jobQueue.emit(`contract_failed_${contractId}`, error);
            }
        });

        this.jobQueue.on('job_completed', (job) => {
            console.log(chalk.green(`✅ Job completed: ${job.id}`));
            this.sendCapacityUpdate();
        });

        this.jobQueue.on('job_failed', (job, error) => {
            console.error(chalk.red(`❌ Job failed: ${job.id} - ${error.message}`));
        });
    }

    /**
     * Send capacity update to backend
     */
    async sendCapacityUpdate() {
        try {
            const stats = await this.ipfsManager.getRepoStats();
            const pins = await this.ipfsManager.listPins();

            const capacityData = {
                totalGB: config.OFFERED_CAPACITY_GB,
                usedGB: stats.repoSizeGB,
                availableGB: Math.max(0, config.OFFERED_CAPACITY_GB - stats.repoSizeGB),
                pinnedFiles: pins.length,
                timestamp: Date.now()
            };

            this.wsClient.send('capacity_update', capacityData);

            if (config.VERBOSE) {
                console.log(chalk.gray(`📊 Capacity: ${stats.repoSizeGB.toFixed(2)}/${config.OFFERED_CAPACITY_GB} GB, ${pins.length} files`));
            }
        } catch (error) {
            console.warn(chalk.yellow(`⚠️ Failed to send capacity update: ${error.message}`));
        }
    }

    /**
     * Show desktop notification
     */
    showNotification(message) {
        // For CLI, just log
        console.log(chalk.cyan(`🔔 ${message}`));

        // TODO: If using Electron, show native notification
        // if (typeof window !== 'undefined' && window.Notification) {
        //   new window.Notification('Provider Agent', { body: message });
        // }
    }

    /**
     * Get agent status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            wsConnected: this.wsClient ? this.wsClient.isOnline() : false,
            ipfsPeerId: this.identity ? this.identity.peerId : null,
            jobQueue: this.jobQueue.getStatus()
        };
    }

    /**
     * Graceful shutdown
     */
    async stop() {
        console.log(chalk.yellow('\n🛑 Shutting down Provider Agent Core...'));

        this.isRunning = false;

        // Disconnect WebSocket
        if (this.wsClient) {
            this.wsClient.disconnect();
        }

        console.log(chalk.gray('👋 Goodbye!'));
    }
}

module.exports = AgentCore;
