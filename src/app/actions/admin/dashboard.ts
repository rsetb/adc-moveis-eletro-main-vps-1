'use server';

import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import {
    startOfDay, endOfDay, startOfMonth, endOfMonth,
    subDays, format, isValid, parseISO, parse,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { unstable_noStore as noStore } from 'next/cache';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DashboardKpis = {
    vendasHoje: { total: number; count: number };
    vendasMes: { total: number; count: number };
    recebidoHoje: number;
    ticketMedio: number;
    clientesInadimplentes: number;
    parcelasVencidas: { count: number; total: number };
    pedidosPendentes: number;
    estoqueCritico: number;
};

export type DashboardChartPoint = {
    data: string;
    vendas: number;
    recebido: number;
};

export type DashboardTopProduct = {
    id: string;
    name: string;
    qtd: number;
    total: number;
};

export type DashboardRecentOrder = {
    id: string;
    customerName: string;
    total: number;
    status: string;
    date: string;
    paymentMethod: string;
};

export type DashboardOverdueToday = {
    orderId: string;
    customerName: string;
    customerPhone: string;
    installmentNumber: number;
    amount: number;
    remaining: number;
    dueDate: string;
};

export type DashboardData = {
    kpis: DashboardKpis;
    chart30dias: DashboardChartPoint[];
    topProdutos: DashboardTopProduct[];
    ultimosPedidos: DashboardRecentOrder[];
    cobrancasHoje: DashboardOverdueToday[];
    generatedAt: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseAnyDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const t = value.trim();
    const iso = parseISO(t);
    if (isValid(iso)) return iso;
    const patterns = [
        'dd/MM/yy HH:mm:ss', 'dd/MM/yyyy HH:mm:ss',
        'dd/MM/yy HH:mm',    'dd/MM/yyyy HH:mm',
        'dd/MM/yy',          'dd/MM/yyyy',
    ];
    for (const p of patterns) {
        const d = parse(t, p, new Date());
        if (isValid(d)) return d;
    }
    const fb = new Date(t);
    return isValid(fb) ? fb : null;
}

function safeJson(v: any): any {
    if (v === null || v === undefined) return v;
    if (typeof v === 'string') {
        try { return JSON.parse(v); } catch { return v; }
    }
    return v;
}

// ─── Main action ─────────────────────────────────────────────────────────────

export async function getDashboardDataAction(): Promise<{ success: boolean; data?: DashboardData; error?: string }> {
    noStore();

    // SEC-01: Validate session and role before any DB access
    const session = await getSession();
    if (!session) return { success: false, error: 'Não autenticado.' };
    if (session.role === 'vendedor_externo') return { success: false, error: 'Sem permissão para acessar o dashboard.' };

    try {
        const now = new Date();
        const todayStart  = startOfDay(now);
        const todayEnd    = endOfDay(now);
        const monthStart  = startOfMonth(now);
        const monthEnd    = endOfMonth(now);
        const thirtyDaysAgo = startOfDay(subDays(now, 29));

        // ── Parallel queries ───────────────────────────────────────────────
        //
        // DAT-01: Two separate order queries with different scopes:
        //   recentOrders    → last 90 days, for sales metrics / chart / top products
        //   allCreditOrders → ALL active crediário orders, for installment analysis
        //
        const [recentOrders, allCreditOrders, pendingCount, allProducts, cashMovementsToday] = await Promise.all([

            // Sales data — last 90 days
            db.order.findMany({
                where: {
                    status: { notIn: ['Cancelado', 'Excluído'] },
                    createdAt: { gte: subDays(now, 89) },
                },
                select: {
                    id: true,
                    customer: true,
                    items: true,
                    total: true,
                    downPayment: true,
                    date: true,
                    status: true,
                    paymentMethod: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
                take: 3000,
            }),

            // ALL active crediário orders — no date limit (DAT-01)
            // Minimal select: only the 3 fields needed for installment analysis
            db.order.findMany({
                where: {
                    status: { notIn: ['Cancelado', 'Excluído'] },
                    paymentMethod: 'Crediário',
                },
                select: {
                    id: true,
                    customer: true,
                    installmentDetails: true,
                },
            }),

            db.temporaryOrder.count({ where: { deletedAt: null } }),

            db.product.findMany({
                where: { deletedAt: null },
                select: { id: true, name: true, stock: true, minStock: true },
            }),

            // DAT-02: Only today's cash movements (used for recebidoHoje)
            db.cashMovement.findMany({
                where: { createdAt: { gte: todayStart, lte: todayEnd } },
                select: { type: true, amount: true },
            }),
        ]);

        // ── Estoque crítico ────────────────────────────────────────────────
        const estoqueCritico = allProducts.filter(
            p => p.minStock != null && p.stock <= p.minStock
        ).length;

        // ── Recebido hoje (DAT-02: somente recebimentos reais de clientes) ─
        // ABERTURA (fundo de caixa) e SUPRIMENTO (transferência interna) excluídos
        const recebidoHoje = cashMovementsToday.reduce((sum, m) => {
            const amt = Number(m.amount || 0);
            if (['RECEBIMENTO', 'ENTRADA_PEDIDO', 'QUITACAO'].includes(m.type)) return sum + amt;
            if (['SANGRIA', 'ESTORNO'].includes(m.type)) return sum - amt;
            return sum;
        }, 0);

        // ── Process RECENT ORDERS (sales, chart, top products) ────────────
        let vendasHojeTotal = 0;
        let vendasHojeCount = 0;
        let vendasMesTotal  = 0;
        let vendasMesCount  = 0;

        // chart30Map indexed by 'yyyy-MM-dd'
        const chart30Map: Record<string, { vendas: number; recebido: number }> = {};
        const prodMap: Record<string, { name: string; qtd: number; total: number }> = {};

        for (const o of recentOrders) {
            const orderDate = parseAnyDate(o.date);
            const total     = Number(o.total || 0);

            // ── Vendas hoje ──
            if (orderDate && orderDate >= todayStart && orderDate <= todayEnd) {
                vendasHojeTotal += total;
                vendasHojeCount++;
            }

            // ── Vendas mês ──
            if (orderDate && orderDate >= monthStart && orderDate <= monthEnd) {
                vendasMesTotal += total;
                vendasMesCount++;
            }

            // ── Chart: faturado + recebido parcial ──
            if (orderDate && orderDate >= thirtyDaysAgo) {
                const key = format(orderDate, 'yyyy-MM-dd');
                if (!chart30Map[key]) chart30Map[key] = { vendas: 0, recebido: 0 };

                chart30Map[key].vendas += total;

                if (o.paymentMethod !== 'Crediário') {
                    // Non-crediário: full amount received on order date
                    chart30Map[key].recebido += total;
                } else {
                    // Crediário: only the entry payment (downPayment) goes on order date
                    // Installment payments are handled separately via actual payment dates (DAT-03)
                    chart30Map[key].recebido += Number(o.downPayment || 0);
                }
            }

            // ── Top produtos (últimos 30 dias) ──
            if (orderDate && orderDate >= thirtyDaysAgo) {
                const items: any[] = Array.isArray(safeJson(o.items)) ? safeJson(o.items) : [];
                for (const item of items) {
                    if (!item?.id || String(item.id).startsWith('CUSTOM-')) continue;
                    const qty   = Number(item.quantity || 0);
                    const price = Number(item.price    || 0);
                    if (qty <= 0) continue;
                    if (!prodMap[item.id]) prodMap[item.id] = { name: item.name || item.id, qtd: 0, total: 0 };
                    prodMap[item.id].qtd   += qty;
                    prodMap[item.id].total += qty * price;
                }
            }
        }

        // ── Process ALL CREDIT ORDERS (installment analysis — DAT-01) ─────
        let parcelasVencidasCount = 0;
        let parcelasVencidasTotal = 0;
        const inadimplenteSet = new Set<string>();
        const cobrancasHoje: DashboardOverdueToday[] = [];

        for (const o of allCreditOrders) {
            const customer: any = safeJson(o.customer) || {};
            const installments: any[] = Array.isArray(safeJson(o.installmentDetails))
                ? safeJson(o.installmentDetails)
                : [];

            for (const inst of installments) {
                if (inst?.status === 'Pago') continue;

                const dueDate   = inst?.dueDate ? parseAnyDate(inst.dueDate) : null;
                const amount    = Number(inst?.amount    || 0);
                const paid      = Number(inst?.paidAmount || 0);
                const remaining = Math.max(0, amount - paid);

                // ── Parcelas vencidas ──
                if (dueDate && dueDate < todayStart) {
                    parcelasVencidasCount++;
                    parcelasVencidasTotal += remaining;
                    if (customer?.name) {
                        inadimplenteSet.add(customer.name + (customer?.cpf || customer?.id || ''));
                    }
                }

                // ── Cobranças vencendo hoje ──
                if (dueDate && dueDate >= todayStart && dueDate <= todayEnd) {
                    cobrancasHoje.push({
                        orderId: o.id,
                        customerName: customer?.name   ?? '',
                        customerPhone: customer?.phone ?? '',
                        installmentNumber: Number(inst?.installmentNumber || 0),
                        amount,
                        remaining,
                        dueDate: inst.dueDate,
                    });
                }

                // ── DAT-03: Chart recebido por data real do pagamento ──────
                // Each payment inside the installment has its own date
                const instPayments: any[] = Array.isArray(inst?.payments) ? inst.payments : [];
                for (const payment of instPayments) {
                    const payDate = parseAnyDate(payment?.date);
                    if (!payDate || payDate < thirtyDaysAgo || payDate > now) continue;
                    const payKey = format(payDate, 'yyyy-MM-dd');
                    if (!chart30Map[payKey]) chart30Map[payKey] = { vendas: 0, recebido: 0 };
                    chart30Map[payKey].recebido += Number(payment?.amount || 0);
                }
            }
        }

        // ── Build 30-day chart array (fill gaps with zero) ────────────────
        const chart30dias: DashboardChartPoint[] = [];
        for (let i = 29; i >= 0; i--) {
            const day = subDays(now, i);
            const key   = format(day, 'yyyy-MM-dd');
            const label = format(day, 'dd/MM', { locale: ptBR });
            chart30dias.push({
                data:     label,
                vendas:   chart30Map[key]?.vendas   ?? 0,
                recebido: chart30Map[key]?.recebido ?? 0,
            });
        }

        // ── Top 10 produtos ───────────────────────────────────────────────
        const topProdutos: DashboardTopProduct[] = Object.entries(prodMap)
            .map(([id, v]) => ({ id, ...v }))
            .sort((a, b) => b.qtd - a.qtd)
            .slice(0, 10);

        // ── Últimos 10 pedidos (already ordered by createdAt desc) ────────
        const ultimosPedidos: DashboardRecentOrder[] = recentOrders.slice(0, 10).map(o => ({
            id:            o.id,
            customerName:  (safeJson(o.customer) as any)?.name ?? '',
            total:         Number(o.total || 0),
            status:        o.status,
            date:          o.date,
            paymentMethod: o.paymentMethod ?? '',
        }));

        // ── Ticket médio (mês atual) ──────────────────────────────────────
        const ticketMedio = vendasMesCount > 0 ? vendasMesTotal / vendasMesCount : 0;

        return {
            success: true,
            data: {
                kpis: {
                    vendasHoje:            { total: vendasHojeTotal, count: vendasHojeCount },
                    vendasMes:             { total: vendasMesTotal,  count: vendasMesCount  },
                    recebidoHoje,
                    ticketMedio,
                    clientesInadimplentes: inadimplenteSet.size,
                    parcelasVencidas:      { count: parcelasVencidasCount, total: parcelasVencidasTotal },
                    pedidosPendentes:      pendingCount,
                    estoqueCritico,
                },
                chart30dias,
                topProdutos,
                ultimosPedidos,
                cobrancasHoje,
                generatedAt: now.toISOString(),
            },
        };
    } catch (error: any) {
        console.error('[getDashboardDataAction]', error);
        return { success: false, error: error.message };
    }
}
