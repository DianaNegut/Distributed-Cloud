// Istoric tranzacții Filecoin între utilizatori
// Track toate transferurile FIL pentru transparență

class FilecoinTransaction {
  constructor() {
    // In-memory storage pentru transactions
    this.transactions = new Map();
    this.transactionCounter = 0;
  }

  // Generează ID unic pentru tranzacție
  generateTransactionId() {
    this.transactionCounter++;
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `tx_${timestamp}_${random}`;
  }

  // Creează tranzacție nouă
  async createTransaction(data) {
    const {
      from,
      to,
      amount,
      type, // 'transfer', 'escrow_deposit', 'escrow_release', 'escrow_refund', 'contract_payment'
      contractId = null,
      metadata = {}
    } = data;

    // Validare
    if (!from || !to || amount <= 0) {
      throw new Error('Invalid transaction data');
    }

    const transactionId = this.generateTransactionId();
    const transaction = {
      id: transactionId,
      from,
      to,
      amount,
      type,
      contractId,
      metadata,
      status: 'completed', // Pentru sistem intern, toate sunt imediat completed
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    this.transactions.set(transactionId, transaction);
    return transaction;
  }

  // Obține tranzacție după ID
  async getTransaction(transactionId) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    return transaction;
  }

  // Obține toate tranzacțiile unui wallet
  async getTransactionsByAddress(address) {
    const transactions = Array.from(this.transactions.values())
      .filter(tx => tx.from === address || tx.to === address)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return transactions;
  }

  // Obține tranzacțiile unui contract
  async getTransactionsByContract(contractId) {
    const transactions = Array.from(this.transactions.values())
      .filter(tx => tx.contractId === contractId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return transactions;
  }

  // Obține tranzacții după tip
  async getTransactionsByType(type) {
    const transactions = Array.from(this.transactions.values())
      .filter(tx => tx.type === type)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return transactions;
  }

  // Calculează total transferat de un address
  async getTotalSent(address) {
    const transactions = Array.from(this.transactions.values())
      .filter(tx => tx.from === address && tx.status === 'completed');
    
    return transactions.reduce((sum, tx) => sum + tx.amount, 0);
  }

  // Calculează total primit de un address
  async getTotalReceived(address) {
    const transactions = Array.from(this.transactions.values())
      .filter(tx => tx.to === address && tx.status === 'completed');
    
    return transactions.reduce((sum, tx) => sum + tx.amount, 0);
  }

  // Statistici generale
  async getStatistics() {
    const transactions = Array.from(this.transactions.values());
    const totalTransactions = transactions.length;
    const totalVolume = transactions
      .filter(tx => tx.status === 'completed')
      .reduce((sum, tx) => sum + tx.amount, 0);

    // Grupare după tip
    const byType = {};
    transactions.forEach(tx => {
      byType[tx.type] = (byType[tx.type] || 0) + 1;
    });

    // Calculează media pe tranzacție
    const averageAmount = totalTransactions > 0 ? totalVolume / totalTransactions : 0;

    return {
      totalTransactions,
      totalVolume: totalVolume.toFixed(6),
      averageAmount: averageAmount.toFixed(6),
      byType,
      currency: 'FIL'
    };
  }

  // Obține tranzacții recente (ultimele N)
  async getRecentTransactions(limit = 10) {
    const transactions = Array.from(this.transactions.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
    
    return transactions;
  }

  // Șterge toate tranzacțiile (pentru testing/reset)
  async clearAll() {
    this.transactions.clear();
    this.transactionCounter = 0;
  }
}

// Singleton instance
const transactionInstance = new FilecoinTransaction();

module.exports = transactionInstance;
