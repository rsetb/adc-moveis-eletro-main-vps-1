# Guia Completo de Implantação em VPS (Ubuntu 22.04)

Este guia cobre passo a passo como colocar seu sistema em produção em um servidor VPS (DigitalOcean, AWS, Vultr, Hetzner, etc.) usando Ubuntu 20.04 ou 22.04.

## 1. Preparação do Servidor

Acesse seu servidor via SSH:
```bash
ssh root@seu_ip_vps
```

### Atualize o sistema
```bash
apt update && apt upgrade -y
```

### Instale as dependências básicas
```bash
apt install -y curl git unzip build-essential
```

### Instale o Node.js (Versão 20 LTS recomendada)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```
Verifique a instalação:
```bash
node -v
npm -v
```

### Instale o Gerenciador de Processos PM2
```bash
npm install -g pm2
```

---

## 2. Configuração do Banco de Dados (PostgreSQL)

### Instale o PostgreSQL
```bash
apt install -y postgresql postgresql-contrib
```

### Configure o Usuário e Banco de Dados
Acesse o prompt do Postgres:
```bash
sudo -u postgres psql
```

Execute os comandos SQL abaixo (altere `sua_senha_segura`):

```sql
CREATE DATABASE appdb;
CREATE USER appuser WITH ENCRYPTED PASSWORD 'sua_senha_segura';
GRANT ALL PRIVILEGES ON DATABASE appdb TO appuser;
ALTER DATABASE appdb OWNER TO appuser;
\q
```

---

## 3. Configuração do Projeto

### Clone o Repositório
Navegue para a pasta de sites (recomendado):
```bash
cd /var/www
git clone https://github.com/seu-usuario/seu-repositorio.git adc-pro
cd adc-pro
```

### Instale as Dependências
```bash
npm install
```

### Configure o .env
Crie o arquivo `.env.production`:
```bash
nano .env.production
```

Cole o conteúdo (ajuste com seus dados):
```env
# Banco de Dados
DATABASE_URL="postgresql://appuser:sua_senha_segura@localhost:5432/appdb?schema=public"

# Autenticação (Gere um segredo com `openssl rand -base64 32`)
AUTH_SECRET="seu_segredo_gerado_aqui"

# Outras Configurações
NEXT_PUBLIC_APP_URL="https://seu-dominio.com"
```
Salve com `Ctrl+O`, Enter, e `Ctrl+X`.

### Prepare o Banco de Dados
Rode as migrações para criar as tabelas no servidor:
```bash
npx prisma generate
npx prisma db push
```

> **Nota:** Se você preferir usar o SQL gerado manualmente, pode rodar:
> `psql -U appuser -d appdb -f setup_db.sql`

### Build do Projeto
```bash
npm run build
```

---

## 4. Colocando Online (PM2)

Inicie a aplicação com o PM2 para que ela rode em segundo plano e reinicie automaticamente.

```bash
pm2 start npm --name "adc-pro" -- start
pm2 save
pm2 startup
```
(Copie e cole o comando que o `pm2 startup` gerar para garantir que inicie com o servidor).

---

## 5. Configuração do Nginx (Proxy Reverso)

Instale o Nginx:
```bash
apt install -y nginx
```

Crie um arquivo de configuração para seu site:
```bash
nano /etc/nginx/sites-available/adc-pro
```

Cole o seguinte conteúdo (altere `seu-dominio.com`):

```nginx
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Ative o site e reinicie o Nginx:
```bash
ln -s /etc/nginx/sites-available/adc-pro /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

---

## 6. Configuração do SSL (HTTPS)

Instale o Certbot para certificados gratuitos Let's Encrypt:
```bash
apt install -y certbot python3-certbot-nginx
```

Gere o certificado:
```bash
certbot --nginx -d seu-dominio.com -d www.seu-dominio.com
```
Siga as instruções na tela. O Certbot configurará o HTTPS automaticamente.

---

## 7. Manutenção e Comandos Úteis

*   **Ver logs da aplicação:** `pm2 logs adc-pro`
*   **Reiniciar aplicação:** `pm2 restart adc-pro`
*   **Atualizar código:**
    ```bash
    git pull
    npm install
    npx prisma db push
    npm run build
    pm2 restart adc-pro
    ```

---

## Anexo: SQL Completo

O arquivo `setup_db.sql` na raiz do projeto contém todo o esquema do banco de dados caso precise recriá-lo manualmente.
