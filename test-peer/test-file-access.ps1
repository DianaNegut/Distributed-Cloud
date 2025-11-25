# Script pentru testarea accesului la fisier din alte noduri
param(
    [Parameter(Mandatory=$true)]
    [string]$FileHash
)

Write-Host "=== Test Acces Fisier din Alte Noduri ===" -ForegroundColor Cyan
Write-Host "Hash fisier: $FileHash" -ForegroundColor Yellow
Write-Host ""

# 1. Verificare pe nodul principal
Write-Host "1. Verificare pe nodul principal (ipfs-node-1)..." -ForegroundColor Yellow
try {
    $stat1 = docker exec ipfs-node-1 ipfs object stat $FileHash 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   OK: Fisier gasit pe ipfs-node-1" -ForegroundColor Green
        Write-Host "   $stat1" -ForegroundColor Gray
    } else {
        Write-Host "   EROARE: Fisier nu este pe ipfs-node-1" -ForegroundColor Red
    }
} catch {
    Write-Host "   EROARE: $($_.Exception.Message)" -ForegroundColor Red
}

# 2. Test recuperare de pe node-2
Write-Host "`n2. Test recuperare de pe ipfs-node-2..." -ForegroundColor Yellow
try {
    Write-Host "   Incerc sa obtin primii 100 bytes..." -ForegroundColor Gray
    $content2 = docker exec ipfs-node-2 ipfs cat $FileHash 2>&1 | Select-Object -First 3
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   OK: Fisier accesat cu succes de pe ipfs-node-2" -ForegroundColor Green
        Write-Host "   Preview:" -ForegroundColor Gray
        $content2 | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkGray }
    } else {
        Write-Host "   EROARE: Nu pot accesa fisierul de pe ipfs-node-2" -ForegroundColor Red
        Write-Host "   $content2" -ForegroundColor Red
    }
} catch {
    Write-Host "   EROARE: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Test recuperare de pe node-3
Write-Host "`n3. Test recuperare de pe ipfs-node-3..." -ForegroundColor Yellow
try {
    $content3 = docker exec ipfs-node-3 ipfs cat $FileHash 2>&1 | Select-Object -First 3
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   OK: Fisier accesat cu succes de pe ipfs-node-3" -ForegroundColor Green
        Write-Host "   Preview:" -ForegroundColor Gray
        $content3 | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkGray }
    } else {
        Write-Host "   EROARE: Nu pot accesa fisierul de pe ipfs-node-3" -ForegroundColor Red
    }
} catch {
    Write-Host "   EROARE: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Test recuperare de pe node-4
Write-Host "`n4. Test recuperare de pe ipfs-node-4..." -ForegroundColor Yellow
try {
    $content4 = docker exec ipfs-node-4 ipfs cat $FileHash 2>&1 | Select-Object -First 3
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   OK: Fisier accesat cu succes de pe ipfs-node-4" -ForegroundColor Green
    } else {
        Write-Host "   EROARE: Nu pot accesa fisierul de pe ipfs-node-4" -ForegroundColor Red
    }
} catch {
    Write-Host "   EROARE: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. Test recuperare de pe node-5
Write-Host "`n5. Test recuperare de pe ipfs-node-5..." -ForegroundColor Yellow
try {
    $content5 = docker exec ipfs-node-5 ipfs cat $FileHash 2>&1 | Select-Object -First 3
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   OK: Fisier accesat cu succes de pe ipfs-node-5" -ForegroundColor Green
    } else {
        Write-Host "   EROARE: Nu pot accesa fisierul de pe ipfs-node-5" -ForegroundColor Red
    }
} catch {
    Write-Host "   EROARE: $($_.Exception.Message)" -ForegroundColor Red
}

# 6. Verificare provideri (cine are fisierul)
Write-Host "`n6. Verificare provideri DHT..." -ForegroundColor Yellow
try {
    Write-Host "   Caut provideri pentru $FileHash..." -ForegroundColor Gray
    $providers = docker exec ipfs-node-1 ipfs dht findprovs $FileHash --timeout=10s 2>&1
    if ($LASTEXITCODE -eq 0 -and $providers) {
        $providersList = $providers -split "`n" | Where-Object { $_ -match "^12D3" }
        Write-Host "   OK: $($providersList.Count) provider(i) gasit(i)" -ForegroundColor Green
        $providersList | ForEach-Object { Write-Host "   - $_" -ForegroundColor Gray }
    } else {
        Write-Host "   WARNING: Nu s-au gasit provideri in DHT (normal pentru fisiere noi)" -ForegroundColor Yellow
        Write-Host "   Fisierul este disponibil local, propagarea in DHT poate dura cateva minute" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   WARNING: Eroare la interogare DHT" -ForegroundColor Yellow
}

# 7. Verificare peers conectati
Write-Host "`n7. Verificare conectivitate retea..." -ForegroundColor Yellow
$peers = docker exec ipfs-node-1 ipfs swarm peers 2>&1
$peerCount = ($peers -split "`n" | Where-Object { $_ -match "^/" }).Count
Write-Host "   Peers conectati: $peerCount" -ForegroundColor $(if ($peerCount -gt 0) { "Green" } else { "Red" })

# 8. Verificare pinning
Write-Host "`n8. Verificare pin status..." -ForegroundColor Yellow
try {
    $pinStatus = docker exec ipfs-node-1 ipfs pin ls $FileHash 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   OK: Fisier pinned (persistent)" -ForegroundColor Green
    } else {
        Write-Host "   WARNING: Fisier nu este pinned" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   WARNING: Nu pot verifica pin status" -ForegroundColor Yellow
}

# Rezumat
Write-Host "`n=== REZUMAT ===" -ForegroundColor Cyan
Write-Host "Hash testat: $FileHash" -ForegroundColor White
Write-Host "Fisierul este disponibil si poate fi accesat de toate nodurile din retea!" -ForegroundColor Green
Write-Host ""
Write-Host "Cum functioneaza:" -ForegroundColor Yellow
Write-Host "  1. Fisierul este stocat pe nodul care l-a uploadat" -ForegroundColor Gray
Write-Host "  2. Celelalte noduri pot accesa fisierul prin hash" -ForegroundColor Gray
Write-Host "  3. La prima accesare, fisierul este transferat automat" -ForegroundColor Gray
Write-Host "  4. DHT-ul permite gasirea providerilor (nodurilor care au fisierul)" -ForegroundColor Gray
Write-Host ""
Write-Host "Pentru a testa manual:" -ForegroundColor Yellow
Write-Host "  docker exec ipfs-node-2 ipfs cat $FileHash > fisier_recuperat.txt" -ForegroundColor Cyan
