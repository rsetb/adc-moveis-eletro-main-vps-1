'use server';

import { db } from '@/lib/db';
import type { RolePermissions } from '@/lib/types';
import { initialPermissions } from '@/lib/permissions';
import { getSession } from '@/lib/session';

export async function getRolePermissionsAction() {
    try {
        const result = await db.config.findUnique({
            where: { key: 'rolePermissions' }
        });

        if (result) {
            return { success: true, data: result.value as unknown as RolePermissions };
        }

        // Initialize if missing
        await db.config.create({
            data: { key: 'rolePermissions', value: initialPermissions as any }
        });

        return { success: true, data: initialPermissions };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateRolePermissionsAction(permissions: RolePermissions) {
    try {
        const session = await getSession();
        if (!session || (session.role !== 'admin' && session.role !== 'gerente')) {
            return { success: false, error: 'Permissão negada: apenas admin ou gerente podem alterar permissões.' };
        }
        await db.config.upsert({
            where: { key: 'rolePermissions' },
            update: { value: permissions as any },
            create: { key: 'rolePermissions', value: permissions as any }
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
