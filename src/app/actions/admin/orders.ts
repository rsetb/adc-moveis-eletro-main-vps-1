'use server';

import { mapRawOrder } from '@/lib/order-record';
import { Prisma } from '@prisma/client';
import { normalizeOrderSearch } from '@/lib/order-search';
import { matchCode, matchCpf, matchName, matchPhoneTail } from '@/lib/customer-match';
import { db } from '@/lib/db';
import type { Order, User } from '@/lib/types';
import { revalidatePath, unstable_noStore as noStore } from 'next/cache';
import { computeStockDeltas, getBillingPriority } from '@/lib/utils';
import { notifyChange } from '@/lib/change-notifier';
import { getSession } from '@/lib/session';

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

// Imported historical rows can contain a JSON string instead of a JSON object.
const customerJson = Prisma.sql`(CASE WHEN jsonb_typeof(customer::jsonb) = 'string' THEN (customer #>> '{}')::jsonb ELSE customer::jsonb END)`;

// Expressões para comparar o snapshot `customer` gravado no pedido com o cadastro atual.
// Espelham as normalizações de '@/lib/customer-match' (dígitos, zeros à esquerda, acentos).
const snapId = Prisma.sql`trim(coalesce(${customerJson}->>'id', ''))`;
const snapCpfDigits = Prisma.sql`regexp_replace(coalesce(${customerJson}->>'cpf', ''), '[^0-9]', '', 'g')`;
const snapCodeRaw = Prisma.sql`lower(trim(coalesce(${customerJson}->>'code', '')))`;
const snapCodeDigits = Prisma.sql`regexp_replace(coalesce(${customerJson}->>'code', ''), '[^0-9]', '', 'g')`;
const snapPhoneDigits = Prisma.sql`regexp_replace(coalesce(${customerJson}->>'phone', ''), '[^0-9]', '', 'g')`;
const snapName = Prisma.sql`regexp_replace(translate(lower(trim(coalesce(${customerJson}->>'name', ''))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '[[:space:]]+', ' ', 'g')`;

async function orderVisibility() {
    const session = await getSession();
    if (!session) throw new Error('Entre no sistema para consultar pedidos.');
    return session.role === 'vendedor_cobranca'
        ? Prisma.sql`(seller_id = ${session.userId} OR created_by_id = ${session.userId})`
        : Prisma.sql`TRUE`;
}

export async function searchOrdersAction(term: string) {
    if (!term || term.trim().length < 3) return { success: true, data: [] };
    try {
        const visibility = await orderVisibility();
        const tokens = normalizeOrderSearch(term).split(' ').filter(Boolean).slice(0, 20);
        const text = Prisma.sql`translate(lower(concat_ws(' ', id, ${customerJson}->>'name', ${customerJson}->>'code', ${customerJson}->>'cpf', ${customerJson}->>'phone')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')`;
        const conditions = tokens.map(token => Prisma.sql`strpos(${text}, ${token}) > 0`);
        const orders = await db.$queryRaw<any[]>(Prisma.sql`SELECT * FROM orders WHERE ${visibility} AND ${Prisma.join(conditions, ' AND ')} ORDER BY date DESC, created_at DESC`);
        return { success: true, data: orders.map(mapRawOrder) };
    } catch (error: any) {
        console.error('Error searching orders:', error);
        return { success: false, error: 'Não foi possível consultar os pedidos. Tente novamente.' };
    }
}

