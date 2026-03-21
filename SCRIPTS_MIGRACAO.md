# 🚀 Scripts de Migração Automatizados

Criados 2 scripts para facilitar a migração do Supabase para MySQL VPS:

## 📁 Arquivos Criados

### 1. `migrar-vps.sh` (Linux/VPS)
Script bash para executar **diretamente no VPS**

### 2. `migrar-vps.ps1` (Windows/Local)
Script PowerShell para executar **localmente no Windows**

---

## 🐧 Como Usar no VPS (Linux)

### 1. Enviar o script para o VPS

```bash
# Via SCP
scp migrar-vps.sh seu_usuario@seu_ip_vps:~/

# Ou via SFTP, ou copiar manualmente
```

### 2. Conectar ao VPS

```bash
ssh seu_usuario@seu_ip_vps
```

### 3. Navegar até o projeto

```bash
cd /caminho/do/projeto
# Exemplo: cd /var/www/adc-moveis-eletro
```

### 4. Copiar o script para o projeto (se enviou para ~/)

```bash
cp ~/migrar-vps.sh .
```

### 5. Dar permissão de execução

```bash
chmod +x migrar-vps.sh
```

### 6. Executar o script

```bash
./migrar-vps.sh
```

---

## 🪟 Como Usar no Windows (Local com Túnel SSH)

### 1. Criar túnel SSH

Em um terminal PowerShell, manter rodando:

```powershell
ssh -L 3307:localhost:3306 seu_usuario@seu_ip_vps
```

### 2. Ajustar .env temporariamente

Editar `.env` e `.env.local` para usar a porta do túnel:

```bash
DATABASE_URL="mysql://appuser:Hf$.3ui*)(1m@127.0.0.1:3307/adc_pro_2026"
```

### 3. Executar o script

Em outro terminal PowerShell:

```powershell
.\migrar-vps.ps1
```

### 4. Restaurar .env

Depois da migração, voltar para:

```bash
DATABASE_URL="mysql://appuser:Hf$.3ui*)(1m@localhost:3306/adc_pro_2026"
```

---

## ✨ O que os scripts fazem

1. ✅ Verificam se está no diretório correto
2. ✅ Criam arquivo `.env` se não existir
3. ✅ Instalam dependências se necessário
4. ✅ Testam conexão com MySQL (apenas Linux)
5. ✅ Criam estrutura do banco (`prisma db push`)
6. ✅ Executam migração (`npm run migrate:vps`)
7. ✅ Mostram resumo dos dados migrados (apenas Linux)

---

## 📊 Output Esperado

```
🚀 Iniciando migração do Supabase para MySQL VPS...

📁 Verificando diretório do projeto...
✅ Diretório correto

📝 Verificando arquivo .env...
✅ Arquivo .env encontrado

📦 Verificando dependências...
✅ Dependências já instaladas

🔌 Testando conexão com MySQL...
✅ Conexão com MySQL OK

🏗️  Criando estrutura do banco de dados...
✅ Estrutura do banco criada

🔄 Executando migração de dados...

🚀 Starting Migration from Supabase to MySQL VPS...
📦 Migrating users...
✅ Finished users: 13 inserted, 0 failed.
[...]

🎉 Migração concluída com sucesso!

📊 Verificando dados migrados...
+------------------+-------+
| tabela           | total |
+------------------+-------+
| users            |    13 |
| products         |   108 |
| customers        |  2512 |
| orders           | 15000 |
| categories       |     4 |
+------------------+-------+

✅ Migração completa!
```

---

## 🎯 Recomendação

**Para VPS:** Use `migrar-vps.sh` diretamente no servidor  
**Para Local:** Use `migrar-vps.ps1` com túnel SSH

---

## 🔧 Troubleshooting

### Erro: "Permission denied"
```bash
chmod +x migrar-vps.sh
```

### Erro: "MySQL connection failed"
```bash
# Verificar se MySQL está rodando
sudo systemctl status mysql

# Iniciar MySQL
sudo systemctl start mysql
```

### Erro: "package.json not found"
```bash
# Certifique-se de estar no diretório correto
cd /caminho/do/projeto
pwd
```

---

## 📞 Comandos Manuais (se preferir)

Se preferir executar manualmente sem o script:

```bash
# 1. Criar estrutura
npx prisma db push

# 2. Migrar dados
npm run migrate:vps

# 3. Verificar
mysql -u appuser -p adc_pro_2026 -e "SELECT COUNT(*) FROM users;"
```
