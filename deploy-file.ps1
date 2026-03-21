param (
    [Parameter(Mandatory=$true)]
    [string]$File,
    [string]$DestinationPath = "/var/www/adc-pro/src/components/"
)

$ScpPath = "C:\Program Files\Git\usr\bin\scp.exe"
$LocalRoot = "C:\Users\Rafael\Desktop\adc-moveis-eletro-main"
$VpsUser = "root"
$VpsIp = "158.69.218.15"

# Resolve relative paths
If (-Not [System.IO.Path]::IsPathRooted($File)) {
    $File = Join-Path $LocalRoot $File
}

Write-Host "Enviando arquivo: $File" -ForegroundColor Cyan
Write-Host "Destino: $VpsUser@$VpsIp : $DestinationPath" -ForegroundColor Cyan

& $ScpPath "$File" "$VpsUser@$VpsIp:$DestinationPath"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Upload concluído com sucesso!" -ForegroundColor Green
    Write-Host "Lembre-se de reiniciar o servidor: pm2 restart all" -ForegroundColor Yellow
} else {
    Write-Host "Erro no upload." -ForegroundColor Red
}
