const express = require('express');
const router = express.Router();
const StorageContract = require('../models/StorageContract');
const StorageProvider = require('../models/StorageProvider');
const UserStorage = require('../models/UserStorage');
const filecoinService = require('../services/filecoinService');

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


    const filCost = filecoinService.calculateStorageCost(requestedGB, months, provider.pricing?.pricePerGBPerMonth);
    console.log('[STORAGE-CONTRACTS] FIL cost:', filCost);


    try {
      const clientBalance = await filecoinService.getBalance(renterId);
      if (clientBalance.balance < filCost.totalCost) {
        return res.status(400).json({
          success: false,
          error: `Insufficient FIL balance. Available: ${clientBalance.balance} FIL, Required: ${filCost.totalCost} FIL`,
          required: filCost.totalCost,
          available: clientBalance.balance
        });
      }
    } catch (error) {
      console.warn('[STORAGE-CONTRACTS] Balance check failed, creating wallet:', error.message);

      await filecoinService.createUserWallet(renterId);
      const newBalance = await filecoinService.getBalance(renterId);
      if (newBalance.balance < filCost.totalCost) {
        return res.status(400).json({
          success: false,
          error: `Insufficient FIL balance. Available: ${newBalance.balance} FIL, Required: ${filCost.totalCost} FIL`,
          required: filCost.totalCost,
          available: newBalance.balance
        });
      }
    }

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
      pricePerGBPerMonth: filCost.pricePerGBPerMonth,
      totalPrice: filCost.totalCost,
      priceInFIL: filCost.totalCost,
      basePrice: filCost.totalCost,
      discount: 0,
      discountAmount: 0,
      currency: 'FIL'
    });


    try {
      const escrowResult = await filecoinService.depositEscrow(renterId, contract.id, filCost.totalCost);
      console.log('[STORAGE-CONTRACTS] Escrow deposit:', escrowResult);


      contract.payment.escrowStatus = 'deposited';
      contract.payment.escrowAmount = filCost.totalCost;
      contract.payment.escrowTxId = escrowResult.transaction.id;
      contract.status = 'active';
    } catch (error) {

      StorageProvider.deallocateStorage(providerId, requestedGB);
      console.error('[STORAGE-CONTRACTS] Escrow deposit failed:', error.message);
      return res.status(500).json({
        success: false,
        error: `Failed to deposit escrow: ${error.message}`
      });
    }

    UserStorage.addContractStorage(renterId, contract.id, requestedGB);
    console.log(`[STORAGE-CONTRACTS] Stocare adaugata pentru ${renterId}: +${requestedGB}GB`);

    res.json({
      success: true,
      message: 'Contract created successfully with FIL payment',
      contract: contract,
      pricing: {
        ...filCost,
        escrowDeposit: filCost.totalCost
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


    if (contract.payment.escrowStatus === 'deposited' && contract.payment.escrowAmount > 0) {
      try {
        const refundResult = await filecoinService.refundEscrow(
          contract.renterId,
          contract.id,
          contract.payment.escrowAmount
        );
        console.log('[STORAGE-CONTRACTS] Escrow refunded:', refundResult);
        contract.payment.escrowStatus = 'refunded';
      } catch (error) {
        console.error('[STORAGE-CONTRACTS] Escrow refund failed:', error.message);

      }
    }

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


    if (contract.payment.escrowStatus === 'deposited' && contract.payment.escrowAmount > 0) {
      try {
        const releaseResult = await filecoinService.releaseEscrow(
          contract.providerId,
          contract.id,
          contract.payment.escrowAmount
        );
        console.log('[STORAGE-CONTRACTS] Escrow released to provider:', releaseResult);
        contract.payment.escrowStatus = 'released';
        contract.payment.status = 'paid';
        contract.payment.paidAmount = contract.payment.escrowAmount;
        contract.payment.paymentDate = new Date().toISOString();
      } catch (error) {
        console.error('[STORAGE-CONTRACTS] Escrow release failed:', error.message);
        return res.status(500).json({
          success: false,
          error: `Failed to release escrow: ${error.message}`
        });
      }
    }


    StorageContract.updateContractStatus(contract.id, 'completed');
    StorageProvider.updateEarnings(contract.providerId, contract.payment.escrowAmount);

    res.json({
      success: true,
      message: 'Contract completed and payment released to provider',
      contract: contract
    });
  } catch (error) {
    console.error('[STORAGE-CONTRACTS] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/pay', (req, res) => {
  console.log(`[STORAGE-CONTRACTS] Procesare plata pentru contract ${req.params.id}...`);
  try {
    const { paymentMethod, transactionId } = req.body;

    const contract = StorageContract.getContract(req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found' });
    }

    const result = StorageContract.processPayment(req.params.id, {
      amount: contract.pricing.totalPrice,
      method: paymentMethod || 'filecoin',
      transactionId: transactionId
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    StorageProvider.updateEarnings(contract.providerId, contract.pricing.totalPrice);

    res.json({
      success: true,
      message: 'Payment processed successfully',
      contract: result.contract
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
    const contract = StorageContract.getContract(req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found' });
    }

    const { usedGB, files } = req.body;

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

    contract.updatedAt = new Date().toISOString();

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

module.exports = router;
