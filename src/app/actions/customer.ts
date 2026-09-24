'use server';

import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
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

export async function verifyCustomerPasswordAction(cpf: string, password: string): Promise<{ success: boolean; data?: CustomerInfo; error?: string }> {
    try {
        const result = await findCustomerByCpfAction(cpf);
        if (!result.success) return { success: false, error: result.error || 'Erro ao buscar CPF.' };
        if (!result.data || result.source === 'trash') return { success: false, error: 'CPF não encontrado.' };

        const customer = result.data as unknown as CustomerInfo;

        if (!customer.password) {
            return { success: false, error: 'Esta conta ainda não possui uma senha cadastrada.' };
        }

        const isValid = await bcrypt.compare(password, customer.password);
        if (!isValid) return { success: false, error: 'Senha inválida.' };

        const { password: _pw, ...customerWithoutPassword } = customer as any;
        return { success: true, data: customerWithoutPassword as CustomerInfo };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getCustomerOrdersAction(customerCpf: string) {
    try {
        const digits = customerCpf.replace(/\D/g, '');

        // Primary: use Prisma findMany with JSON path filter for digits-only CPF
        // (returns camelCase columns, no serialization issues)
        let orders = await (db as any).order.findMany({
            where: {
                status: { not: { contains: 'exclu', mode: 'insensitive' } },
                customer: { path: ['cpf'], equals: digits },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Fallback: CPF stored with formatting (e.g. "073.745.413-09") — raw query to normalize
        if (orders.length === 0) {
            const rawRows = await db.$queryRaw<any[]>`
                SELECT id, customer, items, total, subtotal, discount,
                       down_payment AS "downPayment", delivery_fee AS "deliveryFee",
                       installments, installment_value AS "installmentValue",
                       date, first_due_date AS "firstDueDate", status,
                       payment_method AS "paymentMethod",
                       installment_details AS "installmentDetails",
                       installment_card_details AS "installmentCardDetails",
                       tracking_code AS "trackingCode", attachments,
                       seller_id AS "sellerId", seller_name AS "sellerName",
                       commission, commission_date AS "commissionDate",
                       commission_paid AS "commissionPaid",
                       is_commission_manual AS "isCommissionManual",
                       observations, source, asaas,
                       created_by_id AS "createdById", created_by_name AS "createdByName",
                       created_by_role AS "createdByRole", created_ip AS "createdIp"
                FROM orders
                WHERE regexp_replace((customer::jsonb)->>'cpf', '[^0-9]', '', 'g') = ${digits}
                AND status NOT ILIKE '%exclu%'
                ORDER BY date DESC
            `;
            orders = rawRows;
        }

        return { success: true, data: orders as unknown as Order[] };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
