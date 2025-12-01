-# Backend - IPFS Cluster Manager

Acest backend ofera o API REST pentru gestionarea unui cluster IPFS distribuit. Poti incarca, descarca si administra fisiere in mod simplu si rapid.

## Configurare rapida

1. Instaleaza dependintele:

```powershell
cd Backend
npm install
```

2. Verifica fisierul `.env` (deja inclus):

```env
PORT=3001
DOCKER_CLUSTER_NODES=http://localhost:9094,http://localhost:9194,http://localhost:9294,http://localhost:9394,http://localhost:9494
DOCKER_CLUSTER_TIMEOUT=5000
DOCKER_CLUSTER_MAX_RETRIES=3
API_KEY=supersecret
```

3. Porneste infrastructura si backend-ul:

```powershell
cd ..\Infrastructura
docker-compose up -d
cd ..\Backend
npm start
```

Backend-ul va fi disponibil la: http://localhost:3001

---

## API principale

Toate rutele (exceptand health) necesita header-ul `x-api-key: supersecret`.

- `GET /api/health` - Verifica daca backend-ul este online
- `GET /api/docker-cluster/health` - Statusul clusterului Docker
- `GET /api/docker-cluster/status` - Informatii detaliate despre cluster
- `GET /api/docker-cluster/peers` - Lista de peers
- `POST /api/docker-cluster/add` - Incarca un fisier (form-data, key: file)
- `GET /api/docker-cluster/pins` - Lista fisiere pinuite
- `GET /api/docker-cluster/pin/:cid` - Status pin pentru un CID
- `DELETE /api/docker-cluster/pin/:cid` - Sterge un fisier din cluster
- `GET /api/docker-cluster/download/:cid` - Descarca fisierul

Exemplu raspuns pentru health:

```json
{
  "success": true,
  "message": "Backend online"
}
```

---

## Testare rapida

Foloseste cURL sau PowerShell pentru a testa API-ul:

```powershell
# Verifica backend
curl http://localhost:3001/api/health
# Status cluster
curl -H "x-api-key: supersecret" http://localhost:3001/api/docker-cluster/health
# Upload fisier
curl -X POST -H "x-api-key: supersecret" -F "file=@test.txt" http://localhost:3001/api/docker-cluster/add
# Lista peers
curl -H "x-api-key: supersecret" http://localhost:3001/api/docker-cluster/peers
# Descarca fisier
curl -H "x-api-key: supersecret" -o "downloaded.txt" http://localhost:3001/api/docker-cluster/download/QmXxx...
```

---

## Structura proiectului

```
Backend/
├── server.js
├── .env
├── package.json
├── middleware/
├── routes/
└── utils/
```

---


## Integrare cu frontend

Poti folosi fetch sau axios pentru a interactiona cu API-ul. Exemplu in React:

```javascript
const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch('http://localhost:3001/api/docker-cluster/add', {
    method: 'POST',
    headers: { 'x-api-key': 'supersecret' },
    body: formData
  });
  return await response.json();
};
```

---

## Succes!

Acest backend te ajuta sa gestionezi rapid fisierele intr-un cluster IPFS distribuit. Pentru orice problema, consulta log-urile sau documentatia infrastructurii.
- Method: `POST`
- Headers: `Content-Type: multipart/form-data`, `x-api-key: supersecret`
- Body: form-data cu key `file`

**Response:**
```json
{
  "success": true,
  "message": "Fisier adaugat in cluster cu succes",
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
Listeaza toate fisierele pinuite in cluster.

**Response:**
```json
{
  "success": true,
  "totalPins": 10,
  "pins": [...]
}
```

#### `GET /api/docker-cluster/pin/:cid`
Verifica status-ul de pinning pentru un CID specific.

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
Sterge un fisier din cluster (unpin).

**Response:**
```json
{
  "success": true,
  "message": "Fisier sters din cluster",
  "cid": "QmXxx...",
  "deletedAt": "2025-11-21T10:30:00.000Z"
}
```

#### `GET /api/docker-cluster/download/:cid`
Descarca un fisier din cluster.

**Response:** Binary stream (fisierul)

---

## Testare API

### Cu cURL

```powershell
# Health check
curl http://localhost:3001/api/health

