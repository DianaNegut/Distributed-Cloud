const express = require('express');
const router = express.Router();
const StorageProvider = require('../models/StorageProvider');

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
    const provider = StorageProvider.registerProvider({
      peerId,
      name,
      description,
      totalCapacityGB: parseFloat(totalCapacityGB),
      location,
      uptimeGuarantee: uptimeGuarantee ? parseFloat(uptimeGuarantee) : undefined,
      replicationFactor: replicationFactor ? parseInt(replicationFactor) : undefined
    });
    res.json({
      success: true,
      message: 'Provider registered successfully',
      provider: provider
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

router.post('/:id/heartbeat', (req, res) => {
  try {
    const provider = StorageProvider.heartbeat(req.params.id);
    if (!provider) {
      return res.status(404).json({ success: false, error: 'Provider not found' });
    }
    res.json({ success: true, provider });
  } catch (error) {
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
