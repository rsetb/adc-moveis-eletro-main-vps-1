
'use server';

import { db } from '@/lib/db';
import type { User, CommissionPayment, FinancialFilters, FinancialReport, OverdueInstallment, FinancialReportOrder } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import {
    isValid, parse, parseISO, format,
    startOfDay, endOfDay, startOfMonth, endOfMonth,
    startOfYear, endOfYear, subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseAnyDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const trimmed = value.trim();

    const iso = parseISO(trimmed);
    if (isValid(iso)) return iso;

    const patterns = [
        'dd/MM/yy HH:mm:ss', 'dd/MM/yyyy HH:mm:ss',
        'dd/MM/yy HH:mm', 'dd/MM/yyyy HH:mm',
        'dd/MM/yy', 'dd/MM/yyyy',
    ];
    for (const pattern of patterns) {
        const d = parse(trimmed, pattern, new Date());
        if (isValid(d)) return d;
    }

    const fallback = new Date(trimmed);
    return isValid(fallback) ? fallback : null;
}

function getDateRange(filters: FinancialFilters): { start: Date; end: Date } {
    const now = new Date();
    switch (filters.period) {
        case 'today':
            return { start: startOfDay(now), end: endOfDay(now) };
        case 'week': {
            const s = new Date(now);
            s.setDate(s.getDate() - 6);
            return { start: startOfDay(s), end: endOfDay(now) };
        }
        case 'month':
            return { start: startOfMonth(now), end: endOfMonth(now) };
        case 'year':
            return { start: startOfYear(now), end: endOfYear(now) };
        case 'custom': {
            const s = filters.dateFrom ? startOfDay(new Date(filters.dateFrom + 'T12:00:00')) : startOfMonth(now);
            const e = filters.dateTo ? endOfDay(new Date(filters.dateTo + 'T12:00:00')) : endOfDay(now);
            return { start: s, end: e };
        }
        default:
            return { start: startOfMonth(now), end: endOfMonth(now) };
    }
}

// ─── Commission actions (unchanged) ─────────────────────────────────────────

