# 🔄 Guia de Migração: Supabase → MySQL VPS

## 📋 Visão Geral

Este guia explica como migrar todos os dados do Supabase para o MySQL do VPS de forma segura e eficiente.

## 🎯 O que será migrado

### Tabelas (13 no total):
1. ✅ `users` - Usuários do sistema
2. ✅ `categories` - Categorias e subcategorias
3. ✅ `products` - Produtos (preserva estoque local)
4. ✅ `customers` - Clientes
5. ✅ `orders` - Pedidos/vendas
6. ✅ `commission_payments` - Pagamentos de comissão
7. ✅ `stock_audits` - Auditorias de estoque
8. ✅ `avarias` - Registro de avarias
9. ✅ `chat_sessions` - Sessões de chat
10. ✅ `chat_messages` - Mensagens do chat
11. ✅ `config` - Configurações do sistema
12. ✅ `audit_logs` - Logs de auditoria
13. ✅ `customers_trash` - Lixeira de clientes

## 📝 Pré-requisitos

### 1. Verificar Credenciais no `.env.local`

```bash
# MySQL VPS (destino)
DATABASE_URL="mysql://appuser:Hf$.3ui*)(1m@localhost:3306/adc_pro_2026"

# Supabase (origem)
NEXT_PUBLIC_SUPABASE_URL="https://hnpschlfoecpddoydnuv.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="sua_chave_service_role_aqui"
```

> [!IMPORTANT]
> **Service Role Key:** Certifique-se de usar a `SUPABASE_SERVICE_ROLE_KEY` (não a anon key) para ter permissões completas de leitura.

### 2. Criar Estrutura do Banco MySQL

Primeiro, importe o SQL completo no VPS:

```bash
# No VPS via SSH
mysql -u appuser -p adc_pro_2026 < database_complete.sql
```

Ou use Prisma para criar as tabelas:

```bash
npx prisma db push
```

## 🚀 Como Executar a Migração

### Método 1: Migração Direta (Recomendado para VPS)

```bash
# 1. Conectar ao VPS via SSH
ssh seu_usuario@seu_vps_ip

# 2. Navegar até o diretório do projeto
cd /caminho/para/ADC-MOVEIS-ELETRO

# 3. Instalar dependências (se necessário)
npm install

# 4. Executar a migração
npm run migrate:vps
```

### Método 2: Migração Local com Túnel SSH

Se preferir executar localmente:

```bash
# 1. Criar túnel SSH para o MySQL do VPS
ssh -L 3307:localhost:3306 seu_usuario@seu_vps_ip

# 2. Em outro terminal, ajustar .env.local temporariamente
# DATABASE_URL="mysql://appuser:Hf$.3ui*)(1m@127.0.0.1:3307/adc_pro_2026"

# 3. Executar migração
npm run migrate:vps

# 4. Restaurar .env.local
# DATABASE_URL="mysql://appuser:Hf$.3ui*)(1m@localhost:3306/adc_pro_2026"
```

### Método 3: Script Manual

```bash
# Executar diretamente com tsx
npx tsx scripts/migrate-to-mysql-vps.ts
```

## 📊 Durante a Migração

Você verá um output assim:

```
🚀 Starting Migration from Supabase to MySQL VPS...
📍 Target Database: adc_pro_2026
📍 Source: https://hnpschlfoecpddoydnuv.supabase.co

📦 Migrating users...
   Fetching page 1 (Rows 0 to 999)...
...................................................
✅ Finished users: 15 inserted, 0 failed.

📦 Migrating categories...
   Fetching page 1 (Rows 0 to 999)...
...
✅ Finished categories: 8 inserted, 0 failed.

📦 Migrating products...
   Fetching page 1 (Rows 0 to 999)...
...................................................
✅ Finished products: 234 inserted, 0 failed.

[... continua para todas as tabelas ...]

🎉 Migration Complete!

📊 Summary:
   ✅ All tables migrated from Supabase to MySQL VPS
   ✅ Data normalized and transformed
   ✅ Ready for production use
```

## ⚙️ Características da Migração

### 🔄 Upsert Inteligente
- **Novos registros:** Inseridos normalmente
- **Registros existentes:** Atualizados com novos dados
- **Sem duplicatas:** Usa ID como chave única

