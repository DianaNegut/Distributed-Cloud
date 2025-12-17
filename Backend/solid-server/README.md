# Community Solid Server cu IPFS Backend

Această implementare integrează **Community Solid Server (CSS)** oficial cu **IPFS Cluster** ca backend de stocare, conform arhitecturii descrise în articolul academic:

**"Solid over the Interplanetary File System"**  
*Fabrizio Parrillo & Christian Tschudin, University of Basel*

## Arhitectură

```
┌─────────────────────────────────────────────┐
│  Community Solid Server (CSS)               │
│  ┌────────────────────────────────────┐    │
│  │  HTTP Server (port 3002)           │    │
│  │  - LDP (Linked Data Platform)      │    │
│  │  - WebACL Authorization            │    │
│  │  - Authentication                  │    │
│  └──────────────┬─────────────────────┘    │
│                 │                            │
│  ┌──────────────▼─────────────────────┐    │
│  │  Storage Module                    │    │
│  │  - DataAccessorBasedStore          │    │
│  └──────────────┬─────────────────────┘    │
│                 │                            │
│  ┌──────────────▼─────────────────────┐    │
│  │  IPFSDataAccessor (custom)         │    │
│  │  - getData()                       │    │
│  │  - getMetadata()                   │    │
│  │  - writeDocument()                 │    │
│  │  - writeContainer()                │    │
│  │  - deleteResource()                │    │
│  └──────────────┬─────────────────────┘    │
└─────────────────┼─────────────────────────┘
                  │ IPFS API
                  ↓
┌─────────────────────────────────────────────┐
│  IPFS Cluster (5 Docker Nodes)              │
│  - MFS (Mutable File System)                │
│  - Content-addressable storage (CID)        │
│  - Replication: 2-3 copies                 │
└─────────────────────────────────────────────┘
```

## Componente

### 1. IPFSDataAccessor.js
Implementează interfața `DataAccessor` din CSS pentru a conecta cu IPFS Cluster:

- **canHandle()** - Verifică dacă poate gestiona reprezentarea
- **getData()** - Citește fișiere din IPFS MFS
- **getMetadata()** - Obține metadata (CID, size, type, etc.)
- **writeDocument()** - Scrie fișiere în IPFS
- **writeContainer()** - Creează directoare
- **deleteResource()** - Șterge resurse

### 2. css-config.json
Configurație CSS care:
- Importă module-le CSS standard
- Definește IPFSDataAccessor ca backend storage
- Configurează port-ul (3002) și base URL
- Activează WebACL pentru control acces

### 3. start-css.js
Script de pornire pentru CSS cu:
- Inițializare AppRunner
- Binding-uri variabile
- Graceful shutdown handlers
- Logging detaliat

## Instalare Dependențe

```bash
cd Backend
npm install @solid/community-server form-data
```

## Pornire Server CSS

### Opțiunea 1: Direct
```bash
cd Backend
node solid-server/start-css.js
```

### Opțiunea 2: Cu npm script
Adaugă în `package.json`:
```json
{
  "scripts": {
    "start:css": "node solid-server/start-css.js",
    "start:all": "concurrently \"npm start\" \"npm run start:css\""
  }
}
```

Apoi:
```bash
npm run start:css
```

## Testare

### 1. Verifică server-ul
```bash
curl http://localhost:3002/
```

### 2. Creează un POD
```bash
# CSS necesită autentificare - folosește frontend-ul sau Solid apps
```

### 3. Upload fișier
Folosește aplicații Solid compatibile:
- Solid File Browser: https://otto-aa.github.io/solid-filemanager/
- Penny: https://penny.vincenttunru.com/

## Integrare cu Backend-ul Existent

CSS rulează independent pe **port 3002**, în paralel cu Express.js pe **port 3001**:

```javascript
// Express.js (port 3001)
// - API routes (/api/*)
// - Autentificare custom
// - Filecoin, storage contracts
// - IPFS cluster management

// CSS (port 3002)
// - Solid POD operations (/)
// - LDP resources
// - WebACL authorization
// - RDF/Linked Data
```

### Proxy în Frontend

Actualizează `package.json` frontend:
```json
{
  "proxy": {
    "/api": {
      "target": "http://localhost:3001"
    },
    "/": {
      "target": "http://localhost:3002"
    }
  }
}
```

## Diferențe față de Implementarea Custom

| Aspect | Custom (anterior) | CSS Official |
|--------|-------------------|--------------|
| Server | Express.js custom routes | Community Solid Server |
| Spec compliance | Parțial | 100% conform spec Solid |
| Modularitate | Monolitic | Modular (5 module) |
| Autentificare | Custom (username/password) | Solid-OIDC (WebID) |
| LDP support | Parțial (doar containers) | Complet (RDF, SPARQL) |
| Compatibilitate apps | Limitată | Toate app-urile Solid |

## Limitări Curente

1. **CSS 5.x** nu include identity provider - folosește solidcommunity.net pentru WebID
2. **Performance** - CSS e în dezvoltare, poate fi mai lent decât custom
3. **Curba de învățare** - Solid spec e complexă (RDF, Turtle, SPARQL)

## Debugging

Activează logging detaliat:
```bash
LOG_LEVEL=debug node solid-server/start-css.js
```

Verifică IPFS cluster:
```bash
curl http://localhost:9094/api/v0/id
```

## Referințe

- **Articol**: "Solid over the Interplanetary File System" (2021)
- **CSS Docs**: https://communitysolidserver.github.io/CommunitySolidServer/
- **Solid Spec**: https://solidproject.org/TR/protocol
- **IPFS Docs**: https://docs.ipfs.tech/
