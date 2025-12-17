/**
 * Filecoin Internal Currency Service
 * Sistem intern de plăți FIL pentru tranzacții storage între utilizatori
 * NU se conectează la rețeaua publică Filecoin
 */

const FilecoinWallet = require('../models/FilecoinWallet');
const FilecoinTransaction = require('../models/FilecoinTransaction');

class FilecoinService {
  constructor() {
    this.network = 'internal'; // Sistem intern, nu rețea publică
    this.initialized = false;
    this.defaultInitialBalance = parseFloat(process.env.FILECOIN_INITIAL_BALANCE) || 10.0; // FIL gratuit la înregistrare
    this.defaultPricePerGBPerMonth = parseFloat(process.env.FILECOIN_PRICE_PER_GB_MONTH) || 0.10; // FIL/GB/lună
  }

  /**
   * Inițializare serviciu
   */
  async initialize() {
    console.log('\n═══════════════════════════════════════════════');
    console.log('  FILECOIN INTERNAL CURRENCY SYSTEM');
    console.log('═══════════════════════════════════════════════');
    console.log(`[FILECOIN] Mode: Internal payment system`);
    console.log(`[FILECOIN] Initial balance: ${this.defaultInitialBalance} FIL`);
    console.log(`[FILECOIN] Default price: ${this.defaultPricePerGBPerMonth} FIL/GB/month`);
    console.log('═══════════════════════════════════════════════\n');
    
    this.initialized = true;
  }

  /**
   * Creează wallet pentru utilizator nou
   */
  async createUserWallet(userId, initialBalance = null) {
    try {
      const balance = initialBalance !== null ? initialBalance : this.defaultInitialBalance;
      const wallet = await FilecoinWallet.createWallet(userId, balance);
      
      console.log(`[FILECOIN] Created wallet for user ${userId}: ${wallet.address} (${balance} FIL)`);
      
      // Înregistrează tranzacția de bonus inițial
      if (balance > 0) {
        await FilecoinTransaction.createTransaction({
          from: 't1system000000000000000000000000000000',
          to: wallet.address,
          amount: balance,
          type: 'initial_bonus',
          metadata: { userId, reason: 'Welcome bonus' }
        });
      }
      
      return wallet;
    } catch (error) {
      console.error(`[FILECOIN] Error creating wallet:`, error.message);
      throw error;
    }
  }

  /**
   * Obține wallet utilizator (sau creează dacă nu există)
   */
  async getOrCreateWallet(userId) {
    try {
      const wallet = await FilecoinWallet.getWallet(userId);
      return wallet;
    } catch (error) {
      if (error.message === 'Wallet not found') {
        return await this.createUserWallet(userId);
      }
      throw error;
    }
  }

  /**
   * Obține wallet după userId
   */
  async getWallet(userId) {
    return await FilecoinWallet.getWallet(userId);
  }

  /**
   * Obține wallet după address
   */
  async getWalletByAddress(address) {
    return await FilecoinWallet.getWalletByAddress(address);
  }

  /**
   * Obține balanță utilizator
   */
  async getBalance(userId) {
    const wallet = await this.getOrCreateWallet(userId);
    return {
      address: wallet.address,
      balance: wallet.balance,
      currency: 'FIL'
    };
  }

  /**
   * Transfer FIL între utilizatori
   */
  async transfer(fromUserId, toUserId, amount, metadata = {}) {
    try {
      const transaction = await FilecoinWallet.transfer(fromUserId, toUserId, amount, metadata);
      
      const txRecord = await FilecoinTransaction.createTransaction({
        from: transaction.from,
        to: transaction.to,
        amount: amount,
        type: metadata.type || 'transfer',
        contractId: metadata.contractId || null,
        metadata: metadata
      });

      console.log(`[FILECOIN] Transfer: ${amount} FIL from ${fromUserId} to ${toUserId} (tx: ${txRecord.id})`);
      
      return {
        success: true,
        transaction: txRecord,
        fromBalance: (await this.getWallet(fromUserId)).balance,
        toBalance: (await this.getWallet(toUserId)).balance
      };
    } catch (error) {
      console.error(`[FILECOIN] Transfer failed:`, error.message);
      throw error;
    }
  }

  /**
   * Calculează cost storage pentru contract
   */
  calculateStorageCost(sizeGB, durationMonths, pricePerGBPerMonth = null) {
    const price = pricePerGBPerMonth || this.defaultPricePerGBPerMonth;
    const totalCost = sizeGB * durationMonths * price;
    
    return {
      sizeGB,
      durationMonths,
      pricePerGBPerMonth: price,
      totalCost: parseFloat(totalCost.toFixed(6)),
      currency: 'FIL'
    };
  }

