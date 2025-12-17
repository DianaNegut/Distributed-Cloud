# 🔐 Securitate și Redundanță Fișiere

## Arhitectura de Securitate

### 1. **Criptare End-to-End (AES-256-GCM)**

#### Cum funcționează:
```
┌─────────────┐     Encrypt      ┌──────────────┐     Upload      ┌─────────────┐
│   Browser   │ ──────────────>  │  Encrypted   │ ─────────────>  │ IPFS Cluster│
│ (Plain Text)│    AES-256-GCM   │     File     │                 │  (Storage)  │
└─────────────┘                  └──────────────┘                 └─────────────┘
      ↓                                                                     ↓
  [User Key]                                                       [Encrypted Blob]
                                                                   ❌ Provider nu poate citi
```

#### Caracteristici:
- **Algorithm**: AES-256-GCM (Advanced Encryption Standard, 256-bit, Galois/Counter Mode)
- **Key Generation**: Cryptographically secure random keys (Web Crypto API)
- **IV (Initialization Vector)**: Random 12 bytes pentru fiecare fișier
- **Metadata Protection**: Numele original și dimensiunea sunt incluse în fișierul criptat
- **Key Storage**: 
  - 🔑 Cheia este generată automat pentru fiecare contract
  - 💾 Stocată în `localStorage` (în producție: hardware security module sau key vault)
  - 🔗 Asociată cu ID-ul contractului

#### Proces de Upload:
```javascript
1. User selectează fișier (file.pdf, 10 MB)
2. Browser generează/folosește cheia contractului
3. Criptare în browser:
   - Citire fișier ca ArrayBuffer
   - Generare IV random
   - Encrypt cu AES-256-GCM
   - Rezultat: file.pdf.encrypted (10.1 MB)
4. Upload fișier criptat → IPFS
5. Provider primește doar blob criptat
   ❌ Provider nu are cheia → nu poate decripta
```

#### Proces de Download:
```javascript
1. User cere fișierul (CID)
2. Download blob criptat din IPFS
3. Browser:
   - Extrage IV din metadata
   - Folosește cheia contractului
   - Decrypt cu AES-256-GCM
   - Rezultat: fișier original (file.pdf)
4. Browser oferă download cu numele original
```

#### Securitate:
- ✅ **Zero-Knowledge**: Provider-ul nu știe ce conține fișierul
- ✅ **Client-Side Only**: Cheia nu părăsește niciodată browser-ul utilizatorului
- ✅ **Authenticated Encryption**: GCM mode detectează orice modificare a fișierului
- ✅ **Unique IV**: Fiecare fișier are IV diferit → previne analiza pattern-urilor

---

### 2. **Replicare Multi-Node**

#### Cum funcționează:
```
┌──────────────┐
│   File.pdf   │
│   (Upload)   │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────┐
│         IPFS Cluster Coordinator         │
│    (Decides replication strategy)        │
└────────┬─────────┬─────────┬─────────────┘
         │         │         │
         ▼         ▼         ▼
    ┌───────┐ ┌───────┐ ┌───────┐
    │Node 1 │ │Node 2 │ │Node 3 │
    │  ✓    │ │  ✓    │ │  ✓    │
    └───────┘ └───────┘ └───────┘
    
    Replication Factor: 3
    ✅ Dacă 1 nod pică → datele rămân disponibile
```

#### Parametri de Replicare:
- **Replication Factor**: 3 noduri (default)
- **Min Replication**: 2 noduri (minim pentru availability)
- **Max Replication**: 3 noduri (pentru redundanță)

#### Strategia de Pinning:
```javascript
{
  replication_factor_min: 2,  // Minim 2 copii active
  replication_factor_max: 3,  // Maxim 3 copii
  mode: 'recursive',          // Pin tot conținutul (inclusiv directoare)
  pin_options: {
    replication: 3
  }
}
```

#### Status de Replicare:
- **🟢 Complete**: Fișierul este pe toate nodurile configurate (3/3)
- **🟠 Partial**: Fișierul este pe unele noduri (1-2/3)
- **🔴 Pending**: Replicare în curs
- **⚠️ Degraded**: Sub minimum (< 2 noduri)

