'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import type { User } from '@/lib/types';

export async function getUsersAction() {
    try {
        const allUsers = await db.user.findMany();
        return { success: true, data: allUsers as unknown as User[] };
    } catch (error: any) {
        console.error('Error fetching users:', error);
        return { success: false, error: error.message };
    }
}

export async function createUserAction(data: Omit<User, 'id'>) {
    try {
        // Prisma can autogenerate UUIDs if configured in schema.
        // But our User type might expect specific ID format or logic.
        // Schema has @default(uuid()), so let's try relying on that or manually if needed.
        // We'll trust Prisma default or if manual ID needed.
        // Existing logic used manual ID.
        // Let's rely on Prisma UUID unless we need specific format.
        // The type User expects { id: string, ... }

        const newUser = await db.user.create({
            data: {
                ...data,
                canBeAssigned: data.canBeAssigned ?? true,
                active: data.active ?? true,
            } as any
        });

        revalidatePath('/admin');
        revalidatePath('/admin/configuracao');
        return { success: true, data: newUser as unknown as User };
    } catch (error: any) {
        console.error('Error creating user:', error);
        if (error.code === 'P2002') {
            return { success: false, error: 'Este nome de usuário já está em uso.' };
        }
        return { success: false, error: error.message };
    }
}

export async function updateUserAction(userId: string, data: Partial<Omit<User, 'id'>>) {
    try {
        await db.user.update({
            where: { id: userId },
            data: data as any
        });
        revalidatePath('/admin');
        revalidatePath('/admin/configuracao');
        return { success: true };
    } catch (error: any) {
        if (error.code === 'P2002') {
            return { success: false, error: 'Este nome de usuário já está em uso.' };
        }
        return { success: false, error: error.message };
    }
}

export async function deleteUserAction(userId: string) {
    try {
        await db.user.delete({
            where: { id: userId }
        });
        revalidatePath('/admin');
        revalidatePath('/admin/configuracao');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function restoreUsersAction(usersToRestore: User[]) {
    try {
        // Transactional upsert loop or createMany if strictly creating.
        // Restore implies they might exist or not.

        await db.$transaction(
            usersToRestore.map(u =>
                db.user.upsert({
                    where: { id: u.id },
                    update: u,
                    create: u
                })
            )
        );

        revalidatePath('/admin');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

