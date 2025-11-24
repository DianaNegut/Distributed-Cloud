# Test Peer - Conectare la Rețeaua Privată

## Pași pentru testare:

### 1. Copiază swarm.key
Copiază fișierul `swarm.key` din `../Infrastructura/swarm.key` în `~/.ipfs/`

### 2. Obține Bootstrap Node
Rulează în rețeaua principală:
```bash
docker exec ipfs-node-1 ipfs id
```

### 3. Inițializează IPFS local
```bash
ipfs init
```

### 4. Copiază swarm.key
```bash
# Windows
copy ..\Infrastructura\swarm.key %USERPROFILE%\.ipfs\swarm.key

# Linux/Mac
cp ../Infrastructura/swarm.key ~/.ipfs/swarm.key
```

### 5. Configurează IPFS
```bash
# Dezactivează AutoConf
ipfs config --json AutoConf.Enabled false

# Șterge bootstrap-urile publice
ipfs bootstrap rm --all

# Adaugă bootstrap node-ul tău (înlocuiește cu adresa ta)
ipfs bootstrap add /ip4/YOUR_PUBLIC_IP/tcp/4001/p2p/PEER_ID
```

### 6. Pornește daemon-ul
```bash
ipfs daemon
```

### 7. Verifică conexiunea
```bash
ipfs swarm peers
```

Ar trebui să vezi peer-ii din rețeaua ta privată!
