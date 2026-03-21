
'use server';

import { db } from '@/lib/db';
import type { User, StockAudit, Avaria } from '@/lib/types';
import { revalidatePath } from 'next/cache';

// --- Stock Audit ---

export async function saveStockAuditAction(audit: StockAudit, user: User | null) {
    try {
        await db.stockAudit.create({
            data: {
                id: audit.id, // e.g., "audit-2023-12"
                month: audit.month,
                year: audit.year,
                createdAt: new Date().toISOString(),
                auditedBy: user?.id || 'system',
                auditedByName: user?.name || 'Sistema',
                products: audit.products as any
            }
        });
        revalidatePath('/admin/auditoria');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getStockAuditsAction() {
    try {
        const audits = await db.stockAudit.findMany({
            orderBy: { createdAt: 'desc' },
            take: 24 // Last 2 years
        });
        return { success: true, data: audits as unknown as StockAudit[] };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// --- Avarias ---

export async function addAvariaAction(avaria: any, user: User | null) {
    try {
        await db.avaria.create({
            data: {
                ...avaria,
                createdAt: new Date().toISOString(),
                createdBy: user?.id || 'unknown',
                createdByName: user?.name || 'Desconhecido'
            }
        });
        revalidatePath('/admin/avarias');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateAvariaAction(id: string, data: any, user: User | null) {
    try {
        await db.avaria.update({
            where: { id },
            data: data
        });
        revalidatePath('/admin/avarias');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteAvariaAction(id: string, user: User | null) {
    try {
        await db.avaria.delete({
            where: { id }
        });
        revalidatePath('/admin/avarias');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getAvariasAction() {
    try {
        const avarias = await db.avaria.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return { success: true, data: avarias as unknown as Avaria[] };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
