'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    TrendingUp, DollarSign, ShoppingCart, Users, AlertTriangle,
    Package, Clock, RefreshCw, CreditCard, ReceiptText, ArrowRight,
    CalendarClock,
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/context/PermissionsContext';
import { hasAccess } from '@/lib/permissions';
import { getDashboardDataAction, type DashboardData } from '@/app/actions/admin/dashboard';

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtCompact = (v: number) => {
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(1)}k`;
    return fmt(v);
};

function fmtDate(val: string | null | undefined) {
    if (!val) return '—';
    try {
        const d = parseISO(val);
        return isValid(d) ? format(d, 'dd/MM HH:mm', { locale: ptBR }) : val;
    } catch { return val ?? '—'; }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
    Processando: 'bg-blue-100  text-blue-800  border-blue-200',
    Enviado:     'bg-amber-100 text-amber-800 border-amber-200',
    Entregue:    'bg-green-100 text-green-800 border-green-200',
    Cancelado:   'bg-red-100   text-red-800   border-red-200',
    Excluído:    'bg-gray-100  text-gray-500  border-gray-200',
};

function StatusBadge({ status }: { status: string }) {
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'}`}>
            {status}
        </span>
    );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

type KpiCardProps = {
    title:   string;
    value:   string;
    sub?:    string;
    icon:    React.ReactNode;
    iconBg:  string;
    href?:   string;
    alert?:  boolean;
};

