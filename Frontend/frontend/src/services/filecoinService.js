/**
 * Filecoin Internal Currency Service - Client
 * API wrapper pentru sistemul intern de plăți FIL
 */

const API_BASE_URL = 'http://localhost:3001/api';
const API_KEY = 'supersecret';

class FilecoinService {
  constructor() {
    this.baseUrl = `${API_BASE_URL}/filecoin`;
  }

  /**
   * Headers pentru requests
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    };
  }

  /**
   * Verifică status sistem Filecoin intern
   */
  async getStatus() {
    try {
      const response = await fetch(`${this.baseUrl}/status`, {
        headers: this.getHeaders()
      });
      return await response.json();
    } catch (error) {
      console.error('[FILECOIN] Error getting status:', error);
      throw error;
    }
  }

  /**
   * Creează wallet pentru utilizator
   */
  async createWallet(userId, initialBalance = null) {
    try {
      const body = { userId };
      if (initialBalance !== null) {
        body.initialBalance = initialBalance;
      }

      const response = await fetch(`${this.baseUrl}/wallet`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body)
      });
      return await response.json();
    } catch (error) {
      console.error('[FILECOIN] Error creating wallet:', error);
      throw error;
    }
  }

  /**
   * Obține wallet utilizator (sau creează dacă nu există)
   */
  async getWallet(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/wallet/${userId}`, {
        headers: this.getHeaders()
      });
      return await response.json();
    } catch (error) {
      console.error('[FILECOIN] Error getting wallet:', error);
      throw error;
    }
  }

  /**
   * Obține balanță utilizator
   */
  async getBalance(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/balance/${userId}`, {
        headers: this.getHeaders()
      });
      return await response.json();
    } catch (error) {
      console.error('[FILECOIN] Error getting balance:', error);
      throw error;
    }
  }

  /**
   * Transfer FIL între utilizatori
   */
  async transfer(fromUserId, toUserId, amount, metadata = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/transfer`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          fromUserId,
          toUserId,
          amount,
          metadata
        })
      });
      return await response.json();
    } catch (error) {
      console.error('[FILECOIN] Error transferring FIL:', error);
      throw error;
    }
  }

  /**
   * Calculează cost storage
   */
  async calculateStorageCost(sizeGB, durationMonths, pricePerGBPerMonth = null) {
    try {
      const body = {
        sizeGB,
        durationMonths
      };
      if (pricePerGBPerMonth !== null) {
        body.pricePerGBPerMonth = pricePerGBPerMonth;
      }

      const response = await fetch(`${this.baseUrl}/calculate-cost`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body)
      });
      return await response.json();
    } catch (error) {
      console.error('[FILECOIN] Error calculating cost:', error);
      throw error;
    }
  }

  /**
   * Obține tranzacții wallet
   */
  async getWalletTransactions(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/transactions/${userId}`, {
        headers: this.getHeaders()
      });
      return await response.json();
    } catch (error) {
      console.error('[FILECOIN] Error getting transactions:', error);
      throw error;
    }
  }

  /**
   * Obține tranzacții contract
   */
  async getContractTransactions(contractId) {
    try {
      const response = await fetch(`${this.baseUrl}/transactions/contract/${contractId}`, {
        headers: this.getHeaders()
      });
      return await response.json();
    } catch (error) {
      console.error('[FILECOIN] Error getting contract transactions:', error);
      throw error;
    }
  }

  /**
   * Obține toate wallet-urile (admin)
   */
  async getAllWallets() {
    try {
      const response = await fetch(`${this.baseUrl}/wallets`, {
        headers: this.getHeaders()
      });
      return await response.json();
    } catch (error) {
      console.error('[FILECOIN] Error getting wallets:', error);
      throw error;
    }
  }

  /**
   * Obține statistici generale
   */
  async getStatistics() {
    try {
      const response = await fetch(`${this.baseUrl}/statistics`, {
        headers: this.getHeaders()
      });
      return await response.json();
    } catch (error) {
      console.error('[FILECOIN] Error getting statistics:', error);
      throw error;
    }
  }

  /**
   * Obține tranzacții recente
   */
  async getRecentTransactions(limit = 20) {
    try {
      const response = await fetch(`${this.baseUrl}/recent-transactions?limit=${limit}`, {
        headers: this.getHeaders()
      });
      return await response.json();
    } catch (error) {
      console.error('[FILECOIN] Error getting recent transactions:', error);
      throw error;
    }
  }

  /**
   * Formatează suma FIL
   */
  formatFIL(amount) {
    if (!amount && amount !== 0) return '0.000000';
    return parseFloat(amount).toFixed(6);
  }

  /**
   * Formatează mărime fișier
   */
  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Formatează dată
   */
  formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('ro-RO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

export default new FilecoinService();
