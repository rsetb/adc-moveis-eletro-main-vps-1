'use server';

import { db } from '@/lib/db';
import { subHours } from 'date-fns';
import { requireStaff } from '@/lib/auth-guard';

export async function getRecentPriceChangesAction() {
    try {
        await requireStaff();
        const twentyFourHoursAgo = subHours(new Date(), 24);
        
        const changes = await (db as any).priceChange.findMany({
            where: {
                createdAt: {
                    gte: twentyFourHoursAgo
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return { success: true, data: changes };
    } catch (error: any) {
        console.error('getRecentPriceChangesAction failed:', error);
        return { success: false, error: error.message };
    }
}