  /**
   * Deposit în escrow pentru contract
   */
  async depositEscrow(userId, contractId, amount) {
    try {
      const wallet = await this.getWallet(userId);
      
      if (wallet.balance < amount) {
        throw new Error(`Insufficient balance. Available: ${wallet.balance} FIL, Required: ${amount} FIL`);
      }

      const transaction = await FilecoinWallet.depositEscrow(userId, amount, contractId);
      
      const txRecord = await FilecoinTransaction.createTransaction({
        from: wallet.address,
        to: 't1escrow000000000000000000000000000000',
        amount: amount,
        type: 'escrow_deposit',
        contractId: contractId,
        metadata: { userId, action: 'deposit' }
      });

      console.log(`[FILECOIN] Escrow deposit: ${amount} FIL for contract ${contractId} (tx: ${txRecord.id})`);
      
      return {
        success: true,
        transaction: txRecord,
        escrowAmount: amount,
        remainingBalance: (await this.getWallet(userId)).balance
      };
    } catch (error) {
      console.error(`[FILECOIN] Escrow deposit failed:`, error.message);
      throw error;
    }
  }

  /**
   * Release din escrow către provider
   */
  async releaseEscrow(providerId, contractId, amount) {
    try {
      const transaction = await FilecoinWallet.releaseEscrow(providerId, amount, contractId);
      
      const providerWallet = await this.getWallet(providerId);
      const txRecord = await FilecoinTransaction.createTransaction({
        from: 't1escrow000000000000000000000000000000',
        to: providerWallet.address,
        amount: amount,
        type: 'escrow_release',
        contractId: contractId,
        metadata: { providerId, action: 'release' }
      });

      console.log(`[FILECOIN] Escrow release: ${amount} FIL to provider ${providerId} (tx: ${txRecord.id})`);
      
      return {
        success: true,
        transaction: txRecord,
        providerBalance: providerWallet.balance
      };
    } catch (error) {
      console.error(`[FILECOIN] Escrow release failed:`, error.message);
      throw error;
    }
  }

  /**
   * Refund din escrow către client
   */
  async refundEscrow(clientId, contractId, amount) {
    try {
      const transaction = await FilecoinWallet.refundEscrow(clientId, amount, contractId);
      
      const clientWallet = await this.getWallet(clientId);
      const txRecord = await FilecoinTransaction.createTransaction({
        from: 't1escrow000000000000000000000000000000',
        to: clientWallet.address,
        amount: amount,
        type: 'escrow_refund',
        contractId: contractId,
        metadata: { clientId, action: 'refund' }
      });

      console.log(`[FILECOIN] Escrow refund: ${amount} FIL to client ${clientId} (tx: ${txRecord.id})`);
      
      return {
        success: true,
        transaction: txRecord,
        clientBalance: clientWallet.balance
      };
    } catch (error) {
      console.error(`[FILECOIN] Escrow refund failed:`, error.message);
      throw error;
    }
  }

  /**
   * Obține tranzacții wallet
   */
  async getWalletTransactions(userId) {
    const wallet = await this.getWallet(userId);
    const transactions = await FilecoinTransaction.getTransactionsByAddress(wallet.address);
    
    return {
      address: wallet.address,
      balance: wallet.balance,
      transactions: transactions,
      totalSent: await FilecoinTransaction.getTotalSent(wallet.address),
      totalReceived: await FilecoinTransaction.getTotalReceived(wallet.address)
    };
  }

  /**
   * Obține tranzacții contract
   */
  async getContractTransactions(contractId) {
    return await FilecoinTransaction.getTransactionsByContract(contractId);
  }

  /**
   * Statistici generale sistem
   */
  async getStatistics() {
    const walletStats = await FilecoinWallet.getStatistics();
    const transactionStats = await FilecoinTransaction.getStatistics();
    
    return {
      system: {
        mode: 'internal',
        currency: 'FIL',
        initialized: this.initialized
      },
      wallets: walletStats,
      transactions: transactionStats,
      pricing: {
        defaultPricePerGBPerMonth: this.defaultPricePerGBPerMonth,
        initialBalance: this.defaultInitialBalance
      }
    };
  }

  /**
   * Obține toate wallet-urile (pentru admin)
   */
  async getAllWallets() {
    return await FilecoinWallet.getAllWallets();
  }

  /**
   * Obține tranzacții recente
   */
  async getRecentTransactions(limit = 10) {
    return await FilecoinTransaction.getRecentTransactions(limit);
  }

  /**
   * Status serviciu
   */
  getStatus() {
    return {
      initialized: this.initialized,
      network: this.network,
      mode: 'internal',
      defaultInitialBalance: this.defaultInitialBalance,
      defaultPricePerGBPerMonth: this.defaultPricePerGBPerMonth,
      currency: 'FIL'
    };
  }
}

// Export singleton instance
module.exports = new FilecoinService();
