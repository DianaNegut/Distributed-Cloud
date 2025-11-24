# How to Connect to the Private IPFS Network

## Prerequisites
- IPFS (kubo) installed on your machine
- The swarm key from the network administrator

## Steps to Connect

### 1. Get Network Information

For the local Docker cluster setup:
- **Swarm Key**: Located at `Infrastructura/swarm.key`
- **Bootstrap Node**: `ipfs-node-1` running on Docker
- **API Endpoint**: `http://localhost:3001/api/peers` (requires API key)

To get the bootstrap node peer ID:
```powershell
docker exec ipfs-node-1 ipfs id -f="<id>"
```

### 2. Create the Swarm Key File

Create the swarm key file in your IPFS directory:

**Windows:**
```powershell
# Copy the swarm.key from the infrastructure folder
Copy-Item -Path "Infrastructura\swarm.key" -Destination "$env:USERPROFILE\.ipfs\swarm.key"

# Or manually create it with the content from Infrastructura/swarm.key
# The swarm key should be:
# /key/swarm/psk/1.0.0/
# /base16/
# 0011223344556677889900112233445500112233445566778899001122334455
```

**Linux/Mac:**
```bash
# Create the swarm.key file
cat > ~/.ipfs/swarm.key << EOF
/key/swarm/psk/1.0.0/
/base16/
YOUR_SWARM_KEY_HERE
EOF
```

### 3. Configure Bootstrap Node

Remove default bootstrap nodes and add the private network bootstrap node:

**Windows PowerShell:**
```powershell
# Get the peer ID from the running Docker container
$peerId = docker exec ipfs-node-1 ipfs id -f="<id>"

# Remove all default bootstrap nodes
ipfs bootstrap rm --all

# Add the private network bootstrap node (localhost for local testing)
ipfs bootstrap add "/ip4/127.0.0.1/tcp/4001/p2p/$peerId"
```

**Linux/Mac:**
```bash
# Get the peer ID
PEER_ID=$(docker exec ipfs-node-1 ipfs id -f="<id>")

# Remove all default bootstrap nodes
ipfs bootstrap rm --all

# Add the private network bootstrap node
ipfs bootstrap add "/ip4/127.0.0.1/tcp/4001/p2p/$PEER_ID"
```

### 4. Configure for Private Network

**Windows PowerShell:**
```powershell
# Disable AutoConf (important for private networks)
ipfs config --json AutoConf.Enabled false

# Force private network mode
$env:LIBP2P_FORCE_PNET = "1"

# Optional: Configure custom ports to avoid conflicts
ipfs config Addresses.API /ip4/127.0.0.1/tcp/5010
ipfs config Addresses.Gateway /ip4/127.0.0.1/tcp/8090
ipfs config --json Addresses.Swarm '["\ip4/0.0.0.0/tcp/4010"]'
```

**Linux/Mac:**
```bash
# Disable AutoConf
ipfs config --json AutoConf.Enabled false

# Force private network mode
export LIBP2P_FORCE_PNET=1

# Optional: Configure custom ports
ipfs config Addresses.API /ip4/127.0.0.1/tcp/5010
ipfs config Addresses.Gateway /ip4/127.0.0.1/tcp/8090
ipfs config --json Addresses.Swarm '["\ip4/0.0.0.0/tcp/4010"]'
```

### 5. Start IPFS Daemon

**Windows PowerShell:**
```powershell
# Set environment variable for private network
$env:LIBP2P_FORCE_PNET = "1"

# If using custom IPFS path (like test peer)
$env:IPFS_PATH = "$env:USERPROFILE\.ipfs-test"

# Start daemon
ipfs daemon
```

**Linux/Mac:**
```bash
# Stop existing daemon if running
ipfs shutdown

# Start daemon with private network enforcement
LIBP2P_FORCE_PNET=1 ipfs daemon
```

### 6. Verify Connection

Check if you're connected to the private network:

**Windows PowerShell:**
```powershell
# Check peers
ipfs swarm peers

# Should see peers from the private network (5 Docker nodes)

# Or use the automated test script
cd test-peer
.\start-test-peer.ps1
```

**Linux/Mac:**
```bash
# Check peers
ipfs swarm peers

# Should see peers from the private network
```

## Troubleshooting

### No peers connecting
- Check if Docker cluster is running: `docker-compose ps`
- Verify the swarm key matches: compare with `Infrastructura/swarm.key`
- Check if `LIBP2P_FORCE_PNET=1` is set
- Ensure `AutoConf.Enabled` is set to `false`: `ipfs config AutoConf.Enabled`
- Verify bootstrap node is accessible: `docker exec ipfs-node-1 ipfs swarm peers`

### Connection refused
- Check if Docker containers are running: `docker ps`
- Verify ports are not in use: `netstat -an | Select-String "4001|5001"`
- Restart Docker cluster: `docker-compose restart`
- Check Docker logs: `docker logs ipfs-node-1`

### Can't access files
- Wait a few minutes for DHT to propagate
- Check cluster status: `curl http://localhost:3001/api/docker-cluster/status`
- Verify file is pinned: `curl http://localhost:3001/api/docker-cluster/pins`
- Check if at least 2-3 nodes have the file (replication factor)

## Windows Service Setup (Optional)

To run IPFS as a Windows service with private network:

1. Install NSSM (Non-Sucking Service Manager)
2. Create service:
```powershell
nssm install IPFS "C:\path\to\ipfs.exe" daemon
nssm set IPFS AppEnvironmentExtra LIBP2P_FORCE_PNET=1
nssm start IPFS
```

## Docker Cluster Setup

The project includes a complete Docker Cluster setup with 5 IPFS nodes and 5 Cluster nodes.

**To start the Docker cluster:**
```powershell
cd Infrastructura
docker-compose up -d

# Wait 45 seconds for initialization
Start-Sleep -Seconds 45

# Check status
docker-compose ps
```

**Docker nodes configuration:**
- IPFS Nodes: `ipfs-node-1` to `ipfs-node-5`
- Cluster Nodes: `cluster-1` to `cluster-5`
- API Ports: 5001-5005 (IPFS), 9094-9494 (Cluster)
- Gateway Ports: 8080-8084
- Swarm Ports: 4001-4005

See `Infrastructura/docker-compose.yml` for full configuration.

## Security Notes

**Important:**
- Keep your swarm key private - anyone with this key can join the network
- The swarm key should be shared only through secure channels
- Consider changing the swarm key periodically
- Monitor network activity for unauthorized access

## Quick Start Scripts

The project includes automated scripts for easy setup:

**Start everything:**
```powershell
cd Backend
.\start-infrastructure.ps1
```

**Test connection:**
```powershell
cd test-peer
.\start-test-peer.ps1
```

**Run integration tests:**
```powershell
cd Backend
.\test-cluster-integration.ps1
```

## Additional Resources

- **Backend API Documentation**: See `Backend/DOCKER_CLUSTER_INTEGRATION.md`
- **Testing Guide**: See `Backend/TEST_DOCKER_CLUSTER.md`
- **Quick Commands**: See `Backend/QUICK_COMMANDS.md`
- **Main README**: See `README.md` for complete project overview

## Support

For issues or questions:
1. Check the documentation in `Backend/` folder
2. Run the automated tests: `Backend/test-cluster-integration.ps1`
3. Review troubleshooting section above
4. Check Docker logs: `docker-compose logs`
