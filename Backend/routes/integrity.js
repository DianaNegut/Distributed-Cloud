

const express = require('express');
const router = express.Router();
const IntegrityVerifier = require('../models/IntegrityVerifier');
const DockerClusterClient = require('../utils/dockerClusterClient');
const { requireAuth } = require('../middleware/solidAuth');

const clusterClient = new DockerClusterClient();
const integrityVerifier = new IntegrityVerifier(clusterClient);


router.get('/status', (req, res) => {
  try {
    const recentChecks = integrityVerifier.getRecentChecks(5);
    const currentReport = integrityVerifier.getCurrentReport();

    res.json({
      success: true,
      integritySystem: {
        operational: true,
        lastCheck: recentChecks[0]?.timestamp || 'Never',
        isRunning: integrityVerifier.isRunning
      },
      currentReport,
      recentChecks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.get('/check/:cid', async (req, res) => {
  try {
    const { cid } = req.params;

    const porResult = await integrityVerifier.verifyProofOfReplication(cid);

    res.json({
      success: true,
      porResult,
      summary: {
        verified: porResult.porValid,
        replicas: `${porResult.successCount}/${porResult.totalPeers}`,
        required: porResult.requiredReplicas
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.post('/verify-redundancy', async (req, res) => {
  try {
    console.log('[INTEGRITY-API] Starting full redundancy verification');
    const report = await integrityVerifier.verifyRedundancy();

    res.json({
      success: true,
      report,
      summary: {
        healthy: report.healthy,
        verifiedFiles: report.verifiedFiles,
        totalFiles: report.totalFiles,
        issues: report.issues.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.post('/repair/:cid', async (req, res) => {
  try {
    const { cid } = req.params;

    const repairResult = await integrityVerifier.autoRepair(cid);

    res.json({
      success: repairResult.success,
      repair: repairResult
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.post('/verify-pod', requireAuth, async (req, res) => {
  try {
    const { podData } = req.body;

    if (!podData || !podData.username) {
      return res.status(400).json({
        success: false,
        error: 'podData with username required'
      });
    }

    const integrityCheck = await integrityVerifier.verifySolidPODIntegrity(podData);

    res.json({
      success: true,
      integrityCheck,
      summary: {
        healthy: integrityCheck.healthy,
        pod: integrityCheck.podUsername,
        timestamp: integrityCheck.timestamp
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.get('/report', (req, res) => {
  try {
    const report = integrityVerifier.getCurrentReport();

    if (!report) {
      return res.json({
        success: true,
        message: 'No report available yet',
        report: null
      });
    }

    res.json({
      success: true,
      report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.get('/repairs', (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const repairs = integrityVerifier.getRepairHistory(parseInt(limit));

    res.json({
      success: true,
      repairs,
      count: repairs.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.post('/start-scheduler', requireAuth, (req, res) => {
  try {
    const { intervalHours = 24 } = req.body;
    const intervalMs = intervalHours * 60 * 60 * 1000;

    integrityVerifier.startPeriodicChecks(intervalMs);

    res.json({
      success: true,
      message: 'Periodic integrity checks started',
      intervalHours,
      intervalMs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.post('/stop-scheduler', requireAuth, (req, res) => {
  try {
    integrityVerifier.stopPeriodicChecks();

    res.json({
      success: true,
      message: 'Periodic integrity checks stopped'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = { router: router, integrityVerifier };
