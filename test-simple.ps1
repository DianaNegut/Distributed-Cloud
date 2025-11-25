Write-Host '=== Test Transfer Fisiere IPFS ===' -ForegroundColor Cyan
$testContent = 'Test transfer @ ' + (Get-Date)
$testFile = 'test.txt'
$testContent | Out-File -FilePath $testFile
Write-Host 'Fisier creat' -ForegroundColor Green
$uploadResp = curl.exe -X POST -H 'x-api-key: supersecret' -F ('file=@' + $testFile) http://localhost:3001/api/docker-cluster/add | ConvertFrom-Json
$cid = $uploadResp.cid
Write-Host ('CID: ' + $cid) -ForegroundColor Cyan
Start-Sleep -Seconds 2
Write-Host 'Verificare pe noduri...' -ForegroundColor Yellow
1..5 | ForEach-Object {
    $result = docker exec ipfs-node-$_ ipfs cat $cid 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host ('Node ' + $_ + ': OK') -ForegroundColor Green }
    else { Write-Host ('Node ' + $_ + ': FAIL') -ForegroundColor Red }
}
Remove-Item $testFile -ErrorAction SilentlyContinue
Write-Host 'Test complet!' -ForegroundColor Green
