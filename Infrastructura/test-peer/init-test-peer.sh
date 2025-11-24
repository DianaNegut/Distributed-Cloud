#!/bin/sh
set -e

echo "🔧 Inițializare test peer pentru rețea privată..."

# Inițializează repo IPFS dacă nu există
if [ ! -f /data/ipfs/config ]; then
    echo "📦 Inițializare repo IPFS..."
    ipfs init --profile=server
fi

# Asigură-te că swarm.key există
if [ ! -f /data/ipfs/swarm.key ]; then
    echo "❌ Eroare: swarm.key nu există!"
    exit 1
fi

echo "✓ swarm.key găsit"

# Configurează pentru rețea privată
echo "🔧 Configurare rețea privată..."
ipfs config --json AutoConf.Enabled false
ipfs config --json AutoTLS.Enabled false
ipfs config Routing.Type dht

# Permite conexiuni în rețeaua Docker (șterge filtrele de adrese private)
ipfs config --json Swarm.AddrFilters '[]'

# Șterge bootstrap nodes publici
echo "🗑️ Ștergere bootstrap nodes publici..."
ipfs bootstrap rm --all

# Așteaptă ca ipfs-node-1 să fie disponibil
echo "⏳ Așteptare pentru bootstrap node (ipfs-node-1)..."
sleep 10

# Obține peer ID de la ipfs-node-1 și adaugă-l ca bootstrap
echo "🔍 Obțin peer ID de la ipfs-node-1..."
BOOTSTRAP_PEER=$(wget -qO- --post-data '' http://ipfs-node-1:5001/api/v0/id 2>/dev/null | sed -n 's/.*"ID":"\([^"]*\)".*/\1/p')
if [ -n "$BOOTSTRAP_PEER" ]; then
    echo "✓ Bootstrap peer detectat: $BOOTSTRAP_PEER"
    ipfs bootstrap add /dns4/ipfs-node-1/tcp/4001/p2p/$BOOTSTRAP_PEER
    echo "✓ Bootstrap node adăugat"
else
    echo "⚠️ Nu s-a putut obține bootstrap peer, folosesc configurație default"
fi

echo "🚀 Pornire daemon IPFS..."
exec ipfs daemon --enable-gc
