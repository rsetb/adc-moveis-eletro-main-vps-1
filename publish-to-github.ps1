# Script para publicar o projeto ADC no GitHub
# Autor: Antigravity AI Assistant
# Data: 2026-02-10

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Publicação do Projeto ADC no GitHub  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se o Git está instalado
Write-Host "Verificando instalação do Git..." -ForegroundColor Yellow
try {
    $gitVersion = git --version
    Write-Host "✓ Git encontrado: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Git não encontrado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Por favor, instale o Git:" -ForegroundColor Yellow
    Write-Host "1. Acesse: https://git-scm.com/download/win" -ForegroundColor White
    Write-Host "2. Baixe e instale o Git para Windows" -ForegroundColor White
    Write-Host "3. Reinicie o PowerShell" -ForegroundColor White
    Write-Host "4. Execute este script novamente" -ForegroundColor White
    Write-Host ""
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host ""

# Solicitar informações do novo repositório
Write-Host "Configuração do Novo Repositório" -ForegroundColor Cyan
Write-Host "--------------------------------" -ForegroundColor Cyan
Write-Host ""

$repoName = Read-Host "Digite o nome do novo repositório (padrão: adc-moveis-eletro)"
if ([string]::IsNullOrWhiteSpace($repoName)) {
    $repoName = "adc-moveis-eletro"
    Write-Host "Usando nome padrão: $repoName" -ForegroundColor Yellow
}

$username = Read-Host "Digite seu usuário do GitHub (padrão: rsetbrasil)"
if ([string]::IsNullOrWhiteSpace($username)) {
    $username = "rsetbrasil"
    Write-Host "Usando usuário padrão: $username" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Repositório será criado em: https://github.com/$username/$repoName" -ForegroundColor Green
Write-Host ""

$confirm = Read-Host "Continuar? (S/N)"
if ($confirm -ne "S" -and $confirm -ne "s") {
    Write-Host "Operação cancelada pelo usuário." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Iniciando processo de publicação..." -ForegroundColor Cyan
Write-Host ""

# Verificar status do Git
Write-Host "1. Verificando status do repositório..." -ForegroundColor Yellow
git status

Write-Host ""
$continueAdd = Read-Host "Deseja adicionar todos os arquivos ao commit? (S/N)"
if ($continueAdd -eq "S" -or $continueAdd -eq "s") {
    Write-Host ""
    Write-Host "2. Adicionando arquivos ao staging..." -ForegroundColor Yellow
    git add .
    
    Write-Host ""
    Write-Host "3. Criando commit inicial..." -ForegroundColor Yellow
    $commitMsg = Read-Host "Digite a mensagem do commit (Enter para usar padrão)"
    if ([string]::IsNullOrWhiteSpace($commitMsg)) {
        $commitMsg = "Initial commit: Sistema ADC Móveis e Eletros completo"
    }
    git commit -m "$commitMsg"
}

Write-Host ""
Write-Host "4. Removendo remote antigo (se existir)..." -ForegroundColor Yellow
git remote remove origin 2>$null

Write-Host ""
Write-Host "5. Adicionando novo remote..." -ForegroundColor Yellow
$remoteUrl = "https://github.com/$username/$repoName.git"
git remote add origin $remoteUrl
Write-Host "✓ Remote adicionado: $remoteUrl" -ForegroundColor Green

Write-Host ""
Write-Host "6. Verificando configuração do remote..." -ForegroundColor Yellow
git remote -v

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  IMPORTANTE: Autenticação GitHub      " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Antes de fazer o push, você precisa:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Criar o repositório no GitHub:" -ForegroundColor White
Write-Host "   → Acesse: https://github.com/new" -ForegroundColor Cyan
Write-Host "   → Nome: $repoName" -ForegroundColor Cyan
Write-Host "   → NÃO marque 'Initialize with README'" -ForegroundColor Red
Write-Host ""
Write-Host "2. Ter um Personal Access Token:" -ForegroundColor White
Write-Host "   → Acesse: https://github.com/settings/tokens" -ForegroundColor Cyan
Write-Host "   → Generate new token (classic)" -ForegroundColor Cyan
Write-Host "   → Marque o escopo 'repo'" -ForegroundColor Cyan
Write-Host "   → Copie o token gerado" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Quando o Git pedir senha:" -ForegroundColor White
Write-Host "   → Cole o Personal Access Token" -ForegroundColor Cyan
Write-Host ""

$continuePush = Read-Host "Você já criou o repositório no GitHub? (S/N)"
if ($continuePush -ne "S" -and $continuePush -ne "s") {
    Write-Host ""
    Write-Host "Por favor, crie o repositório no GitHub primeiro." -ForegroundColor Yellow
    Write-Host "Depois execute o comando:" -ForegroundColor Yellow
    Write-Host "  git push -u origin main" -ForegroundColor Cyan
    Write-Host ""
    Read-Host "Pressione Enter para sair"
    exit 0
}

Write-Host ""
Write-Host "7. Fazendo push para o GitHub..." -ForegroundColor Yellow
Write-Host ""

# Detectar o branch atual
$currentBranch = git branch --show-current

if ([string]::IsNullOrWhiteSpace($currentBranch)) {
    $currentBranch = "main"
}

Write-Host "Branch atual: $currentBranch" -ForegroundColor Cyan
Write-Host ""

try {
    git push -u origin $currentBranch
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✓ PUBLICAÇÃO CONCLUÍDA COM SUCESSO!  " -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Seu repositório está disponível em:" -ForegroundColor White
    Write-Host "https://github.com/$username/$repoName" -ForegroundColor Cyan
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  ✗ ERRO NO PUSH                       " -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possíveis soluções:" -ForegroundColor Yellow
    Write-Host "1. Verifique se o repositório foi criado no GitHub" -ForegroundColor White
    Write-Host "2. Verifique se você usou o Personal Access Token correto" -ForegroundColor White
    Write-Host "3. Tente novamente: git push -u origin $currentBranch" -ForegroundColor White
    Write-Host ""
}

Write-Host ""
Read-Host "Pressione Enter para sair"
