import { z } from 'zod';

export const freightSchema = z.object({
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Informe uma data válida.'),
  customerName: z.string().trim().min(2, 'Informe o nome.').max(160),
  orderNumber: z.string().trim().max(60, 'O número do pedido deve ter até 60 caracteres.').default(''),
  zipCode: z.string().trim().optional(),
  address: z.string().trim().optional(),
  complement: z.string().trim().max(100).optional(),
  neighborhood: z.string().trim().min(2, 'Informe o bairro.').max(160),
  amountCents: z.number().int().min(1, 'O valor deve ser maior que zero.').max(100_000_000),
  notes: z.string().trim().max(1000).default(''),
}).strict();

export type FreightInput = z.infer<typeof freightSchema>;

export class FreightError extends Error { }

export function canConfigureFreight(
  user: { id: string; username: string; role: string; active: boolean } | null,
  access: { ownerId: string } | null,
): boolean {
  if (!user?.active) return false;
  // Login do titular confirmado pelo proprietário. Não escolher o primeiro admin.
  return access ? access.ownerId === user.id : user.role === 'admin' && user.username === 'admin';
}

export function canAccessFreight(
  user: { id: string; active: boolean } | null,
  access: { ownerId: string; responsibleIds: string[] } | null,
): boolean {
  return !!user?.active && !!access && (user.id === access.ownerId || access.responsibleIds.includes(user.id));
}

export type FreightRow = FreightInput & {
  id: string;
  zipCode?: string | null;
  address?: string | null;
  complement?: string | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  paidByName: string | null;
};

export function parseFreightAmount(value: string): number | null {
  const normalized = value.trim().replace(/[R$\s]/ig, '').replace(/\.(?=\d{3})/g, '');
  if (!/^\d+(?:[,.]\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.replace(',', '.').split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 100_000_000 ? cents : null;
}
