const axios = require('axios');

class DockerClusterClient {
  constructor() {
  
    const nodesString = process.env.DOCKER_CLUSTER_NODES || 'http://localhost:9094';
    this.nodes = nodesString.split(',').map(n => n.trim());
    this.timeout = parseInt(process.env.DOCKER_CLUSTER_TIMEOUT) || 5000;
    this.maxRetries = parseInt(process.env.DOCKER_CLUSTER_MAX_RETRIES) || 3;
    
    console.log(`[DOCKER-CLUSTER-CLIENT] Inițializat cu ${this.nodes.length} noduri`);
  }

 
  async checkNodeHealth(nodeUrl) {
    try {
      const response = await axios.get(`${nodeUrl}/health`, { 
        timeout: 2000,
        validateStatus: (status) => status < 500
      });
      return response.status === 200 || response.status === 204;
    } catch (error) {
      return false;
    }
  }

  async getAvailableNode() {
    for (const node of this.nodes) {
      const isHealthy = await this.checkNodeHealth(node);
      if (isHealthy) {
        console.log(`[DOCKER-CLUSTER-CLIENT] Nod disponibil: ${node}`);
        return node;
      }
    }
    throw new Error('Niciun nod din cluster nu este disponibil. Verifică că Docker Compose rulează.');
  }

  async executeWithRetry(requestFn, retries = this.maxRetries) {
    let lastError;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const node = await this.getAvailableNode();
        const result = await requestFn(node);
        return result;
      } catch (error) {
        lastError = error;
        console.error(`[DOCKER-CLUSTER-CLIENT] Încercare ${attempt}/${retries} eșuată:`, error.message);
        
        if (attempt < retries) {

          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`Request eșuat după ${retries} încercări: ${lastError.message}`);
  }

  async get(endpoint) {
    return this.executeWithRetry(async (node) => {
      const response = await axios.get(`${node}${endpoint}`, {
        timeout: this.timeout,
        headers: {
          'Accept': 'application/json'
        },
        transformResponse: [(data) => {
      
          if (typeof data === 'string') {
            console.log(`[DOCKER-CLUSTER-CLIENT] Raw response for ${endpoint} (first 500 chars):`, data.substring(0, 500));
            if (endpoint === '/pins' || endpoint === '/peers') {
              try {
                const lines = data.trim().split('\n').filter(line => line.trim());
                console.log(`[DOCKER-CLUSTER-CLIENT] Found ${lines.length} lines in ${endpoint} response`);
                
                if (endpoint === '/pins') {
                  const pinsMap = {};
                  for (const line of lines) {
                    try {
                      const pinData = JSON.parse(line);
                      if (pinData.cid) {
                        const cid = pinData.cid;
                        pinsMap[cid] = pinData;
                        console.log(`[DOCKER-CLUSTER-CLIENT] Added pin: ${cid}`);
                      }
                    } catch (e) {
                      console.warn(`[DOCKER-CLUSTER-CLIENT] Skipping invalid pin JSON line:`, e.message);
                    }
                  }
                  console.log(`[DOCKER-CLUSTER-CLIENT] Total pins mapped: ${Object.keys(pinsMap).length}`);
                  return pinsMap;
                } else if (endpoint === '/peers') {
                  const peersArray = [];
                  for (const line of lines) {
                    try {
                      const peerData = JSON.parse(line);
                      peersArray.push(peerData);
                      console.log(`[DOCKER-CLUSTER-CLIENT] Added peer: ${peerData.peername || peerData.id}`);
                    } catch (e) {
                      console.warn(`[DOCKER-CLUSTER-CLIENT] Skipping invalid peer JSON line:`, e.message);
                    }
                  }
                  console.log(`[DOCKER-CLUSTER-CLIENT] Total peers parsed: ${peersArray.length}`);
                  return peersArray;
                }
              } catch (e) {
                console.error(`[DOCKER-CLUSTER-CLIENT] Eroare parsare ${endpoint}:`, e.message);
                return endpoint === '/pins' ? {} : [];
              }
            }
       
            try {
              return JSON.parse(data);
            } catch (e) {
              return data;
            }
          }
          return data;
        }]
      });
      
      return response.data;
    });
  }

 
  async post(endpoint, data, config = {}) {
    return this.executeWithRetry(async (node) => {
      const response = await axios.post(`${node}${endpoint}`, data, {
        timeout: config.timeout || this.timeout,
        headers: config.headers || {
          'Content-Type': 'application/json'
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        ...config
      });
      return response.data;
    });
  }

  
  async delete(endpoint) {
    return this.executeWithRetry(async (node) => {
      const response = await axios.delete(`${node}${endpoint}`, {
        timeout: this.timeout
      });
      return response.data;
    });
  }

  
  async getClusterInfo() {
    try {
      const [peers, pins, health] = await Promise.allSettled([
        this.get('/peers'),
        this.get('/pins'),
        this.checkAllNodes()
      ]);

      const pinsData = pins.status === 'fulfilled' ? pins.value : {};
      console.log('[DOCKER-CLUSTER-CLIENT] getClusterInfo - pins type:', typeof pinsData);
      console.log('[DOCKER-CLUSTER-CLIENT] getClusterInfo - pins keys:', Object.keys(pinsData));

      return {
        totalNodes: this.nodes.length,
        peers: peers.status === 'fulfilled' ? peers.value : [],
        pins: pinsData,
        nodesHealth: health.status === 'fulfilled' ? health.value : {},
        nodes: this.nodes
      };
    } catch (error) {
      throw new Error(`Nu s-au putut obține informațiile clusterului: ${error.message}`);
    }
  }

 
  async checkAllNodes() {
    const healthChecks = await Promise.all(
      this.nodes.map(async (node) => {
        const isHealthy = await this.checkNodeHealth(node);
        return { node, healthy: isHealthy };
      })
    );

    return healthChecks.reduce((acc, { node, healthy }) => {
      acc[node] = healthy;
      return acc;
    }, {});
  }

 
  extractCID(data) {
    if (!data) return null;

   
    if (typeof data === 'string') {
      const match = data.match(/Qm[a-zA-Z0-9]{44,}|baf[a-zA-Z0-9]{50,}/);
      return match ? match[0] : null;
    }
    

    if (typeof data === 'object') {
      
      if (data.cid) {
       
        return typeof data.cid === 'string' ? data.cid : (data.cid['/'] || data.cid);
      }
      if (data.hash) return data.hash;
      if (data.Hash) return data.Hash;
      if (data.key) return data.key;
      if (data.Key) return data.Key;
      
      
      if (data.data && data.data.cid) {
        return typeof data.data.cid === 'string' ? data.data.cid : data.data.cid['/'];
      }
      
    
      try {
        const jsonStr = JSON.stringify(data);
        const match = jsonStr.match(/Qm[a-zA-Z0-9]{44,}|baf[a-zA-Z0-9]{50,}/);
        return match ? match[0] : null;
      } catch (e) {
        return null;
      }
    }
    
    return null;
  }


  getIPFSGateways() {
    return [
      'http://localhost:8080',
      'http://localhost:8081',
      'http://localhost:8082',
      'http://localhost:8083',
      'http://localhost:8084'
    ];
  }
}

module.exports = new DockerClusterClient();
