# Pagamentos de frete

A página `/admin/fretes` reúne data, nome, bairro, valor, observações e situação de pagamento. Valores são armazenados em centavos inteiros. O lançamento identifica a conta que registrou; pagamentos identificam a conta e o horário da confirmação.

## Ativação

1. Atualize o banco e gere o cliente Prisma antes de executar esta versão.
2. Entre com a conta administrativa do titular (Rafael).
3. Abra **Configurações → Acesso aos pagamentos de frete**.
4. Clique em **Ativar controle de fretes**. É possível deixar o responsável em aberto.
5. Escolha posteriormente uma única conta ativa para os registros. O acesso fica restrito ao titular e a essa conta, em qualquer computador. Outros administradores não recebem acesso automaticamente. Somente o titular pode mudar a seleção depois da ativação.

Cada pessoa deve usar sua própria conta. A autorização é conferida no servidor, consultando o usuário ativo no banco em cada leitura ou alteração. Trocar o responsável bloqueia novas operações da conta anterior; não apaga informações já vistas ou copiadas por ela.

## Banco

O projeto não possui histórico de migrations Prisma. Foi incluído um SQL aditivo exclusivamente para as três novas tabelas. Com `DATABASE_URL` configurada para o banco desejado, execute uma única vez, antes de iniciar a nova versão:

```sh
npx prisma db execute --file prisma/changes/20260916_freight.sql --schema prisma/schema.prisma
npx prisma generate
```

Não execute esse SQL se as tabelas já tiverem sido criadas por `db push`. O SQL não modifica tabelas existentes. O comando de inicialização legado do projeto usa `db push --accept-data-loss`; revise o processo de publicação para evitar aplicá-lo inadvertidamente a outras mudanças de schema.

## Operação

- Clique em **Novo frete** e informe data, nome, bairro e valor.
- Use a busca e o filtro de pendentes/pagos para conferir os lançamentos.
- Clique em **Marcar pago** somente depois do pagamento e confirme.
- Para corrigir um lançamento pago, primeiro desfaça o pagamento e depois edite.
- Os eventos de criação, edição, pagamento e reversão ficam em `freight_payment_events`, com a identidade obtida da sessão. Não são expostos no log geral, acessível a outras contas.
- Alterações concorrentes são rejeitadas por versão do registro e transação serializável; atualize a página antes de tentar novamente.

O módulo é um controle separado: não movimenta automaticamente o caixa nem realiza transferências bancárias. Não inclui exclusão definitiva de lançamentos.

## Verificação em homologação

Com PostgreSQL configurado, confirme: ativação pelo titular; cadastro e pagamento pelo responsável; bloqueio de outra conta por URL e ações diretas; bloqueio de conta inativa; revogação ao trocar o responsável; rejeição de edição com versão antiga; persistência após recarregar. Os testes unitários cobrem política de acesso, datas e valores, mas não substituem essa verificação com banco e sessões reais.

Verificado localmente em 16/09/2026: 25 testes unitários aprovados, TypeScript sem erros e ESLint sem avisos/erros. O componente de interface foi testado no navegador com ações simuladas: estado vazio, cadastro com centavos, confirmação de pagamento, filtro de pendentes, reversão e edição do valor. Não havia `DATABASE_URL` configurada; o SQL não foi aplicado e a integração com PostgreSQL e sessões reais permanece pendente de homologação.