function KpiCard({ title, value, sub, icon, iconBg, href, alert }: KpiCardProps) {
    const inner = (
        <Card className={`hover:shadow-md transition-shadow ${alert ? 'border-red-200' : ''}`}>
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
                            {title}
                        </p>
                        <p className={`mt-1 text-2xl font-bold tracking-tight truncate ${alert ? 'text-red-600' : 'text-foreground'}`}>
                            {value}
                        </p>
                        {sub && (
                            <p className="mt-0.5 text-xs text-muted-foreground truncate">{sub}</p>
                        )}
                    </div>
                    <div className={`flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
                        {icon}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
    if (href) return <Link href={href} className="block">{inner}</Link>;
    return inner;
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function KpiSkeleton() {
    return (
        <Card>
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-7 w-32" />
                        <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-10 w-10 rounded-xl" />
                </div>
            </CardContent>
        </Card>
    );
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border bg-card shadow-md px-3 py-2 text-sm">
            <p className="font-semibold text-foreground mb-1">{label}</p>
            {payload.map((p: any) => (
                <p key={p.dataKey} style={{ color: p.color }}>
                    {p.name === 'vendas' ? 'Faturado' : 'Recebido'}: {fmt(p.value)}
                </p>
            ))}
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const router = useRouter();
    const { user }                                         = useAuth();
    const { permissions, isLoading: permissionsLoading }   = usePermissions();

    const [data,       setData]       = useState<DashboardData | null>(null);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async (showRefreshing = false) => {
        if (showRefreshing) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const result = await getDashboardDataAction();
        if (result.success && result.data) {
            setData(result.data);
        } else {
            setError(result.error ?? 'Erro ao carregar dados do dashboard.');
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    // SEC-02: Permission guard — redirect before loading data
    useEffect(() => {
        if (!user || permissionsLoading || !permissions) return;

        if (!hasAccess(user.role, 'dashboard', permissions)) {
            router.replace('/admin/pedidos');
            return;
        }

        // Only fetch data after permission is confirmed
        load();
    }, [user, permissions, permissionsLoading, router, load]);

    const greeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Bom dia';
        if (h < 18) return 'Boa tarde';
        return 'Boa noite';
    };

    const kpis = data?.kpis;

    return (
        <div className="space-y-6 pb-8">

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {greeting()}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
                        {data?.generatedAt && (
                            <span className="ml-2">
                                Atualizado às {format(new Date(data.generatedAt), 'HH:mm', { locale: ptBR })}
                            </span>
                        )}
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => load(true)}
                    disabled={refreshing || loading}
                    className="self-start sm:self-auto"
                >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                    Atualizar
                </Button>
            </div>

            {error && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
                </Card>
            )}

            {/* ── KPIs Row 1 ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
                ) : (
                    <>
                        <KpiCard
                            title="Vendas Hoje"
                            value={fmtCompact(kpis?.vendasHoje.total ?? 0)}
                            sub={`${kpis?.vendasHoje.count ?? 0} pedido${(kpis?.vendasHoje.count ?? 0) !== 1 ? 's' : ''}`}
                            icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
                            iconBg="bg-emerald-100"
                            href="/admin/pedidos"
                        />
                        <KpiCard
                            title="Recebido Hoje"
                            value={fmtCompact(kpis?.recebidoHoje ?? 0)}
                            sub="entradas de clientes"
                            icon={<DollarSign className="h-5 w-5 text-blue-600" />}
                            iconBg="bg-blue-100"
                            href="/admin/caixa"
                        />
                        <KpiCard
                            title="Ticket Médio"
                            value={fmtCompact(kpis?.ticketMedio ?? 0)}
                            sub="no mês atual"
                            icon={<ReceiptText className="h-5 w-5 text-violet-600" />}
                            iconBg="bg-violet-100"
                        />
                        <KpiCard
                            title="Pedidos Pendentes"
                            value={String(kpis?.pedidosPendentes ?? 0)}
                            sub="aguardando aprovação"
                            icon={<Clock className="h-5 w-5 text-amber-600" />}
                            iconBg="bg-amber-100"
                            href="/admin/solicitacoes"
                            alert={(kpis?.pedidosPendentes ?? 0) > 0}
                        />
                    </>
                )}
            </div>

            {/* ── KPIs Row 2 ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
                ) : (
                    <>
                        <KpiCard
                            title="Vendas no Mês"
                            value={fmtCompact(kpis?.vendasMes.total ?? 0)}
                            sub={`${kpis?.vendasMes.count ?? 0} pedido${(kpis?.vendasMes.count ?? 0) !== 1 ? 's' : ''}`}
                            icon={<ShoppingCart className="h-5 w-5 text-indigo-600" />}
                            iconBg="bg-indigo-100"
                            href="/admin/financeiro"
                        />
                        <KpiCard
                            title="Clientes Inadimplentes"
                            value={String(kpis?.clientesInadimplentes ?? 0)}
                            sub="com parcela vencida"
                            icon={<Users className="h-5 w-5 text-red-600" />}
                            iconBg="bg-red-100"
                            href="/admin/cobrancas"
                            alert={(kpis?.clientesInadimplentes ?? 0) > 0}
                        />
                        <KpiCard
                            title="Parcelas Vencidas"
                            value={String(kpis?.parcelasVencidas.count ?? 0)}
                            sub={`${fmtCompact(kpis?.parcelasVencidas.total ?? 0)} em aberto`}
                            icon={<CreditCard className="h-5 w-5 text-orange-600" />}
                            iconBg="bg-orange-100"
                            href="/admin/cobrancas"
                            alert={(kpis?.parcelasVencidas.count ?? 0) > 0}
                        />
                        <KpiCard
                            title="Estoque Crítico"
                            value={String(kpis?.estoqueCritico ?? 0)}
                            sub="produtos abaixo do mínimo"
                            icon={<Package className="h-5 w-5 text-rose-600" />}
                            iconBg="bg-rose-100"
                            href="/admin/estoque"
                            alert={(kpis?.estoqueCritico ?? 0) > 0}
                        />
                    </>
                )}
            </div>

            {/* ── Chart 30 dias ── */}
            <Card>
                <CardHeader className="pb-3">
                    <div>
                        <CardTitle className="text-base">Vendas — Últimos 30 dias</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                            Faturado vs. recebido (parcelas pela data real do pagamento)
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="pl-0 pr-4">
                    {loading ? (
                        <Skeleton className="h-56 w-full" />
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart
                                data={data?.chart30dias ?? []}
                                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                            >
                                <defs>
                                    <linearGradient id="gradVendas" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gradRecebido" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                <XAxis
                                    dataKey="data"
                                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval={4}
                                />
                                <YAxis
                                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => fmtCompact(v).replace('R$ ', '')}
                                    width={52}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                                    formatter={(value) => value === 'vendas' ? 'Faturado' : 'Recebido'}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="vendas"
                                    name="vendas"
                                    stroke="#6366f1"
                                    strokeWidth={2}
                                    fill="url(#gradVendas)"
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="recebido"
                                    name="recebido"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    fill="url(#gradRecebido)"
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            {/* ── Top produtos + Últimos pedidos ── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                {/* Top 10 produtos */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Top 10 Produtos</CardTitle>
                            <span className="text-xs text-muted-foreground">últimos 30 dias</span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="px-6 pb-4 space-y-2">
                                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                            </div>
                        ) : (data?.topProdutos?.length ?? 0) === 0 ? (
                            <p className="px-6 pb-6 text-sm text-muted-foreground">
                                Nenhuma venda nos últimos 30 dias.
                            </p>
                        ) : (
                            // UI-01: overflow-x-auto para tabelas em mobile
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-8 pl-4">#</TableHead>
                                            <TableHead>Produto</TableHead>
                                            <TableHead className="text-right">Qtd</TableHead>
                                            <TableHead className="text-right pr-4">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data?.topProdutos.map((p, i) => (
                                            <TableRow key={p.id}>
                                                <TableCell className="pl-4 text-muted-foreground text-xs w-8">
                                                    {i + 1}
                                                </TableCell>
                                                <TableCell className="font-medium text-sm max-w-[160px] truncate">
                                                    {p.name}
                                                </TableCell>
                                                <TableCell className="text-right text-sm tabular-nums">
                                                    {p.qtd}
                                                </TableCell>
                                                <TableCell className="text-right text-sm tabular-nums pr-4">
                                                    {fmtCompact(p.total)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Últimos pedidos */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Últimos Pedidos</CardTitle>
                            <Link
                                href="/admin/pedidos"
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                                Ver todos <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="px-6 pb-4 space-y-2">
                                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                            </div>
                        ) : (data?.ultimosPedidos?.length ?? 0) === 0 ? (
                            <p className="px-6 pb-6 text-sm text-muted-foreground">
                                Nenhum pedido encontrado.
                            </p>
                        ) : (
                            // UI-01: overflow-x-auto para tabelas em mobile
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="pl-4">Cliente</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                            <TableHead className="text-center">Status</TableHead>
                                            <TableHead className="text-right pr-4">Data</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data?.ultimosPedidos.map((o) => (
                                            <TableRow key={o.id}>
                                                <TableCell className="pl-4 font-medium text-sm max-w-[140px]">
                                                    <p className="truncate">{o.customerName || '—'}</p>
                                                    <p className="text-[10px] text-muted-foreground font-normal truncate">
                                                        {o.paymentMethod}
                                                    </p>
                                                </TableCell>
                                                <TableCell className="text-right text-sm tabular-nums">
                                                    {fmtCompact(o.total)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <StatusBadge status={o.status} />
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-muted-foreground pr-4 tabular-nums">
                                                    {fmtDate(o.date)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── Cobranças vencendo hoje ── */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CalendarClock className="h-4 w-4 text-amber-500" />
                            <CardTitle className="text-base">Cobranças Vencendo Hoje</CardTitle>
                            {!loading && (data?.cobrancasHoje?.length ?? 0) > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                    {data!.cobrancasHoje.length}
                                </Badge>
                            )}
                        </div>
                        <Link
                            href="/admin/cobrancas"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                            Ver cobranças <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="px-6 pb-4 space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                        </div>
                    ) : (data?.cobrancasHoje?.length ?? 0) === 0 ? (
                        <div className="px-6 pb-6 flex items-center gap-2 text-sm text-muted-foreground">
                            <AlertTriangle className="h-4 w-4 text-green-500 flex-shrink-0" />
                            Nenhuma parcela vencendo hoje.
                        </div>
                    ) : (
                        // UI-01: overflow-x-auto para tabelas em mobile
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="pl-4">Cliente</TableHead>
                                        <TableHead className="text-center">Parcela</TableHead>
                                        <TableHead className="text-right">Valor</TableHead>
                                        <TableHead className="text-right pr-4">Restante</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data?.cobrancasHoje.map((c, i) => (
                                        <TableRow key={`${c.orderId}-${c.installmentNumber}-${i}`}>
                                            <TableCell className="pl-4">
                                                <p className="font-medium text-sm truncate max-w-[180px]">
                                                    {c.customerName || '—'}
                                                </p>
                                                {c.customerPhone && (
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {c.customerPhone}
                                                    </p>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline" className="text-xs">
                                                    #{c.installmentNumber}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-sm tabular-nums">
                                                {fmt(c.amount)}
                                            </TableCell>
                                            <TableCell className="text-right text-sm tabular-nums font-semibold text-amber-600 pr-4">
                                                {fmt(c.remaining)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

        </div>
    );
}
