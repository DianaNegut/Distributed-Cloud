const express = require('express');
const router = express.Router();
const logger = require('../config/logger');


router.post('/webhook', (req, res) => {
  const alerts = req.body.alerts || [];
  alerts.forEach(alert => {
    const { status, labels, annotations } = alert;
    const alertName = labels.alertname;
    const severity = labels.severity || 'info';
    if (status === 'firing') {
      logger.warn(`ALERT FIRING: ${alertName}`, {
        severity,
        summary: annotations.summary,
        description: annotations.description,
        labels
      });
    } else if (status === 'resolved') {
      logger.info(`ALERT RESOLVED: ${alertName}`, {
        severity,
        labels
      });
    }
  });
  res.json({ received: true });
});


router.post('/critical', (req, res) => {
  const alerts = req.body.alerts || [];
  alerts.forEach(alert => {
    if (alert.status === 'firing') {
      logger.error(`CRITICAL ALERT: ${alert.labels.alertname}`, {
        summary: alert.annotations.summary,
        description: alert.annotations.description,
        labels: alert.labels
      });
    }
  });
  res.json({ received: true });
});


router.post('/warning', (req, res) => {
  const alerts = req.body.alerts || [];
  alerts.forEach(alert => {
    if (alert.status === 'firing') {
      logger.warn(`WARNING ALERT: ${alert.labels.alertname}`, {
        summary: alert.annotations.summary,
        description: alert.annotations.description,
        labels: alert.labels
      });
    }
  });
  res.json({ received: true });
});


router.get('/status', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Use Alertmanager API at http://localhost:9093/api/v1/alerts'
    });
  } catch (error) {
    logger.error(`Error fetching alerts: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
