import test from 'node:test';
import assert from 'node:assert/strict';
import { nextReceived, paymentSchema, paymentStatus, received, freightAlertTime } from '../src/lib/freight-payment';
import { filterFreights, freightReport } from '../src/lib/freight-report';
import type { FreightRow } from '../src/lib/freight';
test('entrada e restante somam sem exceder total', () => {
  const first = nextReceived(30000, 0, { status: 'partial', amountCents: 10000, method: 'PIX' });
  assert.equal(first, 10000);
  assert.equal(nextReceived(30000, first, { status: 'paid', amountCents: 20000, method: 'Dinheiro' }), 30000);
  for (const input of [{ status: 'partial' as const, amountCents: 30000, method: 'PIX' as const }, { status: 'paid' as const, amountCents: 100, method: 'PIX' as const }, { status: 'paid' as const, amountCents: 40000, method: 'PIX' as const }, { status: 'partial' as const, amountCents: 0, method: 'PIX' as const }, { status: 'partial' as const, amountCents: 100 }]) assert.throws(() => nextReceived(30000, 0, input));
  assert.equal(nextReceived(30000, 10000, { status: 'pending', amountCents: 0 }), 0);
  assert.equal(paymentSchema.safeParse({ status: 'partial', amountCents: 1.5, method: 'PIX' }).success, false);
});
test('pagamentos antigos continuam quitados e parcial usa saldo no relatório', () => {
  assert.equal(received({ amountCents: 30000, paidAt: '2026-09-17' }), 30000);
  const row = { customerName: 'Cliente', deliveryDate: '2026-09-17', neighborhood: 'Centro', amountCents: 30000, receivedCents: 10000, paidAt: null, createdByName: 'Admin', paymentMethod: 'PIX' } as FreightRow;
  assert.equal(paymentStatus(row), 'partial');
  assert.equal(filterFreights([row], '', '', 'partial').length, 1);
  assert.equal(filterFreights([row], '', '', 'pending').length, 0);
  const html = freightReport([row], '', '', 'partial');
  assert.ok(html.includes('200,00')); assert.ok(html.includes('100,00')); assert.ok(html.includes('Parcial')); assert.ok(html.includes('PIX'));
});
test('aviso começa 16h50 em Fortaleza e reinicia no dia seguinte', () => {
  assert.equal(freightAlertTime(new Date('2026-09-17T19:49:59Z')).due, false);
  assert.equal(freightAlertTime(new Date('2026-09-17T19:50:00Z')).due, true);
  assert.equal(freightAlertTime(new Date('2026-09-18T02:59:00Z')).date, '2026-09-17');
  assert.equal(freightAlertTime(new Date('2026-09-18T03:00:00Z')).due, false);
});
