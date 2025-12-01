#!/bin/sh
set -e

if [ ! -d "/data/ipfs/config" ]; then
  ipfs init --profile=server
fi

ipfs config --json Routing.Type '"dhtclient"'
ipfs config --json AutoConf.Enabled false
ipfs config --json AutoTLS.Enabled false
ipfs config --json Bootstrap '[]'
ipfs config --json Discovery.MDNS.Enabled true

ipfs config --json Swarm.AddrFilters '[]'

ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001

exec ipfs daemon --migrate=true
