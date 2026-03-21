
# Guia de Migração de Dados: Supabase para Banco Local

Este guia descreve como utilizar o script `scripts/migrate-supabase-data.ts` para migrar todos os dados do seu projeto Supabase existente para o seu banco de dados local (MySQL) ou de produção (PostgreSQL).

## 🚀 Visão Geral

O script de migração conecta-se ao Supabase através da API (`supabase-js`) e ao banco de dados local através do Prisma. Ele busca os dados de todas as tabelas relevantes e os insere no banco de destino.

**Funcionalidades:**
- **Paginação:** Busca dados em lotes (1000 registros por vez) para evitar estouro de memória.
- **Transformação de Dados:** Converte chaves `snake_case` (Supabase) para `camelCase` (Prisma/Aplicação) automaticamente.
- **Normalização Profunda:** Recursivamente normaliza objetos JSON aninhados.
- **Upsert:** Pode ser rodado múltiplas vezes; ele atualiza registros existentes e cria novos (idempotente).
- **Log de Progresso:** Mostra o progresso detalhado no console.

## 📋 Pré-requisitos

Antes de rodar a migração, certifique-se de que:

1.  **Dependências Instaladas:**
    Execute `npm install` na raiz do projeto para instalar as dependências necessárias (`@supabase/supabase-js`, `@prisma/client`, `dotenv`, `tsx`).

2.  **Variáveis de Ambiente (.env.local):**
    Seu arquivo `.env.local` deve conter as credenciais do Supabase e a string de conexão do banco local.

    ```env
    # Supabase (Origem)
    NEXT_PUBLIC_SUPABASE_URL="https://sua-url-supabase.supabase.co"
    SUPABASE_SERVICE_ROLE_KEY="sua-chave-service-role" 
    # ou NEXT_PUBLIC_SUPABASE_ANON_KEY (mas SERVICE_ROLE é recomendado para acesso total sem RLS)

    # Banco Local (Destino)
    DATABASE_URL="mysql://root:password@localhost:3306/adc_pro_2026"
    ```

3.  **Banco de Dados Local Criado:**
    O banco de dados deve existir e estar com o schema atualizado.
    ```bash
    npx prisma db push
    ```

## 🛠️ Executando a Migração

Para iniciar a migração, execute o seguinte comando no terminal:

```bash
npx tsx scripts/migrate-supabase-data.ts
```

O script irá exibir na tela o progresso de cada tabela.

### Exemplo de Saída:

```text
🚀 Starting Migration from Supabase to Local PostgreSQL...

📦 Migrating users...
   Fetching page 1 (Rows 0 to 999)...
✅ Finished users: 50 inserted, 0 failed.

📦 Migrating categories...
   Fetching page 1 (Rows 0 to 999)...
✅ Finished categories: 12 inserted, 0 failed.

...

🎉 Migration Complete!
```

## ⚠️ Resolução de Problemas

-   **Erro de Conexão:** Verifique se as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `DATABASE_URL` estão corretas.
-   **Erro de Permissão (RLS):** Se estiver usando a chave `ANON_KEY`, verifique se as políticas de RLS do Supabase permitem leitura pública ou se o usuário anon tem permissão. O ideal é usar `SUPABASE_SERVICE_ROLE_KEY` para ignorar RLS durante a migração.
-   **Campos Faltando:** O script está mapeado para a estrutura atual do banco. Se você alterou o schema no Supabase ou no Prisma recentemente, pode ser necessário ajustar o mapeamento no script `scripts/migrate-supabase-data.ts`.

## 🔄 Tabelas Migradas

O script migra as seguintes tabelas, nesta ordem (para respeitar dependências):

1.  `users` (Usuários do sistema)
2.  `categories` (Categorias de produtos)
3.  `products` (Catálogo de produtos)
4.  `customers` (Cadastro de clientes)
5.  `orders` (Pedidos e Vendas)
6.  `config` (Configurações do sistema)
7.  `audit_logs` (Logs de auditoria)
8.  `customers_trash` (Lixeira de clientes)
