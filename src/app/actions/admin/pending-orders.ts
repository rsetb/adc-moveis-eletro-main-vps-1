
'use server';

import { db } from '@/lib/db';
import { findCustomerByCpfAction } from '@/app/actions/checkout';
import type { User } from '@/lib/types';
import { logActionAction } from '@/app/actions/audit';

async function getTrashRetentionDays(): Promise<number> {
    const result = await db.config.findUnique({ where: { key: 'storeSettings' } });
    const raw = (result?.value as any)?.solicitationsTrashRetentionDays;
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    const safe = Number.isFinite(parsed) ? parsed : 30;
    return Math.min(Math.max(Math.trunc(safe), 1), 365);
}

function assertTrashPermission(user: User | null) {
    if (!user) throw new Error('Permissão negada: usuário não autenticado.');
    if (user.role !== 'admin' && user.role !== 'gerente') {
        throw new Error('Permissão negada: apenas Admin e Gerente podem acessar a lixeira.');
    }
}

export async function getPendingOrdersAction() {
    try {
        // Clean up expired non-trashed orders after 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        await db.temporaryOrder.deleteMany({
            where: {
                createdAt: { lt: sevenDaysAgo },
                deletedAt: null
            }
        });

        const orders = await db.temporaryOrder.findMany({
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' }
        });

        // Enrich orders with customer rating if available
        const enrichedOrders = await Promise.all(orders.map(async (order: any) => {
            const customerData = order.data?.customerData;
            let enrichedCustomerData = { ...customerData };
            if (customerData?.cpf) {
                try {
                    const customerResult = await findCustomerByCpfAction(customerData.cpf);
                    if (customerResult.success && customerResult.data) {
                        if (customerResult.data.rating) enrichedCustomerData.rating = customerResult.data.rating;
                        if (customerResult.data.sellerId) enrichedCustomerData.sellerId = customerResult.data.sellerId;
                    }
                } catch (err) {
                    console.error(`Error fetching customer for pending order ${order.id}:`, err);
                }
            }
            const enrichedData = { ...order.data, customerData: enrichedCustomerData };

            return {
                id: order.id,
                createdAt: order.createdAt,
                customerName: enrichedData.customerData?.name || 'Cliente Desconhecido',
                total: enrichedData.orderData?.total || 0,
                itemsCount: enrichedData.orderData?.items?.length || 0,
                details: enrichedData,
                sellerId: enrichedData.customerData?.sellerId
            };
        }));

        return {
            success: true,
            data: enrichedOrders
        };
    } catch (error: any) {
        console.error('Error fetching pending orders:', error);
        return { success: false, error: error.message };
    }
}

export async function getTrashedPendingOrdersAction(user: User | null) {
    try {
        assertTrashPermission(user);

        const retentionDays = await getTrashRetentionDays();
        const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
        await db.temporaryOrder.deleteMany({
            where: {
                deletedAt: { lt: cutoff }
            }
        });

        const orders = await db.temporaryOrder.findMany({
            where: { deletedAt: { not: null } },
            orderBy: [{ deletedAt: 'desc' }, { createdAt: 'desc' }],
        });

        const enriched = await Promise.all(orders.map(async (order: any) => {
            const customerData = order.data?.customerData;
            if (customerData?.cpf) {
                try {
                    const customerResult = await findCustomerByCpfAction(customerData.cpf);
                    if (customerResult.success && customerResult.data) {
                        if (customerResult.data.rating) {
                            order.data.customerData.rating = customerResult.data.rating;
                        }
                        if (customerResult.data.sellerId) {
                            order.data.customerData.sellerId = customerResult.data.sellerId;
                        }
                    }
                } catch (err) {
                    console.error(`Error fetching customer for trashed pending order ${order.id}:`, err);
                }
            }

            return {
                id: order.id,
                createdAt: order.createdAt,
                deletedAt: order.deletedAt,
                rejectedAt: order.rejectedAt,
                rejectedById: order.rejectedById,
                rejectedByName: order.rejectedByName,
                rejectedByRole: order.rejectedByRole,
                rejectReason: order.rejectReason,
                customerName: order.data?.customerData?.name || 'Cliente Desconhecido',
                total: order.data?.orderData?.total || 0,
                itemsCount: order.data?.orderData?.items?.length || 0,
                details: order.data,
                sellerId: order.data?.customerData?.sellerId
            };
        }));

        return { success: true, data: enriched };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function rejectTemporaryOrderToTrashAction(tempId: string, reason: string, user: User | null) {
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

export async function restoreTemporaryOrderFromTrashAction(tempId: string, user: User | null) {
    try {
        assertTrashPermission(user);

        const retentionDays = await getTrashRetentionDays();
        const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

        const existing = await db.temporaryOrder.findUnique({ where: { id: tempId } });
        if (!existing) throw new Error('Solicitação não encontrada.');
        const deletedAt = (existing as any).deletedAt as Date | null;
        if (!deletedAt) throw new Error('Solicitação não está na lixeira.');
        if (deletedAt < cutoff) throw new Error('Prazo para restauração expirou.');

        await db.temporaryOrder.update({
            where: { id: tempId },
            data: {
                deletedAt: null,
                rejectedAt: null,
                rejectedById: null,
                rejectedByName: null,
                rejectedByRole: null,
                rejectReason: null,
            }
        });

        await logActionAction(
            'Solicitação Restaurada',
            `Solicitação ${tempId} restaurada da lixeira.`,
            user
        );

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function permanentlyDeleteTemporaryOrderFromTrashAction(tempId: string, user: User | null) {
    try {
        assertTrashPermission(user);

        const existing = await db.temporaryOrder.findUnique({ where: { id: tempId } });
        if (!existing) throw new Error('Solicitação não encontrada.');
        const deletedAt = (existing as any).deletedAt as Date | null;
        if (!deletedAt) throw new Error('A solicitação precisa estar na lixeira para ser excluída permanentemente.');

        await db.temporaryOrder.delete({ where: { id: tempId } });

        await logActionAction(
            'Solicitação Excluída Permanentemente',
            `Solicitação ${tempId} removida permanentemente do sistema.`,
            user
        );

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
