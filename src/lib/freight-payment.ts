import { z } from 'zod';
export const paymentSchema = z.object({
  status: z.enum(['pending', 'partial', 'paid']),
  amountCents: z.number().int().min(0).max(100_000_000),
  method: z.enum(['PIX', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Outro']).optional(),
}).strict();
export type FreightPaymentInput = z.infer<typeof paymentSchema>;
export function received(row: { receivedCents?: number | null; paidAt: unknown; amountCents: number }) {
  return row.receivedCents ?? (row.paidAt ? row.amountCents : 0);
}
export function paymentStatus(row: { receivedCents?: number | null; paidAt: unknown; amountCents: number }) {
  const amount = received(row);
  return amount >= row.amountCents ? 'paid' : amount > 0 ? 'partial' : 'pending';
}
export const statusLabels = { pending: 'Pendente', partial: 'Parcial', paid: 'Pago total' };
export function nextReceived(total: number, current: number, input: FreightPaymentInput) {
  if (input.status === 'pending') return 0;
  if (!input.method) throw new Error('Selecione a forma de pagamento.');
  if (input.amountCents <= 0 || current + input.amountCents > total) throw new Error('Informe um valor positivo até o saldo restante.');
  const result = current + input.amountCents;
  if (input.status === 'paid' && result !== total) throw new Error('Para pagar o total, informe o saldo restante.');
  if (input.status === 'partial' && result >= total) throw new Error('Pagamento parcial deve deixar saldo restante.');
  return result;
}
export function freightAlertTime(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return { date: get('year') + '-' + get('month') + '-' + get('day'), due: Number(get('hour')) * 60 + Number(get('minute')) >= 1010 };
}
