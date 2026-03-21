#!/bin/bash

# ============================================
# Script de Migração: Supabase → MySQL VPS
# ============================================

set -e  # Parar em caso de erro

echo "🚀 Iniciando migração do Supabase para MySQL VPS..."
echo ""

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Verificar se estamos no diretório correto
echo -e "${BLUE}📁 Verificando diretório do projeto...${NC}"
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erro: package.json não encontrado!${NC}"
    echo "Execute este script no diretório raiz do projeto."
    exit 1
fi
echo -e "${GREEN}✅ Diretório correto${NC}"
echo ""

# 2. Verificar se o arquivo .env existe
echo -e "${BLUE}📝 Verificando arquivo .env...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Arquivo .env não encontrado. Criando...${NC}"
    cat > .env << 'EOF'
# MySQL VPS
DATABASE_URL="mysql://appuser:Hf$.3ui*)(1m@localhost:3306/adc_pro_2026"

# Supabase (para migração)
NEXT_PUBLIC_SUPABASE_URL="https://hnpschlfoecpddoydnuv.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhucHNjaGxmb2VjcGRkb3lkbnV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NjE5NzksImV4cCI6MjA4NDIzNzk3OX0.pmSpGDJ3bMegT7RvNH-bHGGi-x5soaJWS74usHhyCn0"
EOF
    echo -e "${GREEN}✅ Arquivo .env criado${NC}"
else
    echo -e "${GREEN}✅ Arquivo .env encontrado${NC}"
fi
echo ""

# 3. Verificar se node_modules existe
echo -e "${BLUE}📦 Verificando dependências...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules não encontrado. Instalando dependências...${NC}"
    npm install
    echo -e "${GREEN}✅ Dependências instaladas${NC}"
else
    echo -e "${GREEN}✅ Dependências já instaladas${NC}"
fi
echo ""

# 4. Testar conexão com MySQL
echo -e "${BLUE}🔌 Testando conexão com MySQL...${NC}"
if mysql -u appuser -p'Hf$.3ui*)(1m' adc_pro_2026 -e "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Conexão com MySQL OK${NC}"
else
    echo -e "${RED}❌ Erro: Não foi possível conectar ao MySQL${NC}"
    echo "Verifique se:"
    echo "  - MySQL está rodando: sudo systemctl status mysql"
    echo "  - Credenciais estão corretas"
    echo "  - Banco 'adc_pro_2026' existe"
    exit 1
fi
echo ""

# 5. Criar estrutura do banco de dados
echo -e "${BLUE}🏗️  Criando estrutura do banco de dados...${NC}"
npx prisma db push --skip-generate
echo -e "${GREEN}✅ Estrutura do banco criada${NC}"
echo ""

# 6. Executar migração
echo -e "${BLUE}🔄 Executando migração de dados...${NC}"
echo -e "${YELLOW}Isso pode levar alguns minutos dependendo da quantidade de dados...${NC}"
echo ""

npm run migrate:vps

echo ""
echo -e "${GREEN}🎉 Migração concluída com sucesso!${NC}"
echo ""

# 7. Verificar dados migrados
echo -e "${BLUE}📊 Verificando dados migrados...${NC}"
mysql -u appuser -p'Hf$.3ui*)(1m' adc_pro_2026 << 'EOF'
SELECT 'users' as tabela, COUNT(*) as total FROM users
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'categories', COUNT(*) FROM categories;
EOF

echo ""
echo -e "${GREEN}✅ Migração completa!${NC}"
echo ""
echo "Próximos passos:"
echo "  1. Testar a aplicação: npm run dev"
echo "  2. Fazer build: npm run build"
echo "  3. Iniciar em produção: npm start"
