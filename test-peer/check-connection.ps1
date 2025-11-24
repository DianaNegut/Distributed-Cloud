# Script pentru verificare conexiune la rețeaua privată
Write-Host "=== Verificare Conexiune Retea Privata ===" -ForegroundColor Cyan
Write-Host ""

$ipfsPath = "C:\ATM\LICENTA\kubo_v0.38.1_windows-amd64\kubo\ipfs.exe"
if (-not (Test-Path $ipfsPath)) {
    Write-Host "ERROR: IPFS nu este gasit la: $ipfsPath" -ForegroundColor Red
    exit 1
}

$testIpfsPath = "$env:USERPROFILE\.ipfs-test"
if (-not (Test-Path $testIpfsPath)) {
    Write-Host "ERROR: Director test nu exista: $testIpfsPath" -ForegroundColor Red
    Write-Host "Ruleaza mai intai start-test-peer.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "Verificare daemon IPFS test..." -ForegroundColor Cyan
$env:IPFS_PATH = $testIpfsPath

try {
    $peerId = & $ipfsPath id -f="<id>" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Daemon activ, Peer ID: $peerId" -ForegroundColor Green
    } else {
        Write-Host "✗ Daemon-ul nu rulează" -ForegroundColor Red
        Write-Host "Rulează start-test-peer.ps1 într-o fereastră separată" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "✗ Eroare la conectarea la daemon" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Verificare conexiuni..." -ForegroundColor Cyan
$peers = & $ipfsPath swarm peers 2>$null
if ($peers) {
    Write-Host "✓ Conectat la $($peers.Count) peer(s):" -ForegroundColor Green
    $peers | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
} else {
    Write-Host "✗ Nu există conexiuni active" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Încerc să mă conectez manual..." -ForegroundColor Cyan
    
    # Obține peer ID de la ipfs-node-1
    try {
        $bootstrapId = docker exec ipfs-node-1 ipfs id -f="<id>" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Bootstrap node ID: $bootstrapId" -ForegroundColor Gray
            $connectAddr = "/ip4/127.0.0.1/tcp/4001/p2p/$bootstrapId"
            Write-Host "Conectare la: $connectAddr" -ForegroundColor Gray
            
            & $ipfsPath swarm connect $connectAddr 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ Conectare reușită!" -ForegroundColor Green
            } else {
                Write-Host "✗ Conectare eșuată" -ForegroundColor Red
            }
        }
    } catch {
        Write-Host "✗ Nu pot obține info despre bootstrap node" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Configurație bootstrap:" -ForegroundColor Cyan
& $ipfsPath bootstrap list

Write-Host ""
Write-Host "=== Test complet ===" -ForegroundColor Cyan
Write-Host "Pentru a testa transferul de fișiere:" -ForegroundColor Yellow
Write-Host "  1. Adaugă un fișier: ipfs add <file>" -ForegroundColor Gray
Write-Host "  2. Verifică pe alt nod: docker exec ipfs-node-1 ipfs cat <CID>" -ForegroundColor Gray