# Cluster health
curl -H "x-api-key: supersecret" http://localhost:3001/api/docker-cluster/health

# Upload fisier
curl -X POST -H "x-api-key: supersecret" -F "file=@test.txt" http://localhost:3001/api/docker-cluster/add

# Lista peers
curl -H "x-api-key: supersecret" http://localhost:3001/api/docker-cluster/peers

# Download fisier
curl -H "x-api-key: supersecret" -o "downloaded.txt" http://localhost:3001/api/docker-cluster/download/QmXxx...
```

### Cu PowerShell

```powershell
# Health check
Invoke-RestMethod -Uri "http://localhost:3001/api/health"

# Cluster health
Invoke-RestMethod -Uri "http://localhost:3001/api/docker-cluster/health" -Headers @{"x-api-key"="supersecret"}

# Upload fisier (vezi exemplu in Infrastructura/README.md)

# Download fisier
Invoke-WebRequest -Uri "http://localhost:3001/api/docker-cluster/download/QmXxx..." -Headers @{"x-api-key"="supersecret"} -OutFile "downloaded.txt"
```

---

## Arhitectura

```
Backend/
├── server.js                 # Entry point, Express server
├── .env                      # Configurare variabile mediu
├── package.json             # Dependinte NPM
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

Clasa `DockerClusterClient` ofera:
- ✅ **Retry logic** - reincearca automat requesturile esuate
- ✅ **Failover** - trece automat la alt nod daca unul cade
- ✅ **Health checking** - verifica starea fiecarui nod
- ✅ **Load balancing** - distribuie requesturile pe noduri
- ✅ **Error handling** - gestioneaza toate erorile posibile
- ✅ **CID extraction** - extrage automat CID-ul din diferite formate de raspuns

---

## Troubleshooting

### Backend-ul nu porneste

1. Verifica ca toate dependintele sunt instalate: `npm install`
2. Verifica ca portul 3001 nu este ocupat
3. Verifica fisierul `.env`

### "Cluster-ul nu este disponibil"

1. Verifica ca infrastructura Docker ruleaza:
   ```powershell
   cd ..\Infrastructura
   docker-compose ps
   ```
2. Toate containerele trebuie sa fie in starea "Up"
3. Verifica ca nodurile cluster raspund:
   ```powershell
   Invoke-WebRequest -Uri "http://localhost:9094/health"
   ```

### Upload-ul fisierelor esueaza

1. Verifica dimensiunea fisierului (max 100MB)
2. Verifica ca ai header-ul `x-api-key: supersecret`
3. Verifica ca folosesti `Content-Type: multipart/form-data`
4. Verifica logs-urile: backend-ul va afisa erori detaliate in consola

### Download-ul fisierelor esueaza

1. Verifica ca nodurile IPFS din cluster ruleaza (nu doar nodurile cluster)
2. Verifica ca CID-ul este corect
3. Gateway-urile IPFS trebuie sa fie accesibile pe porturile 8080-8084

---

## Dezvoltare

### Mod Development cu Hot Reload

```powershell
npm run dev
```

### Structura Cod

- **Routes**: Definesc endpoint-urile si validarea input-ului
- **Middleware**: Proceseaza request-urile (auth, logging, CORS)
- **Utils**: Logica de business (comunicare cu cluster, procesare date)

### Adaugare Endpoint Nou

1. Creeaza ruta in `routes/`:
   ```javascript
   router.get('/my-endpoint', async (req, res) => {
     // logica aici
   });
   ```

2. Importeaza si monteaza ruta in `server.js`:
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

Backend-ul este complet integrat cu infrastructura Docker IPFS Cluster si ofera:
- ✅ API REST complet functional
- ✅ Upload/download fisiere
- ✅ Management pins
- ✅ Health monitoring
- ✅ Retry logic si failover
- ✅ Autentificare si securitate

Pentru detalii despre infrastructura, vezi `../Infrastructura/README.md`.
