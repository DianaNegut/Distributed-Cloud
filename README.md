# Distributed-Cloud

## 📋 Proiect IPFS Private Network cu Docker Cluster

Infrastructură distribuită pentru stocare descentralizată folosind IPFS și IPFS Cluster.

---

## 🏗️ Structura Proiectului

```
Distributed-Cloud/
├── Backend/              # Server Express.js pentru API
│   ├── routes/          # Endpoints REST API
│   ├── middleware/      # Auth, CORS, Logger
│   ├── utils/           # Utilities (dockerClusterClient, etc.)
│   ├── config/          # Configurație
│   └── *.md             # Documentație
│
├── Frontend/            # Aplicație React
│   └── frontend/
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   └── api/
│       └── public/
│
├── Infrastructura/      # Docker Compose pentru IPFS Cluster
│   ├── docker-compose.yml
│   └── .env
│
└── Diagrame/           # Diagrame arhitectură

```

---

## 🚀 Quick Start

### Pornire Automată (Recomandat)

```powershell
cd Backend
.\start-infrastructure.ps1
```

Acest script va porni automat:
1. ✅ Docker IPFS Cluster (5 noduri IPFS + 5 noduri Cluster)
2. ✅ Backend API (Express.js pe port 3001)
3. ✅ Teste automate de verificare

### Pornire Manuală

```powershell
# 1. Pornește Docker Cluster
cd Infrastructura
docker-compose up -d

# Așteaptă 45 secunde pentru inițializare
Start-Sleep -Seconds 45

# 2. Pornește Backend
cd ..\Backend
npm install  # Prima dată
npm start

# 3. Pornește Frontend (opțional)
cd ..\Frontend\frontend
npm install  # Prima dată
npm start
```

---

## 📚 Documentație

### Backend - Docker IPFS Cluster Integration

| Document | Descriere |
|----------|-----------|
| **[INTEGRATION_SUMMARY.md](Backend/INTEGRATION_SUMMARY.md)** | 📋 Sumar complet al integrării |
| **[DOCKER_CLUSTER_INTEGRATION.md](Backend/DOCKER_CLUSTER_INTEGRATION.md)** | 📖 Ghid complet de integrare și arhitectură |
| **[TEST_DOCKER_CLUSTER.md](Backend/TEST_DOCKER_CLUSTER.md)** | 🧪 Testare manuală pas cu pas |
| **[QUICK_COMMANDS.md](Backend/QUICK_COMMANDS.md)** | ⚡ Comenzi rapide pentru operații comune |

### Scripts Utile

| Script | Descriere |
|--------|-----------|
| **[start-infrastructure.ps1](Backend/start-infrastructure.ps1)** | 🚀 Pornire automată completă |
| **[test-cluster-integration.ps1](Backend/test-cluster-integration.ps1)** | ✅ Teste automate |

---

## 🔧 Configurare

### Backend/.env

```env
# Server
PORT=3001

# IPFS Local (Kubo)
IPFS_PATH=C:\Users\Diana\.ipfs
KUBO_PATH=C:\ATM\LICENTA\kubo_v0.38.1_windows-amd64\kubo

# Docker Cluster Configuration
DOCKER_CLUSTER_NODES=http://localhost:9094,http://localhost:9194,http://localhost:9294,http://localhost:9394,http://localhost:9494
DOCKER_CLUSTER_TIMEOUT=5000
DOCKER_CLUSTER_MAX_RETRIES=3

# Security
API_KEY=supersecret
```

### Infrastructura/.env

```env
CLUSTER_SECRET=0011223344556677889900112233445500112233445566778899001122334455
BOOTSTRAP_PEER_ID=12D3KooWF98F4bkJbzxKiza9nAKUrpXZai7nciXkunnVq42LWDVV
```

---

## 🌐 Endpoints API

### Docker Cluster API

| Endpoint | Method | Descriere |
|----------|--------|-----------|
| `/api/docker-cluster/health` | GET | Health check cluster |
| `/api/docker-cluster/status` | GET | Status complet (peers, pins, nodes) |
| `/api/docker-cluster/peers` | GET | Lista peers din cluster |
| `/api/docker-cluster/pins` | GET | Lista fișiere pinuite |
| `/api/docker-cluster/add` | POST | Upload fișier în cluster |
| `/api/docker-cluster/pin/:cid` | GET | Status pin pentru CID specific |
| `/api/docker-cluster/pin/:cid` | DELETE | Șterge fișier din cluster |
| `/api/docker-cluster/download/:cid` | GET | Descarcă fișier din cluster |

### Health & Status

| Endpoint | Method | Descriere |
|----------|--------|-----------|
| `/api/health` | GET | Health check backend |
| `/api/status` | GET | Status IPFS local |

---

## 🏗️ Arhitectură

