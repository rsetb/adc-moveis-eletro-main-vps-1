
# Plano de Migração Técnica

Este documento detalha o plano técnico para a migração dos dados do Supabase para o banco de dados local.

## 1. Escopo da Migração

A migração abrangerá todas as entidades principais do sistema para garantir uma transição completa e funcional.

**Entidades Incluídas:**
- [x] Usuários (`users`)
- [x] Categorias (`categories`)
- [x] Produtos (`products`)
- [x] Clientes (`customers`)
- [x] Pedidos (`orders`)
- [x] Configurações (`config`)
- [x] Logs de Auditoria (`audit_logs`)
- [x] Lixeira de Clientes (`customers_trash`)

## 2. Estratégia de Execução

### Fase 1: Preparação
- [x] Verificar acesso à API do Supabase via `supabase-js`.
- [x] Validar schema do banco de dados local com Prisma (`npx prisma db push`).
- [x] Configurar variáveis de ambiente (`.env.local`).

### Fase 2: Implementação do Script
- [x] Criar script em TypeScript (`scripts/migrate-supabase-data.ts`).
- [x] Implementar função de normalização de chaves (`snake_case` -> `camelCase`).
- [x] Implementar lógica de paginação para grandes volumes de dados.
- [x] Implementar lógica de `upsert` para permitir reexecução segura.

### Fase 3: Validação e Testes
- [ ] Executar script em ambiente de desenvolvimento.
- [ ] Verificar integridade dos dados migrados (quantidade de registros, campos nulos).
- [ ] Validar funcionamento da aplicação com os dados migrados.

## 3. Riscos e Mitigação

| Risco | Probabilidade | Mitigação |
| :--- | :--- | :--- |
| **Perda de Dados** | Baixa | Utilização de `upsert` e backups prévios do banco destino se já houver dados. O script apenas lê do Supabase, não apaga nada na origem. |
| **Inconsistência de Tipos** | Média | Uso do TypeScript e Prisma Client para garantir tipagem forte durante a migração. |
| **Timeout/Memória** | Média | Implementação de paginação (chunks de 1000 registros) para evitar sobrecarga. |
| **Limites de API** | Baixa | A API do Supabase geralmente suporta bem a carga, mas a paginação ajuda a mitigar rate limits. |

## 4. Rollback
Em caso de falha crítica durante aa migração para o banco local:
1. Limpar as tabelas locais (`npx prisma migrate reset` ou `TRUNCATE`).
2. Corrigir o script.
3. Executar novamente.

A origem (Supabase) permanece intacta durante todo o processo.
