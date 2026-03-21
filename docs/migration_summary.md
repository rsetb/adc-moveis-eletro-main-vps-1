
# Resumo da Migração

## Visão Geral Técnica

A migração foi projetada para ser **robusta**, **segura** e **idempotente**. Ela transfere dados de um ambiente Supabase (PostgreSQL hosting) para o ambiente de produção/desenvolvimento atual (seja MySQL local ou PostgreSQL VPS), garantindo a integridade dos tipos e relacionamentos.

## Estratégia de Mapeamento

Utilizamos um padrão de mapeamento explícito para garantir que cada campo do banco de origem corresponda corretamente ao destino, lidando com diferenças de convenção de nomenclatura (`snake_case` vs `camelCase`).

### Transformações Principais

-   **Datas:** Conversão de strings/timestamps ISO do Supabase para objetos `Date` do JavaScript compatíveis com o Prisma.
-   **JSON:** Normalização recursiva de campos JSON (`image_urls`, `subcategories`, `items` de pedidos) para garantir que as chaves internas também respeitem o padrão `camelCase` utilizado no frontend em React.
-   **Relacionamentos:** Preservação de IDs (UUIDs) para manter a integridade referencial entre tabelas (ex: `products.category_id` -> `categories.id`).

## Fluxo de Execução

1.  **Inicialização:** Carregamento de variáveis de ambiente e conexão com ambos os bancos.
2.  **Extração:** Leitura paginada da API do Supabase (1000 registros/página) para eficiência de memória.
3.  **Transformação:** Aplicação de funções de transformação específicas para cada tabela.
4.  **Carga (Load):** Uso do método `upsert` do Prisma.
    -   Se o registro já existe (baseado no ID), ele é atualizado.
    -   Se não existe, é criado.
    -   Isso permite re-executar a migração sem duplicar dados ou causar erros de chave primária.

## Cobertura

| Tabela Origem | Tabela Destino (Prisma) | Notas |
| :--- | :--- | :--- |
| `users` | `User` | Usuários administrativos e vendedores. |
| `categories` | `Category` | Estrutura de categorias e subcategorias (JSON). |
| `products` | `Product` | Catálogo completo, preços, estoque. |
| `customers` | `Customer` | Dados sensíveis de clientes. |
| `orders` | `Order` | Histórico de vendas, itens, pagamentos. |
| `config` | `Config` | Configurações globais (KV Store). |
| `audit_logs` | `AuditLog` | Rastreabilidade de ações. |
| `customers_trash` | `CustomerTrash` | Registros de clientes excluídos (Soft Delete). |

## Validação

Após a migração, recomenda-se verificar:
1.  Contagem de registros em ambas as bases.
2.  Integridade de campos JSON complexos (ex: itens de pedido).
3.  Login de usuários administrativos.
