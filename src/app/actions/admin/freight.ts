'use server';

import { db } from '@/lib/db';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { freightSchema, canAccessFreight, canConfigureFreight, type FreightInput } from '@/lib/freight';
import { createFreightOnce, retryFreightTransaction } from '@/lib/freight-integrity';
import { FREIGHT_ACCESS_ID, FreightError, freightIdentity, requireFreightAccess, listFreights, freightError } from '@/lib/freight-server';

export async function getFreightAccessAction() {
  try {
    const { user, access } = await freightIdentity();
    return { allowed: canAccessFreight(user, access) };
  } catch { return { allowed: false }; }
}

export async function getFreightSettingsAction() {
  try {
    const { user, access } = await freightIdentity();
    if (!canConfigureFreight(user, access)) return { success: true as const, canConfigure: false as const };
    const users = await db.user.findMany({
      where: { active: true, id: { not: user.id } },
      select: { id: true, name: true, username: true }, orderBy: { name: 'asc' },
    });
    return { success: true as const, canConfigure: true as const, users, ownerName: user.name, configured: !!access, responsibleIds: access?.responsibleIds ?? [], updatedAt: access?.updatedAt.toISOString() ?? null };
  } catch (error) { return freightError(error); }
}

export async function saveFreightSettingsAction(responsibleIds: string[], updatedAt: string | null) {
  try {
    const selectedIds = z.array(z.string().min(1).max(200)).max(4, 'Selecione no máximo 4 responsáveis.').parse(responsibleIds);
    z.string().datetime().nullable().parse(updatedAt);
    await db.$transaction(async tx => {
      const { user, access } = await freightIdentity(tx);
      if (!canConfigureFreight(user, access)) throw new FreightError('Somente o titular pode configurar o acesso aos fretes.');
      if ((access?.updatedAt.toISOString() ?? null) !== updatedAt) throw new FreightError('A configuração mudou. Atualize a página antes de salvar.');
      if (selectedIds.length > 0) {
        const responsible = await tx.user.findMany({ where: { id: { in: selectedIds } }, select: { id: true, active: true } });
        if (responsible.length !== selectedIds.length || responsible.some(r => !r.active || r.id === user.id)) {
          throw new FreightError('Todas as contas de responsáveis devem estar ativas e ser diferentes do titular.');
        }
      }
      if (access) await tx.freightAccess.update({ where: { id: FREIGHT_ACCESS_ID }, data: { responsibleIds: selectedIds } });
      else await tx.freightAccess.create({ data: { id: FREIGHT_ACCESS_ID, ownerId: user.id, responsibleIds: selectedIds } });
    }, { isolationLevel: 'Serializable' });
    revalidatePath('/admin/fretes');
    return { success: true as const };
  } catch (error) { return freightError(error); }
}

export async function saveFreightAction(input: FreightInput, id?: string, updatedAt?: string, requestId?: string) {
  try {
    const parsed = freightSchema.safeParse(input);
    if (!parsed.success) throw new FreightError(parsed.error.issues[0].message);
    if (id !== undefined) { z.string().uuid().parse(id); z.string().datetime().parse(updatedAt); }
    else if (!z.string().uuid().safeParse(requestId).success) throw new FreightError('Reabra o formulário para iniciar um envio válido.');
    const rows = await retryFreightTransaction(() => db.$transaction(async tx => {
      const user = await requireFreightAccess(tx);
      const data = { ...parsed.data, deliveryDate: new Date(`${parsed.data.deliveryDate}T00:00:00Z`) };
      if (id) {
        const changed = await tx.freightPayment.updateMany({
          where: { id, updatedAt: new Date(updatedAt!), paidAt: null }, data,
        });
        if (changed.count !== 1) throw new FreightError('O frete mudou ou já foi pago. Atualize a página antes de editar.');
        await tx.freightPaymentEvent.create({ data: { freightId: id, actorId: user.id, actorName: user.name, action: 'EDITADO', details: parsed.data } });
      } else {
        await createFreightOnce(tx, requestId!, parsed.data, user);
      }
      return listFreights(tx);
    }, { isolationLevel: 'Serializable' }));
    revalidatePath('/admin/fretes');
    return { success: true as const, rows };
  } catch (error) { return freightError(error); }
}

export async function setFreightPaidAction(id: string, paid: boolean, updatedAt: string) {
  try {
    z.string().uuid().parse(id); z.boolean().parse(paid); z.string().datetime().parse(updatedAt);
    const rows = await db.$transaction(async tx => {
      const user = await requireFreightAccess(tx);
      const changed = await tx.freightPayment.updateMany({
        where: { id, updatedAt: new Date(updatedAt), paidAt: paid ? null : { not: null } },
        data: { paidAt: paid ? new Date() : null, paidById: paid ? user.id : null, paidByName: paid ? user.name : null },
      });
      if (changed.count !== 1) throw new FreightError('O frete foi alterado. Atualize a página para conferir o pagamento.');
      await tx.freightPaymentEvent.create({ data: { freightId: id, actorId: user.id, actorName: user.name, action: paid ? 'PAGO' : 'PAGAMENTO_DESFEITO', details: { paid } } });
      return listFreights(tx);
    }, { isolationLevel: 'Serializable' });
    revalidatePath('/admin/fretes');
    return { success: true as const, rows };
  } catch (error) { return freightError(error); }
}

export async function deleteFreightAction(id: string) {
  try {
    z.string().uuid().parse(id);
    const rows = await db.$transaction(async tx => {
      await requireFreightAccess(tx);
      const freight = await tx.freightPayment.findUnique({ where: { id } });
      if (!freight) throw new FreightError('Frete não encontrado.');
      await tx.freightPaymentEvent.deleteMany({ where: { freightId: id } });
      await tx.freightPayment.delete({ where: { id } });
      return listFreights(tx);
    }, { isolationLevel: 'Serializable' });
    revalidatePath('/admin/fretes');
    return { success: true as const, rows };
  } catch (error) { return freightError(error); }
}
