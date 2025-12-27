/**
 * Provider Agent Configuration
 * 
 * Priority: provider-config.json > environment variables > defaults
 * Download provider-config.json from the web interface after registering as a provider
 */

const fs = require('fs');
const path = require('path');

// Try to load config from provider-config.json first
let fileConfig = {};
const configPath = path.join(__dirname, 'provider-config.json');

if (fs.existsSync(configPath)) {
    try {
        const configData = fs.readFileSync(configPath, 'utf8');
        fileConfig = JSON.parse(configData);
        console.log('✓ Loaded configuration from provider-config.json');
    } catch (error) {
        console.error('⚠ Error reading provider-config.json:', error.message);
    }
}

module.exports = {
    // Backend server URL - change this to your server address
    BACKEND_URL: fileConfig.BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3001/api',

    // API Key for authentication
    API_KEY: fileConfig.API_KEY || process.env.API_KEY || 'supersecret',

    // Provider Token (preferred auth method - from web registration)
    PROVIDER_TOKEN: fileConfig.PROVIDER_TOKEN || process.env.PROVIDER_TOKEN || '',

    // Your provider username (legacy auth method)
    PROVIDER_USERNAME: fileConfig.PROVIDER_USERNAME || process.env.PROVIDER_USERNAME || '',

    // IPFS Configuration - HARDCODED to use local Kubo (port 5002)
    // NOT from provider-config.json because Magic Link overwrites it
    IPFS: {
        // Local kubo port - NOT Docker's 5001
        API_PORT: process.env.IPFS_API_PORT || 5002,
        API_HOST: process.env.IPFS_API_HOST || 'localhost',

        // Local kubo gateway
        GATEWAY_PORT: process.env.IPFS_GATEWAY_PORT || 8081
    },

    // Heartbeat interval in milliseconds (30 seconds)
    HEARTBEAT_INTERVAL: 30000,

    // Storage capacity you want to offer (in GB)
    OFFERED_CAPACITY_GB: process.env.OFFERED_CAPACITY_GB || 50,

    // HTTP Server port for direct file uploads
    AGENT_HTTP_PORT: process.env.AGENT_HTTP_PORT || 4000,

    // Verbose logging
    VERBOSE: process.argv.includes('--verbose'),

    // Flag to check if config was loaded from file
    CONFIG_FROM_FILE: Object.keys(fileConfig).length > 0
};
