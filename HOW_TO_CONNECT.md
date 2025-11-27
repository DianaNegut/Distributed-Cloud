# Conectare la Rețeaua IPFS Privată

## Ce ai nevoie
- IPFS (kubo) instalat pe computer
- Fișierul `swarm.key` din folder-ul `Infrastructura/`

## Pași de conectare

### 1. Obține informațiile rețelei

Pentru setup-ul local cu Docker:
- **Swarm Key**: `Infrastructura/swarm.key`
- **Nod bootstrap**: `ipfs-node-1` (rulează în Docker)

Pentru a vedea ID-ul nodului bootstrap:
```powershell
docker exec ipfs-node-1 ipfs id
```

### 2. Copiază fișierul swarm.key

**Windows:**
```powershell
Copy-Item "Infrastructura\swarm.key" "$env:USERPROFILE\.ipfs\swarm.key"
```

**Linux/Mac:**
```bash
cp Infrastructura/swarm.key ~/.ipfs/swarm.key
```

### 3. Configurează nodul bootstrap

**Windows:**
```powershell
$peerId = docker exec ipfs-node-1 ipfs id -f="<id>"
ipfs bootstrap rm --all
ipfs bootstrap add "/ip4/127.0.0.1/tcp/4001/p2p/$peerId"
```

**Linux/Mac:**
```bash
PEER_ID=$(docker exec ipfs-node-1 ipfs id -f="<id>")
ipfs bootstrap rm --all
ipfs bootstrap add "/ip4/127.0.0.1/tcp/4001/p2p/$PEER_ID"
```

### 4. Activează modul rețea privată

**Windows:**
```powershell
ipfs config --json AutoConf.Enabled false
$env:LIBP2P_FORCE_PNET = "1"
```

**Linux/Mac:**
```bash
ipfs config --json AutoConf.Enabled false
export LIBP2P_FORCE_PNET=1
```

Opțional, poți schimba porturile pentru a evita conflicte:
```powershell
ipfs config Addresses.API /ip4/127.0.0.1/tcp/5010
ipfs config Addresses.Gateway /ip4/127.0.0.1/tcp/8090
```

### 5. Pornește IPFS

**Windows:**
```powershell
$env:LIBP2P_FORCE_PNET = "1"
ipfs daemon
```

**Linux/Mac:**
```bash
LIBP2P_FORCE_PNET=1 ipfs daemon
```

### 6. Verifică conexiunea

```powershell
ipfs swarm peers
```

Dacă totul e ok, vei vedea lista cu cei 5 peers din Docker cluster.

## Probleme frecvente

### Nu se conectează peers
- Verifică dacă Docker-ul merge: `docker-compose ps`
- Verifică că ai cheia corectă în `.ipfs/swarm.key`
- Asigură-te că ai setat `LIBP2P_FORCE_PNET=1`
- Verifică: `ipfs config AutoConf.Enabled` (trebuie să fie `false`)

### Nu merge upload-ul
- Verifică că containerele rulează: `docker ps`
- Restart cluster: `docker-compose restart`
- Verifică logs: `docker logs ipfs-node-1`

### Nu pot accesa fișiere
- Așteaptă 1-2 minute pentru sincronizare
- Verifică status: `curl http://localhost:3001/api/docker-cluster/status`

## IPFS ca serviciu Windows (opțional)

Dacă vrei ca IPFS să pornească automat:

1. Instalează NSSM (Non-Sucking Service Manager)
2. Creează serviciul:
```powershell
nssm install IPFS "C:\path\to\ipfs.exe" daemon
nssm set IPFS AppEnvironmentExtra LIBP2P_FORCE_PNET=1
nssm start IPFS
```

## Docker Cluster

Proiectul include 5 noduri IPFS + 5 noduri Cluster.

**Pentru a porni cluster-ul:**
```powershell
cd Infrastructura
docker-compose up -d
Start-Sleep -Seconds 45  # așteaptă inițializarea
docker-compose ps
```

**Configurare noduri:**
- IPFS: `ipfs-node-1` până la `ipfs-node-5`
- Cluster: `cluster-1` până la `cluster-5`
- Porturi API: 5001-5005 (IPFS), 9094-9494 (Cluster)
- Porturi Gateway: 8080-8084

## Securitate

**Important:** Păstrează `swarm.key` privat! Oricine are cheia poate intra în rețea.

## Script-uri rapide

**Pornire completă:**
```powershell
cd Backend
.\start-infrastructure.ps1
```

**Test conexiune:**
```powershell
cd Backend
.\test-cluster-integration.ps1
```

## Documentație adițională

- `Backend/DOCKER_CLUSTER_INTEGRATION.md` - API complet
- `Backend/QUICK_COMMANDS.md` - Comenzi utile
- `README.md` - Overview proiect

## Ajutor

Dacă ai probleme:
1. Verifică documentația din `Backend/`
2. Rulează testele: `Backend/test-cluster-integration.ps1`
3. Verifică logs: `docker-compose logs`
