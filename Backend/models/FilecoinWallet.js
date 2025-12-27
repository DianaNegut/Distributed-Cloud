// Filecoin Wallet pentru utilizatori - sistem intern de FIL
// Fiecare utilizator are un wallet cu balanță FIL pentru plăți storage
// PERSISTENT: Salvează datele pe disc pentru a nu le pierde la restart

const fs = require('fs');
const path = require('path');
const { IPFS_PATH } = require('../config/paths');

const WALLETS_FILE = path.join(IPFS_PATH, 'filecoin-wallets.json');
const TRANSACTIONS_FILE = path.join(IPFS_PATH, 'filecoin-transactions.json');

class FilecoinWallet {
  constructor() {
    // In-memory storage pentru wallets (backed by file)
    this.wallets = new Map();
    this.transactions = [];

    // Încarcă datele de pe disc la inițializare
    this.loadFromDisk();
  }

  // Încarcă wallet-urile și tranzacțiile de pe disc
  loadFromDisk() {
    try {
      // Încarcă wallet-urile
      if (fs.existsSync(WALLETS_FILE)) {
        const data = JSON.parse(fs.readFileSync(WALLETS_FILE, 'utf8'));
        if (data.wallets && Array.isArray(data.wallets)) {
          data.wallets.forEach(wallet => {
            this.wallets.set(wallet.userId, wallet);
          });
          console.log(`[FILECOIN-WALLET] Loaded ${this.wallets.size} wallets from disk`);
        }
      }

      // Încarcă tranzacțiile
      if (fs.existsSync(TRANSACTIONS_FILE)) {
        const data = JSON.parse(fs.readFileSync(TRANSACTIONS_FILE, 'utf8'));
        if (data.transactions && Array.isArray(data.transactions)) {
          this.transactions = data.transactions;
          console.log(`[FILECOIN-WALLET] Loaded ${this.transactions.length} transactions from disk`);
        }
      }

      // Asigură-te că există wallet-ul escrow
      if (!this.wallets.has('escrow')) {
        this.wallets.set('escrow', {
          userId: 'escrow',
          address: 't1escrow000000000000000000000000000000',
          balance: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          transactions: []
        });
        this.saveToDisk();
      }
    } catch (error) {
      console.error('[FILECOIN-WALLET] Error loading from disk:', error.message);
      // Inițializează cu escrow wallet dacă nu există date
      this.wallets.set('escrow', {
        userId: 'escrow',
        address: 't1escrow000000000000000000000000000000',
        balance: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        transactions: []
      });
    }
  }

  // Salvează wallet-urile și tranzacțiile pe disc
  saveToDisk() {
    try {
      // Salvează wallet-urile
      const walletsData = {
        wallets: Array.from(this.wallets.values()),
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(WALLETS_FILE, JSON.stringify(walletsData, null, 2));

      // Salvează tranzacțiile
      const transactionsData = {
        transactions: this.transactions,
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(transactionsData, null, 2));
    } catch (error) {
      console.error('[FILECOIN-WALLET] Error saving to disk:', error.message);
    }
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

    // Înregistrează tranzacția de bonus inițial dacă există
    if (initialBalance > 0) {
      const transaction = {
        id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        from: 'system',
        to: address,
        fromUserId: 'system',
        toUserId: userId,
        amount: initialBalance,
        timestamp: new Date().toISOString(),
        type: 'initial_bonus',
        status: 'completed',
        note: 'Bonus inițial la crearea wallet-ului'
      };
      this.transactions.push(transaction);
      wallet.transactions.push(transaction.id);
    }

    this.saveToDisk(); // Persistă pe disc
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

  // Verifică dacă există wallet
  async hasWallet(userId) {
    return this.wallets.has(userId);
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
    this.saveToDisk(); // Persistă pe disc
    return wallet;
  }

  // Transfer FIL între utilizatori
  async transfer(fromUserId, toUserId, amount, metadata = {}) {
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }

    const fromWallet = await this.getWallet(fromUserId);
    const toWallet = await this.getWallet(toUserId);

    // Verifică balanță suficientă (escrow poate avea balanță negativă)
    if (fromUserId !== 'escrow' && fromWallet.balance < amount) {
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
      id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from: fromWallet.address,
      to: toWallet.address,
      fromUserId,
      toUserId,
      amount,
      timestamp,
      type: metadata.type || 'transfer',
      contractId: metadata.contractId || null,
      note: metadata.note || null,
      status: 'completed'
    };

    // Adaugă tranzacția la lista globală și la wallet-uri
    this.transactions.push(transaction);
    fromWallet.transactions.push(transaction.id);
    toWallet.transactions.push(transaction.id);

    this.saveToDisk(); // Persistă pe disc
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

  // Obține tranzacțiile unui utilizator
  async getUserTransactions(userId) {
    const wallet = await this.getWallet(userId);
    return this.transactions.filter(tx =>
      tx.fromUserId === userId || tx.toUserId === userId
    );
  }

  // Obține toate tranzacțiile
  async getAllTransactions() {
    return this.transactions;
  }

  // Statistici generale
  async getStatistics() {
    const wallets = Array.from(this.wallets.values()).filter(w => w.userId !== 'escrow');
    const totalWallets = wallets.length;
    const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
    const averageBalance = totalWallets > 0 ? totalBalance / totalWallets : 0;

    const totalTransactions = this.transactions.length;
    const totalVolume = this.transactions.reduce((sum, tx) => sum + tx.amount, 0);

    return {
      totalWallets,
      totalBalance: totalBalance.toFixed(6),
      averageBalance: averageBalance.toFixed(6),
      totalTransactions,
      totalVolume: totalVolume.toFixed(6),
      currency: 'FIL'
    };
  }
}

// Singleton instance
const walletInstance = new FilecoinWallet();

module.exports = walletInstance;