export async function getCustomerOrdersAction(customer: { cpf?: string; id?: string; code?: string; name?: string; phone?: string }, _user: User | null) {
    try {
        const visibility = await orderVisibility();
        const id = String(customer.id || '').trim();
        const cpf = matchCpf(customer.cpf);          // 11 dígitos, zeros à esquerda restaurados
        const codeRaw = String(customer.code || '').trim().toLowerCase();
        const code = matchCode(customer.code);        // 5 dígitos ('5581' -> '05581')
        const name = matchName(customer.name);        // minúsculo, sem acento, espaços colapsados
        const phoneTail = matchPhoneTail(customer.phone); // últimos 8 dígitos

        const matches: Prisma.Sql[] = [];
        if (id) matches.push(Prisma.sql`${snapId} = ${id}`);
        if (cpf) {
            // Pedidos importados de sistemas antigos guardam o CPF no próprio campo `id`.
            matches.push(Prisma.sql`(
                (${snapCpfDigits} <> '' AND lpad(${snapCpfDigits}, 11, '0') = ${cpf})
                OR (${snapId} ~ '^[0-9]{9,11}$' AND lpad(${snapId}, 11, '0') = ${cpf})
            )`);
        }
        // Código exato: comportamento anterior, preservado.
        if (codeRaw) matches.push(Prisma.sql`${snapCodeRaw} = ${codeRaw}`);
        // Código normalizado (sem zeros à esquerda, gravado como número, com prefixo CLI-).
        // Exige nome OU telefone conferindo, porque a importação de clientes realoca códigos:
        // um código antigo no snapshot pode hoje pertencer a outro cliente.
        if (code && (name || phoneTail)) {
            const corroboration: Prisma.Sql[] = [];
            if (name) corroboration.push(Prisma.sql`${snapName} = ${name}`);
            if (phoneTail) corroboration.push(Prisma.sql`(length(${snapPhoneDigits}) >= 8 AND right(${snapPhoneDigits}, 8) = ${phoneTail})`);
            matches.push(Prisma.sql`(
                ${snapCodeDigits} <> '' AND length(${snapCodeDigits}) <= 5 AND lpad(${snapCodeDigits}, 5, '0') = ${code}
                AND (${Prisma.join(corroboration, ' OR ')})
            )`);
        }
        // Este casamento antes só entrava quando não havia id/cpf/código - ou seja, nunca,
        // porque cliente vindo do cadastro sempre tem id. Agora é aditivo: pedido cujo snapshot
        // ficou com id/código antigos (importação, recadastro, CPF em branco) volta a aparecer.
        if (name && phoneTail) matches.push(Prisma.sql`(${snapName} = ${name} AND length(${snapPhoneDigits}) >= 8 AND right(${snapPhoneDigits}, 8) = ${phoneTail})`);
        if (!matches.length) return { success: true, data: [] as Order[] };
        const orders = await db.$queryRaw<any[]>(Prisma.sql`SELECT * FROM orders WHERE ${visibility} AND (${Prisma.join(matches, ' OR ')}) ORDER BY date DESC, created_at DESC`);
        return { success: true, data: orders.map(mapRawOrder) };
    } catch (error: any) {
        console.error('Error fetching customer orders:', error);
        return { success: false, error: 'Não foi possível consultar os pedidos deste cliente.' };
    }
}

export async function getAdminOrdersAction(limit: number = 1000) {
    try {
        const session = await getSession();
        // Vendedor Cobrança só vê os próprios pedidos (criados por ele ou onde é o vendedor).
        // Deriva do cookie de sessão, não de parâmetro do cliente.
        const where = session?.role === 'vendedor_cobranca'
            ? { OR: [{ sellerId: session.userId }, { createdById: session.userId }] }
            : {};

        const [orders, total] = await Promise.all([
            db.order.findMany({
                where,
                take: limit,
                orderBy: [
                    { date: 'desc' },
                    { createdAt: 'desc' }
                ]
            }),
            db.order.count({ where })
        ]);

        return {
            success: true,
            data: {
                orders: orders.map(mapRawOrder),
                total
            }
        };
    } catch (error: any) {
        console.error('Error fetching admin orders:', error);
        return { success: false, error: error.message };
    }
}

const MAX_PRINT_LOG_ENTRIES = 50;

export async function recordOrderPrintAction(orderId: string, user: User | null) {
    try {
        const order = await db.order.findUnique({ where: { id: orderId }, select: { printLogs: true } });
        if (!order) return { success: false, error: 'Pedido não encontrado.' };

        const existing = Array.isArray(order.printLogs) ? order.printLogs as any[] : [];
        const entry = {
            userId: user?.id ?? null,
            userName: user?.name ?? 'Desconhecido',
            printedAt: new Date().toISOString(),
        };
        const nextLogs = [...existing, entry].slice(-MAX_PRINT_LOG_ENTRIES);

        await db.order.update({ where: { id: orderId }, data: { printLogs: nextLogs } });
        return { success: true };
    } catch (error: any) {
        console.error('Error recording order print:', error);
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
        // Exclusão permanente é restrita a admin (a UI já só mostra o botão pra admin;
        // isso garante que a regra vale mesmo chamando a action diretamente).
        const session = await getSession();
        if (!session || session.role !== 'admin') {
            throw new Error('Permissão negada: apenas administradores podem excluir pedidos permanentemente.');
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
    if (user?.role === 'vendedor_externo') {
        return { success: false, error: 'Vendedor Externo não pode dar baixa em parcela. Apenas admin, vendedor e gerente.' };
    }

    // Concurrency note: two payments hitting the same order at nearly the same
    // moment (e.g. two clicks, or two staff members) used to race — both would
    // read the order before either wrote back, so whichever transaction
    // committed last silently overwrote the other's change and the earlier
    // payment vanished with no error shown. Serializable isolation makes the
    // DB detect that conflict and fail one of the transactions instead of
    // losing data; we retry that one automatically.
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            // Check for open cash register
            const activeCash = await (db as any).cashRegister.findFirst({ where: { status: 'ABERTO' } });
            if (!activeCash) {
                return { success: false, error: 'Nenhum caixa aberto. Abra o caixa antes de registrar pagamentos.', code: 'CASH_CLOSED' };
            }

            const result = await db.$transaction(async (tx: any) => {
                const order = await tx.order.findUnique({ where: { id: orderId } });
                if (!order) throw new Error('Order not found');

                const installments = (order.installmentDetails as any) || [];

                let isDuplicatePayment = false;

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
                    return { skipped: true };
                }

                // Check if all installments will be paid after this update (quitação)
                const isQuitacao = updatedInstallments.every((inst: any) =>
                    inst.status === 'Pago' || (inst.installmentNumber === installmentNumber && (inst.paidAmount + payment.amount) >= (inst.amount - 0.01))
                );

                const cashMovementType = isQuitacao ? 'QUITACAO' : 'RECEBIMENTO';
                const pmMethod = mapPaymentMethod(payment.method ?? '');

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

                return { skipped: false };
            }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 15000 });

            revalidatePath('/admin/pedidos');
            revalidatePath('/admin/caixa');
            notifyChange('orders');
            return { success: true, skipped: result.skipped };
        } catch (error: any) {
            const isSerializationConflict =
                error?.code === 'P2034' ||
                /could not serialize|deadlock|Transaction failed due to a write conflict/i.test(String(error?.message || ''));
            if (isSerializationConflict && attempt < MAX_ATTEMPTS) {
                continue;
            }
            return { success: false, error: error.message };
        }
    }
    return { success: false, error: 'Falha ao registrar pagamento após múltiplas tentativas. Tente novamente.' };
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

