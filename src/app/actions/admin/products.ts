'use server';

import { db } from '@/lib/db';
import type { Product, User } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export async function addProductAction(productData: any, user: User | null) {
    try {
        const newProductId = `PROD-${Date.now().toString().slice(-6)}`;
        const newProductCode = Date.now().toString().slice(-6);

        const incomingAiHint =
            (productData && typeof productData === 'object' && (productData['data-ai-hint'] ?? productData.dataAiHint)) || '';

        const newProduct = {
            ...productData,
            id: newProductId,
            code: productData.code || newProductCode,
            dataAiHint: String(incomingAiHint || productData.name || '')
                .toLowerCase()
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .join(' '),
        };

        if (!newProduct.promotionEndDate) delete newProduct.promotionEndDate;

        const created = await db.product.create({ data: newProduct });
        revalidatePath('/admin/produtos');
        return {
            success: true,
            data: {
                id: created.id,
                code: created.code ?? undefined,
                name: created.name,
                description: created.description ?? '',
                longDescription: created.longDescription ?? '',
                price: created.price,
                originalPrice: created.originalPrice ?? undefined,
                cost: created.cost ?? undefined,
                onSale: created.onSale ?? undefined,
                promotionEndDate: created.promotionEndDate ?? undefined,
                isHidden: created.isHidden ?? undefined,
                category: created.category ?? '',
                subcategory: created.subcategory ?? undefined,
                stock: created.stock ?? 0,
                minStock: created.minStock ?? undefined,
                unit: created.unit ?? undefined,
                imageUrl: created.imageUrl ?? undefined,
                imageUrls: Array.isArray(created.imageUrls) ? (created.imageUrls as any) : [],
                maxInstallments: created.maxInstallments ?? undefined,
                paymentCondition: created.paymentCondition ?? undefined,
                commissionType: (created.commissionType as any) ?? undefined,
                commissionValue: created.commissionValue ?? undefined,
                dimensions: (created as any).dimensions ?? undefined,
                'data-ai-hint': created.dataAiHint ?? undefined,
                createdAt: created.createdAt instanceof Date ? created.createdAt.toISOString() : String(created.createdAt),
                deletedAt: undefined,
            } as Product,
        };
    } catch (error: any) {
        console.error('addProductAction failed:', error);
        return { success: false, error: error.message };
    }
}

export async function updateProductAction(product: Product, user: User | null) {
    try {
        const id = product.id;
        const dataAiHint = (product as any)['data-ai-hint'] ?? (product as any).dataAiHint;
        const imageUrls = (product as any).imageUrls;
        const stockValue = (product as any).stock;
        const updateData: any = {
            code: product.code ?? undefined,
            name: product.name,
            description: product.description ?? undefined,
            longDescription: product.longDescription ?? undefined,
            price: product.price,
            originalPrice: (product as any).originalPrice ?? undefined,
            cost: (product as any).cost ?? undefined,
            onSale: (product as any).onSale ?? undefined,
            promotionEndDate: (product as any).promotionEndDate ?? undefined,
            isHidden: (product as any).isHidden ?? undefined,
            category: (product as any).category ?? undefined,
            subcategory: (product as any).subcategory ?? undefined,
            minStock: (product as any).minStock ?? undefined,
            unit: (product as any).unit ?? undefined,
            imageUrl: (product as any).imageUrl ?? undefined,
            imageUrls: Array.isArray(imageUrls) ? imageUrls : undefined,
            maxInstallments: (product as any).maxInstallments ?? undefined,
            paymentCondition: (product as any).paymentCondition ?? undefined,
            commissionType: (product as any).commissionType ?? undefined,
            commissionValue: (product as any).commissionValue ?? undefined,
            dimensions: (product as any).dimensions ?? undefined,
            dataAiHint: dataAiHint ?? undefined,
        };

        if (typeof stockValue === 'number' && Number.isFinite(stockValue)) {
            updateData.stock = stockValue;
        }

        await db.product.update({
            where: { id },
            data: updateData
        });
        revalidatePath('/admin/produtos');
        return { success: true };
    } catch (error: any) {
        console.error('updateProductAction failed:', error);
        return { success: false, error: error.message };
    }
}

export async function deleteProductAction(productId: string, user: User | null) {
    try {
        await db.product.update({
            where: { id: productId },
            data: { deletedAt: new Date().toISOString() } as any
        });
        revalidatePath('/admin/produtos');
        return { success: true };
    } catch (error: any) {
        console.error('deleteProductAction failed:', error);
        return { success: false, error: error.message };
    }
}
