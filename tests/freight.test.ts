import test from 'node:test';
import assert from 'node:assert/strict';
import { freightSchema, parseFreightAmount, canAccessFreight, canConfigureFreight } from '../src/lib/freight';

test('número de pedido é opcional e mantém zeros iniciais e prefixos', () => {
  const base = { deliveryDate: '2026-09-16', customerName: 'Cliente', neighborhood: 'Centro', amountCents: 1000 };
  assert.equal(freightSchema.parse(base).orderNumber, '');
  assert.equal(freightSchema.parse({ ...base, orderNumber: '  001234  ' }).orderNumber, '001234');
  assert.equal(freightSchema.parse({ ...base, orderNumber: 'PED-001234' }).orderNumber, 'PED-001234');
  assert.equal(freightSchema.parse({ ...base, orderNumber: '   ' }).orderNumber, '');
  assert.equal(freightSchema.safeParse({ ...base, orderNumber: '1'.repeat(61) }).success, false);
});

test('somente o login admin confirmado pode fazer a primeira ativação', () => {
  const owner = { id: 'owner', username: 'admin', role: 'admin', active: true };
  assert.equal(canConfigureFreight(owner, null), true);
  assert.equal(canConfigureFreight({ ...owner, username: 'outro-admin' }, null), false);
  assert.equal(canConfigureFreight({ ...owner, role: 'gerente' }, null), false);
  assert.equal(canConfigureFreight({ ...owner, active: false }, null), false);
  assert.equal(canConfigureFreight(null, null), false);
});

test('depois da ativação vale o ID do titular, mesmo se seu login mudar', () => {
  const access = { ownerId: 'owner' };
  assert.equal(canConfigureFreight({ id: 'owner', username: 'rafael', role: 'admin', active: true }, access), true);
  assert.equal(canConfigureFreight({ id: 'other', username: 'admin', role: 'admin', active: true }, access), false);
});

test('acesso aos fretes fica restrito ao titular e aos responsáveis ativos', () => {
  const access = { ownerId: 'owner', responsibleIds: ['gerson', 'jefferson'] };
  assert.equal(canAccessFreight({ id: 'owner', active: true }, access), true);
  assert.equal(canAccessFreight({ id: 'gerson', active: true }, access), true);
  assert.equal(canAccessFreight({ id: 'jefferson', active: true }, access), true);
  assert.equal(canAccessFreight({ id: 'outro-admin', active: true }, access), false);
  assert.equal(canAccessFreight({ id: 'gerson', active: false }, access), false);
  assert.equal(canAccessFreight(null, access), false);
  assert.equal(canAccessFreight({ id: 'owner', active: true }, null), false);
  assert.equal(canAccessFreight({ id: 'gerson', active: true }, { ownerId: 'owner', responsibleIds: ['jefferson'] }), false);
  assert.equal(canAccessFreight({ id: 'jefferson', active: true }, { ownerId: 'owner', responsibleIds: ['jefferson'] }), true);
  assert.equal(canAccessFreight({ id: 'gerson', active: true }, { ownerId: 'owner', responsibleIds: [] }), false);
});

test('frete converte reais em centavos sem aceitar valores ambíguos ou negativos', () => {
  assert.equal(parseFreightAmount('45,50'), 4550);
  assert.equal(parseFreightAmount('0.29'), 29);
  assert.equal(parseFreightAmount('100'), 10000);
  assert.equal(parseFreightAmount('1.234'), 123400);
  assert.equal(parseFreightAmount('1.234,56'), 123456);
  assert.equal(parseFreightAmount('R$ 1.500,00'), 150000);
  for (const value of ['', '-1', '0', '1e3', 'NaN']) {
    assert.equal(parseFreightAmount(value), null, value);
  }
});

test('frete valida data real, campos obrigatórios e valor em centavos inteiros', () => {
  const valid = { deliveryDate: '2026-09-16', customerName: 'Adriano Cavalcante', neighborhood: 'Centro', amountCents: 4550 };
  assert.equal(freightSchema.safeParse(valid).success, true);
  for (const patch of [{ deliveryDate: '2026-02-30' }, { customerName: ' ' }, { neighborhood: '' }, { amountCents: -100 }, { amountCents: 1.5 }, { amountCents: Infinity }, { createdById: 'forjado' }]) {
    assert.equal(freightSchema.safeParse({ ...valid, ...patch }).success, false);
  }
});
