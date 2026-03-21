
# 📚 Documentação do Projeto ADC-PRO-2026

Bem-vindo à documentação completa do projeto **ADC-PRO-2026**. Aqui você encontrará todos os guias necessários para desenvolvimento, migração e deploy.

## 📌 Índice de Documentos

### 🚀 Deploy e Infraestrutura
- [**Guia de Deploy na VPS**](./vps_deployment_guide.md) - Passo a passo completo para colocar o sistema em produção.

### 🔄 Migração de Dados
- [**Guia de Migração de Dados**](./data_migration_guide.md) - Como migrar dados do Supabase para o banco de dados local (MySQL/PostgreSQL).
- [**Resumo da Migração**](./migration_summary.md) - Visão geral técnica do processo de migração.
- [**Plano de Migração**](./migration_plan.md) - Detalhes técnicos e etapas da migração.

### 📝 Planejamento e Tarefas
- [**Lista de Tarefas (Task List)**](./task.md) - Acompanhamento das tarefas do projeto.
- [**Plano de Implementação**](./implementation_plan.md) - Detalhes sobre as funcionalidades implementadas e planejadas.
- [**Histórico de Mudanças (Walkthrough)**](./walkthrough.md) - Registro das alterações e evoluções do projeto.
- [**Blueprint do Projeto**](./blueprint.md) - Visão geral arquitetural e de design do sistema.

---

## 🛠️ Scripts Úteis

- `npm run dev` - Inicia o servidor de desenvolvimento.
- `npx tsx scripts/migrate-supabase-data.ts` - Executa a migração de dados do Supabase.
- `npx prisma db push` - Sincroniza o schema do Prisma com o banco de dados.

---

> _Documentação gerada automaticamente para auxiliar na manutenção e evolução do projeto._
