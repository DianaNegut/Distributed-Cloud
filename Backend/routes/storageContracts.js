const express = require('express');
const router = express.Router();
const StorageContract = require('../models/StorageContract');
const StorageProvider = require('../models/StorageProvider');

router.get('/', (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      renterId: req.query.renterId,
      providerId: req.query.providerId
    };
    const contracts = StorageContract.getAllContracts(filters);
    res.json({
      success: true,
      total: contracts.length,
      contracts: contracts
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const contract = StorageContract.getContract(req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found' });
    }
    const stats = StorageContract.getContractStats(req.params.id);
    res.json({
      success: true,
      contract: contract,
      stats: stats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/storage-contracts/create - Creare contract nou
router.post('/create', (req, res) => {
  console.log('[STORAGE-CONTRACTS] Creare contract nou...');
  try {
    const { 
      renterId, 
      renterName,
      providerId, 
      allocatedGB, 
      durationMonths,
      description,
      replicationFactor,
      slaUptimeMin,
      autoRenew
    } = req.body;

    if (!renterId || !providerId || !allocatedGB) {
      return res.status(400).json({ 
        success: false, 
        error: 'renterId, providerId, and allocatedGB are required' 
      });
    }

    // Verifică provider-ul
    const provider = StorageProvider.getProvider(providerId);
    if (!provider) {
      return res.status(404).json({ success: false, error: 'Provider not found' });
    }

    if (provider.status !== 'active') {
      return res.status(400).json({ success: false, error: 'Provider is not active' });
    }

    // Verifică disponibilitatea storage-ului
    const requestedGB = parseFloat(allocatedGB);
    if (provider.capacity.availableGB < requestedGB) {
      return res.status(400).json({ 
        success: false, 
        error: `Insufficient storage. Available: ${provider.capacity.availableGB}GB, Requested: ${requestedGB}GB` 
      });
    }

    // Alocă storage-ul la provider
    const allocationResult = StorageProvider.allocateStorage(providerId, requestedGB);
    if (!allocationResult.success) {
      return res.status(400).json(allocationResult);
    }

    // Creează contractul
    const contract = StorageContract.createContract({
      renterId,
      renterName,
      providerId,
      providerName: provider.name,
      allocatedGB: requestedGB,
      durationMonths: durationMonths ? parseInt(durationMonths) : 1,
      description,
      replicationFactor,
      slaUptimeMin,
      autoRenew: autoRenew === true
    });

    res.json({
      success: true,
      message: 'Contract created successfully',
      contract: contract
    });
  } catch (error) {
    console.error('[STORAGE-CONTRACTS] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/storage-contracts/:id/add-file - Adaugă fișier în contract
router.post('/:id/add-file', (req, res) => {
  console.log(`[STORAGE-CONTRACTS] Adăugare fișier în contract ${req.params.id}...`);
  try {
    const { cid, name, sizeBytes, mimetype } = req.body;

    if (!cid || !name || !sizeBytes) {
      return res.status(400).json({ 
        success: false, 
        error: 'cid, name, and sizeBytes are required' 
      });
    }

    const result = StorageContract.addFileToContract(req.params.id, {
      cid,
      name,
      sizeBytes: parseInt(sizeBytes),
      mimetype
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Actualizează used storage la provider
    const contract = result.contract;
    StorageProvider.updateUsedStorage(contract.providerId, contract.storage.usedGB);

    res.json({
      success: true,
      message: 'File added to contract successfully',
      contract: result.contract
    });
  } catch (error) {
    console.error('[STORAGE-CONTRACTS] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/storage-contracts/:id/remove-file/:cid - Șterge fișier din contract
router.delete('/:id/remove-file/:cid', (req, res) => {
  console.log(`[STORAGE-CONTRACTS] Ștergere fișier ${req.params.cid} din contract ${req.params.id}...`);
  try {
    const result = StorageContract.removeFileFromContract(req.params.id, req.params.cid);

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Actualizează used storage la provider
    const contract = result.contract;
    StorageProvider.updateUsedStorage(contract.providerId, contract.storage.usedGB);

    res.json({
      success: true,
      message: 'File removed from contract successfully',
      contract: result.contract
    });
  } catch (error) {
    console.error('[STORAGE-CONTRACTS] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/storage-contracts/:id/renew - Reînnoiește contract
router.post('/:id/renew', (req, res) => {
  console.log(`[STORAGE-CONTRACTS] Reînnoire contract ${req.params.id}...`);
  try {
    const { additionalDays } = req.body;

    if (!additionalDays || additionalDays <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'additionalDays must be a positive number' 
      });
    }

    const result = StorageContract.renewContract(req.params.id, parseInt(additionalDays));

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: `Contract renewed for ${additionalDays} additional days`,
      contract: result.contract
    });
  } catch (error) {
    console.error('[STORAGE-CONTRACTS] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/storage-contracts/:id/cancel - Anulează contract
router.post('/:id/cancel', (req, res) => {
  console.log(`[STORAGE-CONTRACTS] Anulare contract ${req.params.id}...`);
  try {
    const { reason } = req.body;

    const contract = StorageContract.getContract(req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found' });
    }

    const result = StorageContract.cancelContract(req.params.id, reason || '');

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Eliberează storage-ul de la provider
    StorageProvider.releaseStorage(contract.providerId, contract.storage.allocatedGB);

    res.json({
      success: true,
      message: 'Contract cancelled successfully',
      contract: result.contract
    });
  } catch (error) {
    console.error('[STORAGE-CONTRACTS] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/storage-contracts/check-expired - Verifică contracte expirate
router.get('/maintenance/check-expired', (req, res) => {
  console.log('[STORAGE-CONTRACTS] Verificare contracte expirate...');
  try {
    const expiredContracts = StorageContract.checkExpiredContracts();
    
    // Eliberează storage pentru contractele expirate (non-renewed)
    expiredContracts.forEach(contract => {
      StorageProvider.releaseStorage(contract.providerId, contract.storage.allocatedGB);
    });

    res.json({
      success: true,
      expiredCount: expiredContracts.length,
      expiredContracts: expiredContracts.map(c => ({
        id: c.id,
        renterId: c.renterId,
        providerId: c.providerId,
        allocatedGB: c.storage.allocatedGB
      }))
    });
  } catch (error) {
    console.error('[STORAGE-CONTRACTS] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
