/**
 * Payment Trigger Service
 * Triggers FIL payments when providers confirm storage
 */

const { ethers } = require('ethers');

class PaymentTrigger {
    constructor() {
        this.provider = null;
        this.wallet = null;
        this.initialized = false;
    }

    /**
     * Initialize payment service
     */
    async initialize() {
        try {
            // Connect to Filecoin Calibration testnet
            const rpcUrl = process.env.FILECOIN_RPC_URL || 'https://api.calibration.node.glif.io/rpc/v1';
            this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);

            // Load wallet from environment
            if (process.env.PAYMENT_PRIVATE_KEY) {
                this.wallet = new ethers.Wallet(process.env.PAYMENT_PRIVATE_KEY, this.provider);
                console.log(`[PAYMENT] Initialized with wallet: ${this.wallet.address}`);
                this.initialized = true;
            } else {
                console.warn('[PAYMENT] No private key configured, payments disabled');
            }
        } catch (error) {
            console.error('[PAYMENT] Initialization failed:', error.message);
        }
    }

    /**
     * Trigger payment when provider confirms storage
     */
    async triggerPayment(contractId, providerId, cid, providerAddress) {
        if (!this.initialized) {
            console.warn('[PAYMENT] Payment service not initialized');
            return { success: false, error: 'Payment service not initialized' };
        }

        console.log(`💰 Triggering payment for contract ${contractId}`);

        try {
            // Get contract details
            const StorageContract = require('../models/StorageContract');
            const contract = StorageContract.getContract(contractId);

            if (!contract) {
                throw new Error('Contract not found');
            }

            // Calculate payment amount (example: 0.01 FIL per GB per month)
            const pricePerGB = 0.01; // FIL
            const amount = contract.storageGB * pricePerGB * (contract.duration / 30);
            const amountWei = ethers.utils.parseEther(amount.toString());

            // Send FIL to provider
            const tx = await this.wallet.sendTransaction({
                to: providerAddress,
                value: amountWei,
                gasLimit: 100000
            });

            console.log(`💸 Payment transaction sent: ${tx.hash}`);

            // Wait for confirmation
            const receipt = await tx.wait();

            console.log(`✅ Payment confirmed: ${amount} FIL to ${providerAddress}`);

            // Update contract status
            StorageContract.updateContract(contractId, {
                status: 'paid',
                paymentTxHash: tx.hash,
                paidAt: new Date().toISOString()
            });

            return {
                success: true,
                txHash: tx.hash,
                amount: amount,
                recipient: providerAddress
            };
        } catch (error) {
            console.error(`❌ Payment failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get wallet balance
     */
    async getBalance() {
        if (!this.wallet) return '0';
        try {
            const balance = await this.wallet.getBalance();
            return ethers.utils.formatEther(balance);
        } catch (error) {
            console.error('[PAYMENT] Failed to get balance:', error.message);
            return '0';
        }
    }
}

module.exports = new PaymentTrigger();
