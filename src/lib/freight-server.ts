import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { canAccessFreight, FreightError, type FreightRow } from '@/lib/freight';
import type { Prisma, FreightPayment } from '@prisma/client';

export const FREIGHT_ACCESS_ID = 'freight';
export { FreightError } from '@/lib/freight';

export async function freightIdentity(tx: Prisma.TransactionClient = db) {
  const session = await getSession();
  if (!session) throw new FreightError('Acesso negado. Entre com uma conta autorizada.');
  const user = await tx.user.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true, name: true, role: true, active: true },
  });
  if (!user?.active) throw new FreightError('Acesso negado. Entre com uma conta autorizada.');
  const access = await tx.freightAccess.findUnique({ where: { id: FREIGHT_ACCESS_ID } });
  return { user, access };
}

export async function requireFreightAccess(tx: Prisma.TransactionClient = db) {
  const identity = await freightIdentity(tx);
  if (!canAccessFreight(identity.user, identity.access)) throw new FreightError('Sua conta não tem acesso aos fretes.');
  return identity.user;
}

export function mapFreight(row: FreightPayment): FreightRow {
  return {
    id: row.id, deliveryDate: row.deliveryDate.toISOString().slice(0, 10),
    customerName: row.customerName, neighborhood: row.neighborhood,
    amountCents: row.amountCents, notes: row.notes ?? '',
    createdByName: row.createdByName, createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(), paidAt: row.paidAt?.toISOString() ?? null,
    paidByName: row.paidByName,
  };
}

export async function listFreights(tx: Prisma.TransactionClient = db) {
  const rows = await tx.freightPayment.findMany({ orderBy: [{ deliveryDate: 'desc' }, { createdAt: 'desc' }] });
  return rows.map(mapFreight);
}

export function freightError(error: unknown): { success: false; error: string } {
  if (error instanceof FreightError) return { success: false, error: error.message };
  if (typeof error === 'object' && error && 'code' in error && error.code === 'P2034') {
    return { success: false, error: 'Os dados foram alterados por outra pessoa. Atualize a página e tente novamente.' };
  }
  console.error('[freight]', error instanceof Error ? error.name : 'Unexpected error');
  return { success: false, error: 'Não foi possível concluir. Verifique a conexão e se o banco foi atualizado para o módulo de fretes.' };
}
