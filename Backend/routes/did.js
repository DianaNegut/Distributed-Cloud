

const express = require('express');
const router = express.Router();
const DecentralizedIdentity = require('../models/DecentralizedIdentity');
const { requireAuth } = require('../middleware/solidAuth');


router.get('/status', (req, res) => {
  try {
    const stats = DecentralizedIdentity.getStatistics();
    res.json({
      success: true,
      system: 'DecentralizedIdentity',
      status: 'operational',
      blockchain: {
        network: process.env.ETHEREUM_NETWORK || 'sepolia-testnet',
        rpcUrl: process.env.ETHEREUM_RPC_URL || 'http://127.0.0.1:8545'
      },
      statistics: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.post('/register', requireAuth, (req, res) => {
  try {
    const { userId, ethereumAddress } = req.body;
    const user = req.user; // din auth middleware

    if (!userId && !user) {
      return res.status(400).json({
        success: false,
        error: 'userId or authenticated user required'
      });
    }

    const finalUserId = userId || user.username;

    const didDocument = DecentralizedIdentity.generateDID(finalUserId, ethereumAddress);

    const { publicKey, privateKey } = DecentralizedIdentity.generateKeyPair(didDocument.did);

    res.json({
      success: true,
      didDocument,
      publicKey,
      privateKey,
      message: 'DID generated successfully. Store privateKey securely!'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.post('/:did/register-onchain', requireAuth, async (req, res) => {
  try {
    const { did } = req.params;

    const result = await DecentralizedIdentity.registerDIDOnChain(did);

    res.json({
      success: true,
      did,
      onChainRegistration: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.get('/:did', (req, res) => {
  try {
    const { did } = req.params;
    const didDocument = DecentralizedIdentity.resolveDID(did);

    res.json({
      success: true,
      didDocument,
      '@context': 'https://www.w3.org/ns/did/v1'
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});


router.post('/credentials/issue', requireAuth, (req, res) => {
  try {
    const { did, credentialType, claims, expiresIn } = req.body;

    if (!did || !credentialType) {
      return res.status(400).json({
        success: false,
        error: 'did and credentialType required'
      });
    }

    const credential = DecentralizedIdentity.issuanceCredential({
      did,
      credentialType,
      claims: claims || {},
      expiresIn: expiresIn || 365
    });

    res.json({
      success: true,
      credential
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.post('/credentials/:credentialId/verify', (req, res) => {
  try {
    const { credentialId } = req.params;
    const verification = DecentralizedIdentity.verifyCredential(credentialId);

    res.json({
      success: verification.valid,
      verification
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.post('/credentials/:credentialId/revoke', requireAuth, (req, res) => {
  try {
    const { credentialId } = req.params;
    const result = DecentralizedIdentity.revokeCredential(credentialId);

    res.json({
      success: true,
      credentialId,
      revoked: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.get('/:did/credentials', (req, res) => {
  try {
    const { did } = req.params;
    const credentials = DecentralizedIdentity.getDIDCredentials(did);

    res.json({
      success: true,
      did,
      credentials,
      count: credentials.length
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
