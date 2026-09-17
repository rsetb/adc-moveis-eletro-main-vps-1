import { received, paymentStatus, statusLabels } from './freight-payment';
import type { FreightRow } from './freight';

export function filterFreights(rows: FreightRow[], date: string, search: string, status: string) {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return rows.filter(row => (!date || row.deliveryDate.slice(0, 10) === date) &&
    normalize(row.customerName + ' ' + row.neighborhood + ' ' + (row.orderNumber ?? '')).includes(normalize(search)) &&
    (status === 'all' || paymentStatus(row) === status));
}

export function freightReport(rows: FreightRow[], date: string, search: string, status: string) {
  const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
  const money = (value: number) => (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const day = (value: string) => value.slice(0, 10).split('-').reverse().join('/');
  const pending = rows.reduce((sum, row) => sum + (row.amountCents - received(row)), 0);
  const paid = rows.reduce((sum, row) => sum + received(row), 0);
  const cells = rows.map(row => '<tr>' + [day(row.deliveryDate), row.orderNumber || '—', row.customerName, row.neighborhood, money(row.amountCents), statusLabels[paymentStatus(row)], money(received(row)), money(row.amountCents - received(row)), row.paymentMethod || '—', row.createdByName, row.notes || '—'].map(value => '<td>' + escape(value) + '</td>').join('') + '</tr>').join('');
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de fretes</title><style>@page{size:A4 landscape;margin:12mm}body{font:12px Arial,sans-serif;color:#111}h1{font-size:22px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #aaa;padding:7px;text-align:left;overflow-wrap:anywhere;white-space:pre-wrap}thead{display:table-header-group}tr{break-inside:avoid}button{padding:10px;margin-bottom:15px}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Imprimir / Salvar PDF</button><h1>ADC — Pagamentos de frete</h1><p>Data do frete: ' + escape(date ? day(date) : 'Todas as datas') + ' · Situação: ' + escape(status === 'all' ? 'Todos' : statusLabels[status as keyof typeof statusLabels]) + (search ? ' · Busca: ' + escape(search) : '') + '</p><p>Emitido em: ' + escape(new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })) + '</p><p>' + rows.length + ' frete(s) · A pagar: ' + money(pending) + ' · Pago: ' + money(paid) + ' · Total: ' + money(pending + paid) + '</p><table><thead><tr><th>Data</th><th>Pedido</th><th>Cliente</th><th>Bairro</th><th>Valor</th><th>Situação</th><th>Recebido</th><th>Saldo</th><th>Última forma</th><th>Registrado por</th><th>Observações</th></tr></thead><tbody>' + (cells || '<tr><td colspan="11">Nenhum frete encontrado para os filtros selecionados.</td></tr>') + '</tbody></table></body></html>';
}
