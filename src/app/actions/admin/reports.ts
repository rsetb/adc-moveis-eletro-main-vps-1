'use server';

import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import {
    startOfDay, endOfDay, startOfMonth, endOfMonth,
    startOfYear, endOfYear, subDays, subMonths, format,
    isValid, parseISO, parse, differenceInDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { unstable_noStore as noStore } from 'next/cache';
import type { FinancialPeriod } from '@/lib/types';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function parseAnyDate(v: string | null | undefined): Date | null {
    if (!v) return null;
    const t = v.trim();
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
    if (typeof v === 'string') { try { return JSON.parse(v); } catch { return v; } }
    return v;
}

function getRange(period: FinancialPeriod, from?: string, to?: string) {
    const now = new Date();
    switch (period) {
        case 'today':
            return { start: startOfDay(now), end: endOfDay(now), label: 'Hoje' };
        case 'week':
            return { start: subDays(startOfDay(now), 6), end: endOfDay(now), label: 'Últimos 7 dias' };
        case 'month':
            return { start: startOfMonth(now), end: endOfMonth(now), label: format(now, 'MMMM/yyyy', { locale: ptBR }) };
        case 'year':
            return { start: startOfYear(now), end: endOfYear(now), label: String(now.getFullYear()) };
        case 'custom': {
            const s = from ? startOfDay(new Date(from + 'T12:00:00')) : startOfMonth(now);
            const e = to   ? endOfDay(new Date(to   + 'T12:00:00')) : endOfDay(now);
            return { start: s, end: e, label: `${format(s, 'dd/MM/yy')} – ${format(e, 'dd/MM/yy')}` };
        }
        default:
            return { start: startOfMonth(now), end: endOfMonth(now), label: format(now, 'MMMM/yyyy', { locale: ptBR }) };
    }
}

const ACTIVE = ['Processando', 'Enviado', 'Entregue'];
const NON_DELETED = ['Processando', 'Enviado', 'Entregue', 'Cancelado'];

// ─── SALES REPORT ─────────────────────────────────────────────────────────────

export type SalesReportFilters = {
    period: FinancialPeriod;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    sellerId?: string;
    customerSearch?: string;
};

export type SalesByDay      = { date: string; label: string; total: number; count: number };
export type SalesBySeller   = { sellerId: string; sellerName: string; total: number; count: number; commission: number };
export type SalesByStatus   = { status: string; total: number; count: number };
export type SalesOrderRow   = { id: string; customerName: string; total: number; status: string; date: string; paymentMethod: string; sellerName: string };

export type SalesReportData = {
    kpis: { totalVendido: number; totalRecebido: number; totalEmAberto: number; quantidadePedidos: number; ticketMedio: number; lucroBruto: number; custoTotal: number };
    vendasPorDia: SalesByDay[];
    vendasPorVendedor: SalesBySeller[];
    vendasPorStatus: SalesByStatus[];
    ultimosPedidos: SalesOrderRow[];
    sellers: { id: string; name: string }[];
    periodoLabel: string;
};

export async function getSalesReportAction(filters: SalesReportFilters): Promise<{ success: boolean; data?: SalesReportData; error?: string }> {
    noStore();
    const session = await getSession();
    if (!session) return { success: false, error: 'Não autenticado.' };
    if (!['admin', 'gerente', 'vendedor'].includes(session.role)) return { success: false, error: 'Sem permissão.' };

    try {
        const { start, end, label } = getRange(filters.period, filters.dateFrom, filters.dateTo);
        const effectiveSellerId = session.role === 'vendedor' ? session.userId : (filters.sellerId || undefined);
        const statusFilter = filters.status && !['all', ''].includes(filters.status) ? [filters.status] : NON_DELETED;

        const [orders, products, sellers] = await Promise.all([
            db.order.findMany({
                where: {
                    status: { in: statusFilter },
                    createdAt: { gte: subDays(start, 3) },
                    ...(effectiveSellerId ? { sellerId: effectiveSellerId } : {}),
                },
                select: {
                    id: true, customer: true, items: true, total: true,
                    downPayment: true, date: true, status: true,
                    paymentMethod: true, sellerId: true, sellerName: true,
                    installmentDetails: true, commission: true,
                },
                orderBy: { createdAt: 'desc' },
                take: 5000,
            }),
            db.product.findMany({ where: { deletedAt: null }, select: { id: true, cost: true } }),
            session.role !== 'vendedor'
                ? db.user.findMany({ where: { active: true, role: { in: ['admin', 'gerente', 'vendedor', 'vendedor_cobranca'] } }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
                : Promise.resolve([] as { id: string; name: string }[]),
        ]);

        const costMap = new Map(products.map(p => [p.id, Number(p.cost ?? 0)]));

        const periodOrders = orders.filter(o => {
            const d = parseAnyDate(o.date);
            if (!d || d < start || d > end) return false;
            if (filters.customerSearch?.trim()) {
                const c   = safeJson(o.customer) || {};
                const s   = filters.customerSearch.toLowerCase().trim();
                if (!(c?.name || '').toLowerCase().includes(s) && !(c?.code || '').toLowerCase().includes(s)) return false;
            }
            return true;
        });

        let totalVendido = 0, totalRecebido = 0, totalEmAberto = 0, custoTotal = 0;
        const dayMap: Record<string, { total: number; count: number }> = {};
        const sellerAgg: Record<string, { name: string; total: number; count: number; commission: number }> = {};
        const statusAgg: Record<string, { total: number; count: number }> = {};

        for (const o of periodOrders) {
            const total = Number(o.total || 0);
            totalVendido += total;

            const items: any[] = Array.isArray(safeJson(o.items)) ? safeJson(o.items) : [];
            for (const item of items) {
                if (item?.id && !String(item.id).startsWith('CUSTOM-'))
                    custoTotal += (costMap.get(item.id) ?? 0) * Number(item.quantity || 1);
            }

            const insts: any[] = Array.isArray(safeJson(o.installmentDetails)) ? safeJson(o.installmentDetails) : [];
            if (o.paymentMethod === 'Crediário') {
                totalRecebido += Number(o.downPayment || 0);
                for (const inst of insts) {
                    totalRecebido += Number(inst?.paidAmount || 0);
                    if (inst?.status !== 'Pago') totalEmAberto += Math.max(0, Number(inst?.amount || 0) - Number(inst?.paidAmount || 0));
                }
            } else {
                totalRecebido += total;
            }

            const orderDate = parseAnyDate(o.date)!;
            const dk = format(orderDate, 'yyyy-MM-dd');
            if (!dayMap[dk]) dayMap[dk] = { total: 0, count: 0 };
            dayMap[dk].total += total;
            dayMap[dk].count++;

            const sk = o.sellerId || '__none__';
            if (!sellerAgg[sk]) sellerAgg[sk] = { name: o.sellerName || 'Sem Vendedor', total: 0, count: 0, commission: 0 };
            sellerAgg[sk].total += total;
            sellerAgg[sk].count++;
            sellerAgg[sk].commission += Number(o.commission || 0);

            if (!statusAgg[o.status]) statusAgg[o.status] = { total: 0, count: 0 };
            statusAgg[o.status].total += total;
            statusAgg[o.status].count++;
        }

        return {
            success: true,
            data: {
                kpis: {
                    totalVendido, totalRecebido, totalEmAberto,
                    quantidadePedidos: periodOrders.length,
                    ticketMedio: periodOrders.length > 0 ? totalVendido / periodOrders.length : 0,
                    lucroBruto: Math.max(0, totalVendido - custoTotal),
                    custoTotal,
                },
                vendasPorDia: Object.entries(dayMap)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([date, v]) => ({ date, label: format(new Date(date + 'T12:00:00'), 'dd/MM', { locale: ptBR }), ...v })),
                vendasPorVendedor: Object.entries(sellerAgg)
                    .sort(([, a], [, b]) => b.total - a.total)
                    .map(([id, v]) => ({ sellerId: id, sellerName: v.name, total: v.total, count: v.count, commission: v.commission })),
                vendasPorStatus: Object.entries(statusAgg)
                    .sort(([, a], [, b]) => b.total - a.total)
                    .map(([status, v]) => ({ status, ...v })),
                ultimosPedidos: periodOrders.slice(0, 100).map(o => ({
                    id: o.id,
                    customerName: (safeJson(o.customer) as any)?.name ?? '',
                    total: Number(o.total || 0),
                    status: o.status,
                    date: o.date,
                    paymentMethod: o.paymentMethod ?? '',
                    sellerName: o.sellerName ?? '',
                })),
                sellers: sellers.map(s => ({ id: s.id, name: s.name })),
                periodoLabel: label,
            },
        };
    } catch (error: any) {
        console.error('[getSalesReportAction]', error);
        return { success: false, error: error.message };
    }
}

// ─── PRODUCTS REPORT ──────────────────────────────────────────────────────────

export type ProductsReportFilters = { period: FinancialPeriod; dateFrom?: string; dateTo?: string };

export type ProductRow = { id: string; name: string; category: string | null; qtd: number; total: number; lucro: number | null };
export type CategoryRow = { category: string; qtd: number; total: number };
export type ZeroSaleProduct = { id: string; name: string; stock: number; category: string | null };
export type CriticalStockProduct = { id: string; name: string; stock: number; minStock: number; category: string | null };

export type ProductsReportData = {
    kpis: { produtosVendidos: number; qtyTotal: number; topNome: string; topFaturamentoNome: string; periodoLabel: string };
    topPorQtd: ProductRow[];
    topPorFaturamento: ProductRow[];
    vendasPorCategoria: CategoryRow[];
    semVendas: ZeroSaleProduct[];
    estoqueCritico: CriticalStockProduct[];
};

export async function getProductsReportAction(filters: ProductsReportFilters): Promise<{ success: boolean; data?: ProductsReportData; error?: string }> {
    noStore();
    const session = await getSession();
    if (!session) return { success: false, error: 'Não autenticado.' };
    if (!['admin', 'gerente'].includes(session.role)) return { success: false, error: 'Sem permissão.' };

    try {
        const { start, end, label } = getRange(filters.period, filters.dateFrom, filters.dateTo);

        const [orders, allProducts] = await Promise.all([
            db.order.findMany({
                where: { status: { in: ACTIVE }, createdAt: { gte: subDays(start, 3) } },
                select: { items: true, date: true },
                take: 3000,
            }),
            db.product.findMany({
                where: { deletedAt: null },
                select: { id: true, name: true, stock: true, minStock: true, cost: true, price: true, category: true },
            }),
        ]);

        const costMap = new Map(allProducts.map(p => [p.id, Number(p.cost ?? 0)]));
        const prodMeta = new Map(allProducts.map(p => [p.id, { name: p.name, category: p.category || 'Sem categoria' }]));

        const prodAgg: Record<string, { name: string; category: string; qtd: number; total: number; lucro: number }> = {};
        const catAgg:  Record<string, { qtd: number; total: number }> = {};

        for (const o of orders) {
            const d = parseAnyDate(o.date);
            if (!d || d < start || d > end) continue;
            const items: any[] = Array.isArray(safeJson(o.items)) ? safeJson(o.items) : [];
            for (const item of items) {
                if (!item?.id || String(item.id).startsWith('CUSTOM-')) continue;
                const qty   = Number(item.quantity || 0);
                const price = Number(item.price    || 0);
                const cost  = costMap.get(item.id) ?? 0;
                const meta  = prodMeta.get(item.id) ?? { name: item.name || item.id, category: 'Sem categoria' };
                if (!prodAgg[item.id]) prodAgg[item.id] = { name: meta.name, category: meta.category, qtd: 0, total: 0, lucro: 0 };
                prodAgg[item.id].qtd   += qty;
                prodAgg[item.id].total += qty * price;
                prodAgg[item.id].lucro += qty * (price - cost);

                if (!catAgg[meta.category]) catAgg[meta.category] = { qtd: 0, total: 0 };
                catAgg[meta.category].qtd   += qty;
                catAgg[meta.category].total += qty * price;
            }
        }

        const soldIds = new Set(Object.keys(prodAgg));
        const allRows: ProductRow[] = Object.entries(prodAgg).map(([id, v]) => ({
            id, name: v.name, category: v.category, qtd: v.qtd, total: v.total, lucro: v.lucro,
        }));

        const topPorQtd         = [...allRows].sort((a, b) => b.qtd   - a.qtd  ).slice(0, 50);
        const topPorFaturamento  = [...allRows].sort((a, b) => b.total - a.total).slice(0, 50);
        const semVendas: ZeroSaleProduct[] = allProducts
            .filter(p => !soldIds.has(p.id))
            .map(p => ({ id: p.id, name: p.name, stock: Number(p.stock), category: p.category || null }))
            .slice(0, 100);
        const estoqueCritico: CriticalStockProduct[] = allProducts
            .filter(p => p.minStock != null && Number(p.stock) <= Number(p.minStock))
            .sort((a, b) => (Number(a.stock) / Number(a.minStock || 1)) - (Number(b.stock) / Number(b.minStock || 1)))
            .slice(0, 30)
            .map(p => ({ id: p.id, name: p.name, stock: Number(p.stock), minStock: Number(p.minStock!), category: p.category || null }));

        return {
            success: true,
            data: {
                kpis: {
                    produtosVendidos: soldIds.size,
                    qtyTotal: allRows.reduce((s, r) => s + r.qtd, 0),
                    topNome: topPorQtd[0]?.name ?? '—',
                    topFaturamentoNome: topPorFaturamento[0]?.name ?? '—',
                    periodoLabel: label,
                },
                topPorQtd,
                topPorFaturamento,
                vendasPorCategoria: Object.entries(catAgg)
                    .sort(([, a], [, b]) => b.total - a.total)
                    .map(([category, v]) => ({ category, ...v })),
                semVendas,
                estoqueCritico,
            },
        };
    } catch (error: any) {
        console.error('[getProductsReportAction]', error);
        return { success: false, error: error.message };
    }
}

// ─── CUSTOMERS REPORT ─────────────────────────────────────────────────────────

export type CustomersReportFilters = { period: FinancialPeriod; dateFrom?: string; dateTo?: string; sellerId?: string };

export type CustomerRankRow     = { name: string; code?: string; phone: string; totalCompras: number; quantidadePedidos: number };
export type CustomerInactiveRow = { id: string; name: string; code?: string; phone: string; ultimaCompra: string | null };
export type CustomerDebtRow     = { name: string; code?: string; phone: string; parcelasVencidas: number; totalVencido: number };
export type CustomerBlockedRow  = { id: string; name: string; code?: string; phone: string; blockedReason?: string };

export type CustomersReportData = {
    kpis: {
        totalClientes: number; clientesAtivos: number; inadimplentes: number;
        maiorCliente: { name: string; total: number } | null;
        maiorSaldo: { name: string; total: number } | null;
        periodoLabel: string;
    };
    rankingClientes: CustomerRankRow[];
    semCompraRecente: CustomerInactiveRow[];
    inadimplentes: CustomerDebtRow[];
    bloqueados: CustomerBlockedRow[];
    sellers: { id: string; name: string }[];
};

export async function getCustomersReportAction(filters: CustomersReportFilters): Promise<{ success: boolean; data?: CustomersReportData; error?: string }> {
    noStore();
    const session = await getSession();
    if (!session) return { success: false, error: 'Não autenticado.' };
    if (!['admin', 'gerente'].includes(session.role)) return { success: false, error: 'Sem permissão.' };

    try {
        const { start, end, label } = getRange(filters.period, filters.dateFrom, filters.dateTo);
        const sellerFilter = filters.sellerId ? { sellerId: filters.sellerId } : {};

        const [customers, ordersForRanking, allCreditOrders, sellers] = await Promise.all([
            db.customer.findMany({
                select: { id: true, name: true, code: true, phone: true, blocked: true, blockedReason: true, createdAt: true },
                orderBy: { name: 'asc' },
                take: 2000,
            }),
            db.order.findMany({
                where: { status: { in: ACTIVE }, createdAt: { gte: subDays(new Date(), 365) }, ...sellerFilter },
                select: { customer: true, total: true, date: true, createdAt: true },
                take: 5000,
            }),
            db.order.findMany({
                where: { status: { notIn: ['Cancelado', 'Excluído'] }, paymentMethod: 'Crediário', ...sellerFilter },
                select: { customer: true, installmentDetails: true },
            }),
            db.user.findMany({
                where: { active: true, role: { in: ['admin', 'gerente', 'vendedor', 'vendedor_cobranca'] } },
                select: { id: true, name: true },
                orderBy: { name: 'asc' },
            }),
        ]);

        // Filter orders by period for "active" count
        const periodOrders = ordersForRanking.filter(o => {
            const d = parseAnyDate(o.date);
            return d && d >= start && d <= end;
        });
        const activeCustomerKeys = new Set<string>();
        for (const o of periodOrders) {
            const c = safeJson(o.customer) || {};
            const key = c?.cpf || c?.id || c?.name;
            if (key) activeCustomerKeys.add(String(key).trim().toLowerCase());
        }

        // Customer ranking (by total spent in last 12 months)
        const rankMap: Record<string, { name: string; code?: string; phone: string; total: number; count: number }> = {};
        for (const o of ordersForRanking) {
            const c = safeJson(o.customer) || {};
            const key = (c?.cpf || c?.id || c?.name || '').toString().toLowerCase();
            if (!key) continue;
            if (!rankMap[key]) rankMap[key] = { name: c?.name || '', code: c?.code, phone: c?.phone || '', total: 0, count: 0 };
            rankMap[key].total += Number(o.total || 0);
            rankMap[key].count++;
        }
        const ranking = Object.values(rankMap).sort((a, b) => b.total - a.total).slice(0, 100);

        // Last purchase date per customer (from DB customer id → last order date)
        const lastPurchaseMap = new Map<string, string>();
        for (const o of ordersForRanking) {
            const c = safeJson(o.customer) || {};
            const key = c?.id;
            if (!key) continue;
            const d = o.date;
            if (!lastPurchaseMap.has(key) || d > (lastPurchaseMap.get(key) ?? '')) {
                lastPurchaseMap.set(key, d);
            }
        }

        // Customers without purchase in the period
        const cutoffForInactive = subDays(new Date(), 90);
        const semCompraRecente: CustomerInactiveRow[] = customers
            .filter(c => !c.blocked)
            .map(c => ({ ...c, lastPurchase: lastPurchaseMap.get(c.id) ?? null }))
            .filter(c => {
                if (!c.lastPurchase) return true;
                const d = parseAnyDate(c.lastPurchase);
                return !d || d < cutoffForInactive;
            })
            .slice(0, 100)
            .map(c => ({ id: c.id, name: c.name, code: c.code ?? undefined, phone: c.phone, ultimaCompra: c.lastPurchase }));

        // Inadimplência
        const today = startOfDay(new Date());
        const debtMap: Record<string, { name: string; code?: string; phone: string; count: number; total: number }> = {};
        for (const o of allCreditOrders) {
            const cust = safeJson(o.customer) || {};
            const insts: any[] = Array.isArray(safeJson(o.installmentDetails)) ? safeJson(o.installmentDetails) : [];
            for (const inst of insts) {
                if (inst?.status === 'Pago') continue;
                const due = inst?.dueDate ? parseAnyDate(inst.dueDate) : null;
                if (!due || due >= today) continue;
                const remaining = Math.max(0, Number(inst?.amount || 0) - Number(inst?.paidAmount || 0));
                const key = (cust?.cpf || cust?.id || cust?.name || '').toString().toLowerCase();
                if (!key) continue;
                if (!debtMap[key]) debtMap[key] = { name: cust?.name || '', code: cust?.code, phone: cust?.phone || '', count: 0, total: 0 };
                debtMap[key].count++;
                debtMap[key].total += remaining;
            }
        }
        const inadimplentes: CustomerDebtRow[] = Object.values(debtMap)
            .sort((a, b) => b.total - a.total)
            .slice(0, 100)
            .map(d => ({ name: d.name, code: d.code, phone: d.phone, parcelasVencidas: d.count, totalVencido: d.total }));

        const bloqueados: CustomerBlockedRow[] = customers
            .filter(c => c.blocked)
            .map(c => ({ id: c.id, name: c.name, code: c.code ?? undefined, phone: c.phone, blockedReason: c.blockedReason ?? undefined }));

        return {
            success: true,
            data: {
                kpis: {
                    totalClientes: customers.filter(c => !c.blocked).length,
                    clientesAtivos: activeCustomerKeys.size,
                    inadimplentes: Object.keys(debtMap).length,
                    maiorCliente:  ranking[0] ? { name: ranking[0].name, total: ranking[0].total } : null,
                    maiorSaldo:    inadimplentes[0] ? { name: inadimplentes[0].name, total: inadimplentes[0].totalVencido } : null,
                    periodoLabel: label,
                },
                rankingClientes: ranking.map(r => ({ name: r.name, code: r.code, phone: r.phone, totalCompras: r.total, quantidadePedidos: r.count })),
                semCompraRecente,
                inadimplentes,
                bloqueados,
                sellers: sellers.map(s => ({ id: s.id, name: s.name })),
            },
        };
    } catch (error: any) {
        console.error('[getCustomersReportAction]', error);
        return { success: false, error: error.message };
    }
}

// ─── FINANCIAL REPORT ────────────────────────────────────────────────────────

export type FinancialReportFilters = { period: FinancialPeriod; dateFrom?: string; dateTo?: string };

export type PaymentMethodRow   = { method: string; total: number; count: number };
export type OverdueRow         = { orderId: string; customerName: string; installmentNumber: number; dueDate: string; amount: number; remaining: number; daysOverdue: number };
export type UpcomingRow        = { orderId: string; customerName: string; installmentNumber: number; dueDate: string; amount: number; remaining: number; daysUntil: number };
export type CommissionRow      = { sellerId: string; sellerName: string; gerada: number; paga: number; pendente: number };
export type MonthlyRow         = { month: string; faturado: number; recebido: number };

export type FinancialReportData = {
    kpis: {
        faturado: number; recebido: number; emAberto: number; vencido: number;
        comissaoGerada: number; comissaoPaga: number; lucroBruto: number; custoTotal: number;
    };
    recebimentosPorMetodo: PaymentMethodRow[];
    parcelasVencidas: OverdueRow[];
    parcelasAVencer: UpcomingRow[];
    comissoesPorVendedor: CommissionRow[];
    evolucaoMensal: MonthlyRow[];
    periodoLabel: string;
};

export async function getFinancialReportAction(filters: FinancialReportFilters): Promise<{ success: boolean; data?: FinancialReportData; error?: string }> {
    noStore();
    const session = await getSession();
    if (!session) return { success: false, error: 'Não autenticado.' };
    if (!['admin', 'gerente'].includes(session.role)) return { success: false, error: 'Sem permissão.' };

    try {
        const { start, end, label } = getRange(filters.period, filters.dateFrom, filters.dateTo);
        const today = startOfDay(new Date());
        const thirtyDaysAhead = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
        const twelveMonthsAgo = startOfMonth(subMonths(new Date(), 11));

        const [periodOrders, allCreditOrders, cashMovements, commPayments, products] = await Promise.all([
            db.order.findMany({
                where: { status: { in: ACTIVE }, createdAt: { gte: subDays(start, 3) } },
                select: { id: true, customer: true, items: true, total: true, downPayment: true, date: true, paymentMethod: true, sellerId: true, sellerName: true, installmentDetails: true, commission: true },
                take: 5000,
            }),
            db.order.findMany({
                where: { status: { notIn: ['Cancelado', 'Excluído'] }, paymentMethod: 'Crediário' },
                select: { id: true, customer: true, installmentDetails: true },
            }),
            db.cashMovement.findMany({
                where: { createdAt: { gte: start, lte: end }, type: { in: ['RECEBIMENTO', 'ENTRADA_PEDIDO', 'QUITACAO'] } },
                select: { type: true, paymentMethod: true, amount: true },
            }),
            db.commissionPayment.findMany({
                where: { paymentDate: { gte: start.toISOString(), lte: end.toISOString() } },
                select: { sellerId: true, sellerName: true, amount: true },
            }),
            db.product.findMany({ where: { deletedAt: null }, select: { id: true, cost: true } }),
        ]);

        const costMap = new Map(products.map(p => [p.id, Number(p.cost ?? 0)]));

        let faturado = 0, recebido = 0, emAberto = 0, vencido = 0, comissaoGerada = 0, custoTotal = 0;

        // Monthly evolution (last 12 months, from all credit orders)
        const monthMap: Record<string, { faturado: number; recebido: number }> = {};

        // Filter period orders by business date
        const filteredOrders = periodOrders.filter(o => {
            const d = parseAnyDate(o.date);
            return d && d >= start && d <= end;
        });

        for (const o of filteredOrders) {
            const total = Number(o.total || 0);
            faturado += total;
            comissaoGerada += Number(o.commission || 0);

            const items: any[] = Array.isArray(safeJson(o.items)) ? safeJson(o.items) : [];
            for (const item of items) {
                if (item?.id && !String(item.id).startsWith('CUSTOM-'))
                    custoTotal += (costMap.get(item.id) ?? 0) * Number(item.quantity || 1);
            }

            const insts: any[] = Array.isArray(safeJson(o.installmentDetails)) ? safeJson(o.installmentDetails) : [];
            if (o.paymentMethod === 'Crediário') {
                recebido += Number(o.downPayment || 0);
                for (const inst of insts) {
                    recebido += Number(inst?.paidAmount || 0);
                    if (inst?.status !== 'Pago') emAberto += Math.max(0, Number(inst?.amount || 0) - Number(inst?.paidAmount || 0));
                }
            } else {
                recebido += total;
            }

            // Monthly chart
            const d = parseAnyDate(o.date)!;
            const mk = format(d, 'yyyy-MM');
            if (!monthMap[mk]) monthMap[mk] = { faturado: 0, recebido: 0 };
            monthMap[mk].faturado += total;
            if (o.paymentMethod !== 'Crediário') monthMap[mk].recebido += total;
            else monthMap[mk].recebido += Number(o.downPayment || 0);
        }

        // Payment method breakdown from cash movements
        const methodMap: Record<string, { total: number; count: number }> = {};
        for (const m of cashMovements) {
            const method = m.paymentMethod || 'Outros';
            if (!methodMap[method]) methodMap[method] = { total: 0, count: 0 };
            methodMap[method].total += Number(m.amount || 0);
            methodMap[method].count++;
        }

        // Overdue and upcoming installments
        const parcelasVencidas: OverdueRow[] = [];
        const parcelasAVencer: UpcomingRow[] = [];
        for (const o of allCreditOrders) {
            const cust = safeJson(o.customer) || {};
            const insts: any[] = Array.isArray(safeJson(o.installmentDetails)) ? safeJson(o.installmentDetails) : [];
            for (const inst of insts) {
                if (inst?.status === 'Pago') continue;
                const due = inst?.dueDate ? parseAnyDate(inst.dueDate) : null;
                if (!due) continue;
                const amount = Number(inst?.amount || 0);
                const paid   = Number(inst?.paidAmount || 0);
                const remaining = Math.max(0, amount - paid);
                if (due < today) {
                    vencido += remaining;
                    if (parcelasVencidas.length < 200) {
                        parcelasVencidas.push({
                            orderId: o.id, customerName: cust?.name ?? '',
                            installmentNumber: Number(inst?.installmentNumber || 0),
                            dueDate: inst.dueDate, amount, remaining,
                            daysOverdue: differenceInDays(today, due),
                        });
                    }
                } else if (due <= thirtyDaysAhead && parcelasAVencer.length < 100) {
                    parcelasAVencer.push({
                        orderId: o.id, customerName: cust?.name ?? '',
                        installmentNumber: Number(inst?.installmentNumber || 0),
                        dueDate: inst.dueDate, amount, remaining,
                        daysUntil: differenceInDays(due, today),
                    });
                }
            }
        }
        parcelasVencidas.sort((a, b) => b.daysOverdue - a.daysOverdue);
        parcelasAVencer.sort((a, b) => a.daysUntil - b.daysUntil);

        // Commissions by seller (generated = from filtered period orders, paid = from commission payments in period)
        const commGenMap: Record<string, { name: string; gerada: number }> = {};
        for (const o of filteredOrders) {
            const sk = o.sellerId || '__none__';
            if (!commGenMap[sk]) commGenMap[sk] = { name: o.sellerName || 'Sem Vendedor', gerada: 0 };
            commGenMap[sk].gerada += Number(o.commission || 0);
        }
        const commPaidMap: Record<string, number> = {};
        for (const cp of commPayments) {
            commPaidMap[cp.sellerId] = (commPaidMap[cp.sellerId] ?? 0) + Number(cp.amount || 0);
        }
        const comissoesPorVendedor: CommissionRow[] = Object.entries(commGenMap)
            .filter(([, v]) => v.gerada > 0)
            .sort(([, a], [, b]) => b.gerada - a.gerada)
            .map(([id, v]) => {
                const paga = commPaidMap[id] ?? 0;
                return { sellerId: id, sellerName: v.name, gerada: v.gerada, paga, pendente: Math.max(0, v.gerada - paga) };
            });

        const comissaoPaga = commPayments.reduce((s, cp) => s + Number(cp.amount || 0), 0);

        // Monthly evolution (last 12 months including from all filtered data)
        const evolucaoMensal: MonthlyRow[] = [];
        for (let i = 11; i >= 0; i--) {
            const mo = subMonths(new Date(), i);
            const mk = format(mo, 'yyyy-MM');
            evolucaoMensal.push({
                month: format(mo, 'MMM/yy', { locale: ptBR }),
                faturado: monthMap[mk]?.faturado ?? 0,
                recebido: monthMap[mk]?.recebido ?? 0,
            });
        }

        return {
            success: true,
            data: {
                kpis: { faturado, recebido, emAberto, vencido, comissaoGerada, comissaoPaga, lucroBruto: Math.max(0, faturado - custoTotal), custoTotal },
                recebimentosPorMetodo: Object.entries(methodMap)
                    .sort(([, a], [, b]) => b.total - a.total)
                    .map(([method, v]) => ({ method, ...v })),
                parcelasVencidas,
                parcelasAVencer,
                comissoesPorVendedor,
                evolucaoMensal,
                periodoLabel: label,
            },
        };
    } catch (error: any) {
        console.error('[getFinancialReportAction]', error);
        return { success: false, error: error.message };
    }
}
