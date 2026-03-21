import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCustomerCodeInput, parseCustomerCodeNumber, formatCustomerCode } from '../src/lib/customer-code';

test('normalizeCustomerCodeInput normaliza vazios e prefixo CLI-', () => {
  assert.equal(normalizeCustomerCodeInput(null), null);
  assert.equal(normalizeCustomerCodeInput(undefined), null);
  assert.equal(normalizeCustomerCodeInput(''), null);
  assert.equal(normalizeCustomerCodeInput('   '), null);
  assert.equal(normalizeCustomerCodeInput('04469'), '04469');
  assert.equal(normalizeCustomerCodeInput('4469'), '04469');
  assert.equal(normalizeCustomerCodeInput(' CLI-4469 '), '04469');
  assert.equal(normalizeCustomerCodeInput('CLI-04469'), '04469');
  assert.equal(normalizeCustomerCodeInput('ABC-123'), null);
  assert.equal(normalizeCustomerCodeInput('1771588382701'), null);
});

test('parseCustomerCodeNumber extrai número apenas quando código é numérico', () => {
  assert.equal(parseCustomerCodeNumber('04469'), 4469);
  assert.equal(parseCustomerCodeNumber('4469'), 4469);
  assert.equal(parseCustomerCodeNumber('CLI-04469'), 4469);
  assert.equal(parseCustomerCodeNumber('ABC-123'), null);
  assert.equal(parseCustomerCodeNumber(null), null);
});

test('formatCustomerCode padroniza com 5 dígitos', () => {
  assert.equal(formatCustomerCode(1), '00001');
  assert.equal(formatCustomerCode(4469), '04469');
  assert.equal(formatCustomerCode(123456), '123456');
});
