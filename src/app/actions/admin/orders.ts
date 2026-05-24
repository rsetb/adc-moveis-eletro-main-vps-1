'use server';

import { db } from '@/lib/db';
import type { Order, User } from '@/lib/types';
import { revalidatePath, unstable_noStore as noStore } from 'next/cache';
import { computeStockDeltas, getBillingPriority } from '@/lib/utils';
import { notifyChange } from '@/lib/change-notifier';

/**
 * Maps raw database fields (snake_case) to Order type fields (camelCase).
 * This is necessary because $queryRaw does not respect Prisma model mappings.
 */
function mapRawOrder(raw: any): Order {
    if (!raw) return raw;

    const safeParse = (val: any) => {
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch { return val; }
        }
        return val;
    };

    return {
        ...raw,
        // Basic mappings
        paymentMethod: raw.paymentMethod ?? raw.payment_method,
        installments: raw.installments,
        installmentValue: raw.installmentValue ?? raw.installment_value,
        firstDueDate: raw.firstDueDate ?? (raw.first_due_date ? new Date(raw.first_due_date) : undefined),
        trackingCode: raw.trackingCode ?? raw.tracking_code,
        sellerId: raw.sellerId ?? raw.seller_id,
        sellerName: raw.sellerName ?? raw.seller_name,
        commissionDate: raw.commissionDate ?? raw.commission_date,
        commissionPaid: row_bool(raw.commissionPaid ?? raw.commission_paid),
        isCommissionManual: row_bool(raw.isCommissionManual ?? raw.is_commission_manual),
        createdById: raw.createdById ?? raw.created_by_id,
        createdByName: raw.createdByName ?? raw.created_by_name,
        createdByRole: raw.createdByRole ?? raw.created_by_role,
        createdIp: raw.createdIp ?? raw.created_ip,
        createdAt: raw.createdAt ?? raw.created_at,
        updatedAt: raw.updatedAt ?? raw.updated_at,

        // JSON fields (raw queries often return them as strings or need mapping)
        customer: safeParse(raw.customer),
        items: safeParse(raw.items),
        installmentDetails: safeParse(raw.installmentDetails ?? raw.installment_details),
        installmentCardDetails: safeParse(raw.installmentCardDetails ?? raw.installment_card_details),
        attachments: safeParse(raw.attachments),
        asaas: safeParse(raw.asaas),
    } as unknown as Order;
}

function row_bool(val: any) {
    if (val === null || val === undefined) return val;
    return val === 1 || val === true || val === 'true' || val === '1';
}

// Helper to adjust stock in a transaction
async function adjustStock(
    tx: any,
    items: any[],
    type: 'deduct' | 'restore',
    context?: { orderId?: string; user?: User | null }
) {
    for (const item of items) {
        if (!item.id || item.id.startsWith('CUSTOM-')) continue;

        const quantity = Number(item.quantity || 0);
        if (!Number.isFinite(quantity) || quantity <= 0) continue;

        const product = await tx.product.findUnique({ where: { id: item.id } });

        if (!product) {
            console.warn(`[adjustStock] Product ${item.id} not found, skipping stock adjustment.`);
            continue;
        }

        const currentStock = Number(product.stock || 0);
        if (type === 'deduct' && currentStock < quantity) {
            throw new Error(`Estoque insuficiente para o produto ${item.id}. Atual: ${currentStock}, necessário: ${quantity}`);
        }

        const data = type === 'deduct'
            ? { stock: { decrement: quantity } }
            : { stock: { increment: quantity } };

        await tx.product.update({ where: { id: item.id }, data });

        await tx.stockMovement.create({
            data: {
                productId: item.id,
                productName: product.name,
                type: type === 'deduct' ? 'VENDA' : 'AJUSTE',
                quantity,
                reason: type === 'deduct'
                    ? `Venda - Pedido ${context?.orderId ?? ''}`
                    : `Estorno - Pedido ${context?.orderId ?? ''}`,
                referenceId: context?.orderId ?? null,
                createdById: context?.user?.id ?? null,
                createdByName: context?.user?.name ?? null,
            },
        });

        console.log(`[adjustStock] Stock for ${item.id} ${type}: ${currentStock} -> ${type === 'deduct' ? currentStock - quantity : currentStock + quantity}`);
    }
}

