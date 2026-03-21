
'use server';

import { db } from '@/lib/db';
import type { User, Product, CustomerInfo } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { normalizeCustomerCodeInput, reserveCustomerCodes, formatCustomerCode } from '@/lib/customer-code';

// --- Resets ---

export async function resetOrdersAction(user: User | null) {
    try {
        await db.order.deleteMany({});
        await db.commissionPayment.deleteMany({});
        revalidatePath('/admin/pedidos');
        revalidatePath('/admin/financeiro');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function resetProductsAction(user: User | null) {
    try {
        await db.product.deleteMany({});
        await db.category.deleteMany({});
        revalidatePath('/admin/produtos');
        revalidatePath('/admin/categorias');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function resetFinancialsAction(user: User | null) {
    try {
        await db.commissionPayment.deleteMany({});
        // Potentially reset financial fields in orders without deleting orders
        await db.order.updateMany({
            data: {
                commissionPaid: false,
                commissionDate: null
            }
        });
        revalidatePath('/admin/financeiro');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function resetAllAdminDataAction(user: User | null) {
    try {
        await db.$transaction([
            db.order.deleteMany({}),
            db.product.deleteMany({}),
            db.customer.deleteMany({}),
            db.category.deleteMany({}),
            db.commissionPayment.deleteMany({}),
            db.stockAudit.deleteMany({}),
            db.avaria.deleteMany({}),
            db.chatSession.deleteMany({}),
            db.chatMessage.deleteMany({})
        ]);
        revalidatePath('/admin');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// --- Imports ---

export async function importProductsAction(products: Product[], user: User | null) {
    try {
        // Bulk create is efficient
        // Prisma createMany is supported in Postgres
        const productsToCreate = products.map(p => ({
            id: p.id || `PROD-${Math.random().toString(36).substr(2, 9)}`,
            name: p.name,
            code: p.code,
            description: p.description,
            longDescription: p.longDescription,
            price: p.price,
            originalPrice: p.originalPrice,
            cost: p.cost,
            onSale: p.onSale,
            isHidden: p.isHidden,
            category: p.category,
            subcategory: p.subcategory,
            stock: p.stock,
            imageUrls: p.imageUrls || (p.imageUrl ? [p.imageUrl] : []),
            maxInstallments: p.maxInstallments,
            paymentCondition: p.paymentCondition,
            commissionType: p.commissionType,
            commissionValue: p.commissionValue,
            createdAt: new Date().toISOString()
        }));

        await db.product.createMany({
            data: productsToCreate,
            skipDuplicates: true
        });

        // Also ensure categories exist
        const uniqueCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
        for (const catName of uniqueCategories) {
            const exists = await db.category.findFirst({ where: { name: catName } });
            if (!exists) {
                await db.category.create({
                    data: {
                        name: catName,
                        subcategories: []
                    }
                });
            }
        }

        revalidatePath('/admin/produtos');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function importCustomersAction(customers: CustomerInfo[], user: User | null) {
    try {
        const normalized = customers.map((c) => ({
            ...c,
            code: normalizeCustomerCodeInput((c as any)?.code),
        })) as Array<CustomerInfo & { code: string | null }>;

        const seenCodesInBatch = new Set<string>();
        const codesToCheckInDb: string[] = [];
        const needsAllocation = new Set<number>();

        normalized.forEach((c, idx) => {
            const code = c.code;
            if (!code) {
                needsAllocation.add(idx);
                return;
            }
            if (seenCodesInBatch.has(code)) {
                needsAllocation.add(idx);
                return;
            }
            seenCodesInBatch.add(code);
            codesToCheckInDb.push(code);
        });

        const existingCodes = new Set<string>();
        const chunkSize = 1000;
        for (let i = 0; i < codesToCheckInDb.length; i += chunkSize) {
            const chunk = codesToCheckInDb.slice(i, i + chunkSize);
            const rows = await db.customer.findMany({
                where: { code: { in: chunk } },
                select: { code: true }
            });
            rows.forEach((r) => {
                if (r.code) existingCodes.add(r.code);
            });
        }

        normalized.forEach((c, idx) => {
            const code = c.code;
            if (!code) return;
            if (existingCodes.has(code)) {
                needsAllocation.add(idx);
            }
        });

        if (needsAllocation.size > 0) {
            const { startNumber } = await reserveCustomerCodes(needsAllocation.size);
            let cursor = startNumber;
            for (const idx of needsAllocation) {
                normalized[idx].code = formatCustomerCode(cursor);
                cursor++;
            }
        }

        const customersToCreate = normalized.map(c => ({
            id: c.id || `CUST-${Math.random().toString(36).substr(2, 9)}`,
            name: c.name,
            code: c.code,
            cpf: c.cpf,
            phone: c.phone,
            email: c.email,
            address: c.address,
            zip: c.zip,
            number: c.number,
            neighborhood: c.neighborhood,
            city: c.city,
            state: c.state,
            createdAt: new Date().toISOString()
        }));

        await db.customer.createMany({
            data: customersToCreate,
            skipDuplicates: true
        });
        revalidatePath('/admin/clientes');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// --- Trash Management ---

export async function emptyTrashAction(user: User | null) {
    try {
        // Permanently delete soft-deleted products
        await db.product.deleteMany({
            where: { deletedAt: { not: null } }
        });

        // Permanently delete orders marked as 'Excluído'
        await db.order.deleteMany({
            where: { status: 'Excluído' }
        });

        revalidatePath('/admin/produtos');
        revalidatePath('/admin/pedidos');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function restoreProductAction(id: string, user: User | null) {
    try {
        await db.product.update({
            where: { id },
            data: { deletedAt: null }
        });
        revalidatePath('/admin/produtos');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function permanentlyDeleteProductWithIdAction(id: string, user: User | null) {
    try {
        await db.product.delete({
            where: { id }
        });
        revalidatePath('/admin/produtos');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function fetchDeletedProductsAction() {
    try {
        const products = await db.product.findMany({
            where: { deletedAt: { not: null } }
        });
        return { success: true, data: products as unknown as Product[] };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
