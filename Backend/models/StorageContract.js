const fs = require('fs');
const path = require('path');
const { IPFS_PATH } = require('../config/paths');

const CONTRACTS_FILE = path.join(IPFS_PATH, 'storage-contracts.json');

class StorageContract {
  static loadContracts() {
    try {
      if (fs.existsSync(CONTRACTS_FILE)) {
        const data = fs.readFileSync(CONTRACTS_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[CONTRACT-MODEL] Error loading contracts:', error.message);
    }
    return { contracts: [] };
  }

  static saveContracts(data) {
    try {
      fs.writeFileSync(CONTRACTS_FILE, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error('[CONTRACT-MODEL] Error saving contracts:', error.message);
      return false;
    }
  }

  static createContract(contractData) {
    const data = this.loadContracts();
    const durationDays = contractData.durationMonths ? contractData.durationMonths * 30 : 30;
    const durationMonths = contractData.durationMonths || 1;
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const contract = {
      id: `contract-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      renterId: contractData.renterId,
      renterName: contractData.renterName || 'Anonymous Renter',
      providerId: contractData.providerId,
      providerName: contractData.providerName || 'Unknown Provider',
      storage: {
        allocatedGB: contractData.allocatedGB,
        usedGB: 0,
        files: [],
        fileDetails: {}
      },
      pricing: {
        pricePerGBPerMonth: contractData.pricePerGBPerMonth || 0.10,
        totalPrice: contractData.totalPrice || 0,
        currency: contractData.currency || 'ETH',
        priceInETH: contractData.totalPrice || (contractData.allocatedGB * (contractData.pricePerGBPerMonth || 0.10) * (contractData.durationMonths || 1)),
        basePrice: contractData.basePrice || 0,
        discount: contractData.discount || 0,
        discountAmount: contractData.discountAmount || 0
      },
      payment: {
        status: 'pending',
        paidAmount: 0,
        paymentDate: null,
        paymentMethod: 'metamask',
        transactionId: null,
        escrowStatus: 'pending', // pending, deposited, released, refunded
        escrowAmount: 0,
        escrowTxId: null
      },
      terms: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        durationDays: durationDays,
        durationMonths: durationMonths,
        replicationFactor: contractData.replicationFactor || 3,
        slaUptimeMin: contractData.slaUptimeMin || 95.0,
        autoRenew: contractData.autoRenew || false
      },
      status: 'pending_payment',
      metadata: {
        description: contractData.description || '',
        tags: contractData.tags || []
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.contracts.push(contract);
    this.saveContracts(data);
    console.log(`[CONTRACT] Created contract: ${contract.id} (${contract.storage.allocatedGB}GB)`);
    return contract;
  }

  static getContract(contractId) {
    const data = this.loadContracts();
    return data.contracts.find(c => c.id === contractId);
  }

  static getContractsByRenter(renterId) {
    const data = this.loadContracts();
    return data.contracts.filter(c => c.renterId === renterId);
  }

  static getContractsByProvider(providerId) {
    const data = this.loadContracts();
    return data.contracts.filter(c => c.providerId === providerId);
  }

  static getAllContracts(filters = {}) {
    const data = this.loadContracts();
    let contracts = data.contracts;

    if (filters.status) {
      contracts = contracts.filter(c => c.status === filters.status);
    }

    if (filters.renterId) {
      contracts = contracts.filter(c => c.renterId === filters.renterId);
    }

    if (filters.providerId) {
      contracts = contracts.filter(c => c.providerId === filters.providerId);
    }

    return contracts;
  }

  static addFileToContract(contractId, fileData) {
    const data = this.loadContracts();
    const contract = data.contracts.find(c => c.id === contractId);

    if (!contract) {
      return { success: false, error: 'Contract not found' };
    }
    if (contract.status !== 'active') {
      return { success: false, error: 'Contract is not active' };
    }
    const fileSizeGB = fileData.sizeBytes / (1024 * 1024 * 1024);
    const newUsedGB = contract.storage.usedGB + fileSizeGB;
    if (newUsedGB > contract.storage.allocatedGB) {
      return {
        success: false,
        error: `Insufficient storage. Used: ${newUsedGB.toFixed(2)}GB, Allocated: ${contract.storage.allocatedGB}GB`
      };
    }
    if (!contract.storage.files.includes(fileData.cid)) {
      contract.storage.files.push(fileData.cid);
      contract.storage.fileDetails[fileData.cid] = {
        name: fileData.name,
        sizeBytes: fileData.sizeBytes,
        mimetype: fileData.mimetype || 'application/octet-stream',
        localPath: fileData.localPath || null, // Physical path on provider's disk
        safeFilename: fileData.safeFilename || null, // Unique filename used on disk
        uploadedAt: new Date().toISOString()
      };
      contract.storage.usedGB = newUsedGB;
      contract.updatedAt = new Date().toISOString();
      this.saveContracts(data);
      console.log(`[CONTRACT] Added file ${fileData.cid} to contract ${contractId}`);
    }
    return { success: true, contract };
  }

  static removeFileFromContract(contractId, fileCid) {
    const data = this.loadContracts();
    const contract = data.contracts.find(c => c.id === contractId);

    if (!contract) {
      return { success: false, error: 'Contract not found' };
    }
    const index = contract.storage.files.indexOf(fileCid);
    if (index > -1) {
      const fileDetail = contract.storage.fileDetails[fileCid];
      if (fileDetail) {
        const fileSizeGB = fileDetail.sizeBytes / (1024 * 1024 * 1024);
        contract.storage.usedGB -= fileSizeGB;
      }
      contract.storage.files.splice(index, 1);
      delete contract.storage.fileDetails[fileCid];
      contract.updatedAt = new Date().toISOString();
      this.saveContracts(data);
      console.log(`[CONTRACT] Removed file ${fileCid} from contract ${contractId}`);
    }
    return { success: true, contract };
  }

  static updateContractStatus(contractId, status) {
    const data = this.loadContracts();
    const contract = data.contracts.find(c => c.id === contractId);

    if (!contract) return null;

    contract.status = status;
    contract.updatedAt = new Date().toISOString();

    this.saveContracts(data);
    return contract;
  }

  static renewContract(contractId, additionalDays) {
    const data = this.loadContracts();
    const contract = data.contracts.find(c => c.id === contractId);

    if (!contract) return { success: false, error: 'Contract not found' };

    const currentEndDate = new Date(contract.terms.endDate);
    const newEndDate = new Date(currentEndDate.getTime() + additionalDays * 24 * 60 * 60 * 1000);

    contract.terms.endDate = newEndDate.toISOString();
    contract.terms.durationDays += additionalDays;
    contract.status = 'active';
    contract.updatedAt = new Date().toISOString();

    this.saveContracts(data);
    console.log(`[CONTRACT] Renewed contract ${contractId} until ${newEndDate.toISOString()}`);

    return { success: true, contract };
  }

  static checkExpiredContracts() {
    const data = this.loadContracts();
    const now = new Date();
    const expiredContracts = [];
    let updated = false;

    data.contracts.forEach(contract => {
      const endDate = new Date(contract.terms.endDate);
      if (contract.status === 'active' && now > endDate) {
        if (contract.terms.autoRenew) {
          const newEndDate = new Date(endDate.getTime() + contract.terms.durationDays * 24 * 60 * 60 * 1000);
          contract.terms.endDate = newEndDate.toISOString();
          contract.updatedAt = new Date().toISOString();
          console.log(`[CONTRACT] Auto-renewed contract ${contract.id}`);
        } else {
          contract.status = 'expired';
          contract.updatedAt = new Date().toISOString();
          expiredContracts.push(contract);
          console.log(`[CONTRACT] Expired contract ${contract.id}`);
        }
        updated = true;
      }
    });

    if (updated) {
      this.saveContracts(data);
    }

    return expiredContracts;
  }

  static cancelContract(contractId, reason = '') {
    const data = this.loadContracts();
    const contract = data.contracts.find(c => c.id === contractId);

    if (!contract) return { success: false, error: 'Contract not found' };

    contract.status = 'cancelled';
    contract.metadata.cancellationReason = reason;
    contract.metadata.cancelledAt = new Date().toISOString();
    contract.updatedAt = new Date().toISOString();

    this.saveContracts(data);
    console.log(`[CONTRACT] Cancelled contract ${contractId}: ${reason}`);

    return { success: true, contract };
  }

  static deleteContract(contractId) {
    const data = this.loadContracts();
    const contract = data.contracts.find(c => c.id === contractId);

    if (!contract) return { success: false, error: 'Contract not found' };

    if (contract.storage.files.length > 0) {
      return { success: false, error: 'Cannot delete contract with stored files' };
    }

    data.contracts = data.contracts.filter(c => c.id !== contractId);
    this.saveContracts(data);

    console.log(`[CONTRACT] Deleted contract ${contractId}`);
    return { success: true };
  }

  static processPayment(contractId, paymentData) {
    const data = this.loadContracts();
    const contract = data.contracts.find(c => c.id === contractId);

    if (!contract) return { success: false, error: 'Contract not found' };
    if (contract.payment.status === 'paid') {
      return { success: false, error: 'Contract already paid' };
    }

    contract.payment = {
      ...contract.payment,
      status: 'paid',
      paidAmount: paymentData.amount || contract.pricing.totalPrice,
      paymentDate: new Date().toISOString(),
      paymentMethod: paymentData.method || 'credits',
      transactionId: paymentData.transactionId || `tx-${Date.now()}`
    };
    contract.status = 'active';
    contract.updatedAt = new Date().toISOString();

    this.saveContracts(data);
    console.log(`[CONTRACT] Payment processed for contract ${contractId}`);
    return { success: true, contract };
  }

  static getContractStats(contractId) {
    const contract = this.getContract(contractId);
    if (!contract) return null;

    const now = new Date();
    const endDate = new Date(contract.terms.endDate);
    const daysRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));

    return {
      contractId: contract.id,
      status: contract.status,
      storageUsedPercent: (contract.storage.usedGB / contract.storage.allocatedGB * 100).toFixed(2),
      filesStored: contract.storage.files.length,
      daysRemaining: daysRemaining,
      isExpiringSoon: daysRemaining <= 7 && daysRemaining > 0,
      totalPrice: contract.pricing.totalPrice,
      paymentStatus: contract.payment.status
    };
  }
}

module.exports = StorageContract;
