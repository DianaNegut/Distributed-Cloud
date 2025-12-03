const express = require('express');
const router = express.Router();
const StorageProvider = require('../models/StorageProvider');
const { getDiskSpace } = require('../utils/getDiskSpace');
const { getIPFSRepoSize } = require('../utils/getIPFSRepoSize');

router.get('/', (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      minAvailableGB: req.query.minAvailableGB ? parseFloat(req.query.minAvailableGB) : undefined,
      location: req.query.location,
      sortBy: req.query.sortBy || 'space'
    };
    const providers = StorageProvider.getAllProviders(filters);
    res.json({
      success: true,
      total: providers.length,
      providers: providers
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const provider = StorageProvider.getProvider(req.params.id);
    if (!provider) {
      return res.status(404).json({ success: false, error: 'Provider not found' });
    }
    res.json({
      success: true,
      provider: provider
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { peerId, name, description, totalCapacityGB, location, uptimeGuarantee, replicationFactor } = req.body;
    if (!peerId || !totalCapacityGB) {
      return res.status(400).json({ success: false, error: 'peerId and totalCapacityGB are required' });
    }

    // Opțiunea 1: Verificare spațiu disk real
    const diskSpace = await getDiskSpace();
    const ipfsRepo = await getIPFSRepoSize();
    const requestedGB = parseFloat(totalCapacityGB);
    const availableDiskGB = diskSpace.freeGB;
    const maxSafeCapacity = availableDiskGB * 0.8; // 80% din spațiul liber

    let warnings = [];
    
    // Warning dacă declară mai mult decât au disponibil
    if (requestedGB > availableDiskGB) {
      return res.status(400).json({
        success: false,
        error: `Capacitatea solicitată (${requestedGB}GB) depășește spațiul liber disponibil (${availableDiskGB.toFixed(1)}GB)`,
        diskSpace: {
          totalGB: diskSpace.totalGB,
          freeGB: diskSpace.freeGB,
          usedGB: diskSpace.usedGB,
          ipfsRepoGB: ipfsRepo.repoSizeGB
        }
      });
    }

    // Warning dacă declară mai mult de 80% din spațiul liber (recomandat)
    if (requestedGB > maxSafeCapacity) {
      warnings.push(`Atenție: Ai declarat ${requestedGB}GB dar ai doar ${availableDiskGB.toFixed(1)}GB liberi. Recomandăm maxim ${maxSafeCapacity.toFixed(1)}GB (80% din spațiul liber).`);
    }

    const provider = StorageProvider.registerProvider({
      peerId,
      name,
      description,
      totalCapacityGB: requestedGB,
      location,
      uptimeGuarantee: uptimeGuarantee ? parseFloat(uptimeGuarantee) : undefined,
      replicationFactor: replicationFactor ? parseInt(replicationFactor) : undefined
    });

    res.json({
      success: true,
      message: 'Provider registered successfully',
      provider: provider,
      warnings: warnings.length > 0 ? warnings : undefined,
      verification: {
        declaredCapacityGB: requestedGB,
        actualFreeSpaceGB: availableDiskGB.toFixed(1),
        recommendedMaxGB: maxSafeCapacity.toFixed(1),
        ipfsCurrentUsageGB: ipfsRepo.repoSizeGB
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { name, description, totalCapacityGB, location, status } = req.body;
    const provider = StorageProvider.getProvider(req.params.id);
    if (!provider) {
      return res.status(404).json({ success: false, error: 'Provider not found' });
    }
    const updates = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (location) updates.metadata = { ...provider.metadata, location };
    if (status) updates.status = status;
    if (totalCapacityGB) {
      updates.capacity = {
        ...provider.capacity,
        totalGB: parseFloat(totalCapacityGB),
        availableGB: parseFloat(totalCapacityGB) - provider.capacity.usedGB
      };
    }
    const updated = StorageProvider.updateProvider(req.params.id, updates);
    res.json({
      success: true,
      message: 'Provider updated successfully',
      provider: updated
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/heartbeat', async (req, res) => {
  try {
    const provider = StorageProvider.getProvider(req.params.id);
    if (!provider) {
      return res.status(404).json({ success: false, error: 'Provider not found' });
    }

    // Opțiunea 2: Monitorizare avansată cu suspendare automată
    const diskSpace = await getDiskSpace();
    const ipfsRepo = await getIPFSRepoSize();
    
    const actualFreeSpaceGB = diskSpace.freeGB;
    const ipfsUsageGB = ipfsRepo.repoSizeGB;
    const reservedGB = provider.capacity.reservedGB || 0;
    const newAvailableGB = actualFreeSpaceGB;

    let statusUpdate = {};
    let alerts = [];

    // Verifică dacă provider-ul mai are spațiul promis pentru contractele active
    if (actualFreeSpaceGB < reservedGB) {
      // Provider-ul nu mai poate onora contractele → SUSPENDARE
      statusUpdate.status = 'suspended';
      alerts.push({
        level: 'critical',
        message: `Provider suspendat automat: Spațiu insuficient. Necesar: ${reservedGB}GB, Disponibil: ${actualFreeSpaceGB.toFixed(1)}GB`
      });
      
      console.error(`[PROVIDER-HEARTBEAT] Provider ${provider.id} SUSPENDED: Insufficient space (need ${reservedGB}GB, has ${actualFreeSpaceGB.toFixed(1)}GB)`);
    } else if (actualFreeSpaceGB < reservedGB * 1.2) {
      // Warning: Se apropie de limită (sub 120% din rezervat)
      statusUpdate.status = 'active';
      alerts.push({
        level: 'warning',
        message: `Atenție: Spațiu liber scăzut. Contracte: ${reservedGB}GB, Disponibil: ${actualFreeSpaceGB.toFixed(1)}GB`
      });
    } else {
      // Totul OK
      statusUpdate.status = 'active';
    }

    // Actualizează capacitatea reală
    statusUpdate.capacity = {
      totalGB: provider.capacity.totalGB,
      usedGB: ipfsUsageGB,
      availableGB: Math.max(0, newAvailableGB),
      reservedGB: reservedGB
    };

    // Actualizează uptime
    statusUpdate.statistics = {
      ...provider.statistics,
      lastUptime: new Date().toISOString(),
      uptimePercentage: Math.min(100, (provider.statistics?.uptimePercentage || 100))
    };

    statusUpdate.lastSeen = new Date().toISOString();

    const updatedProvider = StorageProvider.updateProvider(req.params.id, statusUpdate);

    res.json({
      success: true,
      provider: updatedProvider,
      monitoring: {
        diskSpace: {
          totalGB: diskSpace.totalGB,
          freeGB: actualFreeSpaceGB.toFixed(1),
          usedGB: diskSpace.usedGB
        },
        ipfsRepo: {
          sizeGB: ipfsUsageGB
        },
        contracts: {
          reservedGB: reservedGB,
          canFulfill: actualFreeSpaceGB >= reservedGB
        }
      },
      alerts: alerts.length > 0 ? alerts : undefined
    });
  } catch (error) {
    console.error('[PROVIDER-HEARTBEAT] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const result = StorageProvider.deleteProvider(req.params.id);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
