# Distributed-Cloud

Sistem distribuit de stocare bazat pe IPFS cu cluster Docker.

## Ce face?

Oferă o infrastructură completă pentru stocare descentralizată folosind:
- 5 noduri IPFS pentru stocare
- 5 noduri Cluster pentru coordonare
- Backend REST API (Express.js)
- Frontend web (React)

## Structura

```
Distributed-Cloud/
├── Backend/              # API Server (Express.js)
│   ├── routes/          # Endpoints
│   ├── middleware/      # Auth, CORS, Logger
│   └── utils/           # Utilitare
│
├── Frontend/            # Web App (React)
│   └── frontend/src/
│
├── Infrastructura/      # Docker Cluster
│   └── docker-compose.yml
│
└── Diagrame/           # Arhitectură

```

## Pornire rapidă

**Pornire automată:**

```powershell
cd Backend
.\start-infrastructure.ps1
```

Script-ul pornește:
1. Docker Cluster (5 noduri IPFS + 5 Cluster)
2. Backend API (port 3001)
3. Teste de verificare

**Pornire manuală:**

```powershell
# Pornește Docker
cd Infrastructura
docker-compose up -d
Start-Sleep -Seconds 45

# Pornește Backend
cd ..\Backend
npm install  # doar prima dată
npm start

# Pornește Frontend
cd ..\Frontend\frontend
npm install  # doar prima dată
npm start
```

## Documentație

**Ghiduri disponibile:**

- `Backend/INTEGRATION_SUMMARY.md` - Prezentare generală
- `Backend/DOCKER_CLUSTER_INTEGRATION.md` - Arhitectură completă
- `Backend/TEST_DOCKER_CLUSTER.md` - Cum să testezi
- `Backend/QUICK_COMMANDS.md` - Comenzi utile

**Script-uri:**

- `Backend/start-infrastructure.ps1` - Pornește totul
- `Backend/test-cluster-integration.ps1` - Testează sistemul

## Configurare

**Backend/.env:**

```env
PORT=3001
IPFS_PATH=C:\Users\Diana\.ipfs
KUBO_PATH=C:\ATM\LICENTA\kubo_v0.38.1_windows-amd64\kubo

# Noduri cluster
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
- `GET /api/docker-cluster/pins` - Fișiere stocate

**File Operations:**

- `POST /api/docker-cluster/add` - Upload fișier
- `GET /api/docker-cluster/download/:cid` - Descarcă fișier
- `DELETE /api/docker-cluster/pin/:cid` - Șterge fișier
- `GET /api/docker-cluster/pin/:cid` - Status fișier

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

## Funcționalități

**Backend:**
- Retry logic cu fallback automat
- Health monitoring pentru noduri
- Extragere automată CID
- Configurare flexibilă

**Docker Cluster:**
- 5 noduri IPFS + 5 Cluster
- Replicare automată (2-3 copii)
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

# Cu ștergere date (ATENȚIE!)
docker-compose down -v
```

## Exemple cod

**Upload fișier:**

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

**Verifică health:**

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