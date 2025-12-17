/**
 * Model pentru deal-uri Filecoin
 * Gestionează contractele de stocare pe Filecoin network
 */

class FilecoinDeal {
  constructor() {
    // In-memory storage pentru demo (în producție ar fi DB)
    this.deals = new Map();
  }

  /**
   * Creează un nou deal Filecoin
   * @param {Object} dealData - Datele deal-ului
   * @returns {Object} Deal-ul creat
   */
  async createDeal(dealData) {
    const deal = {
      id: `deal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      cid: dealData.cid,
      pieceCid: dealData.pieceCid || null,
      clientAddress: dealData.clientAddress,
      minerAddress: dealData.minerAddress,
      pricePerEpoch: dealData.pricePerEpoch,
      startEpoch: dealData.startEpoch,
      endEpoch: dealData.endEpoch,
      fileSize: dealData.fileSize,
      fileName: dealData.fileName,
      verified: dealData.verified || false,
      status: 'pending', // pending, active, completed, failed, expired
      dealId: null, // Filecoin on-chain deal ID
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      proposalCid: null,
      message: null
    };

    this.deals.set(deal.id, deal);
    return deal;
  }

  /**
   * Actualizează status-ul unui deal
   * @param {string} dealId - ID-ul deal-ului
   * @param {Object} updates - Câmpurile de actualizat
   * @returns {Object|null} Deal-ul actualizat
   */
  async updateDeal(dealId, updates) {
    const deal = this.deals.get(dealId);
    if (!deal) {
      return null;
    }

    Object.assign(deal, updates, {
      updatedAt: new Date().toISOString()
    });

    this.deals.set(dealId, deal);
    return deal;
  }

  /**
   * Obține un deal după ID
   * @param {string} dealId - ID-ul deal-ului
   * @returns {Object|null} Deal-ul găsit
   */
  async getDeal(dealId) {
    return this.deals.get(dealId) || null;
  }

  /**
   * Obține toate deal-urile pentru un client
   * @param {string} clientAddress - Adresa wallet-ului clientului
   * @returns {Array} Lista de deal-uri
   */
  async getDealsByClient(clientAddress) {
    return Array.from(this.deals.values())
      .filter(deal => deal.clientAddress === clientAddress)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Obține toate deal-urile pentru un miner
   * @param {string} minerAddress - Adresa miner-ului
   * @returns {Array} Lista de deal-uri
   */
  async getDealsByMiner(minerAddress) {
    return Array.from(this.deals.values())
      .filter(deal => deal.minerAddress === minerAddress)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Obține deal-urile pentru un CID specific
   * @param {string} cid - Content Identifier
   * @returns {Array} Lista de deal-uri
   */
  async getDealsByCid(cid) {
    return Array.from(this.deals.values())
      .filter(deal => deal.cid === cid);
  }

  /**
   * Obține toate deal-urile
   * @param {Object} filters - Filtre opționale (status, etc)
   * @returns {Array} Lista de deal-uri
   */
  async getAllDeals(filters = {}) {
    let deals = Array.from(this.deals.values());

    if (filters.status) {
      deals = deals.filter(deal => deal.status === filters.status);
    }

    if (filters.clientAddress) {
      deals = deals.filter(deal => deal.clientAddress === filters.clientAddress);
    }

    if (filters.minerAddress) {
      deals = deals.filter(deal => deal.minerAddress === filters.minerAddress);
    }

    return deals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Calculează costul total al unui deal
   * @param {number} fileSize - Mărimea fișierului în bytes
   * @param {number} duration - Durata în epoch-uri
   * @param {number} pricePerEpoch - Prețul per epoch în attoFIL
   * @returns {Object} Costul calculat
   */
  calculateDealCost(fileSize, duration, pricePerEpoch) {
    const totalCost = BigInt(pricePerEpoch) * BigInt(duration);
    const totalCostFIL = Number(totalCost) / 1e18; // Convert attoFIL to FIL

    return {
      totalCostAttoFIL: totalCost.toString(),
      totalCostFIL: totalCostFIL,
      pricePerEpoch: pricePerEpoch,
      duration: duration,
      fileSizeBytes: fileSize,
      fileSizeGB: (fileSize / 1e9).toFixed(2)
    };
  }

  /**
   * Șterge un deal
   * @param {string} dealId - ID-ul deal-ului
   * @returns {boolean} Succes sau eșec
   */
  async deleteDeal(dealId) {
    return this.deals.delete(dealId);
  }

  /**
   * Obține statistici despre deal-uri
   * @returns {Object} Statistici
   */
  async getStatistics() {
    const deals = Array.from(this.deals.values());
    
    return {
      total: deals.length,
      pending: deals.filter(d => d.status === 'pending').length,
      active: deals.filter(d => d.status === 'active').length,
      completed: deals.filter(d => d.status === 'completed').length,
      failed: deals.filter(d => d.status === 'failed').length,
      totalStorageBytes: deals.reduce((sum, d) => sum + d.fileSize, 0),
      totalStorageGB: (deals.reduce((sum, d) => sum + d.fileSize, 0) / 1e9).toFixed(2)
    };
  }
}

// Export singleton instance
module.exports = new FilecoinDeal();
