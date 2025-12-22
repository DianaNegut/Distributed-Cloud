

const express = require('express');
const router = express.Router();
const FailoverManager = require('../models/FailoverManager');
const DockerClusterClient = require('../utils/dockerClusterClient');
const { requireAuth } = require('../middleware/solidAuth');

const clusterClient = new DockerClusterClient();
const failoverManager = new FailoverManager(clusterClient);


router.get('/status', (req, res) => {
  try {
    const stats = failoverManager.getFailoverStatistics();
    const peerHealth = failoverManager.getPeerHealthStatus();

    res.json({
      success: true,
      failoverSystem: {
        operational: true,
        monitoringActive: stats.monitoringActive
      },
      statistics: stats,
      peerHealth
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.post('/start-monitoring', requireAuth, (req, res) => {
  try {
    const { intervalSeconds = 30 } = req.body;
    failoverManager.startHealthMonitoring(intervalSeconds * 1000);

    res.json({
      success: true,
      message: 'Health monitoring started',
      intervalSeconds
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.post('/stop-monitoring', requireAuth, (req, res) => {
  try {
    failoverManager.stopHealthMonitoring();

    res.json({
      success: true,
      message: 'Health monitoring stopped'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.post('/check-health', async (req, res) => {
  try {
    console.log('[FAILOVER-API] Manual health check requested');
    await failoverManager.performHealthCheck();

    const peerHealth = failoverManager.getPeerHealthStatus();

    res.json({
      success: true,
      message: 'Health check completed',
      peerHealth
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.get('/history', (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const history = failoverManager.getFailoverHistory(parseInt(limit));

    res.json({
      success: true,
      events: history,
      count: history.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.post('/recover/:peerId', requireAuth, async (req, res) => {
  try {
    const { peerId } = req.params;
    const result = await failoverManager.recoverPeer(peerId);

    res.json({
      success: true,
      recovery: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


const setupFailoverWebSocket = (io) => {
  failoverManager.on('failover', (event) => {
    io.emit('failover-event', event);
  });

  failoverManager.on('peer-recovered', (event) => {
    io.emit('peer-recovered', event);
  });
};

module.exports = { router, failoverManager, setupFailoverWebSocket };
