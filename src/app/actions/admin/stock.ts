'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { notifyChange } from '@/lib/change-notifier';
import type { StockMovement, User } from '@/lib/types';

function mapMovement(m: any): StockMovement {
    return {
        id: m.id,
        productId: m.productId ?? m.product_id,
        productName: m.productName ?? m.product_name,
        type: m.type,
        quantity: Number(m.quantity),
        unitCost: m.unitCost ?? m.unit_cost ?? undefined,
        totalCost: m.totalCost ?? m.total_cost ?? undefined,
        reason: m.reason ?? undefined,
        referenceId: m.referenceId ?? m.reference_id ?? undefined,
        createdById: m.createdById ?? m.created_by_id ?? undefined,
        createdByName: m.createdByName ?? m.created_by_name ?? undefined,
        createdAt: m.createdAt instanceof Date
            ? m.createdAt.toISOString()
            : String(m.createdAt ?? m.created_at ?? ''),
    };
}

export async function getStockMovementsAction(productId?: string, limit = 100) {
    try {
        const movements = await db.stockMovement.findMany({
            where: productId ? { productId } : undefined,
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        return { success: true, data: movements.map(mapMovement) };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getStockSummaryAction() {
    try {
        const products = await db.product.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true, stock: true, minStock: true, cost: true, price: true, unit: true, category: true },
        });

        const totalProducts = products.length;
        const lowStock = products.filter(p => p.minStock != null && p.stock <= p.minStock).length;
        const totalValue = products.reduce((acc, p) => acc + (p.stock * (p.cost ?? 0)), 0);

        const recentMovements = await db.stockMovement.count({
            where: {
                createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            },
        });

        return {
            success: true,
            data: {
                totalProducts,
                lowStock,
                totalValue,
                recentMovements,
                products: products.map(p => ({
                    ...p,
                    stock: Number(p.stock),
                    minStock: p.minStock != null ? Number(p.minStock) : null,
                    cost: p.cost != null ? Number(p.cost) : null,
                    price: Number(p.price),
                })),
            },
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function addStockEntryAction(
    data: { productId: string; quantity: number; unitCost: number; reason?: string },
    user: User | null
) {
    try {
        const product = await db.product.findUnique({ where: { id: data.productId } });
        if (!product) return { success: false, error: 'Produto não encontrado.' };

        const quantity = Number(data.quantity);
        const unitCost = Number(data.unitCost);
        const totalCost = quantity * unitCost;

        await db.$transaction(async (tx) => {
            await tx.product.update({
                where: { id: data.productId },
                data: {
                    stock: { increment: quantity },
                    cost: unitCost,
                },
            });

            await tx.stockMovement.create({
                data: {
                    productId: data.productId,
                    productName: product.name,
                    type: 'ENTRADA',
                    quantity,
                    unitCost,
                    totalCost,
                    reason: data.reason || null,
                    createdById: user?.id || null,
                    createdByName: user?.name || null,
                },
            });
        });

        revalidatePath('/admin/estoque');
        revalidatePath('/admin/produtos');
        notifyChange('products');

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function adjustStockAction(
    data: { productId: string; newStock: number; reason: string },
    user: User | null
) {
    try {
        const product = await db.product.findUnique({ where: { id: data.productId } });
        if (!product) return { success: false, error: 'Produto não encontrado.' };

        const currentStock = Number(product.stock);
        const newStock = Number(data.newStock);
        const delta = newStock - currentStock;

        if (delta === 0) return { success: false, error: 'O estoque informado é igual ao atual.' };
        if (!data.reason?.trim()) return { success: false, error: 'Motivo é obrigatório para ajuste.' };

        await db.$transaction(async (tx) => {
            await tx.product.update({
                where: { id: data.productId },
                data: { stock: newStock },
            });

            await tx.stockMovement.create({
                data: {
                    productId: data.productId,
                    productName: product.name,
                    type: 'AJUSTE',
                    quantity: Math.abs(delta),
                    reason: `${data.reason} (${delta > 0 ? '+' : ''}${delta} un. | ${currentStock} → ${newStock})`,
                    createdById: user?.id || null,
                    createdByName: user?.name || null,
                },
            });
        });

        revalidatePath('/admin/estoque');
        revalidatePath('/admin/produtos');
        notifyChange('products');

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
