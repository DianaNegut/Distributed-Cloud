#!/bin/sh
set -e

# Dacă repo-ul nu există, inițializează-l
if [ ! -f /data/ipfs/config ]; then
  echo "Initializing IPFS repository..."
  ipfs init --profile=server
fi

# Configurare pentru rețea privată
echo "Configuring IPFS for private network..."
ipfs config --json AutoConf.Enabled false
ipfs config --json Bootstrap '[]'
ipfs config --json Discovery.MDNS.Enabled true
ipfs config --json Swarm.AddrFilters '[]'
ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001

# Pornește daemon-ul
echo "Starting IPFS daemon..."
exec ipfs daemon --migrate=true
