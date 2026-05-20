'use server'

import { db } from '@/lib/db';
import { createOrderAction } from './checkout';
import type { User } from '@/lib/types';
import { logActionAction } from '@/app/actions/audit';

function assertTrashPermission(user: User | null) {
    if (!user) throw new Error('Permissão negada: usuário não autenticado.');
    if (user.role !== 'admin' && user.role !== 'gerente') {
        throw new Error('Permissão negada: apenas Admin e Gerente podem rejeitar solicitações.');
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
        const tempOrder = await db.temporaryOrder.findUnique({
            where: { id: tempId }
        });

        if (!tempOrder) {
            return { success: false, error: 'Pedido expirado ou não encontrado.' };
        }
        if ((tempOrder as any).deletedAt) {
            return { success: false, error: 'Esta solicitação foi rejeitada e está na lixeira.' };
        }

        const { orderData, customerData } = tempOrder.data as any;

        // Perform the actual order creation (validates stock again)
        const result = await createOrderAction(orderData, customerData);

        if (result.success) {
            // Delete the temporary order on success
            await db.temporaryOrder.delete({
                where: { id: tempId }
            });
        }

        return result;

    } catch (error: any) {
        console.error('Error confirming temporary order:', error);
        return { success: false, error: error.message };
    }
}

export async function cancelTemporaryOrderAction(tempId: string, reason: string, user: User | null) {
    try {
        assertTrashPermission(user);
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

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
