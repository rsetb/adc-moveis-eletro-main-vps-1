export function normalizeOrderSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
export function matchesOrderSearch(order: { id: string; customer: { name?: string; code?: string; cpf?: string; phone?: string } }, query: string) {
  const text = normalizeOrderSearch([order.id, order.customer?.name, order.customer?.code, order.customer?.cpf, order.customer?.phone].filter(Boolean).join(' '));
  return normalizeOrderSearch(query).split(' ').filter(Boolean).every(token => text.includes(token));
}
