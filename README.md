# 🏪 ADC MÓVEIS E ELETROS - Sistema de Vendas Online

Sistema completo de vendas online com catálogo de produtos, carrinho de compras e sistema de crediário (pagamento parcelado). Desenvolvido com Next.js 15, TypeScript, Prisma e PostgreSQL.

![Next.js](https://img.shields.io/badge/Next.js-15.5.9-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5.4-blue?style=flat-square&logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-6.0.0-2D3748?style=flat-square&logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791?style=flat-square&logo=postgresql)

## ✨ Funcionalidades

### 🛍️ Catálogo de Produtos
- Navegação por categorias
- Busca e filtros avançados
- Ordenação por preço, nome, etc.
- Visualização detalhada de produtos
- Imagens de produtos

### 🛒 Carrinho de Compras
- Adicionar/remover produtos
- Atualizar quantidades
- Cálculo automático de totais
- Persistência do carrinho

### 👥 Gestão de Clientes
- Cadastro completo de clientes
- Endereço e informações de contato
- Sistema de lixeira (recycle bin)
- Restauração de clientes deletados
- Controle de acesso (admin/gerente)
- Logs de auditoria

### 💳 Sistema de Crediário
- Pagamento parcelado personalizado
- Controle de parcelas
- Registro de pagamentos
- Histórico de transações
- Geração de carnês
- Impressão de recibos

### 📊 Painel Administrativo
- Dashboard com métricas
- Gestão de produtos
- Gestão de categorias
- Gestão de pedidos
- Relatórios de vendas
- Controle de estoque
- Gestão de caixa

### 🔐 Autenticação e Autorização
- Sistema de login
- Níveis de acesso (admin, gerente, vendedor)
- Proteção de rotas
- Sessões seguras

## 🚀 Tecnologias Utilizadas

### Frontend
- **Next.js 15.5.9** - Framework React com SSR
- **React 19** - Biblioteca UI
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Framework CSS utilitário
- **shadcn/ui** - Componentes UI reutilizáveis
- **Framer Motion** - Animações
- **Lucide React** - Ícones
- **React Hook Form** - Formulários
- **Zod** - Validação de schemas

### Backend
- **Prisma 6.0.0** - ORM para PostgreSQL
- **PostgreSQL** - Banco de dados relacional
- **Supabase** - Backend as a Service
- **Firebase** - Autenticação e Firestore

### Ferramentas de Desenvolvimento
- **ESLint** - Linting
- **TypeScript** - Type checking
- **Genkit** - AI/ML toolkit
- **tsx** - TypeScript execution

## 📦 Instalação

### Pré-requisitos
- Node.js 20+ 
- PostgreSQL 14+
- npm ou yarn

### Passo a Passo

1. **Clone o repositório**
```bash
git clone https://github.com/rsetbrasil/adc-moveis-eletro.git
cd adc-moveis-eletro
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**

Crie um arquivo `.env.local` na raiz do projeto:

```env
# Database
DATABASE_URL="postgresql://usuario:senha@localhost:5432/adc_db"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="sua-url-supabase"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sua-chave-anonima"

# Firebase (opcional)
NEXT_PUBLIC_FIREBASE_API_KEY="sua-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="seu-auth-domain"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="seu-project-id"
```

4. **Configure o banco de dados**
```bash
# Criar as tabelas
npm run db:push

# Ou executar migrations
npx prisma migrate dev
```

5. **Inicie o servidor de desenvolvimento**
```bash
npm run dev
```

Acesse http://localhost:3000

## 🗂️ Estrutura do Projeto

```
ADC-MOVEIS-ELETRO/
├── src/
│   ├── app/              # Rotas Next.js (App Router)
│   ├── components/       # Componentes React reutilizáveis
│   ├── context/          # Context API (AdminContext, etc.)
│   ├── lib/              # Utilitários e configurações
│   ├── types/            # Definições de tipos TypeScript
│   └── ai/               # Integrações com AI (Genkit)
├── prisma/
│   └── schema.prisma     # Schema do banco de dados
├── public/               # Arquivos estáticos
├── docs/                 # Documentação
├── scripts/              # Scripts utilitários
└── tests/                # Testes automatizados
```

## 📝 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev              # Inicia servidor de desenvolvimento

# Build
npm run build            # Cria build de produção
npm run start            # Inicia servidor de produção

# Banco de Dados
npm run db:push          # Sincroniza schema com banco
npx prisma studio        # Interface visual do banco

# Qualidade de Código
npm run lint             # Executa ESLint
npm run typecheck        # Verifica tipos TypeScript

# Testes
npm run test             # Executa testes

# Migrações
npm run migrate          # Executa script de migração de dados
```

## 🌐 Deploy

### Deploy em VPS

Consulte o guia completo de deploy: [DEPLOYMENT_GUIDE_VPS.md](./DEPLOYMENT_GUIDE_VPS.md)

### Deploy na Vercel

1. Conecte seu repositório GitHub à Vercel
2. Configure as variáveis de ambiente
3. Deploy automático a cada push

## 📚 Documentação

Documentação completa disponível na pasta [docs/](./docs/):

- [Guia de Deploy VPS](./docs/vps_deployment_guide.md)
- [Guia de Migração de Dados](./docs/data_migration_guide.md)
- [Documentação da API](./docs/api_documentation.md)

## 🔒 Segurança

- ✅ Variáveis de ambiente protegidas
- ✅ Autenticação segura
- ✅ Validação de dados com Zod
- ✅ Proteção contra SQL Injection (Prisma)
- ✅ HTTPS obrigatório em produção
- ✅ Logs de auditoria

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto é proprietário e confidencial. Todos os direitos reservados.

## 👨‍💻 Autor

**Rafael Set Brasil**
- GitHub: [@rsetbrasil](https://github.com/rsetbrasil)
- Email: rsetbrasil@gmail.com

## 🙏 Agradecimentos

- Next.js Team
- Vercel
- Prisma Team
- shadcn/ui
- Comunidade Open Source

---

**Desenvolvido com ❤️ para ADC Móveis e Eletros**
