

const express = require('express');
const router = express.Router();
const EthereumContractManager = require('../models/EthereumContractManager');
const { requireAuth } = require('../middleware/solidAuth');


router.get('/status', (req, res) => {
  try {
    const status = EthereumContractManager.getContractStatus();

    res.json({
      success: true,
      ethereum: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.post('/deploy', requireAuth, async (req, res) => {
  try {
    console.log('[ETHEREUM-API] Deploying contracts...');

    const storageResult = await EthereumContractManager.deployStorageContract();
    const paymentResult = await EthereumContractManager.deployPaymentProcessor();

    if (!storageResult || !paymentResult) {
      return res.status(500).json({
        success: false,
        error: 'Contract deployment returned null results'
      });
    }

    res.json({
      success: true,
      deployments: {
        storageContract: storageResult || { address: '0x' + 'f'.repeat(40) },
        paymentProcessor: paymentResult || { address: '0x' + 'e'.repeat(40) }
      },
      message: 'Contracts deployed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.get('/contracts', (req, res) => {
  try {
    const contracts = EthereumContractManager.getDeployedContracts();

    res.json({
      success: true,
      contracts,
      count: Object.keys(contracts).length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.post('/storage-contract/create', requireAuth, async (req, res) => {
  try {
    const { provider, allocatedGB, pricePerGBPerMonth, durationMonths } = req.body;

    if (!provider || !allocatedGB) {
      return res.status(400).json({
        success: false,
        error: 'provider and allocatedGB required'
      });
    }

    const result = await EthereumContractManager.createStorageContract(
      provider,
      allocatedGB,
      pricePerGBPerMonth || 0.1,
      durationMonths || 1
    );

    res.json({
      success: true,
      contract: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.post('/payment/process', requireAuth, async (req, res) => {
  try {
    const { recipient, amount, description } = req.body;

    if (!recipient || !amount) {
      return res.status(400).json({
        success: false,
        error: 'recipient and amount required'
      });
    }

    const result = await EthereumContractManager.processPayment(
      recipient,
      amount,
      description || 'Payment'
    );

    res.json({
      success: true,
      payment: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
