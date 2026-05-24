'use server';

import { db } from '@/lib/db';
import type { User, CashRegister, CashMovement, CashMovementType, CashPaymentMethod } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export async function getActiveCashRegisterAction(): Promise<{ success: boolean; data?: CashRegister | null; error?: string }> {
    try {
        const register = await db.cashRegister.findFirst({
            where: { status: 'ABERTO' },
            orderBy: { openedAt: 'desc' },
            include: { movements: { orderBy: { createdAt: 'asc' } } },
        });
        return { success: true, data: register ? (register as unknown as CashRegister) : null };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getCashRegisterHistoryAction(limit = 30): Promise<{ success: boolean; data?: CashRegister[]; error?: string }> {
    try {
        const registers = await (db.cashRegister as any).findMany({
            orderBy: { openedAt: 'desc' },
            take: limit,
            include: { movements: { orderBy: { createdAt: 'asc' } } },
        });
        return { success: true, data: registers as unknown as CashRegister[] };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function openCashRegisterAction(
    openingAmount: number,
    user: User,
): Promise<{ success: boolean; data?: CashRegister; error?: string }> {
    try {
        const existing = await db.cashRegister.findFirst({ where: { status: 'ABERTO' } });
        if (existing) return { success: false, error: 'Já existe um caixa aberto.' };

        const register = await db.$transaction(async (tx: any) => {
            const cr = await tx.cashRegister.create({
                data: {
                    openedById: user.id,
                    openedByName: user.name,
                    openingAmount,
                    status: 'ABERTO',
                },
            });
            await tx.cashMovement.create({
                data: {
                    cashRegisterId: cr.id,
                    type: 'ABERTURA',
                    paymentMethod: 'DINHEIRO',
                    amount: openingAmount,
                    reason: 'Abertura de caixa',
                    createdById: user.id,
                    createdByName: user.name,
                },
            });
            return cr;
        });

        revalidatePath('/admin/caixa');
        return { success: true, data: register as unknown as CashRegister };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function closeCashRegisterAction(
    cashRegisterId: string,
    closingAmount: number,
    user: User,
): Promise<{ success: boolean; error?: string }> {
    try {
        const register = await (db.cashRegister as any).findUnique({
            where: { id: cashRegisterId },
            include: { movements: true },
        });
        if (!register) return { success: false, error: 'Caixa não encontrado.' };
        if (register.status !== 'ABERTO') return { success: false, error: 'Caixa já está fechado.' };

        const movements: any[] = register.movements ?? [];
        const expectedAmount = movements.reduce((sum: number, m: any) => {
            const amt = Number(m.amount);
            if (['ABERTURA', 'RECEBIMENTO', 'ENTRADA_PEDIDO', 'QUITACAO', 'SUPRIMENTO'].includes(m.type)) {
                return sum + amt;
            }
            if (['SANGRIA', 'ESTORNO'].includes(m.type)) {
                return sum - amt;
            }
            return sum;
        }, 0);

        const difference = closingAmount - expectedAmount;

        await db.cashRegister.update({
            where: { id: cashRegisterId },
            data: {
                status: 'FECHADO',
                closingAmount,
                expectedAmount,
                difference,
                closedAt: new Date(),
            },
        });

        revalidatePath('/admin/caixa');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function addCashMovementAction(
    cashRegisterId: string,
    type: CashMovementType,
    paymentMethod: CashPaymentMethod,
    amount: number,
    user: User,
    options?: { reason?: string; referenceType?: string; referenceId?: string },
): Promise<{ success: boolean; error?: string }> {
    try {
        const register = await db.cashRegister.findUnique({ where: { id: cashRegisterId } });
        if (!register) return { success: false, error: 'Caixa não encontrado.' };
        if (register.status !== 'ABERTO') return { success: false, error: 'Caixa fechado.' };

        await db.cashMovement.create({
            data: {
                cashRegisterId,
                type,
                paymentMethod,
                amount,
                reason: options?.reason ?? null,
                referenceType: options?.referenceType ?? null,
                referenceId: options?.referenceId ?? null,
                createdById: user.id,
                createdByName: user.name,
            },
        });

        revalidatePath('/admin/caixa');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
