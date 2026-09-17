import test from 'node:test';
import assert from 'node:assert/strict';
import { freightCustomerFields } from '../src/lib/freight-customer';

test('seleção de cliente preserva o número da entrega e o complemento', () => {
  assert.deepEqual(freightCustomerFields({
    id: '1', code: '001', name: 'Cliente', zip: '60000-000',
    address: 'Rua das Flores', number: '42', complement: 'Casa B', neighborhood: 'Centro',
  }), { zipCode: '60000-000', address: 'Rua das Flores, 42', complement: 'Casa B', neighborhood: 'Centro' });
});

test('cliente sem endereço limpa dados anteriores sem inserir null no formulário', () => {
  assert.deepEqual(freightCustomerFields({
    id: '2', code: null, name: 'Outro cliente', zip: null,
    address: null, number: null, complement: null, neighborhood: null,
  }), { zipCode: '', address: '', complement: '', neighborhood: '' });
});
