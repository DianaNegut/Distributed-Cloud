# Quick Status Check pentru Rețea Privată IPFS
# Rulează pentru a vedea un overview rapid

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "     Distributed Cloud - Network Status Check" -ForegroundColor Cyan
Write-Host "==================================================`n" -ForegroundColor Cyan

# Funcție pentru colorat output
function Write-Status {
    param($label, $value, $color = "White")
    Write-Host "  $label : " -NoNewline -ForegroundColor Gray
    Write-Host $value -ForegroundColor $color
}

# 1. Cluster Status
Write-Host "📊 CLUSTER STATUS" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────" -ForegroundColor DarkGray

$clusterNodes = @("ipfs-node-1", "ipfs-node-2", "ipfs-node-3", "ipfs-node-4", "ipfs-node-5")
$runningNodes = 0

foreach ($node in $clusterNodes) {
    $status = docker inspect -f "{{.State.Status}}" $node 2>$null
    if ($status -eq "running") {
        $runningNodes++
        Write-Status $node "[OK] running" "Green"
    } else {
        Write-Status $node "[X] stopped" "Red"
    }
}

Write-Host ""
if ($runningNodes -eq 5) {
    Write-Host "  [SUCCESS] Cluster complet operational ($runningNodes/5 noduri)" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Cluster partial operational ($runningNodes/5 noduri)" -ForegroundColor Yellow
}

# 2. Peer Connectivity
Write-Host "`n[NETWORK] PEER CONNECTIVITY" -ForegroundColor Yellow
Write-Host "-----------------------------------------------------" -ForegroundColor DarkGray

$totalPeers = 0
foreach ($node in $clusterNodes) {
    $peers = docker exec $node ipfs swarm peers 2>$null
    $peerCount = ($peers | Measure-Object -Line).Lines
    $totalPeers += $peerCount
    Write-Status $node "$peerCount peers" "Cyan"
}

$avgPeers = [math]::Round($totalPeers / 5, 1)
Write-Host ""
Write-Host "  [AVG] Media: $avgPeers peers/nod" -ForegroundColor Cyan
Write-Host "  [TOTAL] Total conexiuni: $totalPeers" -ForegroundColor Cyan

# 3. Test Peers Status
Write-Host "`n[TEST] TEST PEERS STATUS" -ForegroundColor Yellow
Write-Host "-----------------------------------------------------" -ForegroundColor DarkGray

$testPeers = @("test-peer-1", "test-peer-2")
$testRunning = 0

foreach ($testNode in $testPeers) {
    $status = docker inspect -f "{{.State.Status}}" $testNode 2>$null
    if ($status -eq "running") {
        $testRunning++
        $peers = docker exec $testNode ipfs swarm peers 2>$null | Measure-Object -Line
        Write-Status $testNode "[OK] running ($($peers.Lines) peers)" "Green"
    } else {
        Write-Status $testNode "[X] stopped" "DarkGray"
    }
}

if ($testRunning -gt 0) {
    Write-Host "`n  [OK] $testRunning test peer(s) activ(e)" -ForegroundColor Green
} else {
    Write-Host "`n  [INFO] Nu ruleaza test peers (optional)" -ForegroundColor DarkGray
}

# 4. Cluster API Status
Write-Host "`n[API] CLUSTER API STATUS" -ForegroundColor Yellow
Write-Host "-----------------------------------------------------" -ForegroundColor DarkGray

$clusterPorts = @(9094, 9194, 9294, 9394, 9494)
$apiAvailable = 0

foreach ($port in $clusterPorts) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$port/health" -Method Get -TimeoutSec 2 2>$null
        if ($response.StatusCode -eq 204 -or $response.StatusCode -eq 200) {
            $apiAvailable++
            Write-Status "Port $port" "[OK] healthy" "Green"
        }
    } catch {
        Write-Status "Port $port" "[X] unavailable" "Red"
    }
}

Write-Host ""
if ($apiAvailable -eq 5) {
    Write-Host "  [SUCCESS] Toate API-urile cluster disponibile" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Doar $apiAvailable/5 API-uri disponibile" -ForegroundColor Yellow
}

# 5. Private Network Config
Write-Host "`n[SECURITY] PRIVATE NETWORK CONFIG" -ForegroundColor Yellow
Write-Host "-----------------------------------------------------" -ForegroundColor DarkGray

# Verifica swarm.key
$swarmKeyExists = Test-Path ".\swarm.key"
if ($swarmKeyExists) {
    $swarmKeyContent = Get-Content ".\swarm.key" -Raw
    $keyHash = ($swarmKeyContent | Get-FileHash -Algorithm MD5).Hash.Substring(0, 8)
    Write-Status "Swarm Key" "[OK] exista (hash: $keyHash)" "Green"
    
    # Verifica daca e montat in containere
    $mountedKey = docker exec ipfs-node-1 cat /data/ipfs/swarm.key 2>$null
    if ($mountedKey) {
        Write-Status "Montat in cluster" "[OK] yes" "Green"
    } else {
        Write-Status "Montat in cluster" "[X] no" "Red"
    }
} else {
    Write-Status "Swarm Key" "[X] nu exista" "Red"
}

# 6. Storage Info
Write-Host "`n[STORAGE] STORAGE INFO" -ForegroundColor Yellow
Write-Host "-----------------------------------------------------" -ForegroundColor DarkGray

$volumes = docker volume ls --format "{{.Name}}" | Where-Object { $_ -like "infrastructura_*" }
$volumeCount = ($volumes | Measure-Object).Count

Write-Status "Docker Volumes" "$volumeCount volume(s)" "Cyan"

# Incearca sa obtii pins din cluster
try {
    $pins = Invoke-RestMethod -Uri "http://localhost:9094/pins" -Method Get -TimeoutSec 2 2>$null
    if ($pins) {
        $pinCount = ($pins | Get-Member -MemberType NoteProperty | Measure-Object).Count
        Write-Status "Pinned Files" "$pinCount file(s)" "Cyan"
    }
} catch {
    Write-Status "Pinned Files" "N/A" "DarkGray"
}

# Summary
Write-Host "`n======================================================`n" -ForegroundColor Cyan

if ($runningNodes -eq 5 -and $apiAvailable -eq 5) {
    Write-Host "  [HEALTHY] STATUS: HEALTHY - Toate sistemele functioneaza" -ForegroundColor Green
} elseif ($runningNodes -ge 3) {
    Write-Host "  [DEGRADED] STATUS: DEGRADED - Unele servicii indisponibile" -ForegroundColor Yellow
} else {
    Write-Host "  [CRITICAL] STATUS: CRITICAL - Sistem necesita atentie" -ForegroundColor Red
}

Write-Host "`n  [HELP] Comenzi utile:" -ForegroundColor Gray
Write-Host "     - Test complet: .\test-network.ps1" -ForegroundColor DarkGray
Write-Host "     - Logs: docker-compose logs -f" -ForegroundColor DarkGray
Write-Host "     - Restart: docker-compose restart" -ForegroundColor DarkGray
Write-Host ""
