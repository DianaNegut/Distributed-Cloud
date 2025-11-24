# Test Peer - Testare Rețea Privată IPFS

Acest director conține un setup Docker pentru testarea conectivității la rețeaua privată IPFS.

## 📋 Cerințe

- Clusterul principal trebuie să ruleze (`docker-compose up -d` în directorul `Infrastructura`)
- Fișierul `swarm.key` trebuie să existe în directorul părinte

## 🚀 Pornire Test Peers

### Pasul 1: Asigură-te că clusterul principal rulează

```powershell
cd C:\ATM\LICENTA\Distributed-Cloud\Infrastructura
docker-compose ps
```

Ar trebui să vezi 10 containere running.

### Pasul 2: Copiază swarm.key în directorul test-peer

```powershell
cd C:\ATM\LICENTA\Distributed-Cloud\Infrastructura\test-peer
copy ..\swarm.key .
```

### Pasul 3: Pornește test peers

```powershell
docker-compose -f docker-compose.test.yml up -d --build
```

Acest lucru va crea 2 noduri IPFS de test care vor încerca să se conecteze la rețeaua privată.

### Pasul 4: Verifică logs

```powershell
# Vezi logs de la primul test peer
docker logs test-peer-1 -f

# Vezi logs de la al doilea test peer
docker logs test-peer-2 -f
```

**Ar trebui să vezi**:
- "✓ swarm.key găsit"
- "✓ Bootstrap peer detectat: ..."
- "Swarm listening on ..."

## 🔍 Verificare Conectivitate

### Verifică peers din clusterul principal

```powershell
# Din ipfs-node-1
docker exec ipfs-node-1 ipfs swarm peers

# Ar trebui să vezi test-peer-1 și test-peer-2 în listă
```

### Verifică peers din test peer

```powershell
# Din test-peer-1
docker exec test-peer-1 ipfs swarm peers

# Ar trebui să vezi nodurile din cluster (ipfs-node-1, ipfs-node-2, etc.)
```

### Verifică prin API

```powershell
# Obține peer ID de la test-peer-1
docker exec test-peer-1 ipfs id -f="<id>"

# Verifică din backend
Invoke-RestMethod -Uri "http://localhost:3001/api/peers" -Headers @{"x-api-key"="supersecret"}
```

## 🧪 Test de Sincronizare Fișiere

### Test 1: Upload din test peer

```powershell
# Creează un fișier de test
"Test content from test-peer-1" | docker exec -i test-peer-1 ipfs add -q

# Copiază hash-ul returnat (ex: QmXxXxXx...)
# Verifică dacă e disponibil pe cluster:
docker exec ipfs-node-1 ipfs cat QmXxXxXx...
```

### Test 2: Upload din cluster, acces din test peer

```powershell
# Upload un fișier în cluster prin backend
# (folosește interfața web sau API)

# Apoi accesează-l din test peer:
docker exec test-peer-1 ipfs cat <HASH>
```

## 🛑 Oprire Test Peers

```powershell
docker-compose -f docker-compose.test.yml down

# Cu ștergere volume (pierdere date):
docker-compose -f docker-compose.test.yml down -v
```

## 🐛 Troubleshooting

### Test peers nu se conectează

```powershell
# Verifică dacă swarm.key e identic
docker exec test-peer-1 cat /data/ipfs/swarm.key
docker exec ipfs-node-1 cat /data/ipfs/swarm.key

# Ar trebui să fie identice!
```

### Nu apare în lista de peers

```powershell
# Verifică network
docker network inspect infrastructura_ipfs-net

# Verifică dacă containerele sunt în aceeași rețea
```

### Erori de conexiune

```powershell
# Verifică bootstrap nodes
docker exec test-peer-1 ipfs bootstrap list

# Ar trebui să vezi ipfs-node-1
```

## 📊 Monitorizare

### Dashboard rapid

```powershell
# Număr peers pe fiecare nod
echo "=== Cluster Nodes ==="
for ($i=1; $i -le 5; $i++) {
    $peers = docker exec ipfs-node-$i ipfs swarm peers 2>$null | Measure-Object -Line
    Write-Host "ipfs-node-$i: $($peers.Lines) peers"
}

echo "`n=== Test Nodes ==="
for ($i=1; $i -le 2; $i++) {
    $peers = docker exec test-peer-$i ipfs swarm peers 2>$null | Measure-Object -Line
    Write-Host "test-peer-$i: $($peers.Lines) peers"
}
```

## ✅ Test Complet de Succes

Un test complet de succes înseamnă:

1. ✅ Test peers pornesc fără erori
2. ✅ Test peers au swarm.key montat
3. ✅ Test peers se conectează la bootstrap node
4. ✅ Test peers apar în lista de peers a nodurilor cluster
5. ✅ Fișierele pot fi partajate între test peers și cluster
6. ✅ Backend-ul vede test peers în `/api/peers`

---

**Notă**: Test peers folosesc aceeași rețea Docker (`infrastructura_ipfs-net`) ca și clusterul principal pentru a simula conectivitatea în rețeaua privată.
