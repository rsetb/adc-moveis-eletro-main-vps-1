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

        const customer = result.data as unknown as CustomerInfo & { id: string };

        if (!customer.password) {
            return { success: false, error: 'Esta conta ainda não possui uma senha cadastrada.' };
        }

        // A valid bcrypt hash starts with $2 and is at least 50 chars long.
        // Legacy accounts (38 customers) have a 6-char plain-text password
        // (e.g. "078.82" = first 6 chars of the formatted CPF).
        const isBcrypt = customer.password.startsWith('$2') && customer.password.length >= 50;

        let isValid = false;
        if (isBcrypt) {
            isValid = await bcrypt.compare(password, customer.password);
        } else {
            // Plain-text comparison for legacy passwords
            isValid = password === customer.password;
            if (isValid) {
                // Auto-upgrade to bcrypt so the next login goes through the secure path
                const newHash = await bcrypt.hash(password, 10);
                await db.customer.update({
                    where: { id: customer.id },
                    data: { password: newHash },
                });
            }
        }

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
        // Build formatted CPF (e.g. "073.745.413-09") to also match orders that
        // stored it with punctuation instead of digits-only.
        const formatted = digits.length === 11
            ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
            : digits;

        const orders = await db.order.findMany({
            where: {
                NOT: { status: { contains: 'exclu', mode: 'insensitive' } },
                OR: [
                    { customer: { path: ['cpf'], string_contains: digits } },
                    { customer: { path: ['cpf'], string_contains: formatted } },
                ],
            },
            orderBy: { createdAt: 'desc' },
        });

        return { success: true, data: orders as unknown as Order[] };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
