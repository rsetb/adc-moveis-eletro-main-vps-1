# Deploy na Hostinger (VPS Ubuntu 24.04) + Migração Supabase → MySQL

Este guia descreve o passo a passo para:

1. Preparar a VPS Hostinger (Ubuntu 24.04.3)
2. Instalar Node.js + Nginx + MySQL (local)
3. Clonar o repositório do sistema
4. Criar as tabelas com Prisma
5. Migrar dados do Supabase para o MySQL local (rodando na VPS)
6. Subir o sistema em produção (PM2) e publicar via Nginx

Observação: o `localhost` é usado para tudo que é interno na VPS (MySQL e proxy do Nginx para o Node). O acesso público ao site deve ser via domínio (produção).  
Observação: o IP da VPS é usado para SSH e para apontar o DNS do domínio.  
Repositório Git: `https://github.com/rsetbrasil/adc-moveis-eletro.git`

---

## 1) Acessar a VPS

No seu computador:

```bash
ssh root@SEU_IP_DA_VPS
```

---

## 2) Preparar servidor (Ubuntu 24.04)

```bash
apt update && apt upgrade -y
apt install -y git curl nginx ufw

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

---

## 3) Instalar Node.js (recomendado: 20 LTS)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

node -v
npm -v
```

---

## 4) Instalar MySQL (local) e criar banco/usuário

```bash
apt install -y mysql-server
mysql
```

Dentro do MySQL:

```sql
CREATE DATABASE adc_pro_2026 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'appuser'@'localhost' IDENTIFIED BY 'SUA_SENHA_FORTE_AQUI';
GRANT ALL PRIVILEGES ON adc_pro_2026.* TO 'appuser'@'localhost';
FLUSH PRIVILEGES;

EXIT;
```

Testar conexão:

```bash
mysql -u appuser -p -e "SELECT 1;" adc_pro_2026
```

---

## 5) Clonar o projeto na VPS

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/rsetbrasil/adc-moveis-eletro.git
cd adc-moveis-eletro
```

---

## 6) Criar `.env.local` (usado na migração Supabase → MySQL)

Esse arquivo será usado para rodar o script de migração na VPS.

```bash
nano .env.local
```

Exemplo:

```env
# DESTINO (MySQL local na VPS)
DATABASE_URL="mysql://appuser:SUA_SENHA_FORTE_AQUI@localhost:3306/adc_pro_2026"

# ORIGEM (Supabase) - usado só na migração
NEXT_PUBLIC_SUPABASE_URL="https://SEU_PROJETO.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="SUA_SERVICE_ROLE_KEY"
```

---

## 7) Instalar dependências

```bash
npm ci
```

---

## 8) Gerar Prisma + criar as tabelas no MySQL

```bash
npx prisma generate
npm run db:push
```

---

## 9) Migrar Supabase → MySQL (rodando na VPS)

```bash
npm run migrate:vps
```

Checar se os dados entraram:

```bash
mysql -u appuser -p adc_pro_2026 -e "\
SELECT COUNT(*) AS users FROM users; \
SELECT COUNT(*) AS products FROM products; \
SELECT COUNT(*) AS customers FROM customers; \
SELECT COUNT(*) AS orders FROM orders; \
SELECT COUNT(*) AS config FROM config;"
```

---

## 10) Criar `.env` de produção (para rodar o sistema)

```bash
nano .env
```

Exemplo mínimo:

```env
DATABASE_URL="mysql://appuser:SUA_SENHA_FORTE_AQUI@localhost:3306/adc_pro_2026"
NODE_ENV="production"

ASAAS_ACCESS_TOKEN="SUA_API_KEY_ASAAS"
ASAAS_WEBHOOK_TOKEN="SEU_TOKEN_WEBHOOK_ASAAS"
ASAAS_ENV="production"

NEXT_TELEMETRY_DISABLED="1"
```

---

## 11) Build e subir com PM2

```bash
npm run build
npm i -g pm2
pm2 start npm --name adc -- start
pm2 save
pm2 startup
```

Ver logs:

```bash
pm2 logs adc --lines 200
```

---

## 12) Configurar Nginx (interno: localhost)

Crie o arquivo:

```bash
nano /etc/nginx/sites-available/adc
```

Conteúdo (localhost):

```nginx
server {
  server_name localhost _;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

Ativar:

```bash
ln -s /etc/nginx/sites-available/adc /etc/nginx/sites-enabled/adc
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

Acessar:

- Na própria VPS: `curl -I http://localhost`
- No navegador (produção): use o domínio após apontar o DNS e habilitar SSL

---

## 13) Quando tiver domínio: apontar DNS + habilitar HTTPS (SSL)

1. No DNS do domínio, crie registros **A** apontando para o IP da sua VPS:
   - `@` → `SEU_IP_DA_VPS`
   - `www` → `SEU_IP_DA_VPS`

2. Ajuste o `server_name` do Nginx para:
   - `SEU_DOMINIO.com.br www.SEU_DOMINIO.com.br`

3. Instale e rode Certbot:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d SEU_DOMINIO.com.br -d www.SEU_DOMINIO.com.br
```

---

## 14) Webhook do Asaas

No painel do Asaas, configure:

- URL: `https://SEU_DOMINIO.com.br/api/asaas/webhook`
- Token: o mesmo valor de `ASAAS_WEBHOOK_TOKEN`

---

## Dicas rápidas

- Reiniciar app:
  ```bash
  pm2 restart adc
  ```
- Ver status:
  ```bash
  pm2 status
  ```
- Recarregar Nginx:
  ```bash
  systemctl reload nginx
  ```
