// Filecoin Wallet pentru utilizatori - sistem intern de FIL
// Fiecare utilizator are un wallet cu balanță FIL pentru plăți storage

class FilecoinWallet {
  constructor() {
    // In-memory storage pentru wallets (pentru producție: MongoDB/PostgreSQL)
    this.wallets = new Map();
  }

  // Generează adresă FIL unică pentru utilizator
  generateAddress(userId) {
    // Format: t1<hash> (tipic pentru Filecoin mainnet/testnet)
    const hash = Buffer.from(`${userId}-${Date.now()}`).toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 38);
    return `t1${hash}`;
  }

  // Creează wallet nou pentru utilizator
  async createWallet(userId, initialBalance = 0) {
    if (this.wallets.has(userId)) {
      throw new Error('Wallet already exists for this user');
    }

    const address = this.generateAddress(userId);
    const wallet = {
      userId,
      address,
      balance: initialBalance, // în FIL (nu attoFIL pentru simplitate)
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      transactions: []
    };

    this.wallets.set(userId, wallet);
    return wallet;
  }

  // Obține wallet după userId
  async getWallet(userId) {
    const wallet = this.wallets.get(userId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    return wallet;
  }

  // Obține wallet după address
  async getWalletByAddress(address) {
    for (const wallet of this.wallets.values()) {
      if (wallet.address === address) {
        return wallet;
      }
    }
    throw new Error('Wallet not found');
  }

  // Verifică balanță
  async getBalance(userId) {
    const wallet = await this.getWallet(userId);
    return wallet.balance;
  }

  // Actualizează balanță (pentru deposit/withdraw)
  async updateBalance(userId, amount) {
    const wallet = await this.getWallet(userId);
    wallet.balance += amount;
    
    if (wallet.balance < 0) {
      wallet.balance -= amount; // Rollback
      throw new Error('Insufficient balance');
    }

    wallet.updatedAt = new Date().toISOString();
    return wallet;
  }

  // Transfer FIL între utilizatori
  async transfer(fromUserId, toUserId, amount, metadata = {}) {
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }

    const fromWallet = await this.getWallet(fromUserId);
    const toWallet = await this.getWallet(toUserId);

    // Verifică balanță suficientă
    if (fromWallet.balance < amount) {
      throw new Error(`Insufficient balance. Available: ${fromWallet.balance} FIL, Required: ${amount} FIL`);
    }

    // Efectuează transferul
    fromWallet.balance -= amount;
    toWallet.balance += amount;

    const timestamp = new Date().toISOString();
    fromWallet.updatedAt = timestamp;
    toWallet.updatedAt = timestamp;

    // Crează înregistrarea tranzacției
    const transaction = {
      from: fromWallet.address,
      to: toWallet.address,
      amount,
      timestamp,
      type: metadata.type || 'transfer',
      contractId: metadata.contractId || null,
      status: 'completed'
    };

    return transaction;
  }

  // Deposit în escrow pentru contract
  async depositEscrow(userId, amount, contractId) {
    return await this.transfer(userId, 'escrow', amount, {
      type: 'escrow_deposit',
      contractId
    });
  }

  // Release din escrow către provider
  async releaseEscrow(providerId, amount, contractId) {
    return await this.transfer('escrow', providerId, amount, {
      type: 'escrow_release',
      contractId
    });
  }

  // Refund din escrow către client
  async refundEscrow(clientId, amount, contractId) {
    return await this.transfer('escrow', clientId, amount, {
      type: 'escrow_refund',
      contractId
    });
  }

  // Obține toate wallet-urile (pentru admin)
  async getAllWallets() {
    return Array.from(this.wallets.values());
  }

  // Statistici generale
  async getStatistics() {
    const wallets = Array.from(this.wallets.values());
    const totalWallets = wallets.length;
    const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
    const averageBalance = totalWallets > 0 ? totalBalance / totalWallets : 0;

    return {
      totalWallets,
      totalBalance: totalBalance.toFixed(6),
      averageBalance: averageBalance.toFixed(6),
      currency: 'FIL'
    };
  }
}

// Singleton instance
const walletInstance = new FilecoinWallet();

// Creare wallet pentru escrow system (balanță virtuală infinită)
walletInstance.wallets.set('escrow', {
  userId: 'escrow',
  address: 't1escrow000000000000000000000000000000',
  balance: 0, // Se poate face negativă pentru escrow
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  transactions: []
});

module.exports = walletInstance;
