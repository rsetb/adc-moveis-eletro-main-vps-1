'use server';

import { db } from '@/lib/db';
import type { CustomerInfo, Order } from '@/lib/types';

export async function customerLoginAction(cpf: string) {
    try {
        const normalizedCpf = cpf.replace(/\D/g, '');
        const customer = await db.customer.findUnique({
            where: { cpf: normalizedCpf }
        });

        if (!customer) return { success: false, error: 'CPF não encontrado.' };

        return { success: true, data: customer as unknown as CustomerInfo };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getCustomerOrdersAction(customerCpf: string) {
    try {
        // Querying JSON field in Prisma
        // Postgreq allows path query, Prisma supports basic JSON filtering but might need Raw for precise "customer->>'cpf'" query if structure varies.
        // Assuming Order 'customer' field is JSON and matches.
        // Prisma: where: { customer: { path: ['cpf'], equals: customerCpf } } ... check docs support dependent on provider version.
        // Easier: queryRaw or findMany with filter.
        // Or if we know customer is stored in `customer` column as { cpf: ... }

        // Using raw query for JSON containment is often safer for complex JSON paths.
        // But let's try Prisma's JSON filter syntax first.

        const result = await db.order.findMany({
            where: {
                customer: {
                    path: ['cpf'],
                    equals: customerCpf
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return { success: true, data: result as unknown as Order[] };
    } catch (error: any) {
        // Fallback or error handling
        return { success: false, error: error.message };
    }
}
