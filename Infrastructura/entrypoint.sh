#!/bin/sh
set -e

if [ ! -f /data/ipfs/config ]; then
  echo "Initializing IPFS repository..."
  ipfs init --profile=server
fi

echo "Configuring IPFS for private network..."
ipfs config --json AutoConf.Enabled false
ipfs config --json Bootstrap '[]'
ipfs config --json Discovery.MDNS.Enabled true
ipfs config --json Swarm.AddrFilters '[]'
ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001
ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080

echo "Configuring gateway..."
ipfs config --json Gateway.PublicGateways '{
  "localhost": {
    "UseSubdomains": false,
    "Paths": ["/ipfs", "/ipns"]
  }
}'
ipfs config --json Gateway.NoFetch false

echo "Starting IPFS daemon..."
exec ipfs daemon --migrate=true
