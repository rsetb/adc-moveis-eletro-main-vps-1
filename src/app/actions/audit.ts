'use server';

import { db } from '@/lib/db';
import type { AuditLog, User } from '@/lib/types';

export async function getAuditLogsAction() {
    try {
        const logs = await db.auditLog.findMany({
            orderBy: { timestamp: 'desc' },
            take: 100
        });
        return { success: true, data: logs as unknown as AuditLog[] };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function logActionAction(action: string, details: string, user: User | null) {
    if (!user) return { success: false, error: 'User not logged in' };

    const newLog = {
        timestamp: new Date().toISOString(),
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action,
        details
    };

    try {
        await db.auditLog.create({
            data: newLog
        });
        return { success: true };
    } catch (error: any) {
        console.error('Error logging action:', error);
        return { success: false, error: error.message };
    }
}
