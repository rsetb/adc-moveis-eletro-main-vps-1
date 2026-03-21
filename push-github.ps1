# Script Simplificado - Push para GitHub
# Repositório: https://github.com/rsetbrasil/adc-moveis-eletro

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Push para GitHub - ADC Móveis       " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se Git está instalado
try {
    $gitVersion = git --version
    Write-Host "✓ Git: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Git não encontrado!" -ForegroundColor Red
    Write-Host "Instale em: https://git-scm.com/download/win" -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host ""
Write-Host "Repositório: https://github.com/rsetbrasil/adc-moveis-eletro" -ForegroundColor Cyan
Write-Host ""

# Status atual
Write-Host "Status atual do Git:" -ForegroundColor Yellow
git status

Write-Host ""
$continue = Read-Host "Continuar com o push? (S/N)"
if ($continue -ne "S" -and $continue -ne "s") {
    Write-Host "Operação cancelada." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Passo 1: Adicionando arquivos..." -ForegroundColor Yellow
git add .

Write-Host ""
Write-Host "Passo 2: Criando commit..." -ForegroundColor Yellow
git commit -m "Initial commit: Sistema ADC Móveis e Eletros completo"

Write-Host ""
Write-Host "Passo 3: Removendo remote antigo..." -ForegroundColor Yellow
git remote remove origin 2>$null

Write-Host ""
Write-Host "Passo 4: Adicionando remote do GitHub..." -ForegroundColor Yellow
git remote add origin https://github.com/rsetbrasil/adc-moveis-eletro.git
git remote -v

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

Write-Host ""
Write-Host "Passo 5: Fazendo push para GitHub..." -ForegroundColor Yellow
Write-Host ""

# Detectar branch
$branch = git branch --show-current
if ([string]::IsNullOrWhiteSpace($branch)) {
    $branch = "main"
}

Write-Host "Branch: $branch" -ForegroundColor Cyan

try {
    git push -u origin $branch
    
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
    Write-Host "3. Tente novamente: git push -u origin $branch" -ForegroundColor White
    Write-Host ""
}

Read-Host "Pressione Enter para sair"
