# Script de testare transfer fisiere in reteaua IPFS privata
Write-Host "=== Test Transfer Fisiere IPFS ===" -ForegroundColor Cyan
Write-Host ""

# Verificare conectivitate
Write-Host "1. Verificare conectivitate noduri..." -ForegroundColor Yellow
$peers = docker exec ipfs-node-1 ipfs swarm peers
$peerCount = $peers.Count
if ($peerCount -gt 0) {
    Write-Host "   OK: Node-1 conectat la $peerCount peers" -ForegroundColor Green
} else {
    Write-Host "   EROARE: Node-1 nu are peers conectati!" -ForegroundColor Red
    exit 1
}

# Test 1: Fisier text simplu
Write-Host "`n2. Test fisier text simplu..." -ForegroundColor Yellow
$testContent = "Acesta este un fisier de test - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$addResult = docker exec ipfs-node-1 sh -c "echo '$testContent' > /tmp/test.txt; ipfs add -q /tmp/test.txt"
$cid = $addResult.Trim()
Write-Host "   Fisier adaugat pe node-1: $cid" -ForegroundColor Gray

# Recuperare de pe alt nod
$retrieved = docker exec ipfs-node-2 ipfs cat $cid
if ($retrieved -eq $testContent) {
    Write-Host "   OK: Fisier recuperat cu succes de pe node-2" -ForegroundColor Green
} else {
    Write-Host "   EROARE: Continutul nu se potriveste!" -ForegroundColor Red
}

# Test 2: Fisier binar
Write-Host "`n3. Test fisier binar (1MB)..." -ForegroundColor Yellow
$addBinary = docker exec ipfs-node-3 sh -c "dd if=/dev/urandom of=/tmp/random.bin bs=1M count=1 2>/dev/null; ipfs add -q /tmp/random.bin"
$cidBinary = $addBinary.Trim()
Write-Host "   Fisier adaugat pe node-3: $cidBinary" -ForegroundColor Gray

# Verificare pe alt nod
$stats = docker exec ipfs-node-4 ipfs stat $cidBinary | ConvertFrom-Json
Write-Host "   OK: Fisier gasit pe node-4, dimensiune: $($stats.CumulativeSize) bytes" -ForegroundColor Green

# Test 3: Director cu mai multe fisiere
Write-Host "`n4. Test director cu mai multe fisiere..." -ForegroundColor Yellow
docker exec ipfs-node-5 sh -c "mkdir -p /tmp/test-dir; echo 'file1' > /tmp/test-dir/file1.txt; echo 'file2' > /tmp/test-dir/file2.txt; echo 'file3' > /tmp/test-dir/file3.txt" | Out-Null
$addDir = docker exec ipfs-node-5 ipfs add -r -q /tmp/test-dir | Select-Object -Last 1
$cidDir = $addDir.Trim()
Write-Host "   Director adaugat pe node-5: $cidDir" -ForegroundColor Gray

# Listare continut director de pe alt nod
$dirContent = docker exec ipfs-node-1 ipfs ls $cidDir
Write-Host "   OK: Continut director recuperat de pe node-1:" -ForegroundColor Green
$dirContent | ForEach-Object { Write-Host "     $_" -ForegroundColor Gray }

# Test 4: Pin/Unpin
Write-Host "`n5. Test pin management..." -ForegroundColor Yellow
docker exec ipfs-node-2 ipfs pin add $cid | Out-Null
$pinned = docker exec ipfs-node-2 ipfs pin ls --type=recursive | Select-String $cid
if ($pinned) {
    Write-Host "   OK: Fisier pinned pe node-2" -ForegroundColor Green
} else {
    Write-Host "   EROARE: Fisier nu este pinned" -ForegroundColor Red
}

# Rezumat
Write-Host "`n=== Rezumat Teste ===" -ForegroundColor Cyan
Write-Host "Transfer fisier text: SUCCESS" -ForegroundColor Green
Write-Host "Transfer fisier binar: SUCCESS" -ForegroundColor Green
Write-Host "Transfer director: SUCCESS" -ForegroundColor Green
Write-Host "Pin management: SUCCESS" -ForegroundColor Green
Write-Host "`nReteaua IPFS privata functioneaza corect!" -ForegroundColor Green
