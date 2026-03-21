# Checklist de validação na VPS (copie e rode nessa ordem)

Este checklist ajuda a confirmar que:

- O MySQL local está ativo e acessível
- O projeto está lendo o `DATABASE_URL` certo (localhost)
- O Prisma está gerado e as tabelas estão alinhadas ao `schema.prisma`
- A migração do Supabase (se aplicável) rodou e os dados existem no MySQL

> Rode os comandos no servidor (VPS) dentro do diretório do projeto quando indicado.

---

## 1) Confirmar que o MySQL está ok e o banco existe

```bash
sudo systemctl status mysql --no-pager
mysql -u appuser -p -e "SHOW DATABASES;"
mysql -u appuser -p -e "USE adc_pro_2026; SHOW TABLES;"
```

Se o `mysql` não conectar:

- Confirme usuário/senha
- Confirme se o serviço está “active (running)”

---

## 2) Confirmar que o app está lendo o `DATABASE_URL` correto

No diretório do projeto:

```bash
pwd
ls -la
```

Verifique `.env` e `.env.local` (sem expor segredos em prints públicos):

```bash
cat .env | sed -n '1,160p'
cat .env.local | sed -n '1,160p'
```

O esperado para MySQL local na VPS é algo assim:

```env
DATABASE_URL="mysql://appuser:SUA_SENHA@localhost:3306/adc_pro_2026"
```

---

## 3) Garantir dependências e Prisma gerados

```bash
npm ci
npx prisma generate
npx prisma validate
```

---

## 4) Sincronizar tabelas no MySQL com o `schema.prisma`

```bash
npm run db:push
```

Se aparecer erro de permissão:

- Confirme se o usuário do MySQL tem privilégios no banco `adc_pro_2026`

---

## 5) Validar que o projeto builda com o banco configurado

```bash
npm run build
```

Se usar PM2:

```bash
pm2 restart adc
pm2 logs adc --lines 200
```

---

## 6) Se o banco estiver vazio: migrar Supabase → MySQL na VPS

Garanta que `.env.local` tenha as credenciais do Supabase apenas para a migração:

```env
NEXT_PUBLIC_SUPABASE_URL="https://SEU_PROJETO.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="SUA_SERVICE_ROLE_KEY"
```

Rode:

```bash
npm run migrate:vps
```

---

## 7) Confirmar que existem dados no MySQL

```bash
mysql -u appuser -p adc_pro_2026 -e "\
SELECT COUNT(*) AS users FROM users; \
SELECT COUNT(*) AS products FROM products; \
SELECT COUNT(*) AS customers FROM customers; \
SELECT COUNT(*) AS orders FROM orders; \
SELECT COUNT(*) AS config FROM config;"
```

---

## 8) Se der erro, capture os outputs (para diagnóstico)

Cole (mascare senhas/keys):

```bash
npx prisma validate
npm run build
pm2 logs adc --lines 200
mysql -u appuser -p -e "USE adc_pro_2026; SHOW TABLES;"
```

