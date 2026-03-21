# Configuração MySQL VPS

## Credenciais do Banco de Dados

- **Banco de Dados:** `adc_pro_2026`
- **Usuário:** `appuser`
- **Senha:** `Hf$.3ui*)(1m`
- **Host:** `localhost` (quando conectado ao VPS)

## Como Conectar ao MySQL no VPS

### 1. Via SSH + MySQL Client

```bash
# Conectar ao VPS via SSH primeiro
ssh seu_usuario@seu_vps_ip

# Depois conectar ao MySQL
mysql -u appuser -p adc_pro_2026
# Quando solicitado, digite a senha: Hf$.3ui*)(1m
```

### 2. Comandos Úteis MySQL

```sql
-- Ver todas as tabelas
SHOW TABLES;

-- Ver estrutura de uma tabela
DESCRIBE nome_da_tabela;

-- Ver todos os bancos de dados
SHOW DATABASES;

-- Sair do MySQL
EXIT;
```

### 3. Configuração no .env.local

A string de conexão já está configurada no arquivo `.env.local`:

```bash
DATABASE_URL="mysql://appuser:Hf$.3ui*)(1m@localhost:3306/adc_pro_2026"
```

### 4. Testar Conexão com Prisma

```bash
# Verificar se a conexão está funcionando
npx prisma db push

# Ou apenas validar o schema
npx prisma validate
```

## Notas Importantes

> [!WARNING]
> **Segurança:** Nunca compartilhe essas credenciais publicamente ou faça commit delas no GitHub!

> [!TIP]
> **Ambientes Diferentes:** Você pode alternar entre desenvolvimento local (XAMPP) e VPS comentando/descomentando as linhas no `.env.local`

## Alternando entre Ambientes

### Para usar XAMPP (desenvolvimento local):
```bash
DATABASE_URL="mysql://root@localhost:3306/adc_pro_2026"
```

### Para usar VPS (produção):
```bash
DATABASE_URL="mysql://appuser:Hf$.3ui*)(1m@localhost:3306/adc_pro_2026"
```