export async function searchOrdersAction(term: string) {
    if (!term || term.trim().length < 3) return { success: true, data: [] };

    try {
        const searchTerm = `%${term}%`;
        const orders = await db.$queryRaw`
            SELECT * FROM orders
            WHERE id ILIKE ${searchTerm}
            OR customer->>'name' ILIKE ${searchTerm}
            OR customer->>'code' ILIKE ${searchTerm}
            ORDER BY date DESC
            LIMIT 50
        `;

        return { success: true, data: (orders as any[]).map(mapRawOrder) };
    } catch (error: any) {
        console.error('Error searching orders:', error);
        return { success: false, error: error.message };
    }
}

export async function getCustomerOrdersAction(
    customer: { cpf?: string; id?: string; code?: string; name?: string; phone?: string },
    user: User | null
) {
    try {
        const cpf = String(customer?.cpf || '').replace(/\D/g, '');
        const id = String(customer?.id || '').replace(/\D/g, '');
        const code = String(customer?.code || '').trim();
        const name = String(customer?.name || '').trim();
        const phone = String(customer?.phone || '').replace(/\D/g, '');

        if (cpf.length === 11 || id.length === 11) {
            const target = (cpf.length === 11 ? cpf : id);
            if (user?.role === 'vendedor_cobranca') {
                const orders = await db.$queryRaw`
                    SELECT * FROM orders
                    WHERE (
                        customer->>'cpf' = ${target}
                        OR customer->>'id' = ${target}
                    )
                    AND seller_id = ${user.id}
                    ORDER BY date DESC, created_at DESC
                    LIMIT 5000
                `;
                return { success: true, data: (orders as any[]).map(mapRawOrder) };
            }

            const orders = await db.$queryRaw`
                SELECT * FROM orders
                WHERE (
                    customer->>'cpf' = ${target}
                    OR customer->>'id' = ${target}
                )
                ORDER BY date DESC, created_at DESC
                LIMIT 5000
            `;
            return { success: true, data: (orders as any[]).map(mapRawOrder) };
        }

        if (code) {
            if (user?.role === 'vendedor_cobranca') {
                const orders = await db.$queryRaw`
                    SELECT * FROM orders
                    WHERE customer->>'code' ILIKE ${code}
                    AND seller_id = ${user.id}
                    ORDER BY date DESC, created_at DESC
                    LIMIT 5000
                `;
                return { success: true, data: (orders as any[]).map(mapRawOrder) };
            }

            const orders = await db.$queryRaw`
                SELECT * FROM orders
                WHERE customer->>'code' ILIKE ${code}
                ORDER BY date DESC, created_at DESC
                LIMIT 5000
            `;
            return { success: true, data: (orders as any[]).map(mapRawOrder) };
        }

        if (name && phone) {
            if (user?.role === 'vendedor_cobranca') {
                const orders = await db.$queryRaw`
                    SELECT * FROM orders
                    WHERE customer->>'name' ILIKE ${name}
                    AND regexp_replace(customer->>'phone', '[^0-9]', '', 'g') LIKE ${`%${phone}%`}
                    AND seller_id = ${user.id}
                    ORDER BY date DESC, created_at DESC
                    LIMIT 5000
                `;
                return { success: true, data: (orders as any[]).map(mapRawOrder) };
            }

            const orders = await db.$queryRaw`
                SELECT * FROM orders
                WHERE customer->>'name' ILIKE ${name}
                AND regexp_replace(customer->>'phone', '[^0-9]', '', 'g') LIKE ${`%${phone}%`}
                ORDER BY date DESC, created_at DESC
                LIMIT 5000
            `;
            return { success: true, data: (orders as any[]).map(mapRawOrder) };
        }

        return { success: true, data: [] as Order[] };
    } catch (error: any) {
        console.error('Error fetching customer orders:', error);
        return { success: false, error: error.message };
    }
}

