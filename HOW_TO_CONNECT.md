# How to Connect to the Private IPFS Network

## Prerequisites
- IPFS (kubo) installed on your machine
- The swarm key from the network administrator

## Steps to Connect

### 1. Get Network Information
Visit the network administrator's dashboard at `http://<server-ip>:3000/network` to get:
- **Swarm Key**: The private network encryption key
- **Bootstrap Node Address**: The bootstrap node multiaddress

### 2. Create the Swarm Key File

Create the swarm key file in your IPFS directory:

**Windows:**
```powershell
# Create the swarm.key file
$swarmKeyPath = "$env:USERPROFILE\.ipfs\swarm.key"
$swarmKey = "YOUR_SWARM_KEY_HERE"

@"
/key/swarm/psk/1.0.0/
/base16/
$swarmKey
"@ | Out-File -FilePath $swarmKeyPath -Encoding ASCII
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

```bash
# Remove all default bootstrap nodes
ipfs bootstrap rm --all

# Add the private network bootstrap node
ipfs bootstrap add /ip4/<SERVER_IP>/tcp/4001/p2p/<PEER_ID>
```

Example:
```bash
ipfs bootstrap add /ip4/192.168.1.100/tcp/4001/p2p/12D3KooWQWwEb4DrNcW85vsp5brhxQaRk6bennUHYqMbMVDnABXV
```

### 4. Configure for Private Network

```bash
# Force private network mode
export LIBP2P_FORCE_PNET=1

# Disable mDNS discovery (optional, for security)
ipfs config --json Discovery.MDNS.Enabled false

# Set routing to DHT client mode
ipfs config --json Routing.Type '"dhtclient"'
```

### 5. Restart IPFS Daemon

```bash
# Stop existing daemon if running
ipfs shutdown

# Start daemon with private network enforcement
LIBP2P_FORCE_PNET=1 ipfs daemon
```

### 6. Verify Connection

Check if you're connected to the private network:

```bash
# Check peers
ipfs swarm peers

# Should see peers from the private network
```

## Troubleshooting

### No peers connecting
- Check firewall settings (port 4001 should be open)
- Verify the swarm key is correct
- Ensure the bootstrap node address is reachable
- Check if `LIBP2P_FORCE_PNET=1` is set

### Connection refused
- Verify the server's public IP is correct
- Check if the bootstrap node is running
- Ensure port forwarding is configured if behind NAT

### Can't access files
- Wait a few minutes for DHT to propagate
- Try pinning files explicitly with `ipfs pin add <CID>`
- Check if the file is pinned on at least one node

## Windows Service Setup (Optional)

To run IPFS as a Windows service with private network:

1. Install NSSM (Non-Sucking Service Manager)
2. Create service:
```powershell
nssm install IPFS "C:\path\to\ipfs.exe" daemon
nssm set IPFS AppEnvironmentExtra LIBP2P_FORCE_PNET=1
nssm start IPFS
```

## Docker Setup (Optional)

If you want to run IPFS in Docker:

```yaml
version: '3'
services:
  ipfs:
    image: ipfs/kubo:latest
    container_name: my-ipfs-node
    environment:
      - LIBP2P_FORCE_PNET=1
    volumes:
      - ./ipfs-data:/data/ipfs
      - ./swarm.key:/data/ipfs/swarm.key:ro
    ports:
      - "4001:4001"
      - "5001:5001"
      - "8080:8080"
    restart: unless-stopped
```

## Security Notes

⚠️ **Important:**
- Keep your swarm key private - anyone with this key can join the network
- The swarm key should be shared only through secure channels
- Consider changing the swarm key periodically
- Monitor network activity for unauthorized access

## Support

For issues or questions, contact the network administrator.
