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

import { allocateNextCustomerCode, normalizeCustomerCodeInput } from '@/lib/customer-code';
import { matchCpf, matchName, matchPhoneTail } from '@/lib/customer-match';

export async function allocateNextCustomerCodeAction(): Promise<{ success: true; code: string }> {
    const code = await allocateNextCustomerCode();
    return { success: true, code };
}



/**
 * Resolve e persiste o cliente do pedido, devolvendo a linha que existe de fato
 * em `customers`. O snapshot `orders.customer` é gravado a partir dela, senão o
 * pedido nasce órfão (a tela de Clientes não acha o pedido e o Saldo Devedor
 * aparece zerado).
 *
 * Antes daqui, um P2002 (CPF ou código já em uso) era engolido com console.warn:
 * o pedido gravava e o cliente não.
 */
async function resolveOrderCustomer(tx: any, customerData: any) {
    const custId = String(customerData?.id || '').trim();
    const cpfDigits = String(customerData?.cpf || '').replace(/\D/g, '');
    const cpfToSave = cpfDigits.length === 11 ? cpfDigits : null;
    const requestedCode = normalizeCustomerCodeInput(customerData?.code);

    // Só grava campo que veio preenchido: o payload do checkout público é mais
    // pobre que o do admin, e sobrescrever com null apagaria dados do cadastro.
    // `blocked` só muda se vier booleano explícito (senão um pedido desbloquearia
    // um cliente bloqueado).
    const fields: any = {};
    const assign = (key: string, value: any) => {
        if (value === undefined || value === null || value === '') return;
        fields[key] = value;
    };
    assign('name', customerData?.name);
    assign('phone', customerData?.phone);
    assign('phone2', customerData?.phone2);
    assign('phone3', customerData?.phone3);
    assign('email', customerData?.email);
    assign('zip', customerData?.zip);
    assign('address', customerData?.address);
    assign('number', customerData?.number);
    assign('complement', customerData?.complement);
    assign('neighborhood', customerData?.neighborhood);
    assign('city', customerData?.city);
    assign('state', customerData?.state);
    assign('password', customerData?.password);
    assign('observations', customerData?.observations);
    assign('sellerId', customerData?.sellerId);
    assign('sellerName', customerData?.sellerName);
    assign('rating', customerData?.rating);
    assign('blockedReason', customerData?.blockedReason);
    if (typeof customerData?.blocked === 'boolean') fields.blocked = customerData.blocked;

    // 1) por id
    let existing = custId ? await tx.customer.findUnique({ where: { id: custId } }) : null;

    // 2) por CPF: o cliente pode estar cadastrado com outro id (importação gera id novo)
    if (!existing && cpfToSave) {
        existing = await tx.customer.findUnique({ where: { cpf: cpfToSave } });
    }

    // 3) por código, só se nome ou telefone conferirem (código é realocado na importação,
    //    então código igual sozinho não prova que é a mesma pessoa)
    if (!existing && requestedCode) {
        const byCode = await tx.customer.findUnique({ where: { code: requestedCode } });
        if (byCode) {
            const sameName = !!matchName(customerData?.name) && matchName(customerData.name) === matchName(byCode.name);
            const samePhone = !!matchPhoneTail(customerData?.phone) && matchPhoneTail(customerData.phone) === matchPhoneTail(byCode.phone);
            if (sameName || samePhone) existing = byCode;
        }
    }

    if (existing) {
        const data: any = { ...fields };
        // Nunca sobrescreve um CPF divergente já cadastrado.
        if (cpfToSave && (!existing.cpf || matchCpf(existing.cpf) === matchCpf(cpfToSave))) {
            data.cpf = cpfToSave;
        }
        const updated = await tx.customer.update({ where: { id: existing.id }, data });
        return updated;
    }

    // 4) criar. Código pedido pode estar em uso por outra pessoa -> aloca um novo.
    let codeToUse: string | null = requestedCode;
    if (codeToUse) {
        const taken = await tx.customer.findUnique({ where: { code: codeToUse } });
        if (taken) codeToUse = null;
    }
    if (!codeToUse) {
        try {
            codeToUse = await allocateNextCustomerCode();
        } catch (codeErr) {
            console.error('[resolveOrderCustomer] Falha ao alocar código de cliente:', codeErr);
            codeToUse = null;
        }
    }

    const createPayload: any = {
        ...fields,
        id: custId || `CUST-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        name: fields.name || '',
        phone: fields.phone || '',
        cpf: cpfToSave,
    };
    if (codeToUse) createPayload.code = codeToUse;

    try {
        return await tx.customer.create({ data: createPayload });
    } catch (createErr: any) {
        if (createErr?.code !== 'P2002') throw createErr;
        const target: string[] = Array.isArray(createErr?.meta?.target) ? createErr.meta.target : [];

        // Corrida: alguém criou o mesmo CPF entre a busca e o insert -> usa o existente.
        if (cpfToSave) {
            const raced = await tx.customer.findUnique({ where: { cpf: cpfToSave } });
            if (raced) {
                return await tx.customer.update({ where: { id: raced.id }, data: fields });
            }
        }
        // Código tomado na corrida -> cria sem código (a tela de Clientes gera depois).
        if (target.includes('code')) {
            delete createPayload.code;
            return await tx.customer.create({ data: createPayload });
        }
        throw createErr;
    }
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

            // 3. Cliente ANTES do pedido: o snapshot do pedido é gravado a partir da
            //    linha que existe em `customers`, para não nascer órfão.
            let linkedCustomer: any = null;
            try {
                linkedCustomer = await resolveOrderCustomer(tx, customerData);
            } catch (customerErr) {
                // A venda não pode ser perdida por causa do cadastro, mas o erro tem
                // que aparecer no log em vez de ser engolido.
                console.error('[createOrderAction] Falha ao vincular o cliente do pedido:', customerErr);
            }

            const customerSnapshot = linkedCustomer
                ? {
                    ...customerData,
                    id: linkedCustomer.id,
                    cpf: linkedCustomer.cpf ?? customerData?.cpf ?? null,
                    code: linkedCustomer.code ?? customerData?.code ?? null,
                }
                : customerData;

            // 4. Save Order
            const { firstDueDate, ...orderToSave } = orderData;

            // Forçamos a data para o horário do servidor para garantir ordenação correta
            const serverNow = new Date().toISOString();

            // @ts-ignore
            await tx.order.create({
                data: {
                    ...orderToSave,
                    customer: customerSnapshot,
                    date: serverNow, // Sobrescreve a data do cliente
                    firstDueDate: firstDueDate ? new Date(firstDueDate).toISOString() : null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }
            });

            return { success: true, orderId: orderData.id, customerLinked: !!linkedCustomer };
        });

        if (result.success) {
            revalidatePath('/admin/pedidos');
            revalidatePath('/admin/clientes');
            notifyChange('orders');
            notifyChange('customers');

            // Record downPayment as ENTRADA_PEDIDO (non-blocking — ignore if no open cash)
            const dp = Number(orderData.downPayment ?? 0);
            if (dp > 0) {
                try {
                    const activeCash = await (db as any).cashRegister.findFirst({ where: { status: 'ABERTO' } });
                    if (activeCash) {
                        await (db as any).cashMovement.create({
                            data: {
                                cashRegisterId: activeCash.id,
                                type: 'ENTRADA_PEDIDO',
                                paymentMethod: 'DINHEIRO',
                                amount: dp,
                                referenceType: 'order',
                                referenceId: orderData.id,
                                reason: `Entrada pedido ${String(orderData.id).slice(-6).toUpperCase()}`,
                                createdById: orderData.createdById ?? null,
                                createdByName: orderData.createdByName ?? null,
                            },
                        });
                        revalidatePath('/admin/caixa');
                    }
                } catch {
                    // Non-blocking: order creation already succeeded
                }
            }
        }

        return result;

    } catch (error: any) {
        console.error('Order creation failed:', error);
        return { success: false, error: error.message || 'Erro desconhecido ao criar pedido.' };
    }
}
