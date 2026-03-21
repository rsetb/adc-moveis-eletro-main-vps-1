
# Histórico de Mudanças (Walkthrough)

## Mudanças Recentes

### Documentação Centralizada
- Criada a pasta `docs/` e movidos/criados todos os arquivos de documentação relevantes.
- Adicionado `docs/README.md` como índice principal.

### Script de Migração de Dados
- Desenvolvido `scripts/migrate-supabase-data.ts`.
    - **Objetivo:** Migrar dados do Supabase para MySQL/PostgreSQL local.
    - **Recursos:** Paginação, normalização de dados, tratamento de erros, idempotência (upsert).

### Guias de Deploy
- Padronizado o `docs/vps_deployment_guide.md` com instruções claras para Ubuntu 22.04 e Nginx.

## Como Validar as Mudanças

1.  **Verificar Arquivos:** Confirme que todos os arquivos `.md` listados no índice existem na pasta `docs/`.
2.  **Testar Script:** Execute `npx tsx scripts/migrate-supabase-data.ts` (requer `.env.local` configurado).
3.  **Ler Guias:** Revise os guias de migração e deploy para garantir clareza.
