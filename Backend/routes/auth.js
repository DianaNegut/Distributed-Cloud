

const express = require('express');
const router = express.Router();
const SolidAuth = require('../models/SolidAuth');
const SolidPod = require('../models/SolidPod');
const SolidIPFSAdapter = require('../utils/solidIPFSAdapter');
const DockerClusterClient = require('../utils/dockerClusterClient');
const { requireAuth } = require('../middleware/solidAuth');


const clusterClient = new DockerClusterClient();
const solidAdapter = new SolidIPFSAdapter(clusterClient);


router.post('/register', async (req, res) => {
  console.log('[AUTH] Registration request...');

  try {
    const { username, password, email, name, description } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'username and password are required'
      });
    }


    const user = SolidAuth.register(username, password, email);


    const pod = SolidPod.createPod({
      username,
      ownerId: username,
      name: name || `${username}'s POD`,
      description: description || 'Personal data store'
    });


    console.log('[AUTH] Initializing POD structure on IPFS...');
    const containerCids = await solidAdapter.initializePodStructure(pod);


    for (const [container, cid] of Object.entries(containerCids)) {
      SolidPod.updateContainerCid(pod.id, container, cid);
    }


    SolidAuth.setPodForUser(username, pod.id, pod.webId);

    console.log(`[AUTH] User registered successfully: ${username}`);

    res.json({
      success: true,
      message: 'User registered successfully',
      user: {
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
      },
      pod: {
        id: pod.id,
        username: pod.username,
        webId: pod.webId
      }
    });
  } catch (error) {
    console.error('[AUTH] Registration error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});


router.post('/login', (req, res) => {
  console.log('[AUTH] Login request...');

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'username and password are required'
      });
    }


    const session = SolidAuth.login(username, password);

    console.log(`[AUTH] User logged in successfully: ${username}`);

    res.json({
      success: true,
      message: 'Login successful',
      session
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
});


router.post('/logout', requireAuth, (req, res) => {
  try {
    SolidAuth.logout(req.sessionToken);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});


router.get('/me', requireAuth, (req, res) => {
  try {
    const user = SolidAuth.getUser(req.user.username);


    let pod = null;
    if (user.podId) {
      try {
        pod = SolidPod.getPod(user.podId);
      } catch (error) {
        console.warn('[AUTH] POD not found:', error.message);
      }
    }

    res.json({
      success: true,
      user,
      pod: pod ? {
        id: pod.id,
        username: pod.username,
        name: pod.name,
        webId: pod.webId,
        storage: pod.storage
      } : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.post('/change-password', requireAuth, (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'oldPassword and newPassword are required'
      });
    }

    SolidAuth.changePassword(req.user.username, oldPassword, newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});


router.get('/status', (req, res) => {
  try {
    const stats = SolidAuth.getStatistics();

    res.json({
      success: true,
      message: 'Authentication system operational',
      statistics: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
