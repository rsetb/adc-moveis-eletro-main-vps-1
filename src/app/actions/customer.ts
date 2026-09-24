'use server';

import { db } from '@/lib/db';
import type { CustomerInfo, Order } from '@/lib/types';
import { findCustomerByCpfAction } from '@/app/actions/checkout';

export async function customerLoginAction(cpf: string) {
    try {
        const result = await findCustomerByCpfAction(cpf);
        if (!result.success) return { success: false, error: result.error || 'Erro ao buscar CPF.' };
        if (!result.data || result.source === 'trash') return { success: false, error: 'CPF não encontrado.' };
        return { success: true, data: result.data as unknown as CustomerInfo };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getCustomerOrdersAction(customerCpf: string) {
    try {
        const digits = customerCpf.replace(/\D/g, '');
        // Use raw query to normalize both sides before comparing, handling CPFs stored
        // with or without formatting (e.g. "07374541309" vs "073.745.413-09")
        const result = await db.$queryRaw<any[]>`
            SELECT * FROM orders
            WHERE regexp_replace(
                (CASE WHEN jsonb_typeof(customer::jsonb) = 'string'
                      THEN (customer #>> '{}')::jsonb
                      ELSE customer::jsonb END)->>'cpf',
                '[^0-9]', '', 'g'
            ) = ${digits}
            AND status NOT ILIKE '%exclu%'
            ORDER BY created_at DESC
        `;
        return { success: true, data: result as unknown as Order[] };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
