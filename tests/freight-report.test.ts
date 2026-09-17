import test from 'node:test';
import assert from 'node:assert/strict';
import { filterFreights, freightReport } from '../src/lib/freight-report';
import type { FreightRow } from '../src/lib/freight';
const rows = [
  { deliveryDate: '2026-09-17', customerName: 'José', neighborhood: 'Centro', orderNumber: '001', amountCents: 1050, paidAt: null, createdByName: 'Admin', notes: '<script>alert(1)</script>' },
  { deliveryDate: '2026-09-16', customerName: 'Maria', neighborhood: 'Centro', orderNumber: '002', amountCents: 2000, paidAt: '2026-09-17', createdByName: 'Admin', notes: '' },
] as FreightRow[];
test('data filtra a realização do frete e combina busca e situação', () => {
  assert.deepEqual(filterFreights(rows, '2026-09-17', 'jose', 'pending'), [rows[0]]);
  assert.equal(filterFreights(rows, '2026-09-17', '', 'paid').length, 0);
  assert.equal(filterFreights(rows, '', '', 'all').length, 2);
  assert.equal(filterFreights(rows, '2026-09-18', '', 'all').length, 0);
});
test('relatório usa apenas registros filtrados e escapa conteúdo informado', () => {
  const html = freightReport(filterFreights(rows, '2026-09-17', '', 'all'), '2026-09-17', '<img>', 'all');
  assert.ok(html.includes('17/09/2026'));
  assert.ok(html.includes('10,50'));
  assert.ok(!html.includes('Maria'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;img&gt;'));
  assert.ok(freightReport([], '', '', 'all').includes('Nenhum frete encontrado'));
});
