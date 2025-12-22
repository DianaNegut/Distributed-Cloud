const fs = require('fs');
const path = require('path');
const { IPFS_PATH } = require('../config/paths');

const PODS_FILE = path.join(IPFS_PATH, 'solid-pods.json');

class SolidPod {
  constructor() {
    this.pods = new Map();
    this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(PODS_FILE)) {
        const data = JSON.parse(fs.readFileSync(PODS_FILE, 'utf8'));
        this.pods = new Map(Object.entries(data.pods || {}));
        console.log(`[SOLID-POD] Loaded ${this.pods.size} PODs`);
      } else {
        this.saveData();
      }
    } catch (error) {
      console.error('[SOLID-POD] Error loading data:', error.message);
      this.pods = new Map();
    }
  }

  saveData() {
    try {
      const dir = path.dirname(PODS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        pods: Object.fromEntries(this.pods)
      };

      fs.writeFileSync(PODS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[SOLID-POD] Error saving data:', error.message);
      throw error;
    }
  }

  generateWebId(username, baseUrl = 'http://localhost:3001') {
    return `${baseUrl}/solid/${username}/profile/card#me`;
  }

  createPod({ username, ownerId, name, description = '' }) {
    if (!username || !ownerId) {
      throw new Error('username and ownerId are required');
    }

    for (const pod of this.pods.values()) {
      if (pod.username === username) {
        throw new Error(`POD with username '${username}' already exists`);
      }
    }

    const podId = `pod-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const webId = this.generateWebId(username);

    const pod = {
      id: podId,
      username,
      ownerId,
      name: name || username,
      description,
      webId,

      storage: {
        rootCid: null,
        totalBytes: 0,
        fileCount: 0,
        lastSync: null
      },

      containers: {
        profile: { cid: null, path: '/profile/' },
        private: { cid: null, path: '/private/' },
        public: { cid: null, path: '/public/' },
        inbox: { cid: null, path: '/inbox/' },
        settings: { cid: null, path: '/settings/' }
      },

      acl: {
        owner: ownerId,
        public: [],
        readers: [],
        writers: [],
        controllers: [ownerId]
      },

      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      status: 'active',

      version: 1
    };

    this.pods.set(podId, pod);
    this.saveData();

    console.log(`[SOLID-POD] Created POD: ${podId} for user ${username} (${webId})`);
    return pod;
  }

  getPod(podId) {
    const pod = this.pods.get(podId);
    if (!pod) {
      throw new Error('POD not found');
    }
    return pod;
  }

  getPodByUsername(username) {
    for (const pod of this.pods.values()) {
      if (pod.username === username) {
        return pod;
      }
    }
    throw new Error('POD not found');
  }

  getPodByWebId(webId) {
    for (const pod of this.pods.values()) {
      if (pod.webId === webId) {
        return pod;
      }
    }
    throw new Error('POD not found');
  }

  getPodsByOwner(ownerId) {
    const pods = [];
    for (const pod of this.pods.values()) {
      if (pod.ownerId === ownerId) {
        pods.push(pod);
      }
    }
    return pods;
  }

  getAllPods(filters = {}) {
    let pods = Array.from(this.pods.values());

    if (filters.status) {
      pods = pods.filter(p => p.status === filters.status);
    }

    if (filters.ownerId) {
      pods = pods.filter(p => p.ownerId === filters.ownerId);
    }

    return pods;
  }

  updatePod(podId, updates) {
    const pod = this.getPod(podId);

    const immutableFields = ['id', 'webId', 'ownerId', 'created'];
    immutableFields.forEach(field => delete updates[field]);

    Object.assign(pod, updates);
    pod.updated = new Date().toISOString();
    pod.version += 1;

    this.saveData();
    console.log(`[SOLID-POD] Updated POD: ${podId}`);
    return pod;
  }

  updateStorage(podId, storageInfo) {
    const pod = this.getPod(podId);

    pod.storage = {
      ...pod.storage,
      ...storageInfo,
      lastSync: new Date().toISOString()
    };

    pod.updated = new Date().toISOString();
    this.saveData();

    return pod;
  }

  updateContainerCid(podId, containerName, cid) {
    const pod = this.getPod(podId);

    if (!pod.containers[containerName]) {
      throw new Error(`Container '${containerName}' not found`);
    }

    pod.containers[containerName].cid = cid;
    pod.updated = new Date().toISOString();
    this.saveData();

    console.log(`[SOLID-POD] Updated container ${containerName} CID: ${cid}`);
    return pod;
  }

  checkPermission(podId, userId, permission = 'read') {
    const pod = this.getPod(podId);

    if (pod.ownerId === userId || pod.acl.controllers.includes(userId)) {
      return true;
    }

    switch (permission) {
      case 'read':
        return pod.acl.readers.includes(userId) || pod.acl.writers.includes(userId);
      case 'write':
        return pod.acl.writers.includes(userId);
      case 'control':
        return pod.acl.controllers.includes(userId);
      default:
        return false;
    }
  }

  grantPermission(podId, userId, permission = 'read') {
    const pod = this.getPod(podId);

    switch (permission) {
      case 'read':
        if (!pod.acl.readers.includes(userId)) {
          pod.acl.readers.push(userId);
        }
        break;
      case 'write':
        if (!pod.acl.writers.includes(userId)) {
          pod.acl.writers.push(userId);
        }
        if (!pod.acl.readers.includes(userId)) {
          pod.acl.readers.push(userId);
        }
        break;
      case 'control':
        if (!pod.acl.controllers.includes(userId)) {
          pod.acl.controllers.push(userId);
        }
        break;
      default:
        throw new Error('Invalid permission type');
    }

    pod.updated = new Date().toISOString();
    this.saveData();

    console.log(`[SOLID-POD] Granted ${permission} permission to ${userId} for POD ${podId}`);
    return pod;
  }

  revokePermission(podId, userId, permission = 'read') {
    const pod = this.getPod(podId);

    switch (permission) {
      case 'read':
        pod.acl.readers = pod.acl.readers.filter(id => id !== userId);
        break;
      case 'write':
        pod.acl.writers = pod.acl.writers.filter(id => id !== userId);
        break;
      case 'control':
        pod.acl.controllers = pod.acl.controllers.filter(id => id !== userId);
        break;
      case 'all':
        pod.acl.readers = pod.acl.readers.filter(id => id !== userId);
        pod.acl.writers = pod.acl.writers.filter(id => id !== userId);
        pod.acl.controllers = pod.acl.controllers.filter(id => id !== userId);
        break;
      default:
        throw new Error('Invalid permission type');
    }

    pod.updated = new Date().toISOString();
    this.saveData();

    console.log(`[SOLID-POD] Revoked ${permission} permission from ${userId} for POD ${podId}`);
    return pod;
  }

  setPublicResource(podId, resourcePath) {
    const pod = this.getPod(podId);

    if (!pod.acl.public.includes(resourcePath)) {
      pod.acl.public.push(resourcePath);
    }

    pod.updated = new Date().toISOString();
    this.saveData();

    console.log(`[SOLID-POD] Set resource ${resourcePath} as public for POD ${podId}`);
    return pod;
  }

  deletePod(podId) {
    const pod = this.getPod(podId);
    this.pods.delete(podId);
    this.saveData();

    console.log(`[SOLID-POD] Deleted POD: ${podId}`);
    return { success: true, deletedPod: pod };
  }

  /**
   * Obține statistici despre POD-uri
   */
  getStatistics() {
    const pods = Array.from(this.pods.values());

    return {
      totalPods: pods.length,
      activePods: pods.filter(p => p.status === 'active').length,
      totalStorage: pods.reduce((sum, p) => sum + p.storage.totalBytes, 0),
      totalFiles: pods.reduce((sum, p) => sum + p.storage.fileCount, 0),
      uniqueOwners: new Set(pods.map(p => p.ownerId)).size
    };
  }
}

// Singleton instance
module.exports = new SolidPod();
