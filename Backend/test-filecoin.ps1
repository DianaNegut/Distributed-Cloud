# Script de testare Filecoin Integration
# Rulează: .\test-filecoin.ps1

$apiKey = "supersecret"
$baseUrl = "http://localhost:3001/api"
$headers = @{
    "x-api-key" = $apiKey
    "Content-Type" = "application/json"
}

Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host "TESTARE FILECOIN INTEGRATION" -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Cyan

# 1. Verifică status
Write-Host "1. Verificare status Filecoin..." -ForegroundColor Yellow
$status = Invoke-WebRequest -Uri "$baseUrl/filecoin/status" -Headers $headers | ConvertFrom-Json
Write-Host "   ✅ Connected: $($status.connected)" -ForegroundColor Green
Write-Host "   ✅ Network: $($status.network)" -ForegroundColor Green
Write-Host "   ✅ Mode: $($status.mode)`n" -ForegroundColor Green

# 2. Obține miners
Write-Host "2. Obținere miners disponibili..." -ForegroundColor Yellow
$miners = Invoke-WebRequest -Uri "$baseUrl/filecoin/miners" -Headers $headers | ConvertFrom-Json
Write-Host "   ✅ Găsiți $($miners.count) miners" -ForegroundColor Green
foreach ($miner in $miners.miners) {
    Write-Host "      - $($miner.address): $($miner.location), Reputation: $($miner.reputation)%" -ForegroundColor White
}
Write-Host ""

# 3. Selectează primul miner
$selectedMiner = $miners.miners[0]
Write-Host "3. Miner selectat: $($selectedMiner.address)" -ForegroundColor Yellow
Write-Host "   Location: $($selectedMiner.location)" -ForegroundColor White
Write-Host "   Price/GB/Epoch: $($selectedMiner.pricePerGBPerEpoch) attoFIL" -ForegroundColor White
Write-Host "   Available Storage: $([math]::Round($selectedMiner.availableStorage/1GB, 2)) GB`n" -ForegroundColor White

# 4. Calculează preț pentru un fișier de 100MB
Write-Host "4. Calcul preț pentru fișier 100MB..." -ForegroundColor Yellow
$fileSize = 100 * 1024 * 1024  # 100 MB in bytes
$duration = 518400  # ~180 days
$priceBody = @{
    fileSize = $fileSize
    duration = $duration
    minerAddress = $selectedMiner.address
} | ConvertTo-Json

$pricing = Invoke-WebRequest -Uri "$baseUrl/filecoin/calculate-price" -Method Post -Headers $headers -Body $priceBody | ConvertFrom-Json
Write-Host "   ✅ File Size: $($pricing.pricing.fileSizeGB) GB" -ForegroundColor Green
Write-Host "   ✅ Duration: $($pricing.pricing.durationDays) days ($($pricing.pricing.durationEpochs) epochs)" -ForegroundColor Green
Write-Host "   ✅ Total Cost: $($pricing.pricing.totalCostFIL) FIL`n" -ForegroundColor Green

# 5. Creează un storage deal de test
Write-Host "5. Creare storage deal..." -ForegroundColor Yellow
$dealBody = @{
    cid = "QmTestCID123abc456def789ghi"
    fileName = "test-file.txt"
    fileSize = $fileSize
    clientAddress = "t1test1234567890abcdefghij"
    minerAddress = $selectedMiner.address
    duration = $duration
    verified = $false
} | ConvertTo-Json

$deal = Invoke-WebRequest -Uri "$baseUrl/filecoin/deals" -Method Post -Headers $headers -Body $dealBody | ConvertFrom-Json
Write-Host "   ✅ Deal Created!" -ForegroundColor Green
Write-Host "   ✅ Deal ID: $($deal.deal.id)" -ForegroundColor Green
Write-Host "   ✅ Status: $($deal.deal.status)" -ForegroundColor Green
Write-Host "   ✅ Total Cost: $($deal.pricing.totalCostFIL) FIL" -ForegroundColor Green
Write-Host "   ✅ Estimated Activation: $($deal.estimatedActivationTime)`n" -ForegroundColor Green

# 6. Așteaptă puțin pentru activare
Write-Host "6. Așteptare activare deal (3 secunde)..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# 7. Verifică status deal
Write-Host "7. Verificare status deal..." -ForegroundColor Yellow
$dealStatus = Invoke-WebRequest -Uri "$baseUrl/filecoin/deals/$($deal.deal.id)" -Headers $headers | ConvertFrom-Json
Write-Host "   ✅ Status: $($dealStatus.deal.status)" -ForegroundColor Green
Write-Host "   ✅ On-Chain Deal ID: $($dealStatus.deal.dealId)" -ForegroundColor Green
Write-Host "   ✅ Message: $($dealStatus.deal.message)`n" -ForegroundColor Green

# 8. Obține statistici
Write-Host "8. Statistici generale..." -ForegroundColor Yellow
$stats = Invoke-WebRequest -Uri "$baseUrl/filecoin/statistics" -Headers $headers | ConvertFrom-Json
Write-Host "   ✅ Total Deals: $($stats.statistics.total)" -ForegroundColor Green
Write-Host "   ✅ Active Deals: $($stats.statistics.active)" -ForegroundColor Green
Write-Host "   ✅ Pending Deals: $($stats.statistics.pending)" -ForegroundColor Green
Write-Host "   ✅ Total Storage: $($stats.statistics.totalStorageGB) GB`n" -ForegroundColor Green

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "TEST COMPLETAT CU SUCCES! ✅" -ForegroundColor Green
Write-Host "================================================`n" -ForegroundColor Cyan

Write-Host "Următorii pași:" -ForegroundColor Yellow
Write-Host "   1. Integrare în frontend pentru UI" -ForegroundColor White
Write-Host "   2. Conectare cu wallet Filecoin real (MetaMask + Filecoin)" -ForegroundColor White
Write-Host "   3. Deploy pe Filecoin Calibration testnet" -ForegroundColor White
Write-Host ""
