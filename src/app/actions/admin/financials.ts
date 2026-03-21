
'use server';

import { db } from '@/lib/db';
import type { User, CommissionPayment } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export async function payCommissionAction(sellerId: string, sellerName: string, amount: number, orderIds: string[], period: string, user: User | null) {
    try {
        const payment = await db.$transaction(async (tx: any) => {
            // 1. Create Commission Payment Record
            const newPayment = await tx.commissionPayment.create({
                data: {
                    sellerId,
                    sellerName,
                    amount,
                    period,
                    paymentDate: new Date().toISOString(),
                    orderIds: orderIds as any
                }
            });

            // 2. Mark orders as Paid
            if (orderIds.length > 0) {
                // Prisma doesn't support updateMany with where in list for Json fields easily without raw, 
                // but here we are updating a scalar 'commissionPaid' based on ID.
                await tx.order.updateMany({
                    where: {
                        id: { in: orderIds }
                    },
                    data: {
                        commissionPaid: true,
                        commissionDate: new Date().toISOString()
                    }
                });
            }
            return newPayment;
        });

        revalidatePath('/admin/financeiro');
        revalidatePath('/admin/minhas-comissoes');
        return { success: true, data: payment.id };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function reverseCommissionPaymentAction(paymentId: string, user: User | null) {
    try {
        if (user?.role === 'vendedor_cobranca') {
            throw new Error('Permissão negada: Vendedor Cobrança não pode estornar comissões.');
        }
        await db.$transaction(async (tx: any) => {
            const payment = await tx.commissionPayment.findUnique({ where: { id: paymentId } });
            if (!payment) throw new Error('Payment not found');

            const orderIds = payment.orderIds as string[];

            // 1. Revert orders
            if (orderIds && orderIds.length > 0) {
                await tx.order.updateMany({
                    where: { id: { in: orderIds } },
                    data: { commissionPaid: false, commissionDate: null }
                });
            }

            // 2. Delete payment record
            await tx.commissionPayment.delete({ where: { id: paymentId } });
        });

        revalidatePath('/admin/financeiro');
        revalidatePath('/admin/minhas-comissoes');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getCommissionPaymentsAction() {
    try {
        const payments = await db.commissionPayment.findMany({
            orderBy: { paymentDate: 'desc' }
        });
        return { success: true, data: payments as unknown as CommissionPayment[] };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