export async function payCommissionAction(
    sellerId: string, sellerName: string, amount: number,
    orderIds: string[], period: string, user: User | null,
) {
    try {
        const payment = await db.$transaction(async (tx: any) => {
            const newPayment = await tx.commissionPayment.create({
                data: { sellerId, sellerName, amount, period, paymentDate: new Date().toISOString(), orderIds: orderIds as any },
            });
            if (orderIds.length > 0) {
                await tx.order.updateMany({
                    where: { id: { in: orderIds } },
                    data: { commissionPaid: true, commissionDate: new Date().toISOString() },
                });
            }
            return newPayment;
        });
        revalidatePath('/admin/financeiro');
        revalidatePath('/admin/minhas-comissoes');
        return { success: true, data: payment.id };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function reverseCommissionPaymentAction(paymentId: string, user: User | null) {
    try {
        if (user?.role === 'vendedor_cobranca') throw new Error('Permissão negada.');
        await db.$transaction(async (tx: any) => {
            const payment = await tx.commissionPayment.findUnique({ where: { id: paymentId } });
            if (!payment) throw new Error('Payment not found');
            const orderIds = payment.orderIds as string[];
            if (orderIds?.length > 0) {
                await tx.order.updateMany({
                    where: { id: { in: orderIds } },
                    data: { commissionPaid: false, commissionDate: null },
                });
            }
            await tx.commissionPayment.delete({ where: { id: paymentId } });
        });
        revalidatePath('/admin/financeiro');
        revalidatePath('/admin/minhas-comissoes');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getCommissionPaymentsAction() {
    try {
        const payments = await db.commissionPayment.findMany({ orderBy: { paymentDate: 'desc' } });
        return { success: true, data: payments as unknown as CommissionPayment[] };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ─── Real financial summary ──────────────────────────────────────────────────

export async function getFinancialSummaryAction(
    filters: FinancialFilters,
): Promise<{ success: boolean; data?: FinancialReport; error?: string }> {
    try {
        const { start, end } = getDateRange(filters);
        const today = startOfDay(new Date());
        const activeStatuses = ['Processando', 'Enviado', 'Entregue'];

        // Load all active orders via Prisma ORM (no raw SQL, fully PostgreSQL-safe)
        const allOrders = await db.order.findMany({
            where: { status: { in: activeStatuses } },
            orderBy: { createdAt: 'desc' },
        });

        // Load commission payments
        const commPayments = await db.commissionPayment.findMany({
            orderBy: { paymentDate: 'desc' },
        });

        // Build product cost map for profit estimation
        const products = await db.product.findMany({
            where: { deletedAt: null },
            select: { id: true, cost: true },
        });
        const costMap = new Map(products.map(p => [p.id, Number(p.cost ?? 0)]));

        // Filter orders by their order date within the selected period
        const periodOrders = allOrders.filter(o => {
            const d = parseAnyDate(o.date);
            return d && d >= start && d <= end;
        });

        // ── Metrics accumulation ────────────────────────────────────────────
        let totalVendido = 0;
        let totalRecebido = 0;
        let totalEmAberto = 0;
        let totalVencido = 0;
        let custoTotal = 0;
        let comissoesGeradas = 0;
        let parcelasVencidas = 0;
        const overdueInstallments: OverdueInstallment[] = [];

        for (const order of periodOrders) {
            const total = Number(order.total || 0);
            totalVendido += total;
            comissoesGeradas += Number(order.commission || 0);

            // Estimated cost from items (approximate — cost may have changed since sale)
            const items: any[] = Array.isArray(order.items) ? (order.items as any[]) : [];
            for (const item of items) {
                const unitCost = costMap.get(item.id) ?? 0;
                custoTotal += unitCost * Number(item.quantity || 1);
            }

            // Down payment counts as received for crediário orders
            if (order.paymentMethod === 'Crediário') {
                totalRecebido += Number(order.downPayment || 0);
            }

            const installments: any[] = Array.isArray(order.installmentDetails)
                ? (order.installmentDetails as any[])
                : [];
            const customer: any = order.customer ?? {};

            if (installments.length > 0) {
                for (const inst of installments) {
                    const amount = Number(inst?.amount || 0);
                    const paid = Number(inst?.paidAmount || 0);
                    const remaining = Math.max(0, amount - paid);
                    totalRecebido += paid;

                    if (inst?.status !== 'Pago') {
                        totalEmAberto += remaining;
                        const due = inst?.dueDate ? new Date(inst.dueDate) : null;
                        if (due && due < today) {
                            totalVencido += remaining;
                            parcelasVencidas++;
                            if (overdueInstallments.length < 200) {
                                overdueInstallments.push({
                                    orderId: order.id,
                                    customerName: customer?.name ?? '',
                                    sellerName: order.sellerName ?? undefined,
                                    installmentNumber: Number(inst.installmentNumber),
                                    dueDate: inst.dueDate,
                                    amount,
                                    paidAmount: paid,
                                    remaining,
                                });
                            }
                        }
                    }
                }
            } else if (order.paymentMethod !== 'Crediário') {
                // No installment records → non-crediário, full amount received
                totalRecebido += total;
            }
        }

        // Commission paid within the selected period
        const comissoesPagas = commPayments
            .filter(cp => {
                const d = parseAnyDate(cp.paymentDate);
                return d && d >= start && d <= end;
            })
            .reduce((s, cp) => s + Number(cp.amount || 0), 0);

        // ── Monthly chart data — last 12 months (independent of filter) ────
        const twelveMonthsAgo = subMonths(startOfMonth(new Date()), 11);
        const monthlyMap: Record<string, { label: string; vendido: number; recebido: number }> = {};

        for (const order of allOrders) {
            const d = parseAnyDate(order.date);
            if (!d || d < twelveMonthsAgo) continue;

            const sortKey = format(d, 'yyyy-MM');
            const label = format(d, 'MMM/yy', { locale: ptBR });
            if (!monthlyMap[sortKey]) monthlyMap[sortKey] = { label, vendido: 0, recebido: 0 };
            monthlyMap[sortKey].vendido += Number(order.total || 0);

            if (order.paymentMethod === 'Crediário') {
                monthlyMap[sortKey].recebido += Number(order.downPayment || 0);
            }
            const insts: any[] = Array.isArray(order.installmentDetails)
                ? (order.installmentDetails as any[])
                : [];
            if (insts.length > 0) {
                for (const inst of insts) monthlyMap[sortKey].recebido += Number(inst?.paidAmount || 0);
            } else if (order.paymentMethod !== 'Crediário') {
                monthlyMap[sortKey].recebido += Number(order.total || 0);
            }
        }

        const monthlyData = Object.entries(monthlyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, v]) => ({ name: v.label, vendido: v.vendido, recebido: v.recebido }));

        // ── Recent orders for the period ────────────────────────────────────
        const recentOrders: FinancialReportOrder[] = periodOrders.slice(0, 100).map(o => ({
            id: o.id,
            customerName: ((o.customer as any)?.name ?? ''),
            sellerName: o.sellerName ?? undefined,
            total: Number(o.total || 0),
            date: o.date,
            status: o.status,
            paymentMethod: o.paymentMethod ?? '',
            downPayment: Number(o.downPayment || 0),
            commission: Number(o.commission || 0),
        }));

        // Sort overdue by most overdue first
        overdueInstallments.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

        return {
            success: true,
            data: {
                totalVendido,
                totalRecebido,
                totalEmAberto,
                totalVencido,
                lucroBruto: Math.max(0, totalVendido - custoTotal),
                custoTotal,
                comissoesGeradas,
                comissoesPagas,
                totalPedidos: periodOrders.length,
                parcelasVencidas,
                monthlyData,
                overdueInstallments,
                recentOrders,
            },
        };
    } catch (error: any) {
        console.error('[getFinancialSummaryAction]', error);
        return { success: false, error: error.message };
    }
}
