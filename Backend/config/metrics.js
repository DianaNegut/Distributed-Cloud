const promClient = require('prom-client');

const register = new promClient.Registry();
promClient.collectDefaultMetrics({
  register,
  prefix: 'ipfs_backend_',
});
const ipfsOperationsCounter = new promClient.Counter({
  name: 'ipfs_operations_total',
  help: 'Total number of IPFS operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});
const ipfsOperationDuration = new promClient.Histogram({
  name: 'ipfs_operation_duration_seconds',
  help: 'Duration of IPFS operations in seconds',
  labelNames: ['operation'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});
const clusterNodesGauge = new promClient.Gauge({
  name: 'ipfs_cluster_nodes_total',
  help: 'Total number of cluster nodes',
  labelNames: ['status'],
  registers: [register],
});
const clusterPinsGauge = new promClient.Gauge({
  name: 'ipfs_cluster_pins_total',
  help: 'Total number of pinned items in cluster',
  registers: [register],
});
const networkPeersGauge = new promClient.Gauge({
  name: 'ipfs_network_peers_total',
  help: 'Total number of connected peers',
  registers: [register],
});
const fileUploadCounter = new promClient.Counter({
  name: 'ipfs_file_uploads_total',
  help: 'Total number of file uploads',
  labelNames: ['status'],
  registers: [register],
});
const fileUploadSize = new promClient.Histogram({
  name: 'ipfs_file_upload_size_bytes',
  help: 'Size of uploaded files in bytes',
  buckets: [1024, 10240, 102400, 1048576, 10485760, 104857600],
  registers: [register],
});
const apiRequestDuration = new promClient.Histogram({
  name: 'api_request_duration_seconds',
  help: 'Duration of API requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});
const apiRequestCounter = new promClient.Counter({
  name: 'api_requests_total',
  help: 'Total number of API requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});
const healthCheckGauge = new promClient.Gauge({
  name: 'health_check_status',
  help: 'Health check status (1 = healthy, 0 = unhealthy)',
  labelNames: ['component'],
  registers: [register],
});
module.exports = {
  register,
  metrics: {
    ipfsOperationsCounter,
    ipfsOperationDuration,
    clusterNodesGauge,
    clusterPinsGauge,
    networkPeersGauge,
    fileUploadCounter,
    fileUploadSize,
    apiRequestDuration,
    apiRequestCounter,
    healthCheckGauge,
  },
};
