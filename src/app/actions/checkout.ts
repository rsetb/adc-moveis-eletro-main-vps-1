'use server';

import { db } from '@/lib/db';
import type { CustomerInfo, Order } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { notifyChange } from '@/lib/change-notifier';

export async function findCustomerByCpfAction(cpf: string) {
    try {
        const normalizedCpf = cpf.replace(/\D/g, '');

        // 1) Tenta match exato por cpf (já normalizado em novas gravações)
        let customer = await db.customer.findFirst({
            where: { cpf: normalizedCpf }
        });

        // 2) Se não encontrar, tenta por cpf "mascarado":
        if (!customer) {
            const first3 = normalizedCpf.slice(0, 3);
            const last2 = normalizedCpf.slice(-2);

            const candidates = await db.customer.findMany({
                where: {
                    AND: [
                        { cpf: { contains: first3 } },
                        { cpf: { contains: last2 } }
                    ]
                }
            });

            customer = candidates.find((c: any) => {
                const storedDigits = String(c.cpf || '').replace(/\D/g, '');
                return storedDigits === normalizedCpf;
            }) as any;
        }

        if (customer) return { success: true, data: customer as unknown as CustomerInfo, source: 'active' };

        // 3) Caso não esteja em ativos, tenta na lixeira
        let trash = await db.customerTrash.findFirst({
            where: { cpf: normalizedCpf }
        });

        if (!trash) {
            const first3 = normalizedCpf.slice(0, 3);
            const last2 = normalizedCpf.slice(-2);

            const trashCandidates = await db.customerTrash.findMany({
                where: {
                    AND: [
                        { cpf: { contains: first3 } },
                        { cpf: { contains: last2 } }
                    ]
                }
            });

            trash = trashCandidates.find((t: any) => {
                const storedDigits = String(t.cpf || '').replace(/\D/g, '');
                return storedDigits === normalizedCpf;
            }) as any;
        }

        if (trash) return { success: true, data: trash.data as unknown as CustomerInfo, source: 'trash' };

        return { success: true, data: null };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

import { allocateNextCustomerCode } from '@/lib/customer-code';

export async function allocateNextCustomerCodeAction(): Promise<{ success: true; code: string }> {
    const code = await allocateNextCustomerCode();
    return { success: true, code };
}



export async function createOrderAction(orderData: any, customerData: any) {
    try {
        // Enforce restriction for Vendedor Cobrança on the backend
        if (orderData.createdByRole === 'vendedor_cobranca') {
            orderData.discount = 0;
            orderData.downPayment = 0;
        }

        // @ts-ignore
        const result = await db.$transaction(async (tx) => {
            // 1. Check stock and deduct for catalog products only
            for (const item of orderData.items) {
                // Skip custom products
                if (item.id.startsWith('CUSTOM-')) {
                    continue;
                }

                // @ts-ignore
                const product = await tx.product.findUnique({
                    where: { id: item.id }
                });

                if (!product) throw new Error(`Produto ${item.name} não encontrado.`);
                if ((product.stock || 0) < item.quantity) {
                    throw new Error(`Estoque insuficiente para ${item.name}.`);
                }

                // 2. Deduct stock
                // @ts-ignore
                await tx.product.update({
                    where: { id: item.id },
                    data: { stock: (product.stock || 0) - item.quantity }
                });
            }

            // 3. Save Order
            const { firstDueDate, ...orderToSave } = orderData;

            // Forçamos a data para o horário do servidor para garantir ordenação correta
            const serverNow = new Date().toISOString();

            // @ts-ignore
            await tx.order.create({
                data: {
                    ...orderToSave,
                    date: serverNow, // Sobrescreve a data do cliente
                    firstDueDate: firstDueDate ? new Date(firstDueDate).toISOString() : null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }
            });

            // 4. Upsert Customer (sanitize fields to avoid unknown field / unique constraint errors)
            const {
                id: custId,
                code,
                name,
                cpf,
                phone,
                phone2,
                phone3,
                email,
                zip,
                address,
                number,
                complement,
                neighborhood,
                city,
                state,
                password,
                observations,
                sellerId,
                sellerName,
                blocked,
                blockedReason,
                rating,
            } = customerData as any;

            const customerToUpsert: any = {
                name: name || '',
                phone: phone || '',
                phone2: phone2 || null,
                phone3: phone3 || null,
                email: email || null,
                zip: zip || null,
                address: address || null,
                number: number || null,
                complement: complement || null,
                neighborhood: neighborhood || null,
                city: city || null,
                state: state || null,
                password: password || null,
                observations: observations || null,
                sellerId: sellerId || null,
                sellerName: sellerName || null,
                blocked: blocked ?? false,
                blockedReason: blockedReason || null,
                rating: rating ?? null,
            };

            // Only include CPF if it's a valid value (avoid unique constraint on empty string)
            if (cpf && String(cpf).replace(/\D/g, '').length === 11) {
                customerToUpsert.cpf = String(cpf).replace(/\D/g, '');
            }

            // Try to update first (most common path — customer already exists)
            const existingCustomer = await tx.customer.findUnique({ where: { id: custId } });
            if (existingCustomer) {
                await tx.customer.update({
                    where: { id: custId },
                    data: customerToUpsert,
                });
            } else {
                // Create new customer — generate code if needed
                const normCode = code && String(code).replace(/\s/g, '') ? String(code) : null;
                const createPayload: any = {
                    ...customerToUpsert,
                    id: custId,
                };
                if (normCode) createPayload.code = normCode;

                try {
                    await tx.customer.create({ data: createPayload });
                } catch (createErr: any) {
                    // If unique constraint on code or cpf — ignore, customer data is secondary
                    if (createErr?.code === 'P2002') {
                        console.warn('[createOrderAction] Customer upsert skipped (unique conflict):', createErr?.meta?.target);
                    } else {
                        throw createErr;
                    }
                }
            }

            return { success: true, orderId: orderData.id };
        });

        if (result.success) {
            revalidatePath('/admin/pedidos');
            revalidatePath('/admin/clientes');
            notifyChange('orders');
            notifyChange('customers');
        }

        return result;

    } catch (error: any) {
        console.error('Order creation failed:', error);
        return { success: false, error: error.message || 'Erro desconhecido ao criar pedido.' };
    }
}
