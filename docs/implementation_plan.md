
# Plano de Implementação

## Objetivo
Criar e estruturar a documentação necessária para o projeto, incluindo guias de deploy, migração de dados e scripts de automação.

## Estrutura de Documentação
A documentação foi centralizada na pasta `docs/` para manter a organização do repositório.

### Arquivos Criados
1.  **docs/README.md**: Ponto de entrada para a documentação.
2.  **docs/vps_deployment_guide.md**: Guia detalhado de deploy.
3.  **docs/data_migration_guide.md**: Instruções para uso do script de migração.
4.  **docs/migration_summary.md**: Resumo técnico da migração.
5.  **docs/migration_plan.md**: Plano estratégico da migração.
6.  **docs/task.md**: Lista de tarefas e status.
7.  **docs/walkthrough.md**: Histórico de mudanças.
8.  **docs/implementation_plan.md**: Este documento.

## Scripts de Automação
Foi criado o script `scripts/migrate-supabase-data.ts` para facilitar a migração segura dos dados do Supabase para o banco de dados local.

### Funcionalidades do Script
- Leitura paginada da API Supabase.
- Transformação de chaves (`snake_case` para `camelCase`).
- Normalização de JSON aninhado.
- Operações de Upsert para idempotência.

## Verificação
- Os arquivos foram criados com sucesso.
- O script foi validado estaticamente (ainda requer execução real com credenciais válidas).
