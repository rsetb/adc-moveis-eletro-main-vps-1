# 🗄️ Guia de Importação do Banco de Dados

## Arquivo SQL Criado

✅ **`database_complete.sql`** - SQL completo com todas as tabelas do sistema

## 📋 O que está incluído no SQL

### Tabelas Criadas (14 tabelas):
1. ✅ `users` - Usuários do sistema
2. ✅ `products` - Produtos/catálogo
3. ✅ `categories` - Categorias e subcategorias
4. ✅ `customers` - Clientes
5. ✅ `customers_trash` - Lixeira de clientes
6. ✅ `audit_logs` - Logs de auditoria
7. ✅ `config` - Configurações do sistema
8. ✅ `orders` - Pedidos/vendas
9. ✅ `commission_payments` - Pagamentos de comissão
10. ✅ `stock_audits` - Auditorias de estoque
11. ✅ `avarias` - Registro de avarias
12. ✅ `chat_sessions` - Sessões de chat
13. ✅ `chat_messages` - Mensagens do chat

### Dados Iniciais:
- ✅ Usuário admin padrão (username: `admin`, senha: `admin123`)
- ✅ 4 categorias padrão: Móveis, Eletrodomésticos, Eletrônicos, Decoração

## 🚀 Como Importar no VPS

### Opção 1: Via SSH + MySQL Client (Recomendado)

```bash
# 1. Conectar ao VPS via SSH
ssh seu_usuario@seu_vps_ip

# 2. Fazer upload do arquivo SQL (se necessário)
# Use SCP ou SFTP para enviar o arquivo database_complete.sql para o VPS

# 3. Importar o SQL
mysql -u appuser -p adc_pro_2026 < database_complete.sql
# Digite a senha quando solicitado: Hf$.3ui*)(1m

# 4. Verificar se foi importado corretamente
mysql -u appuser -p adc_pro_2026 -e "SHOW TABLES;"
```

### Opção 2: Via phpMyAdmin (se disponível)

1. Acesse o phpMyAdmin do seu VPS
2. Selecione o banco de dados `adc_pro_2026`
3. Clique na aba **"Importar"**
4. Escolha o arquivo `database_complete.sql`
5. Clique em **"Executar"**

### Opção 3: Via Linha de Comando Local (com túnel SSH)

```bash
# Criar túnel SSH para o MySQL
ssh -L 3307:localhost:3306 seu_usuario@seu_vps_ip

# Em outro terminal, importar o SQL
mysql -h 127.0.0.1 -P 3307 -u appuser -p adc_pro_2026 < database_complete.sql
```

## 🔍 Verificação Pós-Importação

Execute estes comandos para verificar:

```sql
-- Conectar ao MySQL
mysql -u appuser -p adc_pro_2026

-- Verificar tabelas criadas
SHOW TABLES;

-- Verificar usuário admin
SELECT id, username, name, role FROM users;

-- Verificar categorias
SELECT id, name, `order` FROM categories;

-- Verificar estrutura de uma tabela
DESCRIBE products;

-- Sair
EXIT;
```

## 📝 Credenciais do Banco

```
Banco: adc_pro_2026
Usuário: appuser
Senha: Hf$.3ui*)(1m
Host: localhost (quando conectado ao VPS)
```

## ⚠️ Notas Importantes

> [!WARNING]
> **Backup:** Se você já tem dados no banco, faça backup antes de importar!

```bash
# Fazer backup do banco atual
mysqldump -u appuser -p adc_pro_2026 > backup_$(date +%Y%m%d_%H%M%S).sql
```

> [!TIP]
> **Senha do Admin:** A senha padrão do usuário admin é `admin123`. Altere após o primeiro login!

> [!IMPORTANT]
> **Charset:** O banco usa `utf8mb4_unicode_ci` para suportar caracteres especiais e emojis

## 🔄 Sincronizar com Prisma

Depois de importar o SQL no VPS, você pode sincronizar localmente:

```bash
# Puxar o schema do banco de dados
npx prisma db pull

# Gerar o Prisma Client
npx prisma generate
```

## 🛠️ Comandos Úteis

```bash
# Ver tamanho do banco de dados
mysql -u appuser -p -e "SELECT table_schema AS 'Database', 
  ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)' 
  FROM information_schema.tables 
  WHERE table_schema = 'adc_pro_2026' 
  GROUP BY table_schema;"

# Contar registros em todas as tabelas
mysql -u appuser -p adc_pro_2026 -e "
  SELECT table_name, table_rows 
  FROM information_schema.tables 
  WHERE table_schema = 'adc_pro_2026';"
```

## 📞 Suporte

Se encontrar algum erro durante a importação:
1. Verifique se o usuário `appuser` tem permissões corretas
2. Verifique se o banco `adc_pro_2026` existe
3. Verifique os logs de erro do MySQL: `/var/log/mysql/error.log`
