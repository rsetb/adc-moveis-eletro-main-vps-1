import type { Prisma } from '@prisma/client';
import { FreightError, freightSchema, type FreightInput } from './freight';

// Must run in the same serializable transaction as the user mutation.
export async function assertFreightOwnerCanChange(
  tx: Pick<Prisma.TransactionClient, 'freightAccess'>,
  userId: string,
  change: { deleting?: boolean; active?: boolean },
) {
  if (!change.deleting && change.active !== false) return;
  const access = await tx.freightAccess.findFirst({ where: { ownerId: userId } });
  if (access) throw new FreightError('A conta titular dos fretes não pode ser excluída ou desativada.');
}

export async function createFreightOnce(
  tx: Pick<Prisma.TransactionClient, 'freightPayment'>,
  requestId: string,
  input: FreightInput,
  actor: { id: string; name: string },
) {
  const existing = await tx.freightPayment.findUnique({
    where: { id: requestId },
    include: { events: { where: { action: 'CRIADO' }, take: 1 } },
  });
  if (existing) {
    const original = freightSchema.safeParse(existing.events[0]?.details);
    // Compare the original request, not the current row (which may have been edited/paid).
    if (existing.createdById !== actor.id || !original.success || JSON.stringify(original.data) !== JSON.stringify(input)) {
      throw new FreightError('Este envio já foi usado em outro lançamento. Atualize a página e confira os fretes.');
    }
    return;
  }
  await tx.freightPayment.create({ data: {
    ...input, id: requestId, deliveryDate: new Date(`${input.deliveryDate}T00:00:00Z`),
    createdById: actor.id, createdByName: actor.name,
    events: { create: { actorId: actor.id, actorName: actor.name, action: 'CRIADO', details: input } },
  } });
}

export async function retryFreightTransaction<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await operation(); }
    catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      // Re-read authorization and the request inside a new transaction on every retry.
      if (attempt >= 2 || (code !== 'P2002' && code !== 'P2034')) throw error;
    }
  }
}
