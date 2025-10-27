import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.REACT_APP_API_KEY || 'supersecret';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'x-api-key': API_KEY,
  },
});

export const configureNetwork = (swarmKey, bootstrapNode) =>
  api.post('/configure-network', { swarmKey, bootstrapNode });

export const getPeers = () =>
  api.get('/peers');



// ... (păstrează funcțiile existente: bootstrapNode, joinNetwork etc.)

// Funcții noi pentru Cluster
export const getClusterPeers = async () => {
  try {
    const response = await api.get('/cluster/peers');
    return response.data; // Returnează lista de peers
  } catch (error) {
    console.error('Error fetching cluster peers:', error);
    throw error; // Aruncă eroarea pentru a o gestiona în componentă
  }
};

export const addClusterPeer = async (peerId) => {
  try {
    const response = await api.post('/cluster/add', { peerId }); // Trimite peerId în body
    return response.data; // Returnează răspunsul (ex: mesaj de succes)
  } catch (error) {
    console.error('Error adding cluster peer:', error);
    throw error;
  }
};

export const removeClusterPeer = async (peerId) => {
  try {
    const response = await api.delete(`/cluster/remove/${peerId}`); // Trimite peerId în URL
    return response.data; // Returnează răspunsul
  } catch (error) {
    console.error('Error removing cluster peer:', error);
    throw error;
  }
};

// ... (exportă și restul funcțiilor)
export default {
  // ... existing exports
  getClusterPeers,
  addClusterPeer,
  removeClusterPeer,
};