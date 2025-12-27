/**
 * Wallet Manager for Provider Agent
 * Manages FIL wallet for receiving payments
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

class WalletManager {
    constructor() {
        this.walletPath = path.join(__dirname, 'provider-wallet.json');
        this.wallet = null;
        this.provider = null;
        this.address = null;
    }

    /**
     * Load or create wallet
     */
    async loadWallet() {
        try {
            if (fs.existsSync(this.walletPath)) {
                // Load existing wallet
                const walletData = JSON.parse(fs.readFileSync(this.walletPath, 'utf8'));
                this.wallet = new ethers.Wallet(walletData.privateKey);
                this.address = this.wallet.address;
                console.log(`💼 Wallet loaded: ${this.address}`);
            } else {
                // Create new wallet
                this.wallet = ethers.Wallet.createRandom();
                this.address = this.wallet.address;

                // Save to file (encrypted would be better in production)
                fs.writeFileSync(this.walletPath, JSON.stringify({
                    address: this.wallet.address,
                    privateKey: this.wallet.privateKey,
                    mnemonic: this.wallet.mnemonic.phrase,
                    createdAt: new Date().toISOString()
                }, null, 2));

                console.log(`🆕 New wallet created: ${this.address}`);
                console.log(`📝 Mnemonic saved to: ${this.walletPath}`);
                console.log(`⚠️  IMPORTANT: Backup your mnemonic phrase!`);
            }

            // Connect to Filecoin Calibration testnet
            const rpcUrl = process.env.FILECOIN_RPC_URL || 'https://api.calibration.node.glif.io/rpc/v1';
            this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
            this.wallet = this.wallet.connect(this.provider);

            return this.wallet;
        } catch (error) {
            console.error(`❌ Failed to load wallet: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get wallet address
     */
    getAddress() {
        return this.address;
    }

    /**
     * Get balance in FIL
     */
    async getBalance() {
        if (!this.wallet) {
            await this.loadWallet();
        }

        try {
            const balance = await this.wallet.getBalance();
            return ethers.utils.formatEther(balance);
        } catch (error) {
            console.error(`❌ Failed to get balance: ${error.message}`);
            return '0';
        }
    }

    /**
     * Sign message (for proof of storage)
     */
    async signMessage(message) {
        if (!this.wallet) {
            await this.loadWallet();
        }

        return await this.wallet.signMessage(message);
    }

    /**
     * Get wallet info
     */
    async getInfo() {
        const balance = await this.getBalance();

        return {
            address: this.address,
            balance: `${balance} FIL`,
            network: 'Filecoin Calibration Testnet'
        };
    }
}

module.exports = WalletManager;
