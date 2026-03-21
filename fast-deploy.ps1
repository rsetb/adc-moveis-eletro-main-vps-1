
$Files = @(
    "src\app\actions\admin\orders.ts",
    "src\components\OrderEditDialog.tsx",
    "src\app\carnet\[id]\[installmentNumber]\page.tsx",
    "src\app\(public)\page.tsx",
    "src\lib\utils.ts",
    "src\context\AdminContext.tsx",
    "src\app\admin\criar-pedido\page.tsx",
    "src\app\admin\pedidos\page.tsx",
    "src\app\actions\admin\financials.ts",
    "src\app\actions\checkout.ts",
    "src\components\CheckoutForm.tsx"
)

$ScpPath = (Get-Command scp.exe -ErrorAction SilentlyContinue).Source
if (-not $ScpPath) {
    $ScpPath = "C:\Program Files\Git\usr\bin\scp.exe"
}

if (-not (Test-Path -LiteralPath $ScpPath)) {
    Write-Error "SCP não encontrado. Instale o Git ou OpenSSH."
    exit 1
}

foreach ($File in $Files) {
    if (Test-Path -LiteralPath $File) {
        # Converte \\ para / e monta o caminho remoto
        $RemotePath = "/var/www/adc-pro/" + $File.Replace("\", "/")
        
        # NÃO escapamos colchetes [ e ], pois o ambiente remoto estava interpretando errado
        # $RemotePathEscaped = $RemotePath.Replace("[", "\[").Replace("]", "\]")

        Write-Host "Enviando: $File"
        Write-Host "   -> $RemotePath" -ForegroundColor DarkGray
        
        # Tenta enviar até 3 vezes
        $Success = $false
        for ($i = 0; $i -lt 3; $i++) {
            & $ScpPath -o ConnectTimeout=10 $File "root@158.69.218.15:$RemotePath"
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   Sucesso!" -ForegroundColor Green
                $Success = $true
                break
            }
            else {
                Write-Warning "Falha na tentativa $($i+1)... Aguardando 5s"
                Start-Sleep -Seconds 5
            }
        }

        if (-not $Success) {
            Write-Error "Falha ao enviar $File após 3 tentativas."
        }
    }
    else {
        Write-Warning "Arquivo local não encontrado (verifique o caminho): $File"
    }
}

Write-Host "`nConcluído! Reinicie o servidor: pm2 restart all" -ForegroundColor Cyan
