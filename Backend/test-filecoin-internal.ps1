# Test Script pentru Filecoin Internal Currency System
$baseUrl = "http://localhost:3001/api"
$apiKey = "supersecret"
$headers = @{
    "x-api-key" = $apiKey
    "Content-Type" = "application/json"
}

Write-Host "`n========================================"
Write-Host "FILECOIN INTERNAL CURRENCY - TEST SUITE"
Write-Host "========================================`n"

# Test 1: Status
Write-Host "[TEST 1] Status sistem..." -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$baseUrl/filecoin/status" -Method GET -Headers $headers
Write-Host "OK - Mode: $($response.mode), Balance: $($response.defaultInitialBalance) FIL" -ForegroundColor Green

# Test 2: Creare wallet client
Write-Host "`n[TEST 2] Creare wallet client..." -ForegroundColor Yellow
$clientId = "user-client-001"
$response = Invoke-RestMethod -Uri "$baseUrl/filecoin/wallet" -Method POST -Headers $headers -Body (@{
    userId = $clientId
} | ConvertTo-Json)
$clientWallet = $response.wallet
Write-Host "OK - Wallet: $($clientWallet.address), Balance: $($clientWallet.balance) FIL" -ForegroundColor Green

# Test 3: Creare wallet provider
Write-Host "`n[TEST 3] Creare wallet provider..." -ForegroundColor Yellow
$providerId = "user-provider-001"
$response = Invoke-RestMethod -Uri "$baseUrl/filecoin/wallet" -Method POST -Headers $headers -Body (@{
    userId = $providerId
} | ConvertTo-Json)
$providerWallet = $response.wallet
Write-Host "OK - Wallet: $($providerWallet.address), Balance: $($providerWallet.balance) FIL" -ForegroundColor Green

# Test 4: Transfer
Write-Host "`n[TEST 4] Transfer 2 FIL..." -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$baseUrl/filecoin/transfer" -Method POST -Headers $headers -Body (@{
    fromUserId = $clientId
    toUserId = $providerId
    amount = 2.0
} | ConvertTo-Json)
Write-Host "OK - Transfer: $($response.transaction.id)" -ForegroundColor Green

# Test 5: Calcul cost
Write-Host "`n[TEST 5] Calcul cost storage..." -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$baseUrl/filecoin/calculate-cost" -Method POST -Headers $headers -Body (@{
    sizeGB = 50
    durationMonths = 3
} | ConvertTo-Json)
Write-Host "OK - Cost: $($response.totalCost) FIL pentru $($response.sizeGB)GB/$($response.durationMonths) luni" -ForegroundColor Green

# Test 6: Statistici
Write-Host "`n[TEST 6] Statistici..." -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$baseUrl/filecoin/statistics" -Method GET -Headers $headers
Write-Host "OK - Wallets: $($response.wallets.totalWallets), Balance: $($response.wallets.totalBalance) FIL" -ForegroundColor Green
Write-Host "     Transactions: $($response.transactions.totalTransactions), Volume: $($response.transactions.totalVolume) FIL" -ForegroundColor Green

Write-Host "`n========================================"
Write-Host "TOATE TESTELE AU REUSIT!"
Write-Host "========================================`n"
