#!/usr/bin/env node
/**
 * Provider Agent - Main Entry Point
 * 
 * This application allows you to become a storage provider in the 
 * Distributed Cloud network. It connects your local IPFS node to
 * the central backend and handles file storage requests.
 * 
 * Usage:
 *   1. Install IPFS (kubo) on your machine
 *   2. Start IPFS daemon: ipfs daemon
 *   3. Edit config.js with your username
 *   4. Run: npm start
 */

const chalk = require('chalk');
const ora = require('ora');
const config = require('./config');
const ipfsManager = require('./ipfsManager');
const backendClient = require('./backendClient');
const { startServer } = require('./httpServer');

// ASCII Art Banner
console.log(chalk.cyan(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🌐  DISTRIBUTED CLOUD - PROVIDER AGENT  🌐              ║
║                                                           ║
║   Become part of the decentralized storage network        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`));

// State
let isRunning = true;
let heartbeatInterval = null;
let pinCheckInterval = null;

/**
 * Main startup sequence
 */
async function main() {
    // Clear config cache and reload (for hot-reload support)
    delete require.cache[require.resolve('./config')];
    const config = require('./config');

    // Check configuration - need either token or username
    if (!config.PROVIDER_TOKEN && !config.PROVIDER_USERNAME) {
        console.log(chalk.yellow('⏳ No provider configuration found - Waiting for setup...'));
        console.log('');
        console.log(chalk.white('   To configure this Provider Agent:'));
        console.log(chalk.cyan('   1. Go to the web interface (http://localhost:3000)'));
        console.log(chalk.cyan('   2. Navigate to "Provider" page'));
        console.log(chalk.cyan('   3. Register as a provider (or find your existing one)'));
        console.log(chalk.cyan('   4. Click the "Setup" button'));
        console.log('');
        console.log(chalk.gray('   The configuration will be downloaded automatically.'));
        console.log('');

        // Start HTTP server anyway to receive Magic Link setup
        const { startServer, PORT } = require('./httpServer');
        await startServer();

        console.log('');
        console.log(chalk.green('🔗 Waiting for Magic Link setup at:'));
        console.log(chalk.cyan(`   http://localhost:${PORT}/setup?token=YOUR_TOKEN`));
        console.log('');
        console.log(chalk.gray('   Press Ctrl+C to stop'));

        // Keep process alive
        return;
    }

    // Show auth method being used
    if (config.PROVIDER_TOKEN) {
        console.log(chalk.green('🔐 Auth:     Token-based (from provider-config.json)'));
    } else {
        console.log(chalk.yellow('🔐 Auth:     Username-based (legacy)'));
    }
    console.log(chalk.white(`📋 Provider: ${chalk.cyan(config.PROVIDER_USERNAME || 'Will be retrieved from token')}`));
    console.log(chalk.white(`🔗 Backend:  ${chalk.cyan(config.BACKEND_URL)}`));
    console.log('');

    // Step 1: Check IPFS daemon
    const ipfsSpinner = ora('Checking IPFS daemon...').start();

    const ipfsRunning = await ipfsManager.isRunning();
    if (!ipfsRunning) {
        ipfsSpinner.fail('IPFS daemon is not running!');
        console.log(chalk.yellow('\n📝 Please start IPFS first:'));
        console.log(chalk.gray('   ipfs daemon'));
        console.log(chalk.gray('\n   Or install Kubo from: https://docs.ipfs.tech/install/'));
        process.exit(1);
    }
    ipfsSpinner.succeed('IPFS daemon is running');

    // Step 2: Get IPFS identity
    const identitySpinner = ora('Getting IPFS identity...').start();
    let identity;
    try {
        identity = await ipfsManager.getIdentity();
        identitySpinner.succeed(`IPFS Peer ID: ${chalk.cyan(identity.peerId.substring(0, 20))}...`);
    } catch (error) {
        identitySpinner.fail(`Failed to get identity: ${error.message}`);
        process.exit(1);
    }

    // Step 3: Check backend connection
    const backendSpinner = ora('Connecting to backend...').start();
    const backendOnline = await backendClient.checkConnection();
    if (!backendOnline) {
        backendSpinner.fail('Cannot connect to backend server');
        console.log(chalk.yellow(`\n📝 Make sure backend is running at: ${config.BACKEND_URL}`));
        process.exit(1);
    }
    backendSpinner.succeed('Connected to backend');

    // Step 4: Register with backend
    const registerSpinner = ora('Registering as provider...').start();
    try {
        const publicAddress = ipfsManager.getPublicAddress();
        const result = await backendClient.registerProvider({
            username: config.PROVIDER_USERNAME,
            ipfsPeerId: identity.peerId,
            multiaddress: publicAddress,
            capacityGB: config.OFFERED_CAPACITY_GB,
            agentVersion: identity.agentVersion
        });

        if (result.success) {
            registerSpinner.succeed(`Registered successfully! Provider ID: ${chalk.cyan(result.provider?.id || 'N/A')}`);
        } else {
            registerSpinner.warn(`Registration response: ${result.message || 'Unknown'}`);
        }
    } catch (error) {
        registerSpinner.fail(`Registration failed: ${error.message}`);
        console.log(chalk.yellow('\n📝 The backend may need the provider-agent endpoints. Continue anyway...'));
    }

    // Step 5: Get initial stats
    const statsSpinner = ora('Getting storage stats...').start();
    try {
        const repoStats = await ipfsManager.getRepoStats();
        const pins = await ipfsManager.listPins();
        statsSpinner.succeed(`Storage: ${repoStats.repoSizeGB} GB used | ${pins.length} files pinned`);
    } catch (error) {
        statsSpinner.warn(`Could not get stats: ${error.message}`);
    }

    console.log('');
    console.log(chalk.green('═══════════════════════════════════════════════════════════'));
    console.log(chalk.green('  ✓ Provider Agent is now ONLINE and ready!'));
    console.log(chalk.green('═══════════════════════════════════════════════════════════'));
    console.log('');

    // Start HTTP server for direct uploads
    try {
        await startServer();
    } catch (error) {
        console.log(chalk.yellow(`⚠️ HTTP server start failed: ${error.message}`));
    }

    console.log('');
    console.log(chalk.gray('Press Ctrl+C to stop the agent'));
    console.log('');

    // Start heartbeat loop
    startHeartbeat(identity);

    // Start pin check loop
    startPinCheck();

    // Handle shutdown
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

/**
 * Send periodic heartbeats to backend
 */
function startHeartbeat(identity) {
    const sendHeartbeat = async () => {
        try {
            const repoStats = await ipfsManager.getRepoStats();
            const pins = await ipfsManager.listPins();

            const result = await backendClient.sendHeartbeat({
                ipfsPeerId: identity.peerId,
                repoStats: repoStats,
                pinnedFilesCount: pins.length
            });

            if (config.VERBOSE) {
                console.log(chalk.gray(`💓 Heartbeat sent (${new Date().toLocaleTimeString()})`));
            }
        } catch (error) {
            console.log(chalk.yellow(`⚠️  Heartbeat error: ${error.message}`));
        }
    };

    // Send first heartbeat immediately
    sendHeartbeat();

    // Then send every HEARTBEAT_INTERVAL
    heartbeatInterval = setInterval(sendHeartbeat, config.HEARTBEAT_INTERVAL);
}

/**
 * Check for pending pin requests
 */
function startPinCheck() {
    const checkPins = async () => {
        try {
            const pendingPins = await backendClient.getPendingPins();

            for (const pinRequest of pendingPins) {
                console.log(chalk.blue(`📥 Pin request: ${pinRequest.cid}`));

                try {
                    await ipfsManager.pinFile(pinRequest.cid);
                    await backendClient.confirmPin(pinRequest.cid);
                    console.log(chalk.green(`   ✓ Pinned successfully: ${pinRequest.cid}`));
                } catch (error) {
                    console.log(chalk.red(`   ✗ Failed to pin: ${error.message}`));
                }
            }
        } catch (error) {
            // Silent fail - endpoint might not exist yet
            if (config.VERBOSE) {
                console.log(chalk.gray(`Pin check: ${error.message}`));
            }
        }
    };

    // Check every 10 seconds
    pinCheckInterval = setInterval(checkPins, 10000);
}

/**
 * Graceful shutdown
 */
async function shutdown() {
    console.log('');
    console.log(chalk.yellow('🛑 Shutting down Provider Agent...'));

    isRunning = false;

    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }
    if (pinCheckInterval) {
        clearInterval(pinCheckInterval);
    }

    // Send offline status
    try {
        await backendClient.sendHeartbeat({
            ipfsPeerId: ipfsManager.peerId,
            status: 'offline'
        });
    } catch (e) {
        // Ignore
    }

    console.log(chalk.gray('Goodbye! 👋'));
    process.exit(0);
}

// Export for hot-reload from httpServer
module.exports = { runMain: main };

// Run only if this is the main module
if (require.main === module) {
    main().catch(error => {
        console.error(chalk.red('Fatal error:'), error);
        process.exit(1);
    });
}
