import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStockDeltas } from '../src/lib/utils';

test('computeStockDeltas calcula diferença por produto ignorando CUSTOM-*', () => {
  const prev = [
    { id: 'PROD-1', quantity: 2 },
    { id: 'CUSTOM-1', quantity: 99 },
    { id: 'PROD-2', quantity: 1 },
  ];

  const next = [
    { id: 'PROD-1', quantity: 3 },
    { id: 'PROD-3', quantity: 4 },
  ];

  const deltas = computeStockDeltas(prev, next);
  assert.deepEqual(deltas, [
    { productId: 'PROD-1', delta: 1 },
    { productId: 'PROD-2', delta: -1 },
    { productId: 'PROD-3', delta: 4 },
  ]);
});

test('computeStockDeltas soma quantidades repetidas e ignora quantidades inválidas', () => {
  const prev = [
    { id: 'PROD-1', quantity: 1 },
    { id: 'PROD-1', quantity: 2 },
    { id: 'PROD-2', quantity: 1 },
  ];

  const next = [
    { id: 'PROD-1', quantity: 2 },
    { id: 'PROD-2', quantity: 0 },
    { id: 'PROD-3', quantity: NaN },
  ];

  const deltas = computeStockDeltas(prev, next);
  assert.deepEqual(deltas, [
    { productId: 'PROD-1', delta: -1 },
    { productId: 'PROD-2', delta: -1 },
  ]);
});

