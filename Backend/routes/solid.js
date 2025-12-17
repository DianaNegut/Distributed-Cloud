/**
 * Solid POD API Routes
 * 
 * Endpoints pentru gestionarea POD-urilor Solid stocate pe IPFS
 * Implementează funcționalități compatibile cu specificația Solid
 */

const express = require('express');
const router = express.Router();
const SolidPod = require('../models/SolidPod');
const SolidIPFSAdapter = require('../utils/solidIPFSAdapter');
const DockerClusterClient = require('../utils/dockerClusterClient');
const { requireAuth, optionalAuth } = require('../middleware/solidAuth');

// Inițializare adapter IPFS pentru Solid
const clusterClient = new DockerClusterClient();
const solidAdapter = new SolidIPFSAdapter(clusterClient);

/**
 * GET /api/solid/status
 * Status sistem Solid-IPFS
 */
router.get('/status', (req, res) => {
  try {
    const stats = SolidPod.getStatistics();
    
    res.json({
      success: true,
      message: 'Solid-IPFS system operational',
      system: {
        enabled: true,
        version: '1.0',
        specification: 'Solid Protocol v0.9',
        storage: 'IPFS',
        features: [
          'WebID',
          'LDP Containers',
          'Access Control Lists (ACL)',
          'IPFS Content-Addressable Storage',
          'Multi-node Replication'
        ]
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

/**
 * POST /api/solid/pods
 * Creează un POD nou
 * 
 * Body:
 * {
 *   "username": "alice",
 *   "ownerId": "user-123",
 *   "name": "Alice's POD",
 *   "description": "Personal data store"
 * }
 */
router.post('/pods', async (req, res) => {
  console.log('[SOLID-API] Creating new POD...');
  
  try {
    const { username, ownerId, name, description } = req.body;

    if (!username || !ownerId) {
      return res.status(400).json({
        success: false,
        error: 'username and ownerId are required'
      });
    }

    // Validare username (doar alfanumeric și underscore)
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({
        success: false,
        error: 'username can only contain alphanumeric characters, hyphens and underscores'
      });
    }

    // Creează POD
    const pod = SolidPod.createPod({
      username,
      ownerId,
      name,
      description
    });

    // Inițializează structura pe IPFS
    console.log('[SOLID-API] Initializing POD structure on IPFS...');
    const containerCids = await solidAdapter.initializePodStructure(pod);

    // Actualizează CID-urile în POD
    for (const [container, cid] of Object.entries(containerCids)) {
      SolidPod.updateContainerCid(pod.id, container, cid);
    }

    // Creează ACL pentru POD
    const aclData = {
      resourcePath: `/${username}/`,
      owner: pod.webId,
      public: false
    };
    const aclCid = await solidAdapter.uploadACL(aclData);

    const updatedPod = SolidPod.getPod(pod.id);

    console.log(`[SOLID-API] POD created successfully: ${pod.id}`);

    res.json({
      success: true,
      message: 'POD created successfully',
      pod: {
        ...updatedPod,
        aclCid
      },
      links: {
        webId: updatedPod.webId,
        profile: `/api/solid/${username}/profile/card`,
        public: `/api/solid/${username}/public/`,
        private: `/api/solid/${username}/private/`,
        inbox: `/api/solid/${username}/inbox/`,
        settings: `/api/solid/${username}/settings/`
      }
    });
  } catch (error) {
    console.error('[SOLID-API] Error creating POD:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/solid/pods
 * Listează toate POD-urile (cu filtrare opțională)
 */
router.get('/pods', (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      ownerId: req.query.ownerId
    };

    const pods = SolidPod.getAllPods(filters);

    res.json({
      success: true,
      total: pods.length,
      pods: pods.map(pod => ({
        id: pod.id,
        username: pod.username,
        name: pod.name,
        webId: pod.webId,
        ownerId: pod.ownerId,
        storage: pod.storage,
        created: pod.created,
        updated: pod.updated,
        status: pod.status
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/solid/pods/:podId
 * Obține detalii despre un POD specific
 */
router.get('/pods/:podId', (req, res) => {
  try {
    const pod = SolidPod.getPod(req.params.podId);

    res.json({
      success: true,
      pod
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/solid/:username
 * Obține POD după username (compatibility endpoint)
 */
router.get('/:username', (req, res) => {
  try {
    const pod = SolidPod.getPodByUsername(req.params.username);

    res.json({
      success: true,
      pod,
      links: {
        webId: pod.webId,
        profile: `/api/solid/${pod.username}/profile/card`,
        public: `/api/solid/${pod.username}/public/`,
        private: `/api/solid/${pod.username}/private/`,
        inbox: `/api/solid/${pod.username}/inbox/`
      }
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: 'POD not found'
    });
  }
});

/**
 * GET /api/solid/:username/profile/card
 * Obține WebID Profile Card (în format Turtle RDF)
 */
router.get('/:username/profile/card', async (req, res) => {
  try {
    const pod = SolidPod.getPodByUsername(req.params.username);
    const profileCid = pod.containers.profile.cid;

    if (!profileCid) {
      return res.status(404).json({
        success: false,
        error: 'Profile not initialized'
      });
    }

    // Citește profilul de pe IPFS
    const profileContent = await solidAdapter.readFileFromPod(profileCid);

    // Returnează ca text/turtle pentru compatibilitate Solid
    res.set('Content-Type', 'text/turtle');
    res.set('Link', `<${pod.webId}.acl>; rel="acl"`);
    res.send(profileContent);
  } catch (error) {
    console.error('[SOLID-API] Error getting profile:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/solid/:username/:container/upload
 * Upload fișier în container POD
 * Container poate fi: public, private, inbox, settings
 */
router.post('/:username/:container/upload', requireAuth, async (req, res) => {
  console.log(`[SOLID-API] Upload to ${req.params.username}/${req.params.container}`);
  
  try {
    const { username, container } = req.params;
    const pod = SolidPod.getPodByUsername(username);

    // Verifică permisiuni - utilizatorul autentificat
    const userId = req.user.username;

    // Verifică dacă containerul există
    if (!pod.containers[container]) {
      return res.status(404).json({
        success: false,
        error: `Container '${container}' not found`
      });
    }

    // Verifică permisiuni de scriere
    const canWrite = SolidPod.checkPermission(pod.id, userId, 'write') || 
                     pod.ownerId === userId;
    
    if (!canWrite && container !== 'public') {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    // Verifică fișier
    if (!req.files || !req.files.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const file = req.files.file;
    const containerPath = pod.containers[container].path;

    // Upload fișier
    const result = await solidAdapter.uploadFileToPod(file, containerPath, {
      uploadedBy: userId,
      podId: pod.id,
      container
    });

    // Actualizează statistici POD
    const currentStorage = pod.storage;
    SolidPod.updateStorage(pod.id, {
      fileCount: currentStorage.fileCount + 1,
      totalBytes: currentStorage.totalBytes + file.size
    });

    console.log(`[SOLID-API] File uploaded successfully: ${result.cid}`);

    res.json({
      success: true,
      message: 'File uploaded to POD',
      file: {
        name: file.name,
        size: file.size,
        cid: result.cid,
        container,
        path: `${containerPath}${file.name}`,
        url: `/api/solid/${username}/${container}/${result.cid}`
      }
    });
  } catch (error) {
    console.error('[SOLID-API] Error uploading file:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/solid/:username/:container/:cid
 * Download fișier din container POD
 */
router.get('/:username/:container/:cid', optionalAuth, async (req, res) => {
  try {
    const { username, container, cid } = req.params;
    const pod = SolidPod.getPodByUsername(username);

    // Verifică dacă containerul există
    if (!pod.containers[container]) {
      return res.status(404).json({
        success: false,
        error: `Container '${container}' not found`
      });
    }

    // Pentru public, nu trebuie autentificare
    // Pentru alte containere, verifică permisiuni
    if (container !== 'public') {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const userId = req.user.username;
      const canRead = SolidPod.checkPermission(pod.id, userId, 'read') || 
                      pod.ownerId === userId;
      
      if (!canRead) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }
    }

    // Citește fișierul de pe IPFS
    const fileContent = await solidAdapter.readFileFromPod(cid);

    // Setează headers
    res.set('Content-Type', 'application/octet-stream');
    res.set('Content-Disposition', `attachment`);
    res.send(fileContent);
  } catch (error) {
    console.error('[SOLID-API] Error downloading file:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/solid/pods/:podId/permissions
 * Actualizează permisiuni pentru POD
 */
router.put('/pods/:podId/permissions', (req, res) => {
  try {
    const { podId } = req.params;
    const { action, userId, permission } = req.body;

    if (!action || !userId || !permission) {
      return res.status(400).json({
        success: false,
        error: 'action, userId, and permission are required'
      });
    }

    let pod;
    if (action === 'grant') {
      pod = SolidPod.grantPermission(podId, userId, permission);
    } else if (action === 'revoke') {
      pod = SolidPod.revokePermission(podId, userId, permission);
    } else {
      return res.status(400).json({
        success: false,
        error: 'action must be "grant" or "revoke"'
      });
    }

    res.json({
      success: true,
      message: `Permission ${action}ed successfully`,
      pod: {
        id: pod.id,
        acl: pod.acl
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/solid/pods/:podId/verify
 * Verifică integritatea unui POD
 */
router.post('/pods/:podId/verify', async (req, res) => {
  try {
    const pod = SolidPod.getPod(req.params.podId);
    const integrity = await solidAdapter.verifyPodIntegrity(pod);

    res.json({
      success: true,
      podId: pod.id,
      integrity
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/solid/pods/:podId
 * Șterge un POD
 */
router.delete('/pods/:podId', (req, res) => {
  try {
    const result = SolidPod.deletePod(req.params.podId);

    res.json({
      success: true,
      message: 'POD deleted successfully',
      deletedPod: {
        id: result.deletedPod.id,
        username: result.deletedPod.username
      }
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/solid/webid/:webId
 * Obține POD după WebID (URL-encoded)
 */
router.get('/webid/:webId', (req, res) => {
  try {
    const webId = decodeURIComponent(req.params.webId);
    const pod = SolidPod.getPodByWebId(webId);

    res.json({
      success: true,
      pod
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: 'POD not found'
    });
  }
});

module.exports = router;
