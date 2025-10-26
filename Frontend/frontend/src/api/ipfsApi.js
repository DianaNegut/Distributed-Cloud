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