### 📦 Processamento em Lote
- Processa 1000 registros por vez
- Evita sobrecarga de memória
- Mostra progresso em tempo real (`.` a cada 50 registros)

### 🛡️ Preservação de Dados Locais
- **Produtos:** Estoque local é preservado (não sobrescrito)
- **Outros:** Dados atualizados completamente

### 🔄 Normalização Automática
- Converte `snake_case` → `camelCase`
- Normaliza campos JSON recursivamente
- Converte timestamps para Date objects

## ⚠️ Avisos Importantes

> [!WARNING]
> **Backup Obrigatório:** Sempre faça backup antes de migrar!

```bash
# Backup do MySQL VPS
mysqldump -u appuser -p adc_pro_2026 > backup_antes_migracao_$(date +%Y%m%d_%H%M%S).sql
```

> [!CAUTION]
> **Dados Sensíveis:** O script migra senhas e dados de clientes. Certifique-se de que a conexão é segura!

> [!TIP]
> **Teste Primeiro:** Execute a migração em um banco de teste antes de migrar para produção.

## 🔍 Verificação Pós-Migração

### 1. Verificar Contagem de Registros

```sql
-- Conectar ao MySQL
mysql -u appuser -p adc_pro_2026

-- Contar registros em cada tabela
SELECT 'users' as tabela, COUNT(*) as total FROM users
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'commission_payments', COUNT(*) FROM commission_payments
UNION ALL SELECT 'stock_audits', COUNT(*) FROM stock_audits
UNION ALL SELECT 'avarias', COUNT(*) FROM avarias
UNION ALL SELECT 'chat_sessions', COUNT(*) FROM chat_sessions
UNION ALL SELECT 'chat_messages', COUNT(*) FROM chat_messages
UNION ALL SELECT 'config', COUNT(*) FROM config
UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs
UNION ALL SELECT 'customers_trash', COUNT(*) FROM customers_trash;
```

### 2. Verificar Dados Específicos

```sql
-- Verificar usuários
SELECT id, username, name, role FROM users LIMIT 5;

-- Verificar produtos
SELECT id, code, name, price, stock FROM products LIMIT 5;

-- Verificar pedidos
SELECT id, date, status, total FROM orders ORDER BY created_at DESC LIMIT 5;
```

### 3. Testar Aplicação

```bash
# Iniciar aplicação
npm run dev

# Verificar se:
# - Login funciona
# - Produtos aparecem
# - Clientes estão listados
# - Pedidos são exibidos corretamente
```

## 🔧 Solução de Problemas

### Erro: "Authentication failed"

```bash
# Verificar credenciais no .env.local
cat .env.local | grep DATABASE_URL

# Testar conexão manualmente
mysql -u appuser -p adc_pro_2026 -e "SELECT 1;"
```

### Erro: "Table doesn't exist"

```bash
# Criar tabelas com Prisma
npx prisma db push

# Ou importar SQL
mysql -u appuser -p adc_pro_2026 < database_complete.sql
```

### Erro: "Missing Supabase credentials"

```bash
# Verificar variáveis de ambiente
cat .env.local | grep SUPABASE

# Certifique-se de ter:
# NEXT_PUBLIC_SUPABASE_URL
# SUPABASE_SERVICE_ROLE_KEY
```

### Migração Lenta

- **Normal:** Grandes volumes de dados podem levar tempo
- **Otimização:** O script já processa em lotes de 1000
- **Paciência:** Aguarde a conclusão (pode levar vários minutos)

## 📈 Próximos Passos

Após a migração bem-sucedida:

1. ✅ **Atualizar `.env.local`** para usar MySQL permanentemente
2. ✅ **Testar todas as funcionalidades** da aplicação
3. ✅ **Desativar Supabase** (opcional, após confirmar que tudo funciona)
4. ✅ **Configurar backups automáticos** do MySQL
5. ✅ **Monitorar performance** da aplicação

## 🔄 Migração Incremental (Opcional)

Se quiser sincronizar dados periodicamente:

```bash
# Executar migração novamente (upsert atualiza registros existentes)
npm run migrate:vps
```

Isso atualizará apenas os registros modificados sem duplicar dados.

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs de erro detalhados
2. Confirme que todas as credenciais estão corretas
3. Teste a conexão com MySQL e Supabase separadamente
4. Verifique se as tabelas foram criadas corretamente
