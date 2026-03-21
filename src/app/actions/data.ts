'use server';

import { db } from '@/lib/db';
import { unstable_noStore as noStore } from 'next/cache';
import type { Product, Category } from '@/lib/types';

export async function getProductsAction() {
    noStore(); // Disable cache
    try {
        const allProducts = await db.product.findMany({
            take: 2000,
            where: {
                deletedAt: null
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return { success: true, data: allProducts as unknown as Product[] };
    } catch (error: any) {
        console.error('Error fetching products:', error);
        return { success: false, error: error.message };
    }
}

export async function getCategoriesAction() {
    noStore();
    try {
        const allCategories = await db.category.findMany({
            orderBy: {
                order: 'asc'
            }
        });
        return { success: true, data: allCategories as unknown as Category[] };
    } catch (error: any) {
        console.error('Error fetching categories:', error);
        return { success: false, error: error.message };
    }
}
