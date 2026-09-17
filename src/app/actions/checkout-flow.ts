'use server'

import { db } from '@/lib/db';
import { createOrderAction } from './checkout';
import type { User } from '@/lib/types';
import { logActionAction } from '@/app/actions/audit';
import { notifyChange } from '@/lib/change-notifier';
import { revalidatePath } from 'next/cache';

function assertRejectPermission(user: User | null) {
    if (!user) throw new Error('Permissão negada: usuário não autenticado.');
    const allowed = ['admin', 'gerente', 'vendedor', 'vendedor_externo'];
    if (!allowed.includes(user.role)) {
        throw new Error('Permissão negada.');
    }
}

export async function createTemporaryOrderAction(payload: { orderData: any; customerData: any }) {
    try {
        // Clean up expired non-trashed orders after 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        await db.temporaryOrder.deleteMany({
            where: {
                createdAt: { lt: sevenDaysAgo },
                deletedAt: null
            }
        });

        const tempOrder = await db.temporaryOrder.create({
            data: {
                data: payload as any
            }
        });

        revalidatePath('/admin/pedidos/pendentes');
        notifyChange('pendingOrders');

        return { success: true, id: tempOrder.id };
    } catch (error: any) {
        console.error('Error creating temporary order:', error);
        return { success: false, error: error.message };
    }
}

export async function confirmTemporaryOrderAction(tempId: string) {
    const session = await import('@/lib/session').then(m => m.getSession());
    if (!session) return { success: false, error: 'Permissão negada.' };
    const canConfirm = ['admin', 'gerente', 'vendedor', 'vendedor_externo'].includes(session.role);
    if (!canConfirm) return { success: false, error: 'Permissão negada.' };
    try {
        // Atomically read + delete the temp order in a single transaction to prevent
        // race condition where two concurrent "Confirmar" clicks create duplicate real orders.
        let tempData: any = null;
        await db.$transaction(async (tx) => {
            const found = await tx.temporaryOrder.findUnique({ where: { id: tempId } });
            if (!found) throw new Error('Pedido expirado ou não encontrado.');
            if ((found as any).deletedAt) throw new Error('Esta solicitação foi rejeitada e está na lixeira.');
            tempData = (found as any).data;
            await tx.temporaryOrder.delete({ where: { id: tempId } });
        });

        if (!tempData) return { success: false, error: 'Erro interno de processamento.' };

        const { orderData, customerData } = tempData;
        const result = await createOrderAction(orderData, customerData);

        if (result.success) {
            revalidatePath('/admin/pedidos');
            revalidatePath('/admin/solicitacoes');
            revalidatePath('/admin/pedidos/pendentes');
            notifyChange('pendingOrders');
        }

        return result;

    } catch (error: any) {
        console.error('Error confirming temporary order:', error);
        return { success: false, error: error.message };
    }
}

export async function cancelTemporaryOrderAction(tempId: string, reason: string, user: User | null) {
    try {
        assertRejectPermission(user);
        const cleanedReason = String(reason || '').trim();
        if (cleanedReason.length < 3) throw new Error('Informe um motivo (mínimo 3 caracteres).');

        const existing = await db.temporaryOrder.findUnique({ where: { id: tempId } });
        if (!existing) throw new Error('Solicitação não encontrada ou expirada.');
        if ((existing as any).deletedAt) throw new Error('Solicitação já está na lixeira.');

        await db.temporaryOrder.update({
            where: { id: tempId },
            data: {
                deletedAt: new Date(),
                rejectedAt: new Date(),
                rejectedById: user!.id,
                rejectedByName: user!.name,
                rejectedByRole: user!.role,
                rejectReason: cleanedReason,
            }
        });

        await logActionAction(
            'Solicitação Rejeitada',
            `Solicitação ${tempId} enviada para a lixeira. Motivo: ${cleanedReason}`,
            user
        );

        notifyChange('pendingOrders');
        revalidatePath('/admin/pedidos');

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
