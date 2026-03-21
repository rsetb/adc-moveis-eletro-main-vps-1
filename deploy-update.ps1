param (
    [Parameter(Mandatory = $false)]
    [string[]]$Files = @(
        "src\context\AdminContext.tsx",
        "src\app\actions\admin\orders.ts",
        "src\app\actions\admin\customers.ts",
        "src\app\admin\clientes\page.tsx",
        "src\components\OrderEditDialog.tsx",
        "src\components\ui\dialog.tsx",
        "src\lib\types.ts"
    ),
    [Parameter(Mandatory = $false)]
    [string]$KeyPath = $env:DEPLOY_SSH_KEY
)

# Normalizar entrada quando o PowerShell passa os caminhos como uma única string com vírgulas
if ($Files.Count -eq 1 -and $Files[0] -match ',') {
    $Files = $Files[0] -split ',' | ForEach-Object { $_.Trim() -replace '^"+|"+$','' -replace "^'+|'+$","" }
}

$ScpPath = (Get-Command scp.exe -ErrorAction SilentlyContinue).Source
if (-not $ScpPath) {
    $ScpPath = "C:\Program Files\Git\usr\bin\scp.exe"
}

$SshPath = (Get-Command ssh.exe -ErrorAction SilentlyContinue).Source
if (-not $SshPath) {
    $SshPath = "C:\Windows\System32\OpenSSH\ssh.exe"
}

$LocalRoot = $PSScriptRoot
$VpsUser = "root"
$VpsIp = "158.69.218.15"
$RemoteRoot = "/var/www/adc-pro"

# Opções comuns para evitar prompts desnecessários e preferir chave
$CommonSshArgs = @(
    "-o", "StrictHostKeyChecking=no",
    "-o", "ConnectTimeout=15",
    "-o", "ConnectionAttempts=3",
    "-o", "ServerAliveInterval=30",
    "-o", "ServerAliveCountMax=3",
    "-o", "TCPKeepAlive=yes"
)
if ($KeyPath -and (Test-Path -LiteralPath $KeyPath)) {
    $CommonSshArgs += @("-i", $KeyPath, "-o", "IdentitiesOnly=yes", "-o", "PreferredAuthentications=publickey", "-o", "PubkeyAuthentication=yes")
}

$Files | ForEach-Object {
    $RelPath = $_
    $LocalFile = Join-Path $LocalRoot $RelPath

    # Usar caminho literal para suportar pastas com colchetes [ ]
    if (-not (Test-Path -LiteralPath $LocalFile)) {
        Write-Host "ARQUIVO NÃO ENCONTRADO: $LocalFile" -ForegroundColor Yellow
        return
    }

    # Montar caminho remoto e escapar colchetes para o shell remoto
    $RemoteRelPath = $RelPath -replace "\\", "/"
    $LastSlashIndex = $RemoteRelPath.LastIndexOf("/")
    if ($LastSlashIndex -lt 0) {
        $RemoteDirRel = ""
    } else {
        $RemoteDirRel = $RemoteRelPath.Substring(0, $LastSlashIndex)
    }
    $RemoteDir = "$RemoteRoot/$RemoteDirRel"
    $RemoteDir = $RemoteDir -replace "/+", "/"
    $RemoteTargetDir = ('{0}@{1}:' -f $VpsUser, $VpsIp) + $RemoteDir

    Write-Host "----------------------------------------" -ForegroundColor Cyan
    Write-Host "Enviando: $RelPath" -ForegroundColor White
    
    # Estratégia robusta: enviar para /tmp e mover no servidor para o caminho final com colchetes
    $BaseName = [System.IO.Path]::GetFileName($LocalFile)
    $TempName = "adc-upload-$([System.Guid]::NewGuid().ToString('N'))-$BaseName"
    $RemoteTmp = "/tmp/$TempName"
    $RemoteDest = "$RemoteRoot/$RemoteRelPath"

    $maxAttempts = 3
    $success = $false

    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        if ($attempt -gt 1) {
            Write-Host "Tentativa $attempt/$maxAttempts..." -ForegroundColor Yellow
        }

        # Enviar para /tmp (sem caracteres especiais)
        $scpArgs = @()
        $scpArgs += $CommonSshArgs
        $scpArgs += @("$LocalFile", ("{0}@{1}:{2}" -f $VpsUser, $VpsIp, $RemoteTmp))
        & $ScpPath $scpArgs
        $scpExit = $LASTEXITCODE
        if ($scpExit -ne 0) {
            if ($attempt -lt $maxAttempts) {
                Start-Sleep -Seconds 2
                continue
            }
            break
        }

        # Criar diretório e mover em um ÚNICO ssh para reduzir prompts
        $remoteCmd = "mkdir -p '$RemoteDir' && mv $RemoteTmp '$RemoteDest'"
        $sshArgs = @()
        $sshArgs += $CommonSshArgs
        $sshArgs += @("$VpsUser@$VpsIp", $remoteCmd)
        & $SshPath $sshArgs
        $sshExit = $LASTEXITCODE
        if ($sshExit -eq 0) {
            $success = $true
            break
        }

        if ($attempt -lt $maxAttempts) {
            Start-Sleep -Seconds 2
        }
    }

    if (-not $success) {
        Write-Host "ERRO ao enviar $RelPath" -ForegroundColor Red
    } else {
        Write-Host "OK" -ForegroundColor Green
    }
}

Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host "Concluído! Reinicie o servidor: pm2 restart all" -ForegroundColor Yellow
