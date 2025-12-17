/**
 * Solid POD Model
 * 
 * Un POD (Personal Online Datastore) este un container de date personal
 * conform specificației Solid (https://solidproject.org/)
 * 
 * Acest model stochează metadata POD-urilor și utilizează IPFS pentru persistență
 */

const fs = require('fs');
const path = require('path');
const { IPFS_PATH } = require('../config/paths');

const PODS_FILE = path.join(IPFS_PATH, 'solid-pods.json');

class SolidPod {
  constructor() {
    this.pods = new Map();
    this.loadData();
  }

  /**
   * Încarcă date POD-uri din storage
   */
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

  /**
   * Salvează date POD-uri în storage
   */
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

  /**
   * Generează WebID pentru utilizator
   * WebID este un URI unic care identifică un utilizator în ecosistema Solid
   * 
   * @param {string} username - Numele utilizatorului
   * @param {string} baseUrl - URL-ul de bază al serverului
   * @returns {string} WebID URI
   */
  generateWebId(username, baseUrl = 'http://localhost:3001') {
    return `${baseUrl}/solid/${username}/profile/card#me`;
  }

  /**
   * Creează un POD nou pentru utilizator
   * 
   * @param {Object} params
   * @param {string} params.username - Numele utilizatorului (unic)
   * @param {string} params.ownerId - ID-ul proprietarului (userId/peerId)
   * @param {string} params.name - Nume afișat
   * @param {string} params.description - Descriere POD
   * @returns {Object} POD creat
   */
  createPod({ username, ownerId, name, description = '' }) {
    if (!username || !ownerId) {
      throw new Error('username and ownerId are required');
    }

    // Verifică dacă username-ul există deja
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
      
      // Storage info
      storage: {
        rootCid: null, // CID-ul root al POD-ului în IPFS
        totalBytes: 0,
        fileCount: 0,
        lastSync: null
      },

      // Structura standard Solid
      containers: {
        profile: { cid: null, path: '/profile/' },
        private: { cid: null, path: '/private/' },
        public: { cid: null, path: '/public/' },
        inbox: { cid: null, path: '/inbox/' },
        settings: { cid: null, path: '/settings/' }
      },

      // ACL (Access Control List)
      acl: {
        owner: ownerId,
        public: [], // Resurse accesibile public
        readers: [], // Utilizatori cu permisiuni de citire
        writers: [], // Utilizatori cu permisiuni de scriere
        controllers: [ownerId] // Utilizatori cu control complet
      },

      // Metadata
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      status: 'active',
      
      // Versioning pentru LDP compatibility
      version: 1
    };

    this.pods.set(podId, pod);
    this.saveData();

    console.log(`[SOLID-POD] Created POD: ${podId} for user ${username} (${webId})`);
    return pod;
  }

  /**
   * Obține POD după ID
   */
  getPod(podId) {
    const pod = this.pods.get(podId);
    if (!pod) {
      throw new Error('POD not found');
    }
    return pod;
  }

  /**
   * Obține POD după username
   */
  getPodByUsername(username) {
    for (const pod of this.pods.values()) {
      if (pod.username === username) {
        return pod;
      }
    }
    throw new Error('POD not found');
  }

  /**
   * Obține POD după WebID
   */
  getPodByWebId(webId) {
    for (const pod of this.pods.values()) {
      if (pod.webId === webId) {
        return pod;
      }
    }
    throw new Error('POD not found');
  }

  /**
   * Obține toate POD-urile unui proprietar
   */
  getPodsByOwner(ownerId) {
    const pods = [];
    for (const pod of this.pods.values()) {
      if (pod.ownerId === ownerId) {
        pods.push(pod);
      }
    }
    return pods;
  }

  /**
   * Obține toate POD-urile (cu filtrare opțională)
   */
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

  /**
   * Actualizează un POD
   */
  updatePod(podId, updates) {
    const pod = this.getPod(podId);

    // Nu permite schimbarea anumitor câmpuri
    const immutableFields = ['id', 'webId', 'ownerId', 'created'];
    immutableFields.forEach(field => delete updates[field]);

    Object.assign(pod, updates);
    pod.updated = new Date().toISOString();
    pod.version += 1;

    this.saveData();
    console.log(`[SOLID-POD] Updated POD: ${podId}`);
    return pod;
  }

  /**
   * Actualizează storage info pentru POD
   */
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

  /**
   * Actualizează CID pentru un container
   */
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

  /**
   * Verifică permisiuni de acces pentru un utilizator
   * 
   * @param {string} podId - ID POD
   * @param {string} userId - ID utilizator
   * @param {string} permission - Tip permisiune ('read', 'write', 'control')
   * @returns {boolean} True dacă utilizatorul are permisiunea
   */
  checkPermission(podId, userId, permission = 'read') {
    const pod = this.getPod(podId);

    // Owner și controllers au toate permisiunile
    if (pod.ownerId === userId || pod.acl.controllers.includes(userId)) {
      return true;
    }

    // Verifică permisiuni specifice
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

  /**
   * Acordă permisiune unui utilizator
   */
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

  /**
   * Revocă permisiune pentru un utilizator
   */
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

  /**
   * Marchează resurse ca publice
   */
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

  /**
   * Șterge un POD
   */
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