export type DeletedOrderRow = {
    id: string;
    customerName: string;
    customerCpf: string;
    total: number;
    orderDate: string;
    deletedBy: string | null;
    deletedAt: string | null;
};

export async function getDeletedOrdersWithAuditAction(): Promise<{ success: boolean; data?: DeletedOrderRow[]; error?: string }> {
    noStore();
    try {
        const session = await getSession();
        if (!session) throw new Error('Não autenticado.');

        // Fetch deleted orders and audit logs in two separate fast queries, then join in memory
        const [orderRows, auditRows] = await Promise.all([
            db.$queryRaw<any[]>(Prisma.sql`
                SELECT
                    id,
                    (CASE WHEN jsonb_typeof(customer::jsonb) = 'string' THEN (customer #>> '{}')::jsonb ELSE customer::jsonb END)->>'name' AS customer_name,
                    (CASE WHEN jsonb_typeof(customer::jsonb) = 'string' THEN (customer #>> '{}')::jsonb ELSE customer::jsonb END)->>'cpf' AS customer_cpf,
                    total,
                    date AS order_date
                FROM orders
                WHERE status ILIKE '%exclu%' AND id ILIKE 'PED-%'
                ORDER BY date DESC
            `),
            db.$queryRaw<any[]>(Prisma.sql`
                SELECT
                    substring(details from 'PED-[0-9]+') AS order_id,
                    user_name,
                    timestamp
                FROM audit_logs
                WHERE action ILIKE '%Exclus%' AND details ILIKE '%PED-%'
                ORDER BY timestamp DESC
            `),
        ]);

        // Build a map: orderId -> latest deletion audit entry
        const auditMap = new Map<string, { user_name: string; timestamp: any }>();
        for (const row of auditRows) {
            if (row.order_id && !auditMap.has(row.order_id)) {
                auditMap.set(row.order_id, row);
            }
        }

        const data: DeletedOrderRow[] = orderRows.map(r => {
            const audit = auditMap.get(String(r.id));
            return {
                id: String(r.id),
                customerName: String(r.customer_name || ''),
                customerCpf: String(r.customer_cpf || ''),
                total: Number(r.total || 0),
                orderDate: r.order_date ? new Date(r.order_date).toISOString() : '',
                deletedBy: audit?.user_name ? String(audit.user_name) : null,
                deletedAt: audit?.timestamp ? new Date(audit.timestamp).toISOString() : null,
            };
        });

        return { success: true, data };
    } catch (error: any) {
        console.error('[getDeletedOrdersWithAuditAction]', error);
        return { success: false, error: error.message };
    }
}

export async function restoreDeletedOrderAction(orderId: string, status: string): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getSession();
        if (!session) throw new Error('Não autenticado.');
        if (session.role !== 'admin' && session.role !== 'gerente') throw new Error('Permissão negada.');

        await db.$executeRaw(Prisma.sql`
            UPDATE orders SET status = ${status}, updated_at = NOW() WHERE id = ${orderId}
        `);

        revalidatePath('/admin/pedidos');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