// Fetch all orders with pagination support
export async function getAdminOrdersAction(limit: number = 1000) {
    try {
        const [orders, total] = await Promise.all([
            db.order.findMany({
                take: limit,
                orderBy: [
                    { date: 'desc' },
                    { createdAt: 'desc' }
                ]
            }),
            db.order.count()
        ]);

        return {
            success: true,
            data: {
                orders: orders as unknown as Order[],
                total
            }
        };
    } catch (error: any) {
        console.error('Error fetching admin orders:', error);
        return { success: false, error: error.message };
    }
}

export type BillingDashboardFilters = {
    dueFrom?: string;
    dueTo?: string;
    minAmount?: number;
    maxAmount?: number;
    customer?: string;
    status?: 'all' | 'overdue_critical' | 'overdue_warning' | 'upcoming';
};

export type BillingDashboardRow = {
    orderId: string;
    customerName: string;
    customerPhone: string;
    customerCpf: string;
    sellerId?: string | null;
    sellerName?: string | null;
    installmentNumber: number;
    dueDate: string;
    installmentAmount: number;
    paidAmount: number;
    amountDue: number;
    daysOverdue: number;
    daysUntilDue: number;
    priority: 'critical' | 'warning' | 'upcoming';
    installmentStatus: 'Pendente' | 'Parcial';
};

export type BillingDashboardSummary = {
    overdueCustomers: number;
    overdueAmount: number;
    totalOpenAmount: number;
    delinquencyRate: number;
};

