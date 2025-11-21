# Backend - IPFS Cluster Manager

Backend REST API pentru managementul clusterului IPFS distribuit.

## Configurare

### 1. Instalare Dependințe

```powershell
cd Backend
npm install
```

### 2. Configurare Variabile de Mediu

Fișierul `.env` este deja configurat cu:

```env
PORT=3001

# Docker Cluster Configuration
DOCKER_CLUSTER_NODES=http://localhost:9094,http://localhost:9194,http://localhost:9294,http://localhost:9394,http://localhost:9494
DOCKER_CLUSTER_TIMEOUT=5000
DOCKER_CLUSTER_MAX_RETRIES=3

# Security
API_KEY=supersecret
```

### 3. Pornire Backend

**IMPORTANT**: Asigură-te că infrastructura cluster rulează înainte de a porni backend-ul!

```powershell
# Terminal 1 - Pornește infrastructura
cd ..\Infrastructura
docker-compose up -d

# Terminal 2 - Pornește backend-ul
cd ..\Backend
npm start
```

Backend-ul va porni pe: `http://localhost:3001`

---

## API Endpoints

### Health Check

#### `GET /api/health`
Verifică starea backend-ului.

**Response:**
```json
{
  "success": true,
  "message": "Backend online",
  "timestamp": "2025-11-21T10:30:00.000Z"
}
```

---

### Docker Cluster Management

Toate endpoint-urile de mai jos necesită header: `x-api-key: supersecret`

#### `GET /api/docker-cluster/health`
Verifică starea clusterului Docker.

**Response:**
```json
{
  "success": true,
  "health": {
    "status": "HEALTHY",
    "totalNodes": 5,
    "onlineNodes": 5,
    "offlineNodes": 0,
    "healthPercentage": 100,
    "nodes": [
      {
        "url": "http://localhost:9094",
        "status": "online",
        "healthy": true
      }
    ],
    "timestamp": "2025-11-21T10:30:00.000Z"
  }
}
```

#### `GET /api/docker-cluster/status`
Obține status-ul complet al clusterului.

**Response:**
```json
{
  "success": true,
  "cluster": {
    "totalNodes": 5,
    "peers": 5,
    "pinnedFiles": 10,
    "peersList": [...],
    "pinsList": [...],
    "nodesHealth": {...}
  }
}
```

#### `GET /api/docker-cluster/peers`
Listează toți peers-ii din cluster.

**Response:**
```json
{
  "success": true,
  "totalPeers": 5,
  "peers": [
    {
      "id": "12D3Koo...",
      "peername": "node-1",
      "ipfs": {...}
    }
  ]
}
```

#### `POST /api/docker-cluster/add`
Încarcă un fișier în cluster.

**Request:**
- Method: `POST`
- Headers: `Content-Type: multipart/form-data`, `x-api-key: supersecret`
- Body: form-data cu key `file`

**Response:**
```json
{
  "success": true,
  "message": "Fișier adăugat în cluster cu succes",
  "file": {
    "name": "test.jpg",
    "cid": "QmXxx...",
    "size": 12345,
    "mimetype": "image/jpeg",
    "pinnedOn": 3,
    "allocations": ["12D3Koo...", "12D3Koo...", "12D3Koo..."],
    "accessUrls": [
      "http://localhost:8080/ipfs/QmXxx...",
      "http://localhost:8081/ipfs/QmXxx...",
      "http://localhost:8082/ipfs/QmXxx..."
    ],
    "addedAt": "2025-11-21T10:30:00.000Z"
  }
}
```

#### `GET /api/docker-cluster/pins`
Listează toate fișierele pinuite în cluster.

**Response:**
```json
{
  "success": true,
  "totalPins": 10,
  "pins": [...]
}
```

#### `GET /api/docker-cluster/pin/:cid`
Verifică status-ul de pinning pentru un CID specific.

**Response:**
```json
{
  "success": true,
  "cid": "QmXxx...",
  "replicationCount": 3,
  "status": {
    "peer_map": {...},
    "allocations": [...]
  }
}
```

#### `DELETE /api/docker-cluster/pin/:cid`
Șterge un fișier din cluster (unpin).

**Response:**
```json
{
  "success": true,
  "message": "Fișier șters din cluster",
  "cid": "QmXxx...",
  "deletedAt": "2025-11-21T10:30:00.000Z"
}
```

#### `GET /api/docker-cluster/download/:cid`
Descarcă un fișier din cluster.

**Response:** Binary stream (fișierul)

---

## Testare API

### Cu cURL

