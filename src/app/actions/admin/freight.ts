'use server';

import { paymentSchema, nextReceived, received, freightAlertTime, type FreightPaymentInput } from '@/lib/freight-payment';
import { db } from '@/lib/db';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { freightSchema, canAccessFreight, canConfigureFreight, type FreightInput } from '@/lib/freight';
import { createFreightOnce, retryFreightTransaction } from '@/lib/freight-integrity';
import type { FreightCustomerSearchResult } from '@/lib/freight-customer';
import { FREIGHT_ACCESS_ID, FreightError, freightIdentity, requireFreightAccess, listFreights, freightError } from '@/lib/freight-server';

export async function searchFreightCustomersAction(query: string): Promise<FreightCustomerSearchResult> {
  try {
    await requireFreightAccess();
    const parsed = z.string().trim().min(2).max(160).safeParse(query);
    if (!parsed.success) return { success: true, customers: [] };
    const tokens = parsed.data.split(/\s+/).slice(0, 8);
    const customers = await db.customer.findMany({
      where: { AND: tokens.map(token => ({ name: { contains: token, mode: 'insensitive' as const } })) },
      select: { id: true, code: true, name: true, zip: true, address: true, number: true, complement: true, neighborhood: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 10,
    });
    return { success: true, customers };
  } catch (error) { return freightError(error); }
}

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
        const existing = await tx.freightPayment.findUnique({ where: { id } });
        if (existing && received(existing) > 0) throw new FreightError('Volte a situação para Pendente antes de editar um frete com pagamento.');
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

export async function setFreightPaidAction(id: string, input: FreightPaymentInput, updatedAt: string) {
  try {
    z.string().uuid().parse(id); z.string().datetime().parse(updatedAt);
    const parsed = paymentSchema.safeParse(input);
    if (!parsed.success) throw new FreightError('Confira a situação, o valor e a forma de pagamento.');
    const rows = await db.$transaction(async tx => {
      const user = await requireFreightAccess(tx);
      const row = await tx.freightPayment.findUnique({ where: { id } });
      if (!row || row.updatedAt.toISOString() !== updatedAt) throw new FreightError('O frete mudou. Atualize a página antes de registrar o pagamento.');
      const before = received(row);
      let amount: number;
      try { amount = nextReceived(row.amountCents, before, parsed.data); }
      catch (error) { throw new FreightError((error as Error).message); }
      const full = amount === row.amountCents;
      const changed = await tx.freightPayment.updateMany({
        where: { id, updatedAt: new Date(updatedAt) },
        data: { receivedCents: amount, paymentMethod: amount ? parsed.data.method : null, paidAt: full ? new Date() : null, paidById: amount ? user.id : null, paidByName: amount ? user.name : null },
      });
      if (changed.count !== 1) throw new FreightError('O frete mudou. Atualize a página para conferir.');
      await tx.freightPaymentEvent.create({ data: { freightId: id, actorId: user.id, actorName: user.name, action: amount ? 'PAGAMENTO_REGISTRADO' : 'PAGAMENTO_DESFEITO', details: { ...parsed.data, beforeCents: before, receivedCents: amount } } });
      return listFreights(tx);
    }, { isolationLevel: 'Serializable' });
    revalidatePath('/admin/fretes');
    return { success: true as const, rows };
  } catch (error) { return freightError(error); }
}

export async function getFreightReminderAction() {
  try {
    await requireFreightAccess();
    const time = freightAlertTime();
    if (!time.due) return { count: 0, balance: 0 };
    const rows = await db.freightPayment.findMany({ where: { deliveryDate: { lte: new Date(time.date + 'T00:00:00Z') }, paidAt: null }, select: { amountCents: true, receivedCents: true, paidAt: true } });
    const pending = rows.filter(row => received(row) < row.amountCents);
    return { count: pending.length, balance: pending.reduce((sum, row) => sum + row.amountCents - received(row), 0) };
  } catch { return { count: 0, balance: 0 }; }
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
