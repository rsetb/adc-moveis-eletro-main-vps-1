import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesAllTokens, normalizeDigits, normalizeSearchText, parseUnifiedSearchFilters, splitTokens, type CustomerSearchFilters } from '../src/lib/customer-search';
import { getBillingPriority } from '../src/lib/utils';

test('normalizeSearchText remove acentos e pontuação', () => {
  assert.equal(normalizeSearchText('RUA JOSÉ ALBERTO, 260'), 'rua jose alberto 260');
  assert.equal(normalizeSearchText('Av. São João - Nº 10'), 'av sao joao n 10');
});

test('splitTokens gera tokens coerentes', () => {
  assert.deepEqual(splitTokens('RUA JOSÉ ALBERTO, 260'), ['rua', 'jose', 'alberto', '260']);
  assert.deepEqual(splitTokens('   '), []);
});

test('matchesAllTokens exige todos os tokens', () => {
  const hay = normalizeSearchText('Rua Jose Alberto, 260 Centro');
  assert.equal(matchesAllTokens(hay, splitTokens('rua jose')), true);
  assert.equal(matchesAllTokens(hay, splitTokens('rua jose 260')), true);
  assert.equal(matchesAllTokens(hay, splitTokens('rua 999')), false);
});

test('normalizeDigits facilita match de CPF/telefone com máscara', () => {
  assert.equal(normalizeDigits('123.456.789-00'), '12345678900');
  assert.equal(normalizeDigits('(11) 98888-7777'), '11988887777');
});

test('parseUnifiedSearchFilters não aplica endereço automaticamente em nomes completos', () => {
  assert.deepEqual(parseUnifiedSearchFilters('paula'), { q: 'paula' });
  assert.deepEqual(parseUnifiedSearchFilters('ana paula alves da silva'), { q: 'ana paula alves da silva' });
});

test('parseUnifiedSearchFilters respeita campos explícitos com prefixo', () => {
  assert.deepEqual(parseUnifiedSearchFilters('end: rua jose alberto 260'), { address: 'rua jose alberto 260' });
  assert.deepEqual(parseUnifiedSearchFilters('cidade: fortaleza'), { city: 'fortaleza' });
  assert.deepEqual(parseUnifiedSearchFilters('cpf: 123.456.789-00'), { cpfOrPhone: '12345678900' });
});

test('Busca por nome completo encontra cliente quando só o nome bate', () => {
  const c = {
    id: 'C1',
    name: 'ANA PAULA ALVES DA SILVA',
    cpf: '',
    phone: '',
    phone2: '',
    phone3: '',
    email: '',
    zip: '',
    address: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    observations: '',
    sellerId: '',
    sellerName: '',
    blockedReason: '',
    rating: 0,
    code: '',
  };

  const filters = parseUnifiedSearchFilters('ana paula alves da silva');
  const hay = normalizeSearchText([c.id, c.code, c.name, c.cpf, c.phone, c.email, c.zip, c.address, c.number, c.neighborhood, c.city, c.state, c.observations, c.sellerId, c.sellerName, c.blockedReason, c.rating]
    .map((v) => (v === null || v === undefined ? '' : String(v)))
    .join(' '));

  const q = String((filters as CustomerSearchFilters).q || '');
  const ok = matchesAllTokens(hay, splitTokens(q));
  assert.equal(ok, true);
});

test('getBillingPriority classifica atraso e vencimento próximo', () => {
  const now = new Date('2026-03-07T12:00:00.000Z');

  const criticalDue = new Date('2025-11-27T12:00:00.000Z'); // ~100 dias antes
  const critical = getBillingPriority(now, criticalDue);
  assert.equal(critical.priority, 'critical');
  assert.ok(critical.daysOverdue >= 90);

  const warningDue = new Date('2026-01-10T12:00:00.000Z'); // ~56 dias antes
  const warning = getBillingPriority(now, warningDue);
  assert.equal(warning.priority, 'warning');
  assert.ok(warning.daysOverdue >= 30 && warning.daysOverdue < 90);

  const upcomingDue = new Date('2026-03-10T12:00:00.000Z'); // 3 dias
  const upcoming = getBillingPriority(now, upcomingDue);
  assert.equal(upcoming.priority, 'upcoming');
  assert.equal(upcoming.daysUntilDue, 3);

  const farDue = new Date('2026-03-20T12:00:00.000Z'); // 13 dias
  const none = getBillingPriority(now, farDue);
  assert.equal(none.priority, null);
});