export async function getBillingDashboardAction(filters: BillingDashboardFilters, user: User | null) {
    noStore();
    try {
        if (!user) throw new Error('Não autenticado.');
        const allowed = user.role === 'admin' || user.role === 'gerente' || user.role === 'vendedor_cobranca';
        if (!allowed) throw new Error('Permissão negada.');

        const dueFrom = String(filters?.dueFrom || '').trim();
        const dueTo = String(filters?.dueTo || '').trim();
        const minAmount = typeof filters?.minAmount === 'number' ? filters!.minAmount! : undefined;
        const maxAmount = typeof filters?.maxAmount === 'number' ? filters!.maxAmount! : undefined;
        const customerNeedle = String(filters?.customer || '').trim().toLowerCase();
        const status = (filters?.status || 'all') as BillingDashboardFilters['status'];

        const safeParseJson = (v: any) => {
            if (v === null || v === undefined) return v;
            if (typeof v === 'string') {
                try { return JSON.parse(v); } catch { return v; }
            }
            return v;
        };

        const startDate = dueFrom ? new Date(`${dueFrom}T00:00:00.000Z`) : null;
        const endDate = dueTo ? new Date(`${dueTo}T23:59:59.999Z`) : null;
        const now = new Date();

        const orders = await db.order.findMany({
            where: {
                status: { notIn: ['Cancelado', 'Excluído'] },
                ...(user.role === 'vendedor_cobranca' ? { sellerId: user.id } : {}),
            },
            take: 20000,
            orderBy: [
                { date: 'desc' },
                { createdAt: 'desc' },
            ],
            select: {
                id: true,
                customer: true,
                installmentDetails: true,
                sellerId: true,
                sellerName: true,
                paymentMethod: true,
            }
        });

        const rows: BillingDashboardRow[] = [];

        for (const o of orders as any[]) {
            const paymentMethod = String(o.paymentMethod || '');
            if (paymentMethod !== 'Crediário') continue;

            const customer = safeParseJson(o.customer) || {};
            const installmentDetails = safeParseJson(o.installmentDetails) || [];
            if (!Array.isArray(installmentDetails) || installmentDetails.length === 0) continue;

            const customerName = String(customer?.name || '').trim();
            const customerPhone = String(customer?.phone || '').trim();
            const customerCpf = String(customer?.cpf || customer?.id || '').replace(/\D/g, '');
            const customerHay = `${customerName} ${customerPhone}`.toLowerCase();
            if (customerNeedle && !customerHay.includes(customerNeedle)) continue;

            for (const inst of installmentDetails as any[]) {
                const st = String(inst?.status || '');
                if (st !== 'Pendente' && st !== 'Parcial') continue;

                const amount = Number(inst?.amount || 0);
                const paidAmount = Number(inst?.paidAmount || 0);
                const amountDue = amount - paidAmount;
                if (!(amountDue > 0.01)) continue;

                const dueDateRaw = String(inst?.dueDate || '').trim();
                if (!dueDateRaw) continue;
                const dueDate = new Date(dueDateRaw);
                if (isNaN(dueDate.getTime())) continue;

                if (startDate && dueDate < startDate) continue;
                if (endDate && dueDate > endDate) continue;

                if (minAmount !== undefined && amountDue < minAmount) continue;
                if (maxAmount !== undefined && amountDue > maxAmount) continue;

                const { priority, daysOverdue, daysUntilDue } = getBillingPriority(now, dueDate);
                if (!priority) continue;

                if (status && status !== 'all') {
                    if (status === 'upcoming' && priority !== 'upcoming') continue;
                    if (status === 'overdue_warning' && priority !== 'warning') continue;
                    if (status === 'overdue_critical' && priority !== 'critical') continue;
                }

                rows.push({
                    orderId: String(o.id),
                    customerName,
                    customerPhone,
                    customerCpf: customerCpf.length === 11 ? customerCpf : '',
                    sellerId: o.sellerId,
                    sellerName: o.sellerName,
                    installmentNumber: Number(inst?.installmentNumber || 0),
                    dueDate: dueDate.toISOString(),
                    installmentAmount: amount,
                    paidAmount,
                    amountDue,
                    daysOverdue,
                    daysUntilDue,
                    priority,
                    installmentStatus: st as BillingDashboardRow['installmentStatus'],
                });
            }
        }

        const critical = rows.filter((r) => r.priority === 'critical');
        const warning = rows.filter((r) => r.priority === 'warning');
        const upcoming = rows.filter((r) => r.priority === 'upcoming');

        const overdueAll = [...critical, ...warning];
        const overdueCustomers = new Set(overdueAll.map((r) => `${r.customerName}::${r.customerPhone}`)).size;
        const overdueAmount = overdueAll.reduce((acc, r) => acc + r.amountDue, 0);

        const totalOpenAmount = rows.reduce((acc, r) => acc + r.amountDue, 0);
        const delinquencyRate = totalOpenAmount > 0 ? overdueAmount / totalOpenAmount : 0;

        const summary: BillingDashboardSummary = {
            overdueCustomers,
            overdueAmount,
            totalOpenAmount,
            delinquencyRate,
        };

        return {
            success: true,
            data: {
                critical,
                warning,
                upcoming,
                summary,
                generatedAt: new Date().toISOString(),
            }
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Update Order Status
export async function updateOrderStatusAction(orderId: string, status: Order['status'], user: User | null) {
    try {
        if (user?.role === 'vendedor_cobranca') {
            throw new Error('Permissão negada: Vendedor Cobrança não pode alterar status de pedidos.');
        }
        console.log('[updateOrderStatusAction] Start', { orderId, status, userId: user?.id });

        return await db.$transaction(async (tx) => {
            const order = await tx.order.findUnique({ where: { id: orderId } });
            if (!order) throw new Error('Pedido não encontrado.');

            const currentStatus = order.status;
            const newStatus = status;

            // Define which statuses are considered "active" (items deducted from stock)
            const activeStatuses = ['Processando', 'Enviado', 'Entregue'];
            const inactiveStatuses = ['Cancelado', 'Excluído'];

            const wasActive = activeStatuses.includes(currentStatus as string);
            const isNowActive = activeStatuses.includes(newStatus as string);
            const wasInactive = inactiveStatuses.includes(currentStatus as string);
            const isNowInactive = inactiveStatuses.includes(newStatus as string);

            // Handle Stock Adjustment
            const items = (order.items as any[]) || [];
            if (wasActive && isNowInactive) {
                // Moving from Active to Inactive -> RESTORE stock
                await adjustStock(tx, items, 'restore', { orderId, user });
            } else if (wasInactive && isNowActive) {
                // Moving from Inactive to Active -> DEDUCT stock
                await adjustStock(tx, items, 'deduct', { orderId, user });
            }

            const updateData: any = { status: newStatus };

            if (newStatus === 'Entregue') {
                // Generates 5% commission automatically
                const commissionValue = (order.total || 0) * 0.05;
                updateData.commission = commissionValue;
                updateData.isCommissionManual = false;
            }

            console.log('[updateOrderStatusAction] Before update status:', currentStatus, '->', newStatus);

            const updatedOrder = await tx.order.update({
                where: { id: orderId },
                data: updateData
            });

            console.log('[updateOrderStatusAction] Success:', updatedOrder.status);

            revalidatePath('/admin/pedidos');
            notifyChange('orders');
            return { success: true, data: updatedOrder as unknown as Order };
        });

    } catch (error: any) {
        console.error('[updateOrderStatusAction] ERROR for order', orderId, '->', error.message);
        return { success: false, error: error.message };
    }
}

export async function moveOrderToTrashAction(orderId: string, user: User | null) {
    try {
        if (user?.role === 'vendedor_cobranca') {
            throw new Error('Permissão negada: Vendedor Cobrança não pode excluir pedidos.');
        }
        // Reuse status update logic to handle stock restoration correctly
        return await updateOrderStatusAction(orderId, 'Excluído', user);
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function permanentlyDeleteOrderAction(orderId: string, user: User | null) {
    try {
        if (user?.role === 'vendedor_cobranca') {
            throw new Error('Permissão negada: Vendedor Cobrança não pode excluir pedidos permanentemente.');
        }
        // 1. Check if exists first to avoid Prisma error
        const exists = await db.order.findUnique({ where: { id: orderId } });
        if (!exists) {
            console.warn(`[permanentlyDeleteOrderAction] Order ${orderId} already gone.`);
            return { success: true }; // Consider success if already gone
        }

        // 2. Delete
        await db.order.delete({
            where: { id: orderId }
        });

        revalidatePath('/admin/pedidos');
        return { success: true };
    } catch (error: any) {
        console.error('[permanentlyDeleteOrderAction] Error:', error.message);
        return { success: false, error: error.message };
    }
}

// Maps Payment method string to CashPaymentMethod
function mapPaymentMethod(method: string): string {
    const m = (method ?? '').toLowerCase();
    if (m.includes('pix')) return 'PIX';
    if (m.includes('cart') || m.includes('créd') || m.includes('cred') || m.includes('déb') || m.includes('deb')) return 'CARTAO';
    if (m.includes('dinheiro')) return 'DINHEIRO';
    return 'OUTRO';
}

// Installment Payments
export async function recordInstallmentPaymentAction(orderId: string, installmentNumber: number, payment: any, user: User | null) {
    try {
        // Check for open cash register
        const activeCash = await (db as any).cashRegister.findFirst({ where: { status: 'ABERTO' } });
        if (!activeCash) {
            return { success: false, error: 'Nenhum caixa aberto. Abra o caixa antes de registrar pagamentos.', code: 'CASH_CLOSED' };
        }

        const order = await db.order.findUnique({ where: { id: orderId } });
        if (!order) throw new Error('Order not found');

        const installments = (order.installmentDetails as any) || [];

        let isDuplicatePayment = false;
        let isQuitacao = false;

        const updatedInstallments = installments.map((inst: any) => {
            if (inst.installmentNumber === installmentNumber) {
                const isDuplicate = (inst.payments || []).some((p: any) => {
                    if (p.id === payment.id) return true;
                    const timeDiff = Math.abs(new Date(p.date).getTime() - new Date(payment.date).getTime());
                    return p.amount === payment.amount && timeDiff < 5000;
                });

                if (isDuplicate) {
                    isDuplicatePayment = true;
                    return inst;
                }

                const currentPaid = inst.paidAmount || 0;
                const newPaid = currentPaid + payment.amount;
                const newStatus = newPaid >= (inst.amount - 0.01) ? 'Pago' : 'Parcial';

                return {
                    ...inst,
                    paidAmount: newPaid,
                    status: newStatus,
                    payments: [...(inst.payments || []), payment],
                };
            }
            return inst;
        });

        if (isDuplicatePayment) {
            return { success: true };
        }

        // Check if all installments will be paid after this update (quitação)
        isQuitacao = updatedInstallments.every((inst: any) =>
            inst.status === 'Pago' || (inst.installmentNumber === installmentNumber && (inst.paidAmount + payment.amount) >= (inst.amount - 0.01))
        );

        const cashMovementType = isQuitacao ? 'QUITACAO' : 'RECEBIMENTO';
        const pmMethod = mapPaymentMethod(payment.method ?? '');

        await db.$transaction(async (tx: any) => {
            await tx.order.update({
                where: { id: orderId },
                data: { installmentDetails: updatedInstallments },
            });

            await tx.cashMovement.create({
                data: {
                    cashRegisterId: activeCash.id,
                    type: cashMovementType,
                    paymentMethod: pmMethod,
                    amount: payment.amount,
                    referenceType: 'order',
                    referenceId: orderId,
                    reason: `Parcela ${installmentNumber} — Pedido ${orderId.slice(-6).toUpperCase()}`,
                    createdById: user?.id ?? null,
                    createdByName: user?.name ?? null,
                },
            });
        });

        revalidatePath('/admin/pedidos');
        revalidatePath('/admin/caixa');
        notifyChange('orders');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Whitelist of updatable Order columns (matches schema.prisma exactly)
// Excludes: id (PK), updatedAt (@updatedAt)
const UPDATABLE_ORDER_FIELDS = [
    'customer', 'items', 'total', 'subtotal', 'discount',
    'downPayment', 'deliveryFee', 'installments', 'installmentValue',
    'date', 'createdAt', 'firstDueDate', 'status', 'paymentMethod',
    'installmentDetails', 'installmentCardDetails', 'trackingCode',
    'attachments', 'sellerId', 'sellerName', 'commission',
    'commissionDate', 'commissionPaid', 'isCommissionManual',
    'observations', 'source', 'createdById', 'createdByName',
    'createdByRole', 'createdIp', 'asaas'
];

// Update Order Details (General) - Only sends valid, updatable fields to Prisma
export async function updateOrderDetailsAction(orderId: string, data: Record<string, any>, user: User | null) {
    try {
        if (user?.role === 'vendedor_cobranca') {
            // Block sensitive fields for Vendedor Cobrança
            const restrictedFields = ['discount', 'downPayment', 'installments', 'installmentDetails', 'installmentValue', 'total', 'subtotal', 'items', 'status', 'paymentMethod', 'date', 'createdAt', 'firstDueDate'];
            const attemptedFields = Object.keys(data);

            const hasRestricted = attemptedFields.some(field => restrictedFields.includes(field));

            if (hasRestricted) {
                const illegalFields = attemptedFields.filter(f => restrictedFields.includes(f));
                if (illegalFields.length > 0) {
                    throw new Error(`Permissão negada: Vendedor Cobrança não pode alterar: ${illegalFields.join(', ')}`);
                }
            }
        }

        // Build update payload with ONLY valid DB fields
        const updateData: Record<string, any> = {};

        for (const field of UPDATABLE_ORDER_FIELDS) {
            if (data[field] !== undefined) {
                updateData[field] = data[field];
            }
        }

        // Ensure firstDueDate is stored as string (schema is String?)
        if (updateData.firstDueDate instanceof Date) {
            updateData.firstDueDate = updateData.firstDueDate.toISOString();
        }
        if (updateData.date instanceof Date) {
            updateData.date = updateData.date.toISOString();
        }
        if (updateData.createdAt instanceof Date) {
            updateData.createdAt = updateData.createdAt.toISOString();
        }

        console.log('[updateOrderDetailsAction] Updating order:', orderId, 'Fields:', Object.keys(updateData));

        const updated = await db.$transaction(async (tx) => {
            const existing = await tx.order.findUnique({ where: { id: orderId } });
            if (!existing) throw new Error('Pedido não encontrado.');

            const currentStatus = existing.status as any;
            const nextStatus = (updateData.status ?? currentStatus) as any;

            const activeStatuses = ['Processando', 'Enviado', 'Entregue'];
            const inactiveStatuses = ['Cancelado', 'Excluído'];

            const wasActive = activeStatuses.includes(String(currentStatus));
            const isNowActive = activeStatuses.includes(String(nextStatus));
            const wasInactive = inactiveStatuses.includes(String(currentStatus));
            const isNowInactive = inactiveStatuses.includes(String(nextStatus));

            const previousItems = (existing.items as any[]) || [];
            const nextItems = (updateData.items as any[]) ?? previousItems;

            if (wasActive && isNowInactive) {
                await adjustStock(tx, previousItems, 'restore', { orderId, user });
            } else if (wasInactive && isNowActive) {
                await adjustStock(tx, nextItems, 'deduct', { orderId, user });
            } else if (wasActive && isNowActive && updateData.items !== undefined) {
                const deltas = computeStockDeltas(previousItems, nextItems);
                for (const d of deltas) {
                    const delta = Number(d.delta);
                    if (!Number.isFinite(delta) || delta === 0) continue;

                    const product = await tx.product.findUnique({ where: { id: d.productId } });
                    if (!product) {
                        console.warn(`[updateOrderDetailsAction] Product ${d.productId} not found, skipping stock delta.`);
                        continue;
                    }

                    const currentStock = Number(product.stock || 0);
                    if (delta > 0) {
                        if (currentStock < delta) {
                            throw new Error(`Estoque insuficiente para o produto ${d.productId}. Atual: ${currentStock}, necessário: ${delta}`);
                        }
                        await tx.product.update({
                            where: { id: d.productId },
                            data: { stock: { decrement: delta } }
                        });
                    } else {
                        await tx.product.update({
                            where: { id: d.productId },
                            data: { stock: { increment: Math.abs(delta) } }
                        });
                    }
                }
            }

            return await tx.order.update({
                where: { id: orderId },
                data: updateData,
            });
        });

        console.log('[updateOrderDetailsAction] Success! Updated fields:', Object.keys(updateData));

        revalidatePath('/admin/pedidos');
        return { success: true, data: updated as unknown as Order };
    } catch (error: any) {
        console.error('[updateOrderDetailsAction] FAILED for order:', orderId);
        console.error('[updateOrderDetailsAction] Error:', error.message);
        console.error('[updateOrderDetailsAction] Attempted data keys:', Object.keys(data));
        return { success: false, error: error.message };
    }
}

// Update Installment Due Date
export async function updateInstallmentDueDateAction(orderId: string, installmentNumber: number, newDate: string, user: User | null) {
    try {
        const order = await db.order.findUnique({ where: { id: orderId } });
        if (!order) throw new Error('Order not found');

        const installments = (order.installmentDetails as any[]) || [];
        const updatedInstallments = installments.map((inst: any) => {
            if (inst.installmentNumber === installmentNumber) {
                return { ...inst, dueDate: newDate };
            }
            return inst;
        });

        await db.order.update({
            where: { id: orderId },
            data: { installmentDetails: updatedInstallments }
        });

        revalidatePath('/admin/pedidos');
        return { success: true };
    } catch (error: any) {
        console.error('Error updating installment date:', error);
        return { success: false, error: error.message };
    }
}

// Update Installment Amount
export async function updateInstallmentAmountAction(orderId: string, installmentNumber: number, newAmount: number, user: User | null) {
    try {
        const order = await db.order.findUnique({ where: { id: orderId } });
        if (!order) throw new Error('Order not found');

        const installments = (order.installmentDetails as any[]) || [];
        const updatedInstallments = installments.map((inst: any) => {
            if (inst.installmentNumber === installmentNumber) {
                return { ...inst, amount: newAmount };
            }
            return inst;
        });

        await db.order.update({
            where: { id: orderId },
            data: { installmentDetails: updatedInstallments }
        });

        revalidatePath('/admin/pedidos');
        return { success: true };
    } catch (error: any) {
        console.error('Error updating installment amount:', error);
        return { success: false, error: error.message };
    }
}
// Reverse Installment Payment
export async function reverseInstallmentPaymentAction(orderId: string, installmentNumber: number, paymentId: string, user: User | null) {
    try {
        if (user?.role === 'vendedor_cobranca') {
            throw new Error('Permissão negada: Vendedor Cobrança não pode realizar estornos.');
        }

        // Check for open cash register
        const activeCash = await (db as any).cashRegister.findFirst({ where: { status: 'ABERTO' } });
        if (!activeCash) {
            return { success: false, error: 'Nenhum caixa aberto. Abra o caixa antes de realizar estornos.', code: 'CASH_CLOSED' };
        }

        const order = await db.order.findUnique({ where: { id: orderId } });
        if (!order) throw new Error('Order not found');

        const installments = (order.installmentDetails as any) || [];

        // Find payment to remove first (need its amount and method for CashMovement)
        let paymentToRemove: any = null;
        for (const inst of installments) {
            if (inst.installmentNumber === installmentNumber) {
                paymentToRemove = (inst.payments || []).find((p: any) => p.id === paymentId);
                break;
            }
        }

        if (!paymentToRemove) {
            return { success: false, error: 'Pagamento não encontrado.' };
        }

        const updatedInstallments = installments.map((inst: any) => {
            if (inst.installmentNumber === installmentNumber) {
                const payments = (inst.payments || []) as any[];
                const newPaid = Math.max(0, (inst.paidAmount || 0) - paymentToRemove.amount);
                let newStatus = 'Pendente';
                if (newPaid >= (inst.amount - 0.01)) newStatus = 'Pago';
                else if (newPaid > 0) newStatus = 'Parcial';
                return {
                    ...inst,
                    paidAmount: newPaid,
                    status: newStatus,
                    payments: payments.filter((p: any) => p.id !== paymentId),
                };
            }
            return inst;
        });

        const pmMethod = mapPaymentMethod(paymentToRemove.method ?? '');

        await db.$transaction(async (tx: any) => {
            await tx.order.update({
                where: { id: orderId },
                data: { installmentDetails: updatedInstallments },
            });

            await tx.cashMovement.create({
                data: {
                    cashRegisterId: activeCash.id,
                    type: 'ESTORNO',
                    paymentMethod: pmMethod,
                    amount: paymentToRemove.amount,
                    referenceType: 'order',
                    referenceId: orderId,
                    reason: `Estorno parcela ${installmentNumber} — Pedido ${orderId.slice(-6).toUpperCase()}`,
                    createdById: user?.id ?? null,
                    createdByName: user?.name ?? null,
                },
            });
        });

        revalidatePath('/admin/pedidos');
        revalidatePath('/admin/caixa');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
