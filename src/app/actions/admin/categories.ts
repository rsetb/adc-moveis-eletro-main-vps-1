
'use server';

import { db } from '@/lib/db';
import type { User } from '@/lib/types';
import { revalidatePath } from 'next/cache';

// --- Categories ---

export async function addCategoryAction(name: string, user: User | null) {
    try {
        const count = await db.category.count();
        await db.category.create({
            data: {
                id: `cat-${Date.now()}`,
                name,
                order: count + 1,
                subcategories: []
            }
        });
        revalidatePath('/admin/products');
        revalidatePath('/admin/categorias');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateCategoryNameAction(categoryId: string, name: string, user: User | null) {
    try {
        await db.category.update({
            where: { id: categoryId },
            data: { name }
        });
        revalidatePath('/admin/products');
        revalidatePath('/admin/categorias');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteCategoryAction(categoryId: string, user: User | null) {
    try {
        await db.category.delete({
            where: { id: categoryId }
        });
        revalidatePath('/admin/products');
        revalidatePath('/admin/categorias');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// --- Subcategories ---

export async function addSubcategoryAction(categoryId: string, subcategoryName: string, user: User | null) {
    try {
        const category = await db.category.findUnique({ where: { id: categoryId } });
        if (!category) throw new Error('Category not found');

        const currentSubs = (category.subcategories as string[]) || [];
        if (!currentSubs.includes(subcategoryName)) {
            await db.category.update({
                where: { id: categoryId },
                data: {
                    subcategories: [...currentSubs, subcategoryName]
                }
            });
        }
        revalidatePath('/admin/products');
        revalidatePath('/admin/categorias');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateSubcategoryAction(categoryId: string, oldName: string, newName: string, user: User | null) {
    try {
        const category = await db.category.findUnique({ where: { id: categoryId } });
        if (!category) throw new Error('Category not found');

        const currentSubs = (category.subcategories as string[]) || [];
        const newSubs = currentSubs.map(s => s === oldName ? newName : s);

        await db.category.update({
            where: { id: categoryId },
            data: {
                subcategories: newSubs
            }
        });
        revalidatePath('/admin/products');
        revalidatePath('/admin/categorias');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteSubcategoryAction(categoryId: string, subcategoryName: string, user: User | null) {
    try {
        const category = await db.category.findUnique({ where: { id: categoryId } });
        if (!category) throw new Error('Category not found');

        const currentSubs = (category.subcategories as string[]) || [];
        const newSubs = currentSubs.filter(s => s !== subcategoryName);

        await db.category.update({
            where: { id: categoryId },
            data: {
                subcategories: newSubs
            }
        });
        revalidatePath('/admin/products');
        revalidatePath('/admin/categorias');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
