'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    TrendingUp, DollarSign, ShoppingCart, ReceiptText,
    RefreshCw, Download, Printer, PackageSearch,
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/context/PermissionsContext';
import { hasAccess } from '@/lib/permissions';
import { getSalesReportAction, type SalesReportData, type SalesReportFilters } from '@/app/actions/admin/reports';
import { exportToCSV } from '@/lib/report-export';
import type { FinancialPeriod } from '@/lib/types';

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtC = (v: number) => {
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
    return fmt(v);
};
function fmtDate(val?: string | null) {
    if (!val) return '—';
    try { const d = parseISO(val); return isValid(d) ? format(d, 'dd/MM/yy HH:mm', { locale: ptBR }) : val; }
    catch { return val; }
}

const STATUS_COLORS: Record<string, string> = {
    Processando: 'bg-blue-100 text-blue-800', Enviado: 'bg-amber-100 text-amber-800',
    Entregue: 'bg-green-100 text-green-800',  Cancelado: 'bg-red-100 text-red-800',
};

const PERIODS: { id: FinancialPeriod; label: string }[] = [
    { id: 'today', label: 'Hoje' }, { id: 'week', label: '7 dias' },
    { id: 'month', label: 'Mês' }, { id: 'year', label: 'Ano' },
    { id: 'custom', label: 'Período' },
];

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border bg-card shadow-md px-3 py-2 text-sm">
            <p className="font-semibold mb-1">{label}</p>
            {payload.map((p: any) => (
                <p key={p.dataKey} style={{ color: p.color }}>{p.name === 'total' ? 'Total' : p.name}: {fmt(p.value)}</p>
            ))}
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RelatorioVendasPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { permissions, isLoading: permLoad } = usePermissions();

    const [data,       setData]       = useState<SalesReportData | null>(null);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [page,       setPage]       = useState(0);
    const PAGE_SIZE = 25;

    const [filters, setFilters] = useState<SalesReportFilters>({
        period: 'month', status: 'all', sellerId: '', customerSearch: '',
    });
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo,   setDateTo]   = useState('');

    const load = useCallback(async (showRefreshing = false) => {
        if (showRefreshing) setRefreshing(true); else setLoading(true);
        setError(null);
        const result = await getSalesReportAction({ ...filters, dateFrom: filters.period === 'custom' ? dateFrom : undefined, dateTo: filters.period === 'custom' ? dateTo : undefined });
        if (result.success && result.data) { setData(result.data); setPage(0); }
        else setError(result.error ?? 'Erro ao carregar relatório.');
        setLoading(false); setRefreshing(false);
    }, [filters, dateFrom, dateTo]);

    useEffect(() => {
        if (!user || permLoad || !permissions) return;
        if (!hasAccess(user.role, 'relatorios-vendas', permissions)) { router.replace('/admin/pedidos'); return; }
        load();
    }, [user, permissions, permLoad, router, load]);

    const kpis = data?.kpis;
    const pagedOrders = (data?.ultimosPedidos ?? []).slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const totalPages  = Math.ceil((data?.ultimosPedidos?.length ?? 0) / PAGE_SIZE);

    function handleExportOrders() {
        if (!data) return;
        exportToCSV(`vendas-${filters.period}.csv`,
            ['ID', 'Cliente', 'Total', 'Status', 'Método', 'Vendedor', 'Data'],
            data.ultimosPedidos.map(o => [o.id, o.customerName, o.total, o.status, o.paymentMethod, o.sellerName, o.date]),
        );
    }

    return (
        <div className="space-y-5 pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Relatório de Vendas</h1>
                    {data?.periodoLabel && <p className="text-sm text-muted-foreground mt-0.5">{data.periodoLabel}</p>}
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                        <Printer className="h-3.5 w-3.5 mr-1.5" />Imprimir
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportOrders} disabled={!data}>
                        <Download className="h-3.5 w-3.5 mr-1.5" />CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading || refreshing}>
                        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />Atualizar
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-2 items-end">
                        {PERIODS.map(p => (
                            <Button key={p.id} variant={filters.period === p.id ? 'default' : 'outline'} size="sm"
                                onClick={() => setFilters(f => ({ ...f, period: p.id }))}>
                                {p.label}
                            </Button>
                        ))}
                        {filters.period === 'custom' && (
                            <>
                                <Input type="date" className="h-8 w-36 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                                <Input type="date" className="h-8 w-36 text-sm" value={dateTo}   onChange={e => setDateTo(e.target.value)} />
                            </>
                        )}
                        <Select value={filters.status || 'all'} onValueChange={v => setFilters(f => ({ ...f, status: v }))}>
                            <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos status</SelectItem>
                                {['Processando', 'Enviado', 'Entregue', 'Cancelado'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        {user?.role !== 'vendedor' && data?.sellers && data.sellers.length > 0 && (
                            <Select value={filters.sellerId || 'all'} onValueChange={v => setFilters(f => ({ ...f, sellerId: v === 'all' ? '' : v }))}>
                                <SelectTrigger className="h-8 w-40 text-sm"><SelectValue placeholder="Vendedor" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos vendedores</SelectItem>
                                    {data.sellers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                        <Input placeholder="Buscar cliente…" className="h-8 w-44 text-sm" value={filters.customerSearch || ''}
                            onChange={e => setFilters(f => ({ ...f, customerSearch: e.target.value }))} />
                    </div>
                </CardContent>
            </Card>

            {error && <Card className="border-red-200 bg-red-50"><CardContent className="p-4 text-sm text-red-700">{error}</CardContent></Card>}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {['Total Vendido', 'Total Recebido', 'Em Aberto', 'Ticket Médio'].map((t, i) => {
                    const vals = [kpis?.totalVendido, kpis?.totalRecebido, kpis?.totalEmAberto, kpis?.ticketMedio];
                    const icons = [<TrendingUp className="h-5 w-5 text-emerald-600" />, <DollarSign className="h-5 w-5 text-blue-600" />, <ReceiptText className="h-5 w-5 text-amber-600" />, <ShoppingCart className="h-5 w-5 text-violet-600" />];
                    const bgs   = ['bg-emerald-100', 'bg-blue-100', 'bg-amber-100', 'bg-violet-100'];
                    return (
                        <Card key={t}>
                            <CardContent className="p-5 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t}</p>
                                    {loading ? <Skeleton className="h-7 w-28 mt-1" /> : <p className="mt-1 text-2xl font-bold tabular-nums">{fmtC(vals[i] ?? 0)}</p>}
                                </div>
                                <div className={`flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl ${bgs[i]}`}>{icons[i]}</div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                    { label: 'Qtd Pedidos', val: String(kpis?.quantidadePedidos ?? 0) },
                    { label: 'Lucro Bruto',  val: fmtC(kpis?.lucroBruto ?? 0) },
                    { label: 'Custo Total',  val: fmtC(kpis?.custoTotal ?? 0) },
                ].map(({ label, val }) => (
                    <Card key={label}>
                        <CardContent className="p-5">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                            {loading ? <Skeleton className="h-7 w-24 mt-1" /> : <p className="mt-1 text-2xl font-bold">{val}</p>}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Faturado vs Recebido chart */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Faturado vs Recebido por Dia</CardTitle>
                </CardHeader>
                <CardContent className="pl-0 pr-4">
                    {loading ? <Skeleton className="h-52 w-full" /> : (
                        <ResponsiveContainer width="100%" height={210}>
                            <AreaChart data={data?.vendasPorDia ?? []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={v => fmtC(v).replace('R$ ', '')} width={52} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="total" name="total" stroke="#6366f1" strokeWidth={2} fill="url(#gV)" dot={false} activeDot={{ r: 4 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            {/* Vendas por vendedor + por status */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Vendas por Vendedor</CardTitle></CardHeader>
                    <CardContent className="p-0">
                        {loading ? <div className="px-5 pb-4 space-y-2">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-8 w-full" />)}</div> : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead className="pl-4">Vendedor</TableHead>
                                        <TableHead className="text-right">Qtd</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right pr-4">Comissão</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {(data?.vendasPorVendedor ?? []).slice(0, 20).map(r => (
                                            <TableRow key={r.sellerId}>
                                                <TableCell className="pl-4 font-medium text-sm">{r.sellerName}</TableCell>
                                                <TableCell className="text-right text-sm tabular-nums">{r.count}</TableCell>
                                                <TableCell className="text-right text-sm tabular-nums">{fmtC(r.total)}</TableCell>
                                                <TableCell className="text-right text-sm tabular-nums pr-4">{fmtC(r.commission)}</TableCell>
                                            </TableRow>
                                        ))}
                                        {!data?.vendasPorVendedor?.length && <TableRow><TableCell colSpan={4} className="text-center py-6 text-sm text-muted-foreground">Sem dados.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Vendas por Status</CardTitle></CardHeader>
                    <CardContent className="p-0">
                        {loading ? <div className="px-5 pb-4 space-y-2">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-8 w-full" />)}</div> : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead className="pl-4">Status</TableHead>
                                        <TableHead className="text-right">Qtd</TableHead>
                                        <TableHead className="text-right pr-4">Total</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {(data?.vendasPorStatus ?? []).map(r => (
                                            <TableRow key={r.status}>
                                                <TableCell className="pl-4">
                                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-600'}`}>{r.status}</span>
                                                </TableCell>
                                                <TableCell className="text-right text-sm tabular-nums">{r.count}</TableCell>
                                                <TableCell className="text-right text-sm tabular-nums pr-4">{fmtC(r.total)}</TableCell>
                                            </TableRow>
                                        ))}
                                        {!data?.vendasPorStatus?.length && <TableRow><TableCell colSpan={3} className="text-center py-6 text-sm text-muted-foreground">Sem dados.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Últimos pedidos */}
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Pedidos do Período</CardTitle>
                        {data && <span className="text-xs text-muted-foreground">{data.ultimosPedidos.length} pedidos</span>}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? <div className="px-5 pb-4 space-y-2">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-8 w-full" />)}</div> : (
                        <>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead className="pl-4">Cliente</TableHead>
                                        <TableHead>Vendedor</TableHead>
                                        <TableHead>Método</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-center">Status</TableHead>
                                        <TableHead className="text-right pr-4">Data</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {pagedOrders.map(o => (
                                            <TableRow key={o.id}>
                                                <TableCell className="pl-4 font-medium text-sm max-w-[140px] truncate">{o.customerName || '—'}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground max-w-[100px] truncate">{o.sellerName || '—'}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{o.paymentMethod}</TableCell>
                                                <TableCell className="text-right text-sm tabular-nums">{fmtC(o.total)}</TableCell>
                                                <TableCell className="text-center"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status] ?? 'bg-gray-100 text-gray-600'}`}>{o.status}</span></TableCell>
                                                <TableCell className="text-right text-xs text-muted-foreground pr-4 tabular-nums">{fmtDate(o.date)}</TableCell>
                                            </TableRow>
                                        ))}
                                        {pagedOrders.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground"><PackageSearch className="h-8 w-8 mx-auto mb-2 opacity-30" />Nenhum pedido no período.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </div>
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
                                    <span className="text-muted-foreground">Pág. {page + 1} de {totalPages}</span>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                                        <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
