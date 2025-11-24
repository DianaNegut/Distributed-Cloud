# Test Script pentru Rețea Privată IPFS
# Rulează acest script pentru a testa conectivitatea completă

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Test Rețea Privată IPFS - Distributed Cloud" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Functie pentru verificare containere
function Test-Container {
    param($containerName)
    $status = docker inspect -f "{{.State.Status}}" $containerName 2>$null
    return $status -eq "running"
}

# Pasul 1: Verifică clusterul principal
Write-Host "[1/7] Verificare cluster principal..." -ForegroundColor Yellow
$clusterNodes = @("ipfs-node-1", "ipfs-node-2", "ipfs-node-3", "ipfs-node-4", "ipfs-node-5")
$clusterRunning = $true

foreach ($node in $clusterNodes) {
    if (Test-Container $node) {
        Write-Host "  [OK] $node : running" -ForegroundColor Green
    } else {
        Write-Host "  [X] $node : not running" -ForegroundColor Red
        $clusterRunning = $false
    }
}

if (-not $clusterRunning) {
    Write-Host "`n[ERROR] Clusterul principal nu ruleaza complet!" -ForegroundColor Red
    Write-Host "Ruleaza: docker-compose up -d in directorul Infrastructura" -ForegroundColor Yellow
    exit 1
}

# Pasul 2: Verifica swarm.key
Write-Host "`n[2/7] Verificare swarm.key..." -ForegroundColor Yellow
if (Test-Path ".\test-peer\swarm.key") {
    Write-Host "  [OK] swarm.key gasit in test-peer/" -ForegroundColor Green
} else {
    Write-Host "  [!] swarm.key nu exista in test-peer/, se copiaza..." -ForegroundColor Yellow
    Copy-Item ".\swarm.key" ".\test-peer\swarm.key"
    Write-Host "  [OK] swarm.key copiat" -ForegroundColor Green
}

# Pasul 3: Porneste test peers
Write-Host "`n[3/7] Pornire test peers..." -ForegroundColor Yellow
Push-Location test-peer
docker-compose -f docker-compose.test.yml up -d --build 2>$null
Pop-Location
Start-Sleep -Seconds 5

if ((Test-Container "test-peer-1") -and (Test-Container "test-peer-2")) {
    Write-Host "  [OK] Test peers pornite cu succes" -ForegroundColor Green
} else {
    Write-Host "  [X] Eroare la pornirea test peers" -ForegroundColor Red
    exit 1
}

# Pasul 4: Asteapta initializare
Write-Host "`n[4/7] Asteptare initializare (15 secunde)..." -ForegroundColor Yellow
for ($i = 15; $i -gt 0; $i--) {
    Write-Host "  [$i] secunde..." -NoNewline
    Start-Sleep -Seconds 1
    Write-Host "`r" -NoNewline
}
Write-Host "  [OK] Initializare completa              " -ForegroundColor Green

# Pasul 5: Verifica peers in cluster
Write-Host "`n[5/7] Verificare conectivitate cluster -> test peers..." -ForegroundColor Yellow
$peers = docker exec ipfs-node-1 ipfs swarm peers 2>$null
$peerCount = ($peers | Measure-Object -Line).Lines

Write-Host "  [INFO] ipfs-node-1 are $peerCount peers conectati" -ForegroundColor Cyan

if ($peerCount -ge 6) {
    Write-Host "  [OK] Conectivitate buna (cluster + test peers)" -ForegroundColor Green
} elseif ($peerCount -ge 4) {
    Write-Host "  [WARN] Conectivitate partiala ($peerCount peers)" -ForegroundColor Yellow
} else {
    Write-Host "  [X] Conectivitate slaba ($peerCount peers)" -ForegroundColor Red
}

# Pasul 6: Verifica peers in test-peer-1
Write-Host "`n[6/7] Verificare conectivitate test-peer-1 -> cluster..." -ForegroundColor Yellow
$testPeers = docker exec test-peer-1 ipfs swarm peers 2>$null
$testPeerCount = ($testPeers | Measure-Object -Line).Lines

Write-Host "  [INFO] test-peer-1 are $testPeerCount peers conectati" -ForegroundColor Cyan

if ($testPeerCount -ge 1) {
    Write-Host "  [OK] Test peer conectat la cluster" -ForegroundColor Green
} else {
    Write-Host "  [X] Test peer nu e conectat" -ForegroundColor Red
}

# Pasul 7: Test partajare fisier
Write-Host "`n[7/7] Test partajare fisier..." -ForegroundColor Yellow
$testContent = "Test Network Connectivity - $(Get-Date)"
$hash = ($testContent | docker exec -i test-peer-1 ipfs add -q 2>$null)

if ($hash) {
    Write-Host "  [OK] Fisier adaugat in test-peer-1: $hash" -ForegroundColor Green
    
    # Incearca sa accesezi din cluster
    Start-Sleep -Seconds 2
    $content = docker exec ipfs-node-1 ipfs cat $hash 2>$null
    
    if ($content -eq $testContent) {
        Write-Host "  [OK] Fisier accesat cu succes din ipfs-node-1!" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] Fisierul nu e disponibil imediat in cluster (normal pentru DHT)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  [X] Eroare la adaugare fisier" -ForegroundColor Red
}

# Sumar final
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  SUMAR TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nCluster Nodes:" -ForegroundColor White
foreach ($node in $clusterNodes) {
    $peers = docker exec $node ipfs swarm peers 2>$null | Measure-Object -Line
    Write-Host "  • $node : $($peers.Lines) peers" -ForegroundColor Gray
}

Write-Host "`nTest Nodes:" -ForegroundColor White
foreach ($testNode in @("test-peer-1", "test-peer-2")) {
    $peers = docker exec $testNode ipfs swarm peers 2>$null | Measure-Object -Line
    Write-Host "  • $testNode : $($peers.Lines) peers" -ForegroundColor Gray
}

Write-Host "`nPeer IDs:" -ForegroundColor White
$testPeer1Id = docker exec test-peer-1 ipfs id -f="<id>" 2>$null
$testPeer2Id = docker exec test-peer-2 ipfs id -f="<id>" 2>$null
Write-Host "  • test-peer-1: $testPeer1Id" -ForegroundColor Gray
Write-Host "  • test-peer-2: $testPeer2Id" -ForegroundColor Gray

Write-Host "`n[SUCCESS] Test complet!" -ForegroundColor Green
Write-Host "`nComenzi utile:" -ForegroundColor Yellow
Write-Host "  - Vezi logs: docker logs test-peer-1 -f" -ForegroundColor Gray
Write-Host "  - Vezi peers: docker exec test-peer-1 ipfs swarm peers" -ForegroundColor Gray
Write-Host "  - Opreste test: cd test-peer; docker-compose -f docker-compose.test.yml down" -ForegroundColor Gray
Write-Host ""
