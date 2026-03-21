'use server';

import { db } from '@/lib/db';
import type { Order } from '@/lib/types';

export async function getOrderByIdAction(orderId: string) {
    try {
        const result = await db.order.findUnique({
            where: { id: orderId }
        });
        if (result) {
            return { success: true, data: result as unknown as Order };
        }
        return { success: true, data: null };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
