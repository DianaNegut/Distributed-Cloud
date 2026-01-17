const express = require('express');
const router = express.Router();
const StorageContract = require('../models/StorageContract');
const StorageProvider = require('../models/StorageProvider');
const UserStorage = require('../models/UserStorage');
// Note: Blockchain payment functionality removed - will be handled by MetaMask in frontend

router.get('/', (req, res) => {
  try {
    // Get userId from headers (set by auth middleware)
    const userId = req.headers['x-user-id'] || req.body.owner;

    console.log(`[STORAGE-CONTRACTS] GET / endpoint called`);
    console.log(`[STORAGE-CONTRACTS] userId from headers: ${userId}`);
    console.log(`[STORAGE-CONTRACTS] query params:`, req.query);

    // Build filters
    const filters = {
      status: req.query.status,
      renterId: req.query.renterId || userId, // Use userId if no renterId specified
      providerId: req.query.providerId
    };

    let contracts = StorageContract.getAllContracts(filters);

    // Additional filtering for "my contracts" - only active and paid
    if (userId && !req.query.renterId) {
      console.log(`[STORAGE-CONTRACTS] Filtering contracts for user: ${userId}`);

      contracts = contracts.filter(contract => {
        console.log(`[STORAGE-CONTRACTS] Checking contract ${contract.id}:`);
        console.log(`  - renterId: ${contract.renterId}`);
        console.log(`  - providerId: ${contract.providerId}`);
        console.log(`  - status: ${contract.status}`);
        console.log(`  - payment.status: ${contract.payment?.status}`);

        // Filter by user - must be renter
        if (contract.renterId !== userId) {
          console.log(`  ❌ Excluded: Not my contract (renterId mismatch)`);
          return false;
        }

        // IMPORTANT: Exclude contracts where user is the provider owner
        // (can't store data on your own provider contract)
        const provider = StorageProvider.getProvider(contract.providerId);
        console.log(`  - Provider found:`, provider ? 'YES' : 'NO');
        if (provider) {
          console.log(`  - Provider peerId: ${provider.peerId}`);
          console.log(`  - User ID: ${userId}`);
          console.log(`  - Match: ${provider.peerId === userId}`);
        }

        if (provider && provider.peerId === userId) {
          console.log(`  ❌ Excluded: User is provider owner`);
          return false;
        }

        // Only show active contracts
        if (contract.status !== 'active') {
          console.log(`  ❌ Excluded: Not active (status: ${contract.status})`);
          return false;
        }

        // Only show paid contracts
        if (contract.payment?.status !== 'paid') {
          console.log(`  ❌ Excluded: Not paid (payment.status: ${contract.payment?.status})`);
          return false;
        }

        console.log(`  ✅ Included in list`);
        return true;
      });
    }

    // Remove duplicates by contract ID (just in case)
    const uniqueContracts = [];
    const seenIds = new Set();
    for (const contract of contracts) {
      if (!seenIds.has(contract.id)) {
        seenIds.add(contract.id);
        uniqueContracts.push(contract);
      }
    }

    res.json({
      success: true,
      total: uniqueContracts.length,
      contracts: uniqueContracts
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

router.post('/create', async (req, res) => {
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

    const provider = StorageProvider.getProvider(providerId);
    if (!provider) {
      return res.status(404).json({ success: false, error: 'Provider not found' });
    }

    // Prevent self-rental: check if renter is the provider owner
    if (provider.peerId === renterId) {
      return res.status(400).json({
        success: false,
        error: 'Nu poți închiria stocare de la propriul tău provider. Te rugăm să alegi alt provider.'
      });
    }

    if (provider.status === 'suspended') {
      return res.status(400).json({
        success: false,
        error: 'Provider is suspended due to insufficient storage capacity. Please choose another provider.'
      });
    }

    if (provider.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: `Provider is not active (status: ${provider.status})`
      });
    }

    const requestedGB = parseFloat(allocatedGB);
    const months = durationMonths ? parseInt(durationMonths) : 1;

    if (provider.capacity.availableGB < requestedGB) {
      return res.status(400).json({
        success: false,
        error: `Insufficient storage. Available: ${provider.capacity.availableGB.toFixed(1)}GB, Requested: ${requestedGB}GB`
      });
    }

    const utilizationPercent = ((provider.capacity.totalGB - provider.capacity.availableGB) / provider.capacity.totalGB) * 100;
    const warnings = [];

    if (utilizationPercent > 90) {
      warnings.push('Provider has high storage utilization (>90%). Consider choosing another provider for better reliability.');
    }

    const pricing = StorageProvider.calculatePrice(providerId, requestedGB, months);
    if (!pricing) {
      return res.status(500).json({ success: false, error: 'Failed to calculate pricing' });
    }

    console.log('[STORAGE-CONTRACTS] Pricing calculated:', pricing);

    // Calculate cost based on provider's pricing (simple calculation, no blockchain)
    const pricePerGBPerMonth = provider.pricing?.pricePerGBPerMonth || 0.10;
    const totalCost = requestedGB * months * pricePerGBPerMonth;

    console.log('[STORAGE-CONTRACTS] Cost calculated:', { totalCost, pricePerGBPerMonth });

    const allocationResult = StorageProvider.allocateStorage(providerId, requestedGB);
    if (!allocationResult.success) {
      return res.status(400).json(allocationResult);
    }

    const contract = StorageContract.createContract({
      renterId,
      renterName,
      providerId,
      providerName: provider.name,
      allocatedGB: requestedGB,
      durationMonths: months,
      description,
      replicationFactor,
      slaUptimeMin,
      autoRenew: autoRenew === true,
      pricePerGBPerMonth: pricePerGBPerMonth,
      totalPrice: totalCost,
      basePrice: totalCost,
      discount: 0,
      discountAmount: 0,
      currency: 'ETH' // Will be paid via MetaMask
    });

    // Contract starts as pending_payment - will be activated after MetaMask payment
    contract.status = 'pending_payment';
    contract.payment.status = 'pending';
    contract.payment.requiredAmount = totalCost;

    UserStorage.addContractStorage(renterId, contract.id, requestedGB);
    console.log(`[STORAGE-CONTRACTS] Stocare adaugata pentru ${renterId}: +${requestedGB}GB`);

    res.json({
      success: true,
      message: 'Contract created - awaiting payment via MetaMask',
      contract: contract,
      pricing: {
        sizeGB: requestedGB,
        durationMonths: months,
        pricePerGBPerMonth: pricePerGBPerMonth,
        totalCost: totalCost,
        currency: 'ETH'
      },
      paymentRequired: {
        amount: totalCost,
        currency: 'ETH',
        instructions: 'Complete payment using MetaMask to activate contract'
      },
      warnings: warnings.length > 0 ? warnings : undefined
    });
  } catch (error) {
    console.error('[STORAGE-CONTRACTS] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/add-file', (req, res) => {
  console.log(`[STORAGE-CONTRACTS] Adaugare fisier in contract ${req.params.id}...`);
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

router.delete('/:id/remove-file/:cid', (req, res) => {
  console.log(`[STORAGE-CONTRACTS] stergere fisier ${req.params.cid} din contract ${req.params.id}...`);
  try {
    const result = StorageContract.removeFileFromContract(req.params.id, req.params.cid);

    if (!result.success) {
      return res.status(400).json(result);
    }

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

router.post('/:id/renew', (req, res) => {
  console.log(`[STORAGE-CONTRACTS] Reinnoire contract ${req.params.id}...`);
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

router.post('/:id/cancel', async (req, res) => {
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

    // Note: Refunds should be handled via MetaMask/smart contract in frontend
    console.log('[STORAGE-CONTRACTS] Contract cancelled - refund should be processed via MetaMask if payment was made');

    StorageProvider.releaseStorage(contract.providerId, contract.storage.allocatedGB);

    UserStorage.removeContractStorage(contract.renterId, contract.id, contract.storage.allocatedGB);
    console.log(`[STORAGE-CONTRACTS] Stocare eliminata pentru ${contract.renterId}: -${contract.storage.allocatedGB}GB`);

    res.json({
      success: true,
      message: 'Contract cancelled and escrow refunded',
      contract: result.contract
    });
  } catch (error) {
    console.error('[STORAGE-CONTRACTS] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/complete', async (req, res) => {
  console.log(`[STORAGE-CONTRACTS] Finalizare contract ${req.params.id}...`);
  try {
    const contract = StorageContract.getContract(req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found' });
    }

    if (contract.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Only active contracts can be completed'
      });
    }

    // Note: Payment release to provider should be handled via MetaMask/smart contract
    console.log('[STORAGE-CONTRACTS] Contract completed - payment release should be processed via MetaMask');

    StorageContract.updateContractStatus(contract.id, 'completed');
    StorageProvider.updateEarnings(contract.providerId, contract.payment?.paidAmount || 0);

    res.json({
      success: true,
      message: 'Contract completed - payment release should be processed via MetaMask',
      contract: contract
    });
  } catch (error) {
    console.error('[STORAGE-CONTRACTS] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/pay', async (req, res) => {
  console.log(`[STORAGE-CONTRACTS] Confirmare plata pentru contract ${req.params.id}...`);
  try {
    const { transactionHash } = req.body; // MetaMask transaction hash

    const contract = StorageContract.getContract(req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found' });
    }

    if (contract.status !== 'pending_payment') {
      return res.status(400).json({
        success: false,
        error: `Contract is not pending payment (status: ${contract.status})`
      });
    }

    // Update contract status after MetaMask payment confirmation
    const data = StorageContract.loadContracts();
    const contractToUpdate = data.contracts.find(c => c.id === contract.id);
    if (contractToUpdate) {
      contractToUpdate.payment.status = 'paid';
      contractToUpdate.payment.transactionHash = transactionHash || 'pending_verification';
      contractToUpdate.payment.paymentDate = new Date().toISOString();
      contractToUpdate.payment.paymentMethod = 'metamask';
      contractToUpdate.status = 'active';
      contractToUpdate.updatedAt = new Date().toISOString();
      StorageContract.saveContracts(data);
    }

    console.log(`[STORAGE-CONTRACTS] Contract ${req.params.id} activated after MetaMask payment`);

    res.json({
      success: true,
      message: 'Payment confirmed - contract is now active',
      contract: contractToUpdate,
      payment: {
        transactionHash: transactionHash || 'pending_verification',
        method: 'metamask'
      }
    });
  } catch (error) {
    console.error('[STORAGE-CONTRACTS] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/calculate-price', (req, res) => {
  try {
    const { providerId, sizeGB, durationMonths } = req.query;

    if (!providerId || !sizeGB || !durationMonths) {
      return res.status(400).json({
        success: false,
        error: 'providerId, sizeGB, and durationMonths are required'
      });
    }

    const pricing = StorageProvider.calculatePrice(
      providerId,
      parseFloat(sizeGB),
      parseInt(durationMonths)
    );

    if (!pricing) {
      return res.status(404).json({ success: false, error: 'Provider not found' });
    }

    res.json({
      success: true,
      pricing: pricing
    });
  } catch (error) {
    console.error('[STORAGE-CONTRACTS] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/:id/storage', (req, res) => {
  console.log('[STORAGE-CONTRACTS] Actualizare storage contract:', req.params.id);
  try {
    const data = StorageContract.loadContracts();
    const contract = data.contracts.find(c => c.id === req.params.id);

    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found' });
    }

    const { usedGB, files, fileDetails } = req.body;

    if (usedGB !== undefined) {
      if (usedGB > contract.storage.allocatedGB) {
        return res.status(400).json({
          success: false,
          error: `Storage limit exceeded. Allocated: ${contract.storage.allocatedGB}GB, Trying to use: ${usedGB}GB`
        });
      }
      contract.storage.usedGB = usedGB;
    }

    if (files !== undefined) {
      contract.storage.files = files;
    }

    // Handle fileDetails update (for file deletion)
    if (fileDetails !== undefined) {
      contract.storage.fileDetails = fileDetails;
      // Also update the files array to keep it in sync
      contract.storage.files = Object.keys(fileDetails);
    }

    contract.updatedAt = new Date().toISOString();

    // Save the updated contracts to disk
    StorageContract.saveContracts(data);

    console.log(`[STORAGE-CONTRACTS] Contract updated: ${contract.id}, usedGB: ${contract.storage.usedGB.toFixed(3)}GB, files: ${contract.storage.files.length}`);

    res.json({
      success: true,
      message: 'Contract storage updated',
      contract: contract
    });
  } catch (error) {
    console.error('[STORAGE-CONTRACTS] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/maintenance/check-expired', (req, res) => {
  console.log('[STORAGE-CONTRACTS] Verificare contracte expirate...');
  try {
    const expiredContracts = StorageContract.checkExpiredContracts();

    expiredContracts.forEach(contract => {
      StorageProvider.releaseStorage(contract.providerId, contract.storage.allocatedGB);

      UserStorage.removeContractStorage(contract.renterId, contract.id, contract.storage.allocatedGB);
      console.log(`[STORAGE-CONTRACTS] Contract expirat ${contract.id}: stocare eliminata pentru ${contract.renterId}`);
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

/**
 * POST /api/storage-contracts/:contractId/upload
 * Upload file directly to provider's storage folder for a specific contract
 */
router.post('/:contractId/upload', async (req, res) => {
  console.log(`[STORAGE-CONTRACTS] Upload to contract ${req.params.contractId}...`);

  try {
    const { contractId } = req.params;

    // 1. Validate contract
    const contract = StorageContract.getContract(contractId);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found' });
    }

    if (contract.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: `Contract is not active (status: ${contract.status})`
      });
    }

    // 2. Validate file upload
    if (!req.files || !req.files.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const uploadedFile = req.files.file;
    const fileSizeGB = uploadedFile.size / (1024 * 1024 * 1024);

    // 3. Check storage quota
    const newUsedGB = contract.storage.usedGB + fileSizeGB;
    if (newUsedGB > contract.storage.allocatedGB) {
      return res.status(400).json({
        success: false,
        error: `Storage quota exceeded. Allocated: ${contract.storage.allocatedGB}GB, Used: ${contract.storage.usedGB.toFixed(3)}GB, File: ${fileSizeGB.toFixed(3)}GB`,
        quota: {
          allocatedGB: contract.storage.allocatedGB,
          usedGB: contract.storage.usedGB,
          availableGB: contract.storage.allocatedGB - contract.storage.usedGB,
          requestedGB: fileSizeGB
        }
      });
    }

    // 4. Get provider's storage path
    const StorageReservation = require('../models/StorageReservationManager');
    const providerPath = StorageReservation.getProviderStoragePath(contract.providerId);

    if (!providerPath) {
      return res.status(500).json({
        success: false,
        error: 'Provider storage path not found. Provider may not be properly registered.'
      });
    }

    // 5. Write file to provider's folder
    const fs = require('fs').promises;
    const path = require('path');
    const crypto = require('crypto');

    // Generate unique filename to avoid collisions
    const timestamp = Date.now();
    const hash = crypto.createHash('md5').update(uploadedFile.name + timestamp).digest('hex').substring(0, 8);
    const safeFilename = `${timestamp}-${hash}-${uploadedFile.name}`;
    const filePath = path.join(providerPath, safeFilename);

    try {
      await fs.writeFile(filePath, uploadedFile.data);
      console.log(`[STORAGE-CONTRACTS] File written to: ${filePath}`);
    } catch (writeError) {
      console.error('[STORAGE-CONTRACTS] File write error:', writeError);
      return res.status(500).json({
        success: false,
        error: `Failed to write file to provider storage: ${writeError.message}`
      });
    }

    // 6. Update contract metadata
    const fileId = `file-${timestamp}-${hash}`;
    const result = StorageContract.addFileToContract(contractId, {
      cid: fileId, // Using unique ID instead of IPFS CID
      name: uploadedFile.name,
      sizeBytes: uploadedFile.size,
      mimetype: uploadedFile.mimetype,
      localPath: filePath,
      safeFilename: safeFilename
    });

    if (!result.success) {
      // Rollback: delete the file we just wrote
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        console.error('[STORAGE-CONTRACTS] Failed to rollback file:', unlinkError);
      }
      return res.status(400).json(result);
    }

    // 7. Update provider's used storage tracking
    StorageReservation.updateUsedSpace(contract.providerId, newUsedGB);
    StorageProvider.updateUsedStorage(contract.providerId, newUsedGB);

    console.log(`[STORAGE-CONTRACTS] File uploaded successfully: ${uploadedFile.name} (${fileSizeGB.toFixed(3)}GB) to contract ${contractId}`);

    res.json({
      success: true,
      message: 'File uploaded to provider storage successfully',
      file: {
        id: fileId,
        name: uploadedFile.name,
        size: uploadedFile.size,
        sizeGB: fileSizeGB.toFixed(3),
        mimetype: uploadedFile.mimetype,
        uploadedAt: new Date().toISOString()
      },
      contract: {
        id: contract.id,
        usedGB: newUsedGB.toFixed(3),
        allocatedGB: contract.storage.allocatedGB,
        availableGB: (contract.storage.allocatedGB - newUsedGB).toFixed(3),
        filesCount: result.contract.storage.files.length
      },
      provider: {
        id: contract.providerId,
        name: contract.providerName,
        storagePath: providerPath
      }
    });

  } catch (error) {
    console.error('[STORAGE-CONTRACTS] Upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/storage-contracts/:contractId/download/:fileId
 * Download file from provider's storage folder
 */
router.get('/:contractId/download/:fileId', async (req, res) => {
  console.log(`[STORAGE-CONTRACTS] Download file ${req.params.fileId} from contract ${req.params.contractId}...`);

  try {
    const { contractId, fileId } = req.params;

    // 1. Validate contract
    const contract = StorageContract.getContract(contractId);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found' });
    }

    // 2. Find file in contract
    const fileDetail = contract.storage.fileDetails[fileId];
    if (!fileDetail) {
      return res.status(404).json({ success: false, error: 'File not found in contract' });
    }

    // 3. Read file from provider's folder
    const fs = require('fs');
    const filePath = fileDetail.localPath;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found on provider storage. It may have been deleted.'
      });
    }

    // 4. Stream file to client
    res.setHeader('Content-Disposition', `attachment; filename="${fileDetail.name}"`);
    res.setHeader('Content-Type', fileDetail.mimetype || 'application/octet-stream');
    res.setHeader('Content-Length', fileDetail.sizeBytes);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('error', (err) => {
      console.error('[STORAGE-CONTRACTS] Stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Error streaming file' });
      }
    });

    console.log(`[STORAGE-CONTRACTS] File download started: ${fileDetail.name}`);

  } catch (error) {
    console.error('[STORAGE-CONTRACTS] Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

module.exports = router;
