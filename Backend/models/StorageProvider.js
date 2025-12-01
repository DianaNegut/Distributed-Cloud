const fs = require('fs');
const path = require('path');
const { IPFS_PATH } = require('../config/paths');

const PROVIDERS_FILE = path.join(IPFS_PATH, 'storage-providers.json');

class StorageProvider {
  static loadProviders() {
    try {
      if (fs.existsSync(PROVIDERS_FILE)) {
        const data = fs.readFileSync(PROVIDERS_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[PROVIDER-MODEL] Error loading providers:', error.message);
    }
    return { providers: [] };
  }

  static saveProviders(data) {
    try {
      fs.writeFileSync(PROVIDERS_FILE, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error('[PROVIDER-MODEL] Error saving providers:', error.message);
      return false;
    }
  }

  static registerProvider(providerData) {
    const data = this.loadProviders();
    
    const existing = data.providers.find(p => p.peerId === providerData.peerId);
    if (existing) {
      throw new Error('Provider with this Peer ID already registered');
    }

    const provider = {
      id: `provider-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      peerId: providerData.peerId,
      name: providerData.name || 'Anonymous Provider',
      description: providerData.description || '',
      capacity: {
        totalGB: providerData.totalCapacityGB || 0,
        usedGB: 0,
        availableGB: providerData.totalCapacityGB || 0,
        reservedGB: 0
      },
      pricing: {
        pricePerGBPerMonth: providerData.pricePerGBPerMonth || 0.10,
        currency: 'USD',
        minimumContract: providerData.minimumContract || 1,
        discounts: {
          threeMonths: providerData.discountThreeMonths || 5,
          sixMonths: providerData.discountSixMonths || 10,
          twelveMonths: providerData.discountTwelveMonths || 20
        }
      },
      earnings: {
        totalEarned: 0,
        pendingPayment: 0,
        lastPaymentDate: null,
        monthlyRevenue: 0
      },
      sla: {
        uptimeGuarantee: providerData.uptimeGuarantee || 95.0,
        replicationFactor: providerData.replicationFactor || 3,
        dataRetentionDays: providerData.dataRetentionDays || 30
      },
      statistics: {
        totalContracts: 0,
        activeContracts: 0,
        totalFilesStored: 0,
        uptimePercentage: 100.0,
        lastUptime: new Date().toISOString()
      },
      status: 'active',
      metadata: {
        location: providerData.location || 'Unknown',
        nodeVersion: providerData.nodeVersion || 'Unknown',
        network: providerData.network || 'private'
      },
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    };

    data.providers.push(provider);
    this.saveProviders(data);
    console.log(`[PROVIDER] Registered new provider: ${provider.id} (${provider.name})`);
    return provider;
  }

  static getProvider(providerId) {
    const data = this.loadProviders();
    return data.providers.find(p => p.id === providerId);
  }

  static getProviderByPeerId(peerId) {
    const data = this.loadProviders();
    return data.providers.find(p => p.peerId === peerId);
  }

  static getAllProviders(filters = {}) {
    const data = this.loadProviders();
    let providers = data.providers;

    if (filters.status) {
      providers = providers.filter(p => p.status === filters.status);
    }
    if (filters.minAvailableGB) {
      providers = providers.filter(p => p.capacity.availableGB >= filters.minAvailableGB);
    }
    if (filters.location) {
      providers = providers.filter(p => 
        p.metadata.location.toLowerCase().includes(filters.location.toLowerCase())
      );
    }
    if (filters.sortBy === 'space') {
      providers.sort((a, b) => b.capacity.availableGB - a.capacity.availableGB);
    } else if (filters.sortBy === 'name') {
      providers.sort((a, b) => a.name.localeCompare(b.name));
    } else if (filters.sortBy === 'uptime') {
      providers.sort((a, b) => b.statistics.uptimePercentage - a.statistics.uptimePercentage);
    }

    return providers;
  }

  static updateProvider(providerId, updates) {
    const data = this.loadProviders();
    const index = data.providers.findIndex(p => p.id === providerId);
    
    if (index === -1) return null;

    data.providers[index] = {
      ...data.providers[index],
      ...updates,
      lastSeen: new Date().toISOString()
    };

    this.saveProviders(data);
    return data.providers[index];
  }

  static allocateStorage(providerId, sizeGB) {
    const provider = this.getProvider(providerId);
    if (!provider) return { success: false, error: 'Provider not found' };

    if (provider.capacity.availableGB < sizeGB) {
      return { success: false, error: 'Insufficient storage available' };
    }

    const updates = {
      capacity: {
        ...provider.capacity,
        reservedGB: provider.capacity.reservedGB + sizeGB,
        availableGB: provider.capacity.availableGB - sizeGB
      },
      statistics: {
        ...provider.statistics,
        totalContracts: provider.statistics.totalContracts + 1,
        activeContracts: provider.statistics.activeContracts + 1
      }
    };

    const updated = this.updateProvider(providerId, updates);
    return { success: true, provider: updated };
  }

  static releaseStorage(providerId, sizeGB) {
    const provider = this.getProvider(providerId);
    if (!provider) return { success: false, error: 'Provider not found' };

    const updates = {
      capacity: {
        ...provider.capacity,
        reservedGB: Math.max(0, provider.capacity.reservedGB - sizeGB),
        availableGB: provider.capacity.availableGB + sizeGB
      },
      statistics: {
        ...provider.statistics,
        activeContracts: Math.max(0, provider.statistics.activeContracts - 1)
      }
    };

    const updated = this.updateProvider(providerId, updates);
    return { success: true, provider: updated };
  }

  static updateUsedStorage(providerId, usedGB) {
    const provider = this.getProvider(providerId);
    if (!provider) return null;

    const updates = {
      capacity: {
        ...provider.capacity,
        usedGB: usedGB
      },
      statistics: {
        ...provider.statistics,
        totalFilesStored: provider.statistics.totalFilesStored
      }
    };

    return this.updateProvider(providerId, updates);
  }

  static updateStatus(providerId, status) {
    return this.updateProvider(providerId, { status });
  }

  static heartbeat(providerId) {
    const provider = this.getProvider(providerId);
    if (!provider) return null;

    const updates = {
      lastSeen: new Date().toISOString(),
      statistics: {
        ...provider.statistics,
        lastUptime: new Date().toISOString()
      }
    };

    return this.updateProvider(providerId, updates);
  }

  static updateEarnings(providerId, amount) {
    const provider = this.getProvider(providerId);
    if (!provider) return null;

    const earnings = provider.earnings || {
      totalEarned: 0,
      pendingPayment: 0,
      lastPaymentDate: null,
      monthlyRevenue: 0
    };

    const updates = {
      earnings: {
        ...earnings,
        totalEarned: earnings.totalEarned + amount,
        pendingPayment: earnings.pendingPayment + amount,
        monthlyRevenue: earnings.monthlyRevenue + amount
      }
    };

    return this.updateProvider(providerId, updates);
  }

  static calculatePrice(providerId, sizeGB, durationMonths) {
    const provider = this.getProvider(providerId);
    if (!provider) return null;

    const pricing = provider.pricing || {
      pricePerGBPerMonth: 0.10,
      currency: 'USD',
      discounts: { threeMonths: 5, sixMonths: 10, twelveMonths: 20 }
    };

    let basePrice = pricing.pricePerGBPerMonth * sizeGB * durationMonths;
    let discount = 0;

    if (durationMonths >= 12) {
      discount = pricing.discounts?.twelveMonths || 20;
    } else if (durationMonths >= 6) {
      discount = pricing.discounts?.sixMonths || 10;
    } else if (durationMonths >= 3) {
      discount = pricing.discounts?.threeMonths || 5;
    }

    const discountAmount = (basePrice * discount) / 100;
    const finalPrice = basePrice - discountAmount;

    return {
      basePrice: parseFloat(basePrice.toFixed(2)),
      discount: discount,
      discountAmount: parseFloat(discountAmount.toFixed(2)),
      finalPrice: parseFloat(finalPrice.toFixed(2)),
      currency: pricing.currency,
      pricePerGBPerMonth: pricing.pricePerGBPerMonth
    };
  }

  static deleteProvider(providerId) {
    const data = this.loadProviders();
    const provider = data.providers.find(p => p.id === providerId);
    
    if (!provider) return { success: false, error: 'Provider not found' };
    
    if (provider.statistics.activeContracts > 0) {
      return { success: false, error: 'Cannot delete provider with active contracts' };
    }

    data.providers = data.providers.filter(p => p.id !== providerId);
    this.saveProviders(data);
    
    console.log(`[PROVIDER] Deleted provider: ${providerId}`);
    return { success: true };
  }
}

module.exports = StorageProvider;
