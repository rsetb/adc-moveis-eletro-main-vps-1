# Pagamentos de frete

A página `/admin/fretes` reúne data, nome, bairro, valor, observações e situação de pagamento. Valores são armazenados em centavos inteiros. O lançamento identifica a conta que registrou; pagamentos identificam a conta e o horário da confirmação.

## Ativação

1. Atualize o banco e gere o cliente Prisma antes de executar esta versão.
2. Entre com o login **admin**, confirmado por Rafael como sua conta. Somente esse login, ativo e com perfil de administrador, pode fazer a primeira ativação.
3. Abra **Configurações → Acesso aos pagamentos de frete**.
4. Clique em **Ativar controle de fretes**. É possível deixar o responsável em aberto.
5. Escolha posteriormente uma única conta ativa para os registros. O acesso fica restrito ao titular e a essa conta, em qualquer computador. Outros administradores não recebem acesso automaticamente. Somente o titular pode mudar a seleção depois da ativação.

Cada pessoa deve usar sua própria conta. A autorização é conferida no servidor, consultando o usuário ativo no banco em cada leitura ou alteração. Trocar o responsável bloqueia novas operações da conta anterior; não apaga informações já vistas ou copiadas por ela.

Depois da ativação, o titular é identificado pelo ID da conta, mesmo se o login mudar. A exclusão e a desativação desse usuário são bloqueadas, inclusive na restauração de usuários. O banco também impede excluir a conta vinculada. Esta atualização não troca automaticamente um titular já cadastrado: caso outra conta tenha ativado a versão anterior, confira e corrija o vínculo administrativamente antes do uso.

## Banco

O projeto não possui histórico de migrations Prisma. Foi incluído um SQL aditivo exclusivamente para as três novas tabelas. Com `DATABASE_URL` configurada para o banco desejado, execute uma única vez, antes de iniciar a nova versão:

```sh
npx prisma db execute --file prisma/changes/20260916_freight.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/changes/20260916_freight_owner_guard.sql --schema prisma/schema.prisma
npx prisma generate
```

Não execute o primeiro SQL se as tabelas já tiverem sido criadas por `db push`: ele apenas cria as tabelas. O segundo adiciona a chave estrangeira de proteção do titular. O comando de inicialização legado do projeto usa `db push --accept-data-loss`; revise o processo de publicação para evitar aplicá-lo inadvertidamente a outras mudanças de schema.

Se as tabelas de fretes já existirem, aplique somente `20260916_freight_owner_guard.sql` (desde que a chave estrangeira ainda não exista). Esse segundo SQL adiciona a proteção de exclusão do titular; não remove dados. Se já houver um titular órfão, a aplicação falha para exigir a correção explícita do vínculo, sem atribuir acesso a outra pessoa automaticamente.

## Operação

- Clique em **Novo frete** e informe data, nome, bairro e valor.
- Informe, se desejar, o **Número do pedido**. Ele pode conter zeros iniciais, letras e hífens, aparece na coluna **Pedido** e pode ser usado na busca. O campo é uma referência informada manualmente; não altera nem exige um pedido cadastrado. Para atualizar um banco existente, aplique `prisma/changes/20260917_freight_order_number.sql` antes desta versão (ou a sincronização de schema já usada na publicação).
- No campo **Nome**, digite pelo menos duas letras para buscar clientes cadastrados. A seleção preenche CEP, endereço com número, complemento e bairro; é possível corrigir esses campos ou continuar com um nome livre. A busca retorna até dez sugestões e exige o mesmo acesso restrito do módulo de fretes.
- Use a busca e o filtro de pendentes/pagos para conferir os lançamentos.
- Clique em **Marcar pago** somente depois do pagamento e confirme.
- Para corrigir um lançamento pago, primeiro desfaça o pagamento e depois edite.
- Os eventos de criação, edição, pagamento e reversão ficam em `freight_payment_events`, com a identidade obtida da sessão. Não são expostos no log geral, acessível a outras contas.
- Alterações concorrentes são rejeitadas por versão do registro e transação serializável; atualize a página antes de tentar novamente.
- Novos cadastros usam um identificador único de envio. Se a resposta se perder, repetir **Salvar frete** reutiliza esse identificador e confirma o mesmo registro. O envio pendente é mantido por conta na sessão da aba; recarregar a página não gera outro identificador. Não feche a aba enquanto houver envio pendente. Esta proteção cobre a repetição de um envio, não dois cadastros novos feitos manualmente com IDs diferentes.

O módulo é um controle separado: não movimenta automaticamente o caixa nem realiza transferências bancárias. Não inclui exclusão definitiva de lançamentos.

## Verificação em homologação

Com PostgreSQL configurado, confirme: ativação pelo titular; cadastro e pagamento pelo responsável; bloqueio de outra conta por URL e ações diretas; bloqueio de conta inativa; revogação ao trocar o responsável; rejeição de edição com versão antiga; persistência após recarregar. Os testes unitários cobrem política de acesso, datas e valores, mas não substituem essa verificação com banco e sessões reais.

Verificado localmente em 16/09/2026: 25 testes unitários aprovados, TypeScript sem erros e ESLint sem avisos/erros. O componente de interface foi testado no navegador com ações simuladas: estado vazio, cadastro com centavos, confirmação de pagamento, filtro de pendentes, reversão e edição do valor. Não havia `DATABASE_URL` configurada; o SQL não foi aplicado e a integração com PostgreSQL e sessões reais permanece pendente de homologação.

Revisão das correções: 35 testes aprovados, incluindo primeira ativação restrita ao login confirmado, preservação do titular por ID, bloqueio de exclusão/desativação, repetição sequencial e concorrente de cadastros, colisões com conteúdo/autor diferente e recuperação de envio pendente. Os testes de persistência usam um repositório em memória; a migração e a concorrência do PostgreSQL precisam ser conferidas na homologação.

Na interface, foi simulado um cadastro salvo seguido de resposta HTTP 502: fechar/reabrir o formulário e repetir o envio preservou exatamente um frete, também após recarregar a página. O teste usou o componente real e a função real de criação idempotente, com armazenamento em memória. TypeScript e ESLint passaram após as correções.