#### Beneficii:
1. **Fault Tolerance**:
   - 1 nod pică → 2 copii rămân → ✅ Date disponibile
   - 2 noduri pică → 1 copie rămâne → ⚠️ Warning, re-replicate ASAP

2. **Load Balancing**:
   - Download-urile se distribuie pe multiple noduri
   - Performance îmbunătățit la acces concurent

3. **Geographic Distribution** (cu IPFS Cluster extins):
   - Noduri în locații diferite
   - Latency redusă pentru utilizatori globali

---

### 3. **Verificare Integritate**

#### IPFS Content Addressing:
```
File → SHA-256 Hash → CID (Content Identifier)

Example:
file.pdf → QmXg9Pp2ytZ2gvPJ8JCYhBQPPxtcFqZDrqGfKZALJC1j5b

✅ Orice modificare → CID diferit
✅ CID identic = conținut identic (garantat)
```

#### Verificări:
1. **Upload**: Hash-ul fișierului criptat = CID IPFS
2. **Storage**: IPFS verifică hash-ul automat la salvare
3. **Download**: Browser verifică CID-ul primit
4. **Decryption**: GCM mode verifică autenticitatea

---

## Configurare Contract cu Securitate

### Schema Contract:
```javascript
{
  "id": "contract-xyz",
  "renterId": "user-123",
  "providerId": "provider-abc",
  "storage": {
    "allocatedGB": 50,
    "usedGB": 12.5,
    "files": [
      {
        "cid": "QmXg9...",
        "name": "document.pdf.encrypted",
        "size": 5242880,
        "uploadedAt": "2025-12-17T10:30:00Z",
        "encryption": {
          "enabled": true,
          "algorithm": "AES-256-GCM",
          "iv": "base64_encoded_iv",
          "originalName": "document.pdf",
          "originalSize": 5000000
        },
        "replication": {
          "factor": 3,
          "status": "complete",
          "nodes": 3,
          "lastChecked": "2025-12-17T11:00:00Z"
        }
      }
    ]
  },
  "encryption": {
    "enabled": true,
    "key": "base64_encoded_key",  // În producție: HSM/KMS
    "algorithm": "AES-256-GCM",
    "createdAt": "2025-12-01T00:00:00Z"
  }
}
```

---

## Flux Complet: Upload → Storage → Download

### 1. Upload cu Criptare și Replicare:
```
┌────────────┐
│   USER     │
└──────┬─────┘
       │ 1. Select file (report.pdf, 20 MB)
       │
       ▼
┌─────────────────────────────────────────┐
│          BROWSER (Client-Side)          │
│                                         │
│  2. Load contract encryption key        │
│  3. Encrypt file:                       │
│     - Generate random IV                │
│     - AES-256-GCM encrypt               │
│     - Result: report.pdf.encrypted      │
│                                         │
│  4. Upload encrypted blob               │
└──────────┬──────────────────────────────┘
           │
           ▼
┌────────────────────────────────────────────┐
│          BACKEND (Server-Side)             │
│                                            │
│  5. Receive encrypted file                 │
│  6. Add to IPFS Cluster                    │
│  7. Configure replication (factor: 3)      │
│  8. Store metadata:                        │
│     - CID                                  │
│     - Encryption info (IV, algorithm)      │
│     - Replication status                   │
└──────────┬─────────────────────────────────┘
           │
           ▼
┌────────────────────────────────────────────┐
│         IPFS CLUSTER                       │
│                                            │
│  9. Pin file on 3 nodes:                   │
│     Node 1: ✓ Pinned (QmXg9...)           │
│     Node 2: ✓ Pinned (QmXg9...)           │
│     Node 3: ✓ Pinned (QmXg9...)           │
│                                            │
│  10. Return success + CID                  │
└────────────────────────────────────────────┘
           │
           ▼
    ✅ File stored securely:
       - Encrypted ✓
       - Replicated on 3 nodes ✓
       - Content-addressed (CID) ✓
```

