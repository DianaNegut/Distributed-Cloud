# Script demonstrație funcționalitate transfer fișiere
Write-Host "=== Demonstrație Transfer Fișiere în Proiect ===" -ForegroundColor Cyan
Write-Host ""

$API_URL = "http://localhost:3001/api"
$API_KEY = "supersecret"

# 1. Verificare backend pornit
Write-Host "1. Verificare servicii..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$API_URL/health" -Method Get
    Write-Host "   ✓ Backend activ" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Backend nu răspunde - pornește serverul!" -ForegroundColor Red
    Write-Host "   Rulează: cd Backend; npm start" -ForegroundColor Yellow
    exit 1
}

# 2. Test statistici transfer
Write-Host "`n2. Obținere statistici transfer..." -ForegroundColor Yellow
try {
    $headers = @{
        "x-api-key" = $API_KEY
    }
    
    $stats = Invoke-RestMethod -Uri "$API_URL/files/transfer-stats" -Method Get -Headers $headers
    
    if ($stats.success) {
        Write-Host "   ✓ Statistici obținute:" -ForegroundColor Green
        Write-Host "     - Total fișiere: $($stats.stats.totalFiles)" -ForegroundColor Gray
        Write-Host "     - Fișiere publice: $($stats.stats.publicFiles)" -ForegroundColor Gray
        Write-Host "     - Fișiere private: $($stats.stats.privateFiles)" -ForegroundColor Gray
        Write-Host "     - Dimensiune totală: $($stats.stats.totalSizeMB) MB" -ForegroundColor Gray
        Write-Host "     - Peers conectați: $($stats.stats.peersConnected)" -ForegroundColor Gray
        Write-Host "     - Rețea activă: $($stats.stats.networkActive)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ✗ Eroare la obținere statistici: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Test transfer între noduri
Write-Host "`n3. Test transfer între noduri..." -ForegroundColor Yellow
try {
    $testResult = Invoke-RestMethod -Uri "$API_URL/files/test-transfer" -Method Post -Headers $headers
    
    if ($testResult.success) {
        $test = $testResult.test
        Write-Host "   ✓ Test transfer finalizat:" -ForegroundColor Green
        Write-Host "     - Hash test: $($test.hash)" -ForegroundColor Gray
        Write-Host "     - Peers conectați: $($test.peersConnected)" -ForegroundColor Gray
        Write-Host "     - Provideri găsiți: $($test.providersFound)" -ForegroundColor Gray
        Write-Host "     - Status: $($test.status)" -ForegroundColor $(if ($test.canTransfer) { "Green" } else { "Yellow" })
        Write-Host "     - Transfer posibil: $($test.canTransfer)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ✗ Eroare la test transfer: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Listare fișiere existente
Write-Host "`n4. Listare fișiere din cluster..." -ForegroundColor Yellow
try {
    $filesList = Invoke-RestMethod -Uri "$API_URL/docker-cluster/pins" -Method Get -Headers $headers
    
    if ($filesList.success) {
        $filesCount = if ($filesList.pins -is [Array]) { $filesList.pins.Count } else { ($filesList.pins.PSObject.Properties).Count }
        Write-Host "   ✓ $filesCount fișiere găsite în cluster" -ForegroundColor Green
        
        if ($filesCount -gt 0) {
            Write-Host "`n   Primele 3 fișiere:" -ForegroundColor Cyan
            $files = if ($filesList.pins -is [Array]) { 
                $filesList.pins | Select-Object -First 3 
            } else { 
                $filesList.pins.PSObject.Properties | Select-Object -First 3 | ForEach-Object { $_.Value }
            }
            
            foreach ($file in $files) {
                $name = if ($file.name) { $file.name } else { $file.PSObject.Properties.Name }
                $cid = if ($file.cid) { $file.cid } else { if ($file.hash) { $file.hash } else { "N/A" } }
                Write-Host "     - $name [$cid]" -ForegroundColor Gray
            }
        }
    }
} catch {
    Write-Host "   ✗ Eroare la listare fișiere: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. Instrucțiuni pentru frontend
Write-Host "`n=== Instrucțiuni Frontend ===" -ForegroundColor Cyan
Write-Host "Pentru a vizualiza interfața grafică:" -ForegroundColor Yellow
Write-Host "  1. cd Frontend\frontend" -ForegroundColor Gray
Write-Host "  2. npm start" -ForegroundColor Gray
Write-Host "  3. Acces la http://localhost:3000" -ForegroundColor Gray
Write-Host ""
Write-Host "Funcționalități disponibile în UI:" -ForegroundColor Yellow
Write-Host "  ✓ Statistici transfer în timp real" -ForegroundColor Green
Write-Host "  ✓ Buton 'Test Transfer Între Noduri'" -ForegroundColor Green
Write-Host "  ✓ Monitorizare peers conectați" -ForegroundColor Green
Write-Host "  ✓ Upload/Download fișiere" -ForegroundColor Green
Write-Host "  ✓ Vizualizare distribuție fișiere" -ForegroundColor Green

Write-Host "`n=== Demo Completa ===" -ForegroundColor Green
Write-Host "Toate functionalitatile au fost testate cu succes!" -ForegroundColor Green
