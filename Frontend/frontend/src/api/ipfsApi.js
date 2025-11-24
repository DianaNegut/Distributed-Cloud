import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.REACT_APP_API_KEY || 'supersecret';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'x-api-key': API_KEY,
  },
});

// ============ IPFS Local Network ============

export const configureNetwork = (swarmKey, bootstrapNode) =>
  api.post('/configure-network', { swarmKey, bootstrapNode });

export const getPeers = () =>
  api.get('/peers');

export const getBootstrapInfo = () =>
  api.get('/bootstrap-info');

export const joinNetwork = (bootstrapData) =>
  api.post('/join-network', bootstrapData);

export const getStatus = () =>
  api.get('/status');

export const getNetworkInfo = () =>
  api.get('/network-info');

// ============ Docker Cluster API ============

export const dockerCluster = {
  // Get cluster health
  getHealth: async () => {
    const response = await api.get('/docker-cluster/health');
    return response.data;
  },

  // Get cluster status
  getStatus: async () => {
    const response = await api.get('/docker-cluster/status');
    return response.data;
  },

  // Get cluster peers
  getPeers: async () => {
    const response = await api.get('/docker-cluster/peers');
    return response.data;
  },

  // Get all pins
  getPins: async () => {
    const response = await api.get('/docker-cluster/pins');
    return response.data;
  },

  // Get pin status for specific CID
  getPinStatus: async (cid) => {
    const response = await api.get(`/docker-cluster/pin/${cid}`);
    return response.data;
  },

  // Upload file to cluster
  uploadFile: async (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/docker-cluster/add', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
      onUploadProgress: onProgress,
    });
    return response.data;
  },

  // Download file from cluster
  downloadFile: async (cid) => {
    const response = await api.get(`/docker-cluster/download/${cid}`, {
      responseType: 'blob',
      timeout: 30000,
    });
    return response.data;
  },

  // Delete pin from cluster
  deletePin: async (cid) => {
    const response = await api.delete(`/docker-cluster/pin/${cid}`);
    return response.data;
  },
};

// ============ Local IPFS Cluster ============

export const getClusterPeers = async () => {
  const response = await api.get('/cluster/peers');
  return response.data;
};

export const addClusterPeer = async (peerId) => {
  const response = await api.post('/cluster/add', { peerId });
  return response.data;
};

export const removeClusterPeer = async (peerId) => {
  const response = await api.delete(`/cluster/remove/${peerId}`);
  return response.data;
};

// Default export
const ipfsApi = {
  configureNetwork,
  getPeers,
  getBootstrapInfo,
  joinNetwork,
  getStatus,
  dockerCluster,
  getClusterPeers,
  addClusterPeer,
  removeClusterPeer,
};

export default ipfsApi;