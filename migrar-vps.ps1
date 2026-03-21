# ============================================
# Script de Migração: Supabase → MySQL VPS
# PowerShell Version (para Windows)
# ============================================

Write-Host "🚀 Iniciando migração do Supabase para MySQL VPS..." -ForegroundColor Cyan
Write-Host ""

# 1. Verificar se estamos no diretório correto
Write-Host "📁 Verificando diretório do projeto..." -ForegroundColor Blue
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Erro: package.json não encontrado!" -ForegroundColor Red
    Write-Host "Execute este script no diretório raiz do projeto."
    exit 1
}
Write-Host "✅ Diretório correto" -ForegroundColor Green
Write-Host ""

# 2. Verificar se o arquivo .env existe
Write-Host "📝 Verificando arquivo .env..." -ForegroundColor Blue
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  Arquivo .env não encontrado. Criando..." -ForegroundColor Yellow
    @"
# MySQL VPS
DATABASE_URL="mysql://appuser:Hf$.3ui*)(1m@localhost:3306/adc_pro_2026"

# Supabase (para migração)
NEXT_PUBLIC_SUPABASE_URL="https://hnpschlfoecpddoydnuv.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhucHNjaGxmb2VjcGRkb3lkbnV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NjE5NzksImV4cCI6MjA4NDIzNzk3OX0.pmSpGDJ3bMegT7RvNH-bHGGi-x5soaJWS74usHhyCn0"
"@ | Out-File -FilePath ".env" -Encoding UTF8
    Write-Host "✅ Arquivo .env criado" -ForegroundColor Green
}
else {
    Write-Host "✅ Arquivo .env encontrado" -ForegroundColor Green
}
Write-Host ""

# 3. Verificar se node_modules existe
Write-Host "📦 Verificando dependências..." -ForegroundColor Blue
if (-not (Test-Path "node_modules")) {
    Write-Host "⚠️  node_modules não encontrado. Instalando dependências..." -ForegroundColor Yellow
    npm install
    Write-Host "✅ Dependências instaladas" -ForegroundColor Green
}
else {
    Write-Host "✅ Dependências já instaladas" -ForegroundColor Green
}
Write-Host ""

# 4. Criar estrutura do banco de dados
Write-Host "🏗️  Criando estrutura do banco de dados..." -ForegroundColor Blue
npx prisma db push --skip-generate
Write-Host "✅ Estrutura do banco criada" -ForegroundColor Green
Write-Host ""

# 5. Executar migração
Write-Host "🔄 Executando migração de dados..." -ForegroundColor Blue
Write-Host "Isso pode levar alguns minutos dependendo da quantidade de dados..." -ForegroundColor Yellow
Write-Host ""

npm run migrate:vps

Write-Host ""
Write-Host "🎉 Migração concluída com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "✅ Migração completa!" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos passos:"
Write-Host "  1. Testar a aplicação: npm run dev"
Write-Host "  2. Fazer build: npm run build"
Write-Host "  3. Iniciar em produção: npm start"
