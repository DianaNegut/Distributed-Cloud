# Distributed-Cloud

Sistem distribuit de stocare bazat pe IPFS cu cluster Docker.

## Functionalitati

Oferta o infrastructura completa pentru stocare descentralizata folosind:
- 5 noduri IPFS pentru stocare
- 5 noduri Cluster pentru coordonare
- Backend REST API (Express.js)
- Frontend web (React)

## Structura

```
Distributed-Cloud/
├── Backend/
│   ├── routes/
│   ├── middleware/
│   └── utils/
│
├── Frontend/
│   └── frontend/src/
│
├── Infrastructura/
│   └── docker-compose.yml
│
└── Diagrame/

```

## Pornire rapida

**Pornire automata:**

```powershell
cd Backend
.\start-infrastructure.ps1
```

Script-ul porneste:
1. Docker Cluster (5 noduri IPFS + 5 Cluster)
2. Backend API (port 3001)
3. Teste de verificare

**Pornire manuala:**

```powershell
cd Infrastructura
docker-compose up -d
Start-Sleep -Seconds 45

cd ..\Backend
npm install
npm start

cd ..\Frontend\frontend
npm install
npm start
```

## Documentatie

**Ghiduri disponibile:**

- `Backend/INTEGRATION_SUMMARY.md` - Prezentare generala
- `Backend/DOCKER_CLUSTER_INTEGRATION.md` - Arhitectura completa
- `Backend/TEST_DOCKER_CLUSTER.md` - Cum sa testezi
- `Backend/QUICK_COMMANDS.md` - Comenzi utile

**Script-uri:**

- `Backend/start-infrastructure.ps1` - Porneste totul
- `Backend/test-cluster-integration.ps1` - Testeaza sistemul

## Configurare

**Backend/.env:**

```env
PORT=3001
IPFS_PATH=C:\Users\Diana\.ipfs
KUBO_PATH=C:\ATM\LICENTA\kubo_v0.38.1_windows-amd64\kubo

DOCKER_CLUSTER_NODES=http://localhost:9094,http://localhost:9194,http://localhost:9294,http://localhost:9394,http://localhost:9494
DOCKER_CLUSTER_TIMEOUT=5000

API_KEY=supersecret
```

**Infrastructura/.env:**

```env
CLUSTER_SECRET=0011223344556677889900112233445500112233445566778899001122334455
BOOTSTRAP_PEER_ID=12D3KooWF98F4bkJbzxKiza9nAKUrpXZai7nciXkunnVq42LWDVV
```

## API Endpoints

**Cluster Management:**

- `GET /api/docker-cluster/health` - Verifică starea cluster-ului
- `GET /api/docker-cluster/status` - Status complet (peers, pins, nodes)
- `GET /api/docker-cluster/peers` - Lista peers conectați
- `GET /api/docker-cluster/pins` - Fisiere stocate

**File Operations:**

- `POST /api/docker-cluster/add` - Upload fisier
- `GET /api/docker-cluster/download/:cid` - Descarca fisier
- `DELETE /api/docker-cluster/pin/:cid` - Sterge fisier
- `GET /api/docker-cluster/pin/:cid` - Status fisier

**General:**

- `GET /api/health` - Health check backend
- `GET /api/status` - Status IPFS local

## Arhitectură

```
Frontend (React)
    ↓
Backend (Express) :3001
    ↓
dockerClusterClient (retry + failover)
    ↓
Cluster-1...5 (:9094-9494)
    ↓
IPFS-1...5 (:5001-5005, :8080-8084)
```

## Functionalitati

**Backend:**
- Retry logic cu fallback automat
- Health monitoring pentru noduri
- Extragere automata CID
- Configurare flexibila

**Docker Cluster:**
- 5 noduri IPFS + 5 Cluster
- Replicare automata (2-3 copii)
- Auto-restart la probleme
- Volume persistente

## Testare

**Test automat:**

```powershell
cd Backend
.\test-cluster-integration.ps1
```

Testează: health check, upload, download, peers, pins.

**Test manual:** Vezi `Backend/TEST_DOCKER_CLUSTER.md`

## Probleme frecvente

**Cluster nu pornește:**
```powershell
docker-compose ps          # verifică status
docker-compose logs        # vezi logs
docker-compose restart     # restart
```

**Backend nu se conectează:**
- Verifică că Docker rulează: `docker-compose ps`
- Test direct: `curl http://localhost:9094/health`
- Verifică `Backend/.env`

**Upload nu merge:**
- Max 100MB per fișier
- Verifică logs: `docker-compose logs`

## Monitoring

```powershell
# Health check
curl http://localhost:3001/api/docker-cluster/health

# Status cluster
curl http://localhost:3001/api/docker-cluster/status

# Docker stats
docker stats
```

## Oprire

```powershell
cd Infrastructura
docker-compose down

docker-compose down -v
```

## Exemple cod

**Upload fisier:**

```javascript
const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await fetch('http://localhost:3001/api/docker-cluster/add', {
    method: 'POST',
    body: formData
  });
  
  return (await res.json()).file.cid;
};
```

**Verifica health:**

```javascript
const checkHealth = async () => {
  const res = await fetch('http://localhost:3001/api/docker-cluster/health');
  const data = await res.json();
  console.log('Status:', data.health.status);
};
```

http://localhost:8080/ipfs/QmTNoJrhSU1p7juqveZwroQAf3TrSXb3gRY5boUAf7ALwy
http://localhost:8081/ipfs/QmTNoJrhSU1p7juqveZwroQAf3TrSXb3gRY5boUAf7ALwy
http://localhost:8082/ipfs/QmTNoJrhSU1p7juqveZwroQAf3TrSXb3gRY5boUAf7ALwy
http://localhost:8083/ipfs/QmTNoJrhSU1p7juqveZwroQAf3TrSXb3gRY5boUAf7ALwy
http://localhost:8084/ipfs/QmTNoJrhSU1p7juqveZwroQAf3TrSXb3gRY5boUAf7ALwy