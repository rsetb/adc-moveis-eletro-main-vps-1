# 🚀 Guia Rápido: Executar Migração no VPS

## ⚠️ Importante
A migração deve ser executada **DIRETAMENTE NO VPS** porque o banco MySQL está lá.

## 📋 Passo a Passo

### 1️⃣ Conectar ao VPS via SSH

```bash
ssh seu_usuario@seu_ip_vps
```

### 2️⃣ Navegar até o Diretório do Projeto

```bash
cd /caminho/do/projeto/ADC-MOVEIS-ELETRO
# ou onde você clonou o repositório
```

### 3️⃣ Verificar se o Arquivo .env Existe

```bash
# Verificar se existe
ls -la .env

# Se não existir, criar:
cat > .env << 'EOF'
DATABASE_URL="mysql://appuser:Hf$.3ui*)(1m@localhost:3306/adc_pro_2026"
NEXT_PUBLIC_SUPABASE_URL="https://hnpschlfoecpddoydnuv.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhucHNjaGxmb2VjcGRkb3lkbnV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NjE5NzksImV4cCI6MjA4NDIzNzk3OX0.pmSpGDJ3bMegT7RvNH-bHGGi-x5soaJWS74usHhyCn0"
EOF
```

### 4️⃣ Instalar Dependências (se necessário)

```bash
npm install
```

### 5️⃣ Criar Estrutura do Banco de Dados

```bash
# Opção 1: Via Prisma (recomendado)
npx prisma db push

# Opção 2: Via SQL
mysql -u appuser -p adc_pro_2026 < database_complete.sql
# Senha: Hf$.3ui*)(1m
```

### 6️⃣ Executar a Migração de Dados

```bash
npm run migrate:vps
```

**Você verá algo assim:**
```
🚀 Starting Migration from Supabase to MySQL VPS...
📍 Target Database: adc_pro_2026
📍 Source: https://hnpschlfoecpddoydnuv.supabase.co

📦 Migrating users...
   Fetching page 1 (Rows 0 to 999)...
...................................................
✅ Finished users: 15 inserted, 0 failed.

📦 Migrating categories...
...
```

### 7️⃣ Verificar os Dados Migrados

```bash
# Conectar ao MySQL
mysql -u appuser -p adc_pro_2026

# Dentro do MySQL, executar:
SHOW TABLES;

SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM products;
SELECT COUNT(*) FROM customers;
SELECT COUNT(*) FROM orders;

EXIT;
```

## 🎯 Alternativa: Migração Local com Túnel SSH

Se preferir executar localmente:

### 1️⃣ Criar Túnel SSH

```bash
# Em um terminal, manter este comando rodando:
ssh -L 3307:localhost:3306 seu_usuario@seu_ip_vps
```

### 2️⃣ Ajustar .env Temporariamente

```bash
# Editar .env local para usar a porta do túnel:
DATABASE_URL="mysql://appuser:Hf$.3ui*)(1m@127.0.0.1:3307/adc_pro_2026"
```

### 3️⃣ Executar Migração

```bash
# Em outro terminal:
npm run migrate:vps
```

### 4️⃣ Restaurar .env

```bash
# Voltar para localhost:
DATABASE_URL="mysql://appuser:Hf$.3ui*)(1m@localhost:3306/adc_pro_2026"
```

## ✅ Verificação Final

Após a migração, testar a aplicação:

```bash
# Iniciar aplicação no VPS
npm run build
npm start

# Ou em desenvolvimento:
npm run dev
```

Acessar a aplicação e verificar:
- ✅ Login funciona
- ✅ Produtos aparecem
- ✅ Clientes estão listados
- ✅ Pedidos são exibidos

## 📞 Problemas Comuns

### Erro: "Can't connect to MySQL server"
```bash
# Verificar se MySQL está rodando
sudo systemctl status mysql

# Iniciar MySQL se necessário
sudo systemctl start mysql
```

### Erro: "Access denied for user"
```bash
# Verificar credenciais
mysql -u appuser -p adc_pro_2026 -e "SELECT 1;"
```

### Erro: "Table doesn't exist"
```bash
# Criar tabelas primeiro
npx prisma db push
```

## 🎉 Sucesso!

Quando ver a mensagem:
```
🎉 Migration Complete!

📊 Summary:
   ✅ All tables migrated from Supabase to MySQL VPS
   ✅ Data normalized and transformed
   ✅ Ready for production use
```

Sua migração está completa! 🚀
