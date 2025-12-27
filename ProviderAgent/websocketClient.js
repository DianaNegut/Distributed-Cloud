/**
 * WebSocket Client for Provider Agent
 * Maintains persistent connection with Backend server
 */

const WebSocket = require('ws');
const EventEmitter = require('events');
const config = require('./config');

class WebSocketClient extends EventEmitter {
    constructor() {
        super();
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 5000; // 5 seconds
        this.isConnected = false;
        this.pingInterval = null;
    }

    /**
     * Connect to backend WebSocket server
     */
    connect() {
        const wsUrl = this.getWebSocketUrl();
        console.log(`🔌 Connecting to ${wsUrl}...`);

        this.ws = new WebSocket(wsUrl, {
            headers: {
                'Authorization': `Bearer ${config.PROVIDER_TOKEN}`,
                'x-api-key': config.API_KEY
            }
        });

        this.ws.on('open', () => {
            console.log('✅ WebSocket connected to backend');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.emit('connected');

            // Send initial registration
            this.send('register', {
                type: 'provider',
                version: require('./package.json').version,
                timestamp: Date.now()
            });

            // Start ping interval
            this.startPingInterval();
        });

        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.handleMessage(message);
            } catch (error) {
                console.error('❌ Invalid message format:', error.message);
            }
        });

        this.ws.on('close', (code, reason) => {
            console.log(`🔌 WebSocket disconnected (${code}): ${reason}`);
            this.isConnected = false;
            this.stopPingInterval();
            this.emit('disconnected');
            this.reconnect();
        });

        this.ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error.message);
            this.emit('error', error);
        });
    }

    /**
     * Get WebSocket URL from backend URL
     */
    getWebSocketUrl() {
        // Convert HTTP URL to WebSocket URL
        let wsUrl = config.BACKEND_URL
            .replace('http://', 'ws://')
            .replace('https://', 'wss://');

        // Remove /api suffix if present
        wsUrl = wsUrl.replace(/\/api\/?$/, '');

        // Add WebSocket path
        wsUrl += '/provider-ws';

        // Add token as query parameter
        if (config.PROVIDER_TOKEN) {
            wsUrl += `?token=${config.PROVIDER_TOKEN}`;
        }

        return wsUrl;
    }

    /**
     * Handle incoming messages from backend
     */
    handleMessage(message) {
        const { type, data } = message;

        if (config.VERBOSE) {
            console.log(`📨 Received: ${type}`, data ? JSON.stringify(data).substring(0, 100) : '');
        }

        switch (type) {
            case 'welcome':
                console.log(`✅ ${data.message}`);
                this.emit('welcome', data);
                break;

            case 'ping':
                // Respond to heartbeat
                this.send('pong', { timestamp: Date.now() });
                break;

            case 'storage_job':
                // New storage contract assigned
                console.log(`📥 New storage job: ${data.contractId}`);
                this.emit('storage_job', data);
                break;

            case 'pin_request':
                // Request to pin a specific CID
                console.log(`📌 Pin request: ${data.cid}`);
                this.emit('pin_request', data);
                break;

            case 'unpin_request':
                // Request to unpin a CID
                console.log(`🗑️ Unpin request: ${data.cid}`);
                this.emit('unpin_request', data);
                break;

            case 'payment_received':
                // FIL payment notification
                console.log(`💰 Payment received: ${data.amount} FIL`);
                this.emit('payment_received', data);
                break;

            case 'capacity_request':
                // Backend requesting capacity update
                this.emit('capacity_request');
                break;

            default:
                console.log(`📨 Unknown message type: ${type}`);
                this.emit('unknown_message', { type, data });
        }
    }

    /**
     * Send message to backend
     */
    send(type, data = {}) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = JSON.stringify({ type, data });
            this.ws.send(message);

            if (config.VERBOSE && type !== 'pong') {
                console.log(`📤 Sent: ${type}`);
            }
            return true;
        } else {
            console.warn(`⚠️ Cannot send ${type} - not connected`);
            return false;
        }
    }

    /**
     * Start ping interval to keep connection alive
     */
    startPingInterval() {
        this.pingInterval = setInterval(() => {
            if (this.isConnected) {
                this.send('ping', { timestamp: Date.now() });
            }
        }, 30000); // Every 30 seconds
    }

    /**
     * Stop ping interval
     */
    stopPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    /**
     * Auto-reconnect logic
     */
    reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Max reconnect attempts reached');
            this.emit('max_reconnect_failed');
            return;
        }

        this.reconnectAttempts++;
        console.log(`🔄 Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectDelay / 1000}s...`);

        setTimeout(() => {
            this.connect();
        }, this.reconnectDelay);
    }

    /**
     * Graceful disconnect
     */
    disconnect() {
        console.log('🔌 Disconnecting from backend...');
        this.stopPingInterval();

        if (this.ws) {
            // Send offline notification
            this.send('going_offline', { timestamp: Date.now() });

            // Close connection
            this.ws.close(1000, 'Provider shutting down');
            this.ws = null;
        }

        this.isConnected = false;
    }

    /**
     * Check if connected
     */
    isOnline() {
        return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
    }
}

module.exports = WebSocketClient;