```
┌─────────────┐
│  Frontend   │  React Application
│   (React)   │  Port: 3000
└──────┬──────┘
       │ HTTP
       ↓
┌─────────────────────────────┐
│  Backend (Express)          │  REST API Server
│  Port: 3001                 │
│                             │
│  ┌─────────────────────┐   │
│  │ dockerClusterClient │   │  Resilient Client
│  │  - Retry logic      │   │  - 3 retries
│  │  - Health check     │   │  - Failover
│  │  - Failover         │   │  - Timeout
│  └──────────┬──────────┘   │
└─────────────┼───────────────┘
              │
       ┌──────┴──────┬──────────┬──────────┬──────────┐
       ↓             ↓          ↓          ↓          ↓
┌───────────┐  ┌───────────┐  ...  ┌───────────┐  ┌───────────┐
│ Cluster-1 │  │ Cluster-2 │       │ Cluster-4 │  │ Cluster-5 │
│ :9094     │  │ :9194     │       │ :9394     │  │ :9494     │
└─────┬─────┘  └─────┬─────┘       └─────┬─────┘  └─────┬─────┘
      │              │                   │              │
      ↓              ↓                   ↓              ↓
┌───────────┐  ┌───────────┐       ┌───────────┐  ┌───────────┐
│  IPFS-1   │  │  IPFS-2   │       │  IPFS-4   │  │  IPFS-5   │
│ :5001     │  │ :5002     │       │ :5004     │  │ :5005     │
│ :8080     │  │ :8081     │       │ :8083     │  │ :8084     │
└───────────┘  └───────────┘       └───────────┘  └───────────┘
```

---

## ✨ Features

### ✅ Backend
- **Resilient Communication**: Retry logic cu exponential backoff
- **Automatic Failover**: Trece automat la alt nod în caz de eroare
- **Health Monitoring**: Verificare continuă stare noduri
- **CID Extraction**: Extragere automată CID din răspunsuri
- **Configurable**: Toate setările în `.env`

### ✅ Docker Cluster
- **5 IPFS Nodes**: Stocare distribuită
- **5 Cluster Nodes**: Coordonare și replicare
- **Automatic Replication**: Factor configurabil (2-3 copii)
- **Health Checks**: Monitorizare automată
- **Auto-restart**: Nodurile se repornesc automat

### ✅ Infrastructură
- **Docker Compose**: Orchestrare simplă
- **Persistent Storage**: Volume-uri pentru date
- **CORS Configured**: Pentru comunicare cross-origin
- **Scalable**: Ușor de adăugat noduri noi

---

## 🧪 Testare

### Test Complet Automat

```powershell
cd Backend
.\test-cluster-integration.ps1
```

Testează automat:
- ✅ Health check cluster
- ✅ Status și statistici
- ✅ Lista peers
- ✅ Upload fișier
- ✅ Status pin
- ✅ Download fișier
- ✅ Delete pin

### Test Manual

Vezi ghidul complet în [TEST_DOCKER_CLUSTER.md](Backend/TEST_DOCKER_CLUSTER.md)

---

## 🛠️ Troubleshooting

### Cluster nu pornește

```powershell
# Verifică Docker
docker --version

# Vezi status
docker-compose ps

# Vezi logs
docker-compose logs cluster-1

# Restart
docker-compose restart
```

### Backend nu se conectează

1. Verifică că clusterul rulează: `docker-compose ps`
2. Testează direct: `curl http://localhost:9094/health`
3. Verifică `.env` - `DOCKER_CLUSTER_NODES`

### Upload eșuează

1. Verifică dimensiunea fișierului (max 100MB)
2. Vezi logs Backend
3. Verifică că nodurile sunt online

---

## 📊 Monitoring

### Health Check
```powershell
curl http://localhost:3001/api/docker-cluster/health
```

### Status Cluster
```powershell
curl http://localhost:3001/api/docker-cluster/status
```

### Docker Stats
```powershell
docker stats
```

---

## 🛑 Oprire

```powershell
# Oprește cluster
cd Infrastructura
docker-compose down

# Oprește și șterge volumes (ATENȚIE: pierdere date!)
docker-compose down -v
```

---

## 📦 Dependințe

### Backend
- Node.js 16+
- npm
- Dependințe: express, axios, cors, dotenv, form-data, etc.

### Infrastructură
- Docker Desktop
- Docker Compose

---

## 👨‍💻 Development

### Structura Backend

```
Backend/
├── server.js                    # Entry point
├── routes/
│   ├── dockerCluster.js        # Docker Cluster endpoints
│   ├── cluster.js              # Local IPFS cluster
│   ├── files.js                # File operations
│   └── ...
├── utils/
│   ├── dockerClusterClient.js  # ⭐ Client pentru Docker Cluster
│   └── ...
└── middleware/
    ├── auth.js
    ├── corsConfig.js
    └── logger.js
```

---

## 🎓 Exemple Cod

### Upload fișier din Frontend

```javascript
const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('http://localhost:3001/api/docker-cluster/add', {
    method: 'POST',
    body: formData
  });
  
  const data = await response.json();
  return data.file.cid;
};
```

### Check cluster health

```javascript
const checkHealth = async () => {
  const response = await fetch('http://localhost:3001/api/docker-cluster/health');
  const data = await response.json();
  
  console.log('Status:', data.health.status);
  console.log('Online:', data.health.onlineNodes);
};
```

---

## 📄 Licență

Proiect educațional - Lucrare de Licență

---

## 🙏 Credits

- **IPFS**: https://ipfs.io/
- **IPFS Cluster**: https://cluster.ipfs.io/
- **Docker**: https://www.docker.com/

---

## 📞 Support

Pentru probleme sau întrebări:
1. Verifică documentația în `Backend/`
2. Rulează testele automate
3. Consultă secțiunea Troubleshooting

---

**Versiune:** 1.0.0  
**Data:** 20 noiembrie 2025  
**Status:** ✅ Production Ready