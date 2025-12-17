/**
 * API Routes pentru Filecoin Internal Currency System
 * Gestionează wallet-uri, transferuri și plăți storage între utilizatori
 */

const express = require('express');
const router = express.Router();
const filecoinService = require('../services/filecoinService');

/**
 * GET /api/filecoin/status
 * Status sistem Filecoin intern
 */
router.get('/status', async (req, res) => {
  try {
    const status = filecoinService.getStatus();
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('[FILECOIN-API] Error getting status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/filecoin/wallet
 * Creează wallet nou pentru utilizator
 * Body: { userId, initialBalance }
 */
router.post('/wallet', async (req, res) => {
  try {
    const { userId, initialBalance } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const wallet = await filecoinService.createUserWallet(userId, initialBalance);
    
    res.json({
      success: true,
      wallet: wallet
    });
  } catch (error) {
    console.error('[FILECOIN-API] Error creating wallet:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/filecoin/wallet/:userId
 * Obține wallet utilizator
 */
router.get('/wallet/:userId', async (req, res) => {
  try {
    const wallet = await filecoinService.getOrCreateWallet(req.params.userId);
    
    res.json({
      success: true,
      wallet: wallet
    });
  } catch (error) {
    console.error('[FILECOIN-API] Error getting wallet:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/filecoin/balance/:userId
 * Obține balanță utilizator
 */
router.get('/balance/:userId', async (req, res) => {
  try {
    const balance = await filecoinService.getBalance(req.params.userId);
    
    res.json({
      success: true,
      ...balance
    });
  } catch (error) {
    console.error('[FILECOIN-API] Error getting balance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/filecoin/transfer
 * Transfer FIL între utilizatori
 * Body: { fromUserId, toUserId, amount, metadata }
 */
router.post('/transfer', async (req, res) => {
  try {
    const { fromUserId, toUserId, amount, metadata } = req.body;

    if (!fromUserId || !toUserId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'fromUserId, toUserId and amount are required'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be positive'
      });
    }

    const result = await filecoinService.transfer(fromUserId, toUserId, amount, metadata || {});
    
    res.json(result);
  } catch (error) {
    console.error('[FILECOIN-API] Error transferring FIL:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/filecoin/calculate-cost
 * Calculează cost storage
 * Body: { sizeGB, durationMonths, pricePerGBPerMonth }
 */
router.post('/calculate-cost', async (req, res) => {
  try {
    const { sizeGB, durationMonths, pricePerGBPerMonth } = req.body;

    if (!sizeGB || !durationMonths) {
      return res.status(400).json({
        success: false,
        error: 'sizeGB and durationMonths are required'
      });
    }

    const cost = filecoinService.calculateStorageCost(sizeGB, durationMonths, pricePerGBPerMonth);
    
    res.json({
      success: true,
      ...cost
    });
  } catch (error) {
    console.error('[FILECOIN-API] Error calculating cost:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/filecoin/escrow/deposit
 * Deposit în escrow pentru contract
 * Body: { userId, contractId, amount }
 */
router.post('/escrow/deposit', async (req, res) => {
  try {
    const { userId, contractId, amount } = req.body;

    if (!userId || !contractId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'userId, contractId and amount are required'
      });
    }

    const result = await filecoinService.depositEscrow(userId, contractId, amount);
    
    res.json(result);
  } catch (error) {
    console.error('[FILECOIN-API] Error depositing escrow:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/filecoin/escrow/release
 * Release din escrow către provider
 * Body: { providerId, contractId, amount }
 */
router.post('/escrow/release', async (req, res) => {
  try {
    const { providerId, contractId, amount } = req.body;

    if (!providerId || !contractId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'providerId, contractId and amount are required'
      });
    }

    const result = await filecoinService.releaseEscrow(providerId, contractId, amount);
    
    res.json(result);
  } catch (error) {
    console.error('[FILECOIN-API] Error releasing escrow:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/filecoin/escrow/refund
 * Refund din escrow către client
 * Body: { clientId, contractId, amount }
 */
router.post('/escrow/refund', async (req, res) => {
  try {
    const { clientId, contractId, amount } = req.body;

    if (!clientId || !contractId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'clientId, contractId and amount are required'
      });
    }

    const result = await filecoinService.refundEscrow(clientId, contractId, amount);
    
    res.json(result);
  } catch (error) {
    console.error('[FILECOIN-API] Error refunding escrow:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/filecoin/transactions/:userId
 * Obține tranzacții wallet
 */
router.get('/transactions/:userId', async (req, res) => {
  try {
    const transactions = await filecoinService.getWalletTransactions(req.params.userId);
    
    res.json({
      success: true,
      ...transactions
    });
  } catch (error) {
    console.error('[FILECOIN-API] Error getting transactions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/filecoin/transactions/contract/:contractId
 * Obține tranzacții contract
 */
router.get('/transactions/contract/:contractId', async (req, res) => {
  try {
    const transactions = await filecoinService.getContractTransactions(req.params.contractId);
    
    res.json({
      success: true,
      transactions: transactions
    });
  } catch (error) {
    console.error('[FILECOIN-API] Error getting contract transactions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/filecoin/wallets
 * Obține toate wallet-urile (admin)
 */
router.get('/wallets', async (req, res) => {
  try {
    const wallets = await filecoinService.getAllWallets();
    
    res.json({
      success: true,
      wallets: wallets,
      count: wallets.length
    });
  } catch (error) {
    console.error('[FILECOIN-API] Error getting wallets:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/filecoin/statistics
 * Statistici generale sistem
 */
router.get('/statistics', async (req, res) => {
  try {
    const stats = await filecoinService.getStatistics();
    
    res.json({
      success: true,
      ...stats
    });
  } catch (error) {
    console.error('[FILECOIN-API] Error getting statistics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/filecoin/recent-transactions
 * Tranzacții recente (ultimele 20)
 */
router.get('/recent-transactions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const transactions = await filecoinService.getRecentTransactions(limit);
    
    res.json({
      success: true,
      transactions: transactions,
      count: transactions.length
    });
  } catch (error) {
    console.error('[FILECOIN-API] Error getting recent transactions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
