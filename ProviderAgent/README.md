# Provider Agent - Distributed Cloud

Această aplicație îți permite să devii un **provider de stocare** în rețeaua Distributed Cloud.

## 📋 Cerințe

1. **Node.js** (v16+)
2. **IPFS/Kubo** instalat local
   - Download: https://docs.ipfs.tech/install/

## 🚀 Instalare

```bash
# 1. Instalează dependențele
cd ProviderAgent
npm install

# 2. Inițializează IPFS (doar prima dată)
ipfs init

# 3. Pornește IPFS daemon (într-un terminal separat)
ipfs daemon
```

## ⚙️ Configurare

Editează `config.js` sau folosește variabile de mediu:

```bash
# Setează username-ul tău (obligatoriu!)
set PROVIDER_USERNAME=dianam
npm start
```

Sau editează direct `config.js`:
```javascript
PROVIDER_USERNAME: 'dianam',
```

## ▶️ Pornire

```bash
# Terminal 1: Pornește IPFS
ipfs daemon

# Terminal 2: Pornește Provider Agent
npm start
```

## 📊 Ce Face Agent-ul?

1. **Înregistrare** - Se conectează la backend cu Peer ID-ul tău IPFS
2. **Heartbeat** - Trimite status la fiecare 30 secunde (online/offline)
3. **Pin Files** - Primește cereri de stocare și pin-uiește fișiere
4. **Sync** - Raportează capacitatea și fișierele stocate

## 🔧 Debugging

```bash
# Mod verbose (afișează toate log-urile)
npm run dev
```

## ❓ Probleme Comune

| Problemă | Soluție |
|----------|---------|
| "IPFS daemon is not running" | Pornește `ipfs daemon` în alt terminal |
| "Cannot connect to backend" | Verifică că backend-ul rulează |
| "PROVIDER_USERNAME not set" | Setează username în config.js |
