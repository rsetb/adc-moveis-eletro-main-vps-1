import test from 'node:test';
import assert from 'node:assert/strict';
import { freightSchema, parseFreightAmount, canAccessFreight, canConfigureFreight } from '../src/lib/freight';

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

test('acesso aos fretes fica restrito ao titular e ao único responsável ativo', () => {
  const access = { ownerId: 'owner', responsibleId: 'gerson' };
  assert.equal(canAccessFreight({ id: 'owner', active: true }, access), true);
  assert.equal(canAccessFreight({ id: 'gerson', active: true }, access), true);
  assert.equal(canAccessFreight({ id: 'outro-admin', active: true }, access), false);
  assert.equal(canAccessFreight({ id: 'gerson', active: false }, access), false);
  assert.equal(canAccessFreight(null, access), false);
  assert.equal(canAccessFreight({ id: 'owner', active: true }, null), false);
  assert.equal(canAccessFreight({ id: 'gerson', active: true }, { ownerId: 'owner', responsibleId: 'jefferson' }), false);
  assert.equal(canAccessFreight({ id: 'jefferson', active: true }, { ownerId: 'owner', responsibleId: 'jefferson' }), true);
  assert.equal(canAccessFreight({ id: 'gerson', active: true }, { ownerId: 'owner', responsibleId: null }), false);
});

test('frete converte reais em centavos sem aceitar valores ambíguos ou negativos', () => {
  assert.equal(parseFreightAmount('45,50'), 4550);
  assert.equal(parseFreightAmount('0.29'), 29);
  assert.equal(parseFreightAmount('100'), 10000);
  for (const value of ['', '-1', '0', '1.234', '1e3', 'NaN', '1.234,56']) {
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