### 2. Download cu Decriptare:
```
┌────────────┐
│   USER     │
└──────┬─────┘
       │ 1. Request file (CID: QmXg9...)
       │
       ▼
┌─────────────────────────────────────────┐
│         IPFS CLUSTER                    │
│                                         │
│  2. Find file on available nodes        │
│  3. Retrieve from closest/fastest node  │
│  4. Return encrypted blob               │
└──────────┬──────────────────────────────┘
           │
           ▼
┌────────────────────────────────────────────┐
│          BROWSER (Client-Side)             │
│                                            │
│  5. Receive encrypted blob                 │
│  6. Load contract encryption key           │
│  7. Extract IV from metadata               │
│  8. Decrypt with AES-256-GCM:              │
│     - Verify authentication tag            │
│     - Decrypt data                         │
│  9. Restore original file:                 │
│     - Original name: report.pdf            │
│     - Original size: 20 MB                 │
│                                            │
│  10. Trigger browser download              │
└────────────────────────────────────────────┘
           │
           ▼
    ✅ User gets original file:
       - Decrypted ✓
       - Verified integrity ✓
       - Original name/size ✓
```

---

## Scenarii de Failover

### Scenario 1: Un Nod Pică
```
Before:
Node 1: ✓ (file)
Node 2: ✓ (file)
Node 3: ✓ (file)

After Node 2 crash:
Node 1: ✓ (file)
Node 2: ❌ (down)
Node 3: ✓ (file)

Result: 2/3 nodes → ✅ File still available
Action: Cluster auto-repairs → replicate to new node
```

### Scenario 2: Doi Noduri Pică
```
Before:
Node 1: ✓ (file)
Node 2: ✓ (file)
Node 3: ✓ (file)

After Node 2 & Node 3 crash:
Node 1: ✓ (file)
Node 2: ❌ (down)
Node 3: ❌ (down)

Result: 1/3 nodes → ⚠️ Degraded but still accessible
Action: URGENT - Cluster alerts + auto-repair
```

### Scenario 3: Provider Malițios
```
Provider încearcă să citească fișierul:
1. Provider descarcă blob de pe nod
2. Provider vede doar date criptate:
   0x8f3a2b9c7e1d... (gibberish)
3. Provider nu are cheia de decriptare
4. ❌ Provider nu poate decripta
   
Result: ✅ Confidențialitate păstrată
```

---

## Best Practices

### Pentru Utilizatori:
1. ✅ **Activează criptarea** pentru fișiere sensibile
2. ✅ **Backup cheii contractului** (în producție: nu stoca în localStorage)
3. ✅ **Verifică status replicare** înainte de ștergerea fișierelor locale
4. ⚠️ **Nu dezactiva criptarea** pentru date confidențiale

### Pentru Administratori:
1. ✅ **Monitorizează health nodurilor** (uptime, disk space)
2. ✅ **Configurează alerting** când replication < min threshold
3. ✅ **Auto-repair** pentru noduri căzute
4. ✅ **Key management** cu HSM/KMS în producție
5. ✅ **Regular integrity checks** (verify CIDs)

---

## Implementare în Producție

### Key Management:
```javascript
// Development (localStorage)
localStorage.setItem(`contract_key_${contractId}`, key);

// Production (AWS KMS example)
const kms = new AWS.KMS();
await kms.encrypt({
  KeyId: 'arn:aws:kms:...',
  Plaintext: key,
  EncryptionContext: {
    contractId: contractId,
    userId: userId
  }
});
```

### Monitoring:
```javascript
// Check replication health
setInterval(async () => {
  for (const file of contract.storage.files) {
    const status = await ipfsCluster.getPinStatus(file.cid);
    const pinnedNodes = countPinnedNodes(status);
    
    if (pinnedNodes < MIN_REPLICATION) {
      alertAdmin(`File ${file.cid} degraded: ${pinnedNodes} nodes`);
      await ipfsCluster.repairPin(file.cid);
    }
  }
}, 60000); // Check every minute
```

---

## Concluzie

Sistemul oferă:
- 🔐 **Confidențialitate**: Criptare AES-256 client-side
- 🔄 **Disponibilitate**: Replicare pe 3+ noduri
- ✅ **Integritate**: Content-addressing (CID)
- 🛡️ **Zero-Knowledge**: Provider-ul nu poate citi datele

**Rezultat**: Date sigure, private și mereu disponibile! 🚀
