import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesOrderSearch, normalizeOrderSearch } from '../src/lib/order-search';
const order = { id: 'PED-01234', customer: { name: 'Antônio José da Silva', code: '00123', cpf: '12345678901' } };
test('busca por cliente aceita acentos, espaços e partes do nome', () => {
  for (const query of ['antonio jose', '  ANTÔNIO   SILVA ', 'José', '00123', 'PED-01234', '12345678901']) assert.ok(matchesOrderSearch(order, query), query);
  assert.equal(matchesOrderSearch(order, 'Maria'), false);
  assert.equal(normalizeOrderSearch('  JOÃO   '), 'joao');
});

import { mapRawOrder } from '../src/lib/order-record';
test('pedidos importados e consultas SQL mantêm cliente, parcelas e entrada', () => {
  const mapped = mapRawOrder({ id: 'PED-1', customer: JSON.stringify(order.customer), items: '[]', installment_details: '[{"number":1}]', down_payment: 100, payment_method: 'Crediário', created_at: '2026-09-17' });
  assert.equal(mapped.customer.name, order.customer.name);
  assert.ok(matchesOrderSearch(mapped, 'antonio'));
  assert.deepEqual(mapped.items, []);
  assert.equal(mapped.installmentDetails?.length, 1);
  assert.equal(mapped.downPayment, 100);
  assert.equal(mapRawOrder({ customer: order.customer }).customer.cpf, order.customer.cpf);
});
