'use server';

import { db } from '@/lib/db';
import { findOrCreateAsaasCustomer, createAsaasInstallmentCharge, getAsaasPayment, cancelAsaasPayment } from '@/lib/asaas';
import type { AsaasConfig } from '@/lib/asaas';
import { format, parseISO } from 'date-fns';
import type { User } from '@/lib/types';
import { logActionAction } from '@/app/actions/audit';

function assertPermission(user: User | null) {
    if (!user) throw new Error('Permissão negada.');
    if (!['admin', 'gerente'].includes(user.role)) {
        throw new Error('Apenas Admin e Gerente podem gerenciar cobranças Asaas.');
    }
}

async function resolveAsaasConfig(): Promise<AsaasConfig> {
    const settingsData = await db.config.findUnique({ where: { key: 'asaasSettings' } });
    const settings = settingsData?.value as any;

    const env = (process.env.ASAAS_ENV || settings?.env || 'production') as 'sandbox' | 'production';
    const baseUrl = env === 'sandbox'
        ? 'https://api-sandbox.asaas.com/v3'
        : 'https://api.asaas.com/v3';

    const token = (process.env.ASAAS_ACCESS_TOKEN || process.env.ASAAS_API_KEY || settings?.accessToken || '').trim();
    if (!token) throw new Error('Asaas não configurado. Adicione o token em Configurações.');

    return { baseUrl, token };
}

export async function generateAsaasChargesAction(orderId: string, user: User | null) {
    try {
        assertPermission(user);
        const config = await resolveAsaasConfig();

        const order = await db.order.findUnique({ where: { id: orderId } });
        if (!order) throw new Error('Pedido não encontrado.');
        if (order.paymentMethod !== 'Crediário') {
            throw new Error('Apenas pedidos Crediário podem gerar cobranças Asaas.');
        }

        const customer = order.customer as any;
        const installments = (order.installmentDetails as any[]) || [];
        if (!installments.length) throw new Error('Pedido sem parcelas definidas.');

        const customerId = await findOrCreateAsaasCustomer(config, {
            name: customer.name,
            cpf: customer.cpf,
            phone: customer.phone,
        });

        const existing = (order.asaas as any) || {};
        const existingCharges: any[] = existing.charges || [];
        const newCharges = [...existingCharges];
        let generated = 0;

        for (const installment of installments) {
            if (installment.status === 'Pago') continue;
            if (existingCharges.some((c: any) => c.installmentNumber === installment.installmentNumber)) continue;

            const remaining = installment.amount - (installment.paidAmount || 0);
            if (remaining <= 0) continue;

            const dueDate = format(parseISO(installment.dueDate), 'yyyy-MM-dd');
            const charge = await createAsaasInstallmentCharge(config, {
                customerId,
                value: remaining,
                dueDate,
                description: `Parcela ${installment.installmentNumber}/${order.installments} - Pedido ${order.id}`,
                externalReference: `${order.id}__${installment.installmentNumber}`,
            });

            newCharges.push({
                installmentNumber: installment.installmentNumber,
                chargeId: charge.id,
                status: charge.status,
                invoiceUrl: charge.invoiceUrl,
                createdAt: new Date().toISOString(),
            });
            generated++;
        }

        const asaasData = {
            ...existing,
            customerId,
            charges: newCharges,
        };

        await db.order.update({ where: { id: orderId }, data: { asaas: asaasData as any } });

        await logActionAction(
            'Cobranças Asaas Geradas',
            `${generated} cobranças geradas no Asaas para o pedido ${orderId}.`,
            user
        );

        return { success: true, data: asaasData };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function syncAsaasStatusesAction(orderId: string, user: User | null) {
    try {
        assertPermission(user);
        const config = await resolveAsaasConfig();

        const order = await db.order.findUnique({ where: { id: orderId } });
        if (!order) throw new Error('Pedido não encontrado.');

        const existing = (order.asaas as any) || {};
        const charges: any[] = existing.charges || [];
        if (!charges.length) return { success: true, data: existing };

        const updated = await Promise.all(
            charges.map(async (c) => {
                try {
                    const fresh = await getAsaasPayment(config, c.chargeId);
                    return { ...c, status: fresh.status };
                } catch {
                    return c;
                }
            })
        );

        const asaasData = { ...existing, charges: updated };
        await db.order.update({ where: { id: orderId }, data: { asaas: asaasData as any } });

        return { success: true, data: asaasData };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function cancelAsaasChargeAction(orderId: string, installmentNumber: number, user: User | null) {
    try {
        assertPermission(user);
        const config = await resolveAsaasConfig();

        const order = await db.order.findUnique({ where: { id: orderId } });
        if (!order) throw new Error('Pedido não encontrado.');

        const existing = (order.asaas as any) || {};
        const charges: any[] = existing.charges || [];
        const charge = charges.find((c) => c.installmentNumber === installmentNumber);
        if (!charge) throw new Error('Cobrança não encontrada.');

        await cancelAsaasPayment(config, charge.chargeId);

        const updatedCharges = charges.map((c) =>
            c.installmentNumber === installmentNumber ? { ...c, status: 'CANCELLED' } : c
        );
        const asaasData = { ...existing, charges: updatedCharges };
        await db.order.update({ where: { id: orderId }, data: { asaas: asaasData as any } });

        await logActionAction(
            'Cobrança Asaas Cancelada',
            `Parcela ${installmentNumber} do pedido ${orderId} cancelada no Asaas.`,
            user
        );

        return { success: true, data: asaasData };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
