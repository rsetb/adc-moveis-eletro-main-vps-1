# 🔄 Alternar Entre XAMPP Local e VPS MySQL

## 📋 Configurações Disponíveis

Você tem duas configurações de banco de dados:

### 🟢 XAMPP Local (Desenvolvimento)
- **Banco:** `adc_pro_2026`
- **Usuário:** `root`
- **Senha:** (sem senha)
- **Host:** `localhost:3306`
- **Uso:** Desenvolvimento e testes locais

### 🔴 VPS MySQL (Produção)
- **Banco:** `adc_pro_2026`
- **Usuário:** `appuser`
- **Senha:** `Hf$.3ui*)(1m`
- **Host:** `localhost:3306` (quando no VPS)
- **Uso:** Produção ou testes no servidor

## 🔧 Como Alternar

### Método 1: Editar `.env` e `.env.local`

Abra os arquivos `.env` e `.env.local` e comente/descomente as linhas:

#### Para usar XAMPP Local:
```bash
# 🔴 VPS - MySQL Produção (appuser)
# DATABASE_URL="mysql://appuser:Hf$.3ui*)(1m@localhost:3306/adc_pro_2026"

# 🟢 XAMPP - MySQL Local (root sem senha) - ATIVO
DATABASE_URL="mysql://root@localhost:3306/adc_pro_2026"
```

#### Para usar VPS MySQL:
```bash
# 🔴 VPS - MySQL Produção (appuser) - ATIVO
DATABASE_URL="mysql://appuser:Hf$.3ui*)(1m@localhost:3306/adc_pro_2026"

# 🟢 XAMPP - MySQL Local (root sem senha)
# DATABASE_URL="mysql://root@localhost:3306/adc_pro_2026"
```

### Método 2: Criar Scripts PowerShell

#### `use-xampp.ps1`
```powershell
# Usar XAMPP Local
(Get-Content .env) -replace '^DATABASE_URL="mysql://appuser', '# DATABASE_URL="mysql://appuser' | Set-Content .env
(Get-Content .env) -replace '^# DATABASE_URL="mysql://root', 'DATABASE_URL="mysql://root' | Set-Content .env
(Get-Content .env.local) -replace '^DATABASE_URL="mysql://appuser', '# DATABASE_URL="mysql://appuser' | Set-Content .env.local
(Get-Content .env.local) -replace '^# DATABASE_URL="mysql://root', 'DATABASE_URL="mysql://root' | Set-Content .env.local
Write-Host "✅ Configurado para usar XAMPP Local" -ForegroundColor Green
```

#### `use-vps.ps1`
```powershell
# Usar VPS MySQL
(Get-Content .env) -replace '^DATABASE_URL="mysql://root', '# DATABASE_URL="mysql://root' | Set-Content .env
(Get-Content .env) -replace '^# DATABASE_URL="mysql://appuser', 'DATABASE_URL="mysql://appuser' | Set-Content .env
(Get-Content .env.local) -replace '^DATABASE_URL="mysql://root', '# DATABASE_URL="mysql://root' | Set-Content .env.local
(Get-Content .env.local) -replace '^# DATABASE_URL="mysql://appuser', 'DATABASE_URL="mysql://appuser' | Set-Content .env.local
Write-Host "✅ Configurado para usar VPS MySQL" -ForegroundColor Green
```

**Uso:**
```powershell
# Alternar para XAMPP
.\use-xampp.ps1

# Alternar para VPS
.\use-vps.ps1
```

## ✅ Verificar Configuração Atual

```powershell
# Ver qual conexão está ativa
Get-Content .env | Select-String "^DATABASE_URL"
```

## 🔄 Após Alternar

Sempre que alternar o ambiente:

1. **Parar o servidor** (se estiver rodando):
   ```powershell
   # Pressione Ctrl+C no terminal do npm run dev
   ```

2. **Reiniciar o servidor**:
   ```powershell
   npm run dev
   ```

3. **Verificar conexão**:
   ```powershell
   npx prisma db push
   ```

## 📊 Sincronizar Dados Entre Ambientes

### XAMPP → VPS (Enviar dados locais para produção)

```bash
# 1. Exportar dados do XAMPP
mysqldump -u root adc_pro_2026 > backup_xampp.sql

# 2. Conectar ao VPS via SSH
ssh seu_usuario@seu_vps_ip

# 3. Importar no VPS
mysql -u appuser -p adc_pro_2026 < backup_xampp.sql
```

### VPS → XAMPP (Trazer dados de produção para local)

```bash
# 1. No VPS, exportar dados
ssh seu_usuario@seu_vps_ip
mysqldump -u appuser -p adc_pro_2026 > backup_vps.sql
exit

# 2. Copiar arquivo para local
scp seu_usuario@seu_vps_ip:~/backup_vps.sql ./

# 3. Importar no XAMPP
mysql -u root adc_pro_2026 < backup_vps.sql
```

## ⚠️ Dicas Importantes

> [!WARNING]
> **Sempre verifique qual ambiente está ativo** antes de fazer alterações importantes nos dados!

> [!TIP]
> **Desenvolvimento:** Use XAMPP local para testes e desenvolvimento
> **Produção:** Use VPS MySQL apenas quando for fazer deploy ou testar em produção

> [!CAUTION]
> **Cuidado com dados de produção:** Não sobrescreva dados de produção acidentalmente!

## 🎯 Workflow Recomendado

1. **Desenvolvimento diário:**
   - Use XAMPP local
   - Teste todas as funcionalidades
   - Faça commits no Git

2. **Antes de fazer deploy:**
   - Altere para VPS MySQL
   - Teste a aplicação
   - Verifique se tudo funciona

3. **Deploy:**
   - Faça push para GitHub
   - Execute migração no VPS
   - Teste em produção

## 📞 Verificação Rápida

```powershell
# Ver ambiente ativo
Get-Content .env | Select-String "^DATABASE_URL"

# Testar conexão
npx prisma db push

# Ver tabelas
npx prisma studio
```
