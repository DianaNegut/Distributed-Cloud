#!/bin/sh
set -e

# Dacă repo-ul nu există, inițializează-l
if [ ! -d "/data/ipfs/config" ]; then
  ipfs init --profile=server
fi

# Configurare pentru rețea privată
ipfs config --json Routing.Type '"dhtclient"'
ipfs config --json AutoConf.Enabled false
ipfs config --json Bootstrap '[]'
ipfs config --json Discovery.MDNS.Enabled true

# Permite API pe toate interfețele pentru cluster
ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001

# Pornește daemon-ul
exec ipfs daemon --migrate=true