```powershell
# Health check
curl http://localhost:3001/api/health

# Cluster health
curl -H "x-api-key: supersecret" http://localhost:3001/api/docker-cluster/health

# Upload fișier
curl -X POST -H "x-api-key: supersecret" -F "file=@test.txt" http://localhost:3001/api/docker-cluster/add

# Lista peers
curl -H "x-api-key: supersecret" http://localhost:3001/api/docker-cluster/peers

# Download fișier
curl -H "x-api-key: supersecret" -o "downloaded.txt" http://localhost:3001/api/docker-cluster/download/QmXxx...
```

### Cu PowerShell

```powershell
# Health check
Invoke-RestMethod -Uri "http://localhost:3001/api/health"

# Cluster health
Invoke-RestMethod -Uri "http://localhost:3001/api/docker-cluster/health" -Headers @{"x-api-key"="supersecret"}

# Upload fișier (vezi exemplu în Infrastructura/README.md)

# Download fișier
Invoke-WebRequest -Uri "http://localhost:3001/api/docker-cluster/download/QmXxx..." -Headers @{"x-api-key"="supersecret"} -OutFile "downloaded.txt"
```

---

## Arhitectură

```
Backend/
├── server.js                 # Entry point, Express server
├── .env                      # Configurare variabile mediu
├── package.json             # Dependințe NPM
│
├── middleware/              # Middleware-uri Express
│   ├── auth.js             # Autentificare API key
│   ├── corsConfig.js       # Configurare CORS
│   └── logger.js           # Logging requests
│
├── routes/                  # Definirea rutelor API
│   ├── health.js           # Health check backend
│   ├── dockerCluster.js    # Rutele pentru Docker Cluster (PRINCIPAL)
│   ├── status.js           # Status general
│   ├── peers.js            # Peers management
│   ├── files.js            # File operations
│   └── ...
│
└── utils/                   # Utilitare
    ├── dockerClusterClient.js  # Client pentru comunicare cu IPFS Cluster
    └── ...
```

### Docker Cluster Client

Clasa `DockerClusterClient` oferă:
- ✅ **Retry logic** - reîncearcă automat requesturile eșuate
- ✅ **Failover** - trece automat la alt nod dacă unul cade
- ✅ **Health checking** - verifică starea fiecărui nod
- ✅ **Load balancing** - distribuie requesturile pe noduri
- ✅ **Error handling** - gestionează toate erorile posibile
- ✅ **CID extraction** - extrage automat CID-ul din diferite formate de răspuns

---

## Troubleshooting

### Backend-ul nu pornește

1. Verifică că toate dependințele sunt instalate: `npm install`
2. Verifică că portul 3001 nu este ocupat
3. Verifică fișierul `.env`

### "Cluster-ul nu este disponibil"

1. Verifică că infrastructura Docker rulează:
   ```powershell
   cd ..\Infrastructura
   docker-compose ps
   ```
2. Toate containerele trebuie să fie în starea "Up"
3. Verifică că nodurile cluster răspund:
   ```powershell
   Invoke-WebRequest -Uri "http://localhost:9094/health"
   ```

### Upload-ul fișierelor eșuează

1. Verifică dimensiunea fișierului (max 100MB)
2. Verifică că ai header-ul `x-api-key: supersecret`
3. Verifică că folosești `Content-Type: multipart/form-data`
4. Verifică logs-urile: backend-ul va afișa erori detaliate în consolă

### Download-ul fișierelor eșuează

1. Verifică că nodurile IPFS din cluster rulează (nu doar nodurile cluster)
2. Verifică că CID-ul este corect
3. Gateway-urile IPFS trebuie să fie accesibile pe porturile 8080-8084

---

## Dezvoltare

### Mod Development cu Hot Reload

```powershell
npm run dev
```

### Structură Cod

- **Routes**: Definesc endpoint-urile și validarea input-ului
- **Middleware**: Procesează request-urile (auth, logging, CORS)
- **Utils**: Logică de business (comunicare cu cluster, procesare date)

### Adăugare Endpoint Nou

1. Creează ruta în `routes/`:
   ```javascript
   router.get('/my-endpoint', async (req, res) => {
     // logică aici
   });
   ```

2. Importă și montează ruta în `server.js`:
   ```javascript
   const myRoute = require('./routes/myRoute');
   app.use('/api/my-route', myRoute);
   ```

---

## Integrare cu Frontend

Frontend-ul poate accesa API-ul folosind fetch sau axios:

```javascript
// Exemplu React
const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('http://localhost:3001/api/docker-cluster/add', {
    method: 'POST',
    headers: {
      'x-api-key': 'supersecret'
    },
    body: formData
  });
  
  return await response.json();
};
```

---

## Concluzie

Backend-ul este complet integrat cu infrastructura Docker IPFS Cluster și oferă:
- ✅ API REST complet funcțional
- ✅ Upload/download fișiere
- ✅ Management pins
- ✅ Health monitoring
- ✅ Retry logic și failover
- ✅ Autentificare și securitate

Pentru detalii despre infrastructură, vezi `../Infrastructura/README.md`.
