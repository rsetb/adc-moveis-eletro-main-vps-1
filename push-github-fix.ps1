# Script de Push com Git Path Fixo
# Solução para quando o Git não está no PATH do sistema

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Push para GitHub - ADC Móveis       " -ForegroundColor Cyan
Write-Host "  (Com correção de PATH)              " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Adicionar Git ao PATH temporariamente
$env:PATH = "C:\Program Files\Git\cmd;$env:PATH"

# Verificar se Git funciona agora
Write-Host "Verificando Git..." -ForegroundColor Yellow
try {
    $gitVersion = & "C:\Program Files\Git\cmd\git.exe" --version
    Write-Host "✓ Git encontrado: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Git não encontrado em C:\Program Files\Git" -ForegroundColor Red
    Write-Host ""
    Write-Host "O Git não está instalado ou está em outro local." -ForegroundColor Yellow
    Write-Host "Reinstale o Git de: https://git-scm.com/download/win" -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host ""
Write-Host "Repositório: https://github.com/rsetbrasil/adc-moveis-eletro" -ForegroundColor Cyan
Write-Host ""

# Configurar Git
Write-Host "Configurando Git..." -ForegroundColor Yellow
& "C:\Program Files\Git\cmd\git.exe" config --global user.name "rsetbrasil"
& "C:\Program Files\Git\cmd\git.exe" config --global user.email "rsetbrasil@gmail.com"

# Status
Write-Host ""
Write-Host "Status do repositório:" -ForegroundColor Yellow
& "C:\Program Files\Git\cmd\git.exe" status

Write-Host ""
$continue = Read-Host "Continuar com o push? (S/N)"
if ($continue -ne "S" -and $continue -ne "s") {
    Write-Host "Operação cancelada." -ForegroundColor Yellow
    exit 0
}

# Adicionar arquivos
Write-Host ""
Write-Host "Passo 1: Adicionando arquivos..." -ForegroundColor Yellow
& "C:\Program Files\Git\cmd\git.exe" add .

# Commit
Write-Host ""
Write-Host "Passo 2: Criando commit..." -ForegroundColor Yellow
& "C:\Program Files\Git\cmd\git.exe" commit -m "Initial commit: Sistema ADC Móveis e Eletros completo"

# Remover remote antigo
Write-Host ""
Write-Host "Passo 3: Configurando remote..." -ForegroundColor Yellow
& "C:\Program Files\Git\cmd\git.exe" remote remove origin 2>$null

# Adicionar novo remote
& "C:\Program Files\Git\cmd\git.exe" remote add origin https://github.com/rsetbrasil/adc-moveis-eletro.git
& "C:\Program Files\Git\cmd\git.exe" remote -v

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ATENÇÃO: Autenticação                " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Quando pedir senha, use seu Personal Access Token:" -ForegroundColor Yellow
Write-Host "→ Crie em: https://github.com/settings/tokens" -ForegroundColor Cyan
Write-Host "→ Marque o escopo 'repo'" -ForegroundColor Cyan
Write-Host ""

Read-Host "Pressione Enter para fazer o push"

# Push
Write-Host ""
Write-Host "Passo 4: Fazendo push para GitHub..." -ForegroundColor Yellow
Write-Host ""

$branch = & "C:\Program Files\Git\cmd\git.exe" branch --show-current
if ([string]::IsNullOrWhiteSpace($branch)) {
    $branch = "main"
}

Write-Host "Branch: $branch" -ForegroundColor Cyan
Write-Host ""

try {
    & "C:\Program Files\Git\cmd\git.exe" push -u origin $branch
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✓ SUCESSO!                          " -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Repositório publicado em:" -ForegroundColor White
    Write-Host "https://github.com/rsetbrasil/adc-moveis-eletro" -ForegroundColor Cyan
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  ✗ ERRO                              " -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifique:" -ForegroundColor Yellow
    Write-Host "1. Se você usou o Personal Access Token" -ForegroundColor White
    Write-Host "2. Se o token tem permissão 'repo'" -ForegroundColor White
    Write-Host ""
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  IMPORTANTE: Corrigir PATH            " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para usar 'git' normalmente no futuro:" -ForegroundColor Yellow
Write-Host "1. Abra: Configurações do Windows" -ForegroundColor White
Write-Host "2. Pesquise: 'Variáveis de ambiente'" -ForegroundColor White
Write-Host "3. Edite a variável 'Path'" -ForegroundColor White
Write-Host "4. Adicione: C:\Program Files\Git\cmd" -ForegroundColor White
Write-Host ""
Write-Host "Ou reinstale o Git marcando a opção:" -ForegroundColor White
Write-Host "'Git from the command line and also from 3rd-party software'" -ForegroundColor White
Write-Host ""

Read-Host "Pressione Enter para sair"
