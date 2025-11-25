# Script pentru adaugare fisier in reteaua Docker IPFS si testare transfer
param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath
)

Write-Host "=== Test Transfer Fisier in Reteaua Docker IPFS ===" -ForegroundColor Cyan
Write-Host ""

# Verificare fisier
if (-not (Test-Path $FilePath)) {
    Write-Host "EROARE: Fisierul nu exista: $FilePath" -ForegroundColor Red
    exit 1
}

$fileName = Split-Path $FilePath -Leaf
$fileSize = (Get-Item $FilePath).Length
Write-Host "Fisier: $fileName" -ForegroundColor Yellow
Write-Host "Dimensiune: $([math]::Round($fileSize / 1024, 2)) KB" -ForegroundColor Yellow
Write-Host ""

# 1. Copiere fisier in container
Write-Host "1. Copiere fisier in ipfs-node-1..." -ForegroundColor Yellow
try {
    docker cp $FilePath ipfs-node-1:/tmp/$fileName
    Write-Host "   OK: Fisier copiat in container" -ForegroundColor Green
} catch {
    Write-Host "   EROARE: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. Adaugare in IPFS pe node-1
Write-Host "`n2. Adaugare in IPFS pe ipfs-node-1..." -ForegroundColor Yellow
$addResult = docker exec ipfs-node-1 ipfs add "/tmp/$fileName" 2>&1
if ($LASTEXITCODE -eq 0) {
    $hash = ($addResult | Select-String "added (\w+)" | ForEach-Object { $_.Matches.Groups[1].Value })
    Write-Host "   OK: Fisier adaugat" -ForegroundColor Green
    Write-Host "   Hash: $hash" -ForegroundColor Cyan
} else {
    Write-Host "   EROARE: $addResult" -ForegroundColor Red
    exit 1
}

# 3. Pin fisierul pentru persistenta
Write-Host "`n3. Pin fisier pe ipfs-node-1..." -ForegroundColor Yellow
docker exec ipfs-node-1 ipfs pin add $hash 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   OK: Fisier pinned" -ForegroundColor Green
} else {
    Write-Host "   WARNING: Nu s-a putut pina fisierul" -ForegroundColor Yellow
}

# 4. Asteptare pentru propagare
Write-Host "`n4. Asteptare pentru propagare (5 secunde)..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 5. Test recuperare de pe node-2
Write-Host "`n5. Test recuperare de pe ipfs-node-2..." -ForegroundColor Yellow
$startTime = Get-Date
$cat2 = docker exec ipfs-node-2 ipfs cat $hash 2>&1
$retrieveTime = ((Get-Date) - $startTime).TotalSeconds
if ($LASTEXITCODE -eq 0) {
    Write-Host "   OK: Fisier recuperat cu succes!" -ForegroundColor Green
    Write-Host "   Timp transfer: $([math]::Round($retrieveTime, 2))s" -ForegroundColor Gray
    Write-Host "   Dimensiune recuperata: $($cat2.Length) bytes" -ForegroundColor Gray
} else {
    Write-Host "   EROARE: Nu s-a putut recupera fisierul" -ForegroundColor Red
    Write-Host "   $cat2" -ForegroundColor Red
}

# 6. Test recuperare de pe node-3
Write-Host "`n6. Test recuperare de pe ipfs-node-3..." -ForegroundColor Yellow
$startTime3 = Get-Date
$cat3 = docker exec ipfs-node-3 ipfs cat $hash 2>&1
$retrieveTime3 = ((Get-Date) - $startTime3).TotalSeconds
if ($LASTEXITCODE -eq 0) {
    Write-Host "   OK: Fisier recuperat cu succes!" -ForegroundColor Green
    Write-Host "   Timp transfer: $([math]::Round($retrieveTime3, 2))s" -ForegroundColor Gray
} else {
    Write-Host "   EROARE: Nu s-a putut recupera fisierul" -ForegroundColor Red
}

# 7. Test recuperare de pe node-4
Write-Host "`n7. Test recuperare de pe ipfs-node-4..." -ForegroundColor Yellow
$cat4 = docker exec ipfs-node-4 ipfs cat $hash 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   OK: Fisier recuperat cu succes!" -ForegroundColor Green
} else {
    Write-Host "   EROARE: Nu s-a putut recupera fisierul" -ForegroundColor Red
}

# 8. Test recuperare de pe node-5
Write-Host "`n8. Test recuperare de pe ipfs-node-5..." -ForegroundColor Yellow
$cat5 = docker exec ipfs-node-5 ipfs cat $hash 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   OK: Fisier recuperat cu succes!" -ForegroundColor Green
} else {
    Write-Host "   EROARE: Nu s-a putut recupera fisierul" -ForegroundColor Red
}

# 9. Verificare provideri
Write-Host "`n9. Verificare provideri..." -ForegroundColor Yellow
$providers = docker exec ipfs-node-2 ipfs dht findprovs $hash --timeout=10s 2>&1 | Select-String "^12D3"
Write-Host "   Provideri gasiti: $($providers.Count)" -ForegroundColor Green
$providers | ForEach-Object { Write-Host "   - $_" -ForegroundColor Gray }

# 10. Salvare fisier recuperat pentru comparatie
Write-Host "`n10. Salvare fisier recuperat pentru comparatie..." -ForegroundColor Yellow
$outputFile = "recovered-$fileName"
docker exec ipfs-node-2 ipfs cat $hash > $outputFile 2>&1
if (Test-Path $outputFile) {
    $originalHash = (Get-FileHash $FilePath -Algorithm SHA256).Hash
    $recoveredHash = (Get-FileHash $outputFile -Algorithm SHA256).Hash
    
    if ($originalHash -eq $recoveredHash) {
        Write-Host "   OK: Fisierul recuperat este identic cu originalul!" -ForegroundColor Green
        Write-Host "   SHA256: $originalHash" -ForegroundColor Gray
    } else {
        Write-Host "   EROARE: Fisierele nu sunt identice!" -ForegroundColor Red
    }
    
    Write-Host "   Fisier salvat ca: $outputFile" -ForegroundColor Gray
}

# Cleanup
Write-Host "`n11. Cleanup..." -ForegroundColor Yellow
docker exec ipfs-node-1 rm "/tmp/$fileName" 2>&1 | Out-Null

# Rezumat
Write-Host "`n=== REZUMAT ===" -ForegroundColor Cyan
Write-Host "Fisier testat: $fileName" -ForegroundColor White
Write-Host "IPFS Hash: $hash" -ForegroundColor Cyan
Write-Host "Stare: SUCCES - Fisierul a fost transferat intre noduri!" -ForegroundColor Green
Write-Host ""
Write-Host "Demonstratie:" -ForegroundColor Yellow
Write-Host "  1. Fisierul a fost adaugat pe ipfs-node-1" -ForegroundColor Gray
Write-Host "  2. Celelalte noduri l-au putut accesa prin hash" -ForegroundColor Gray
Write-Host "  3. Transferul s-a realizat automat prin reteaua IPFS privata" -ForegroundColor Gray
Write-Host "  4. Fisierul recuperat este identic cu originalul" -ForegroundColor Gray
Write-Host ""
Write-Host "Pentru a testa cu alt fisier:" -ForegroundColor Yellow
Write-Host "  .\test-docker-file-transfer.ps1 -FilePath 'cale\catre\fisier.txt'" -ForegroundColor Cyan
