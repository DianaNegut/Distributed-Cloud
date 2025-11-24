# Script pentru testarea conectarii la reteaua privata
Write-Host "=== Test Peer - Conectare Retea Privata ===" -ForegroundColor Cyan
Write-Host ""

$ipfsPath = "C:\ATM\LICENTA\kubo_v0.38.1_windows-amd64\kubo\ipfs.exe"
if (-not (Test-Path $ipfsPath)) {
    Write-Host "ERROR: IPFS nu este gasit la: $ipfsPath" -ForegroundColor Red
    exit 1
}
Write-Host "IPFS gasit: $ipfsPath" -ForegroundColor Green

$testIpfsPath = "$env:USERPROFILE\.ipfs-test"
if (Test-Path $testIpfsPath) {
    Write-Host "Director test exista: $testIpfsPath" -ForegroundColor Yellow
    $cleanup = Read-Host "Stergi directorul existent? (y/n)"
    if ($cleanup -eq 'y') {
        Remove-Item -Recurse -Force $testIpfsPath
        Write-Host "Director sters" -ForegroundColor Green
    }
}

if (-not (Test-Path $testIpfsPath)) {
    Write-Host "Initializez IPFS test..." -ForegroundColor Cyan
    $env:IPFS_PATH = $testIpfsPath
    & $ipfsPath init --profile=server
    Write-Host "IPFS initializat in: $testIpfsPath" -ForegroundColor Green
}

$swarmKeySource = "..\Infrastructura\swarm.key"
$swarmKeyDest = "$testIpfsPath\swarm.key"
if (Test-Path $swarmKeySource) {
    Copy-Item -Force $swarmKeySource $swarmKeyDest
    Write-Host "swarm.key copiat" -ForegroundColor Green
} else {
    Write-Host "ERROR: swarm.key nu este gasit" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Obtin informatii despre bootstrap node..." -ForegroundColor Cyan
$peerId = docker exec ipfs-node-1 ipfs id -f="<id>" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Peer ID bootstrap node: $peerId" -ForegroundColor Green
    $publicIP = "localhost"
    $bootstrapAddr = "/ip4/$publicIP/tcp/4001/p2p/$peerId"
    Write-Host "Bootstrap Address: $bootstrapAddr" -ForegroundColor Green
} else {
    Write-Host "ERROR: Nu pot obtine peer ID" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Configurez peer-ul de test..." -ForegroundColor Cyan
$env:IPFS_PATH = $testIpfsPath
& $ipfsPath config --json AutoConf.Enabled false
Write-Host "AutoConf dezactivat" -ForegroundColor Green
& $ipfsPath bootstrap rm --all 2>&1 | Out-Null
Write-Host "Bootstrap-uri publice sterse" -ForegroundColor Green
& $ipfsPath bootstrap add $bootstrapAddr
Write-Host "Bootstrap privat adaugat" -ForegroundColor Green
& $ipfsPath config Addresses.API /ip4/127.0.0.1/tcp/5010
& $ipfsPath config Addresses.Gateway /ip4/127.0.0.1/tcp/8090
& $ipfsPath config --json Addresses.Swarm '["/ip4/0.0.0.0/tcp/4010"]'
Write-Host "Porturi configurate (API: 5010, Gateway: 8090, Swarm: 4010)" -ForegroundColor Green

Write-Host ""
Write-Host "=== Pornesc IPFS daemon pentru test peer ===" -ForegroundColor Cyan
Write-Host "Apasa Ctrl+C pentru a opri daemon-ul" -ForegroundColor Yellow
Write-Host ""
$env:LIBP2P_FORCE_PNET = "1"
& $ipfsPath daemon
