/**
 * Provider Agent Configuration
 * Edit these values before running the agent
 */

module.exports = {
    // Backend server URL - change this to your server address
    BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:3001/api',

    // API Key for authentication
    API_KEY: process.env.API_KEY || 'supersecret',

    // Your provider username (same as registered on the platform)
    PROVIDER_USERNAME: process.env.PROVIDER_USERNAME || '',

    // IPFS Configuration
    IPFS: {
        // IPFS API port (default kubo port)
        API_PORT: process.env.IPFS_API_PORT || 5001,
        API_HOST: process.env.IPFS_API_HOST || 'localhost',

        // Gateway port for serving files
        GATEWAY_PORT: process.env.IPFS_GATEWAY_PORT || 8080
    },

    // Heartbeat interval in milliseconds (30 seconds)
    HEARTBEAT_INTERVAL: 30000,

    // Storage capacity you want to offer (in GB)
    OFFERED_CAPACITY_GB: process.env.OFFERED_CAPACITY_GB || 50,

    // HTTP Server port for direct file uploads
    AGENT_HTTP_PORT: process.env.AGENT_HTTP_PORT || 4000,

    // Verbose logging
    VERBOSE: process.argv.includes('--verbose')
};
