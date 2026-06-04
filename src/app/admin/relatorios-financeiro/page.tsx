'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, AlertTriangle, CreditCard, RefreshCw, Download, Printer, BadgePercent } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/context/PermissionsContext';
import { hasAccess } from '@/lib/permissions';
import { getFinancialReportAction, type FinancialReportData, type FinancialReportFilters } from '@/app/actions/admin/reports';
import { exportToCSV } from '@/lib/report-export';
import type { FinancialPeriod } from '@/lib/types';

const fmt  = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtC = (v: number) => v >= 1_000_000 ? `R$ ${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `R$ ${(v/1_000).toFixed(1)}k` : fmt(v);

const PERIODS: { id: FinancialPeriod; label: string }[] = [
    { id: 'today', label: 'Hoje' }, { id: 'week', label: '7 dias' },
    { id: 'month', label: 'Mês' }, { id: 'year', label: 'Ano' }, { id: 'custom', label: 'Período' },
];
const PIE_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#0ea5e9','#14b8a6'];

function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border bg-card shadow-md px-3 py-2 text-sm">
            <p className="font-semibold mb-1">{label}</p>
            {payload.map((p: any) => <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>)}
        </div>
    );
}

export default function RelatorioFinanceiroPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { permissions, isLoading: permLoad } = usePermissions();

    const [data,       setData]       = useState<FinancialReportData | null>(null);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const [filters, setFilters] = useState<FinancialReportFilters>({ period: 'month' });
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo,   setDateTo]   = useState('');

    const load = useCallback(async (showRefreshing = false) => {
        if (showRefreshing) setRefreshing(true); else setLoading(true);
        setError(null);
        const result = await getFinancialReportAction({
            ...filters,
            dateFrom: filters.period === 'custom' ? dateFrom : undefined,
            dateTo:   filters.period === 'custom' ? dateTo   : undefined,
        });
        if (result.success && result.data) setData(result.data);
        else setError(result.error ?? 'Erro ao carregar relatório.');
        setLoading(false); setRefreshing(false);
    }, [filters, dateFrom, dateTo]);

    useEffect(() => {
        if (!user || permLoad || !permissions) return;
        if (!hasAccess(user.role, 'relatorios-financeiro', permissions)) { router.replace('/admin/pedidos'); return; }
        load();
    }, [user, permissions, permLoad, router, load]);

    const kpis = data?.kpis;

    function handleExportOverdue() {
        if (!data) return;
        exportToCSV(`parcelas-vencidas.csv`,
            ['Pedido', 'Cliente', 'Parcela', 'Vencimento', 'Valor', 'Restante', 'Dias Vencido'],
            data.parcelasVencidas.map(p => [p.orderId, p.customerName, p.installmentNumber, p.dueDate, p.amount, p.remaining, p.daysOverdue]),
        );
    }

    return (
        <div className="space-y-5 pb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Relatório Financeiro</h1>
                    {data?.periodoLabel && <p className="text-sm text-muted-foreground mt-0.5">{data.periodoLabel}</p>}
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-3.5 w-3.5 mr-1.5" />Imprimir</Button>
                    <Button variant="outline" size="sm" onClick={handleExportOverdue} disabled={!data}><Download className="h-3.5 w-3.5 mr-1.5" />CSV</Button>
                    <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading || refreshing}>
                        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />Atualizar
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-2">
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
                    </div>
                </CardContent>
            </Card>

            {error && <Card className="border-red-200 bg-red-50"><CardContent className="p-4 text-sm text-red-700">{error}</CardContent></Card>}

            {/* KPI Row 1 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Faturado',   val: fmtC(kpis?.faturado ?? 0),   bg: 'bg-indigo-100',  icon: <TrendingUp className="h-5 w-5 text-indigo-600" /> },
                    { label: 'Recebido',   val: fmtC(kpis?.recebido ?? 0),   bg: 'bg-emerald-100', icon: <DollarSign className="h-5 w-5 text-emerald-600" /> },
                    { label: 'Em Aberto',  val: fmtC(kpis?.emAberto ?? 0),   bg: 'bg-amber-100',   icon: <CreditCard className="h-5 w-5 text-amber-600" /> },
                    { label: 'Vencido',    val: fmtC(kpis?.vencido ?? 0),    bg: 'bg-red-100',     icon: <AlertTriangle className="h-5 w-5 text-red-600" />, alert: (kpis?.vencido ?? 0) > 0 },
                ].map(({ label, val, bg, icon, alert }) => (
                    <Card key={label} className={alert ? 'border-red-200' : ''}>
                        <CardContent className="p-5 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                                {loading ? <Skeleton className="h-7 w-28 mt-1" /> : <p className={`mt-1 text-2xl font-bold tabular-nums ${alert ? 'text-red-600' : ''}`}>{val}</p>}
                            </div>
                            <div className={`flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>{icon}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* KPI Row 2 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Comissão Gerada', val: fmtC(kpis?.comissaoGerada ?? 0), bg: 'bg-violet-100', icon: <BadgePercent className="h-5 w-5 text-violet-600" /> },
                    { label: 'Comissão Paga',   val: fmtC(kpis?.comissaoPaga   ?? 0), bg: 'bg-blue-100',   icon: <BadgePercent className="h-5 w-5 text-blue-600" /> },
                    { label: 'Lucro Bruto',     val: fmtC(kpis?.lucroBruto     ?? 0), bg: 'bg-green-100',  icon: <DollarSign className="h-5 w-5 text-green-600" /> },
                    { label: 'Custo Total',     val: fmtC(kpis?.custoTotal     ?? 0), bg: 'bg-gray-100',   icon: <DollarSign className="h-5 w-5 text-gray-600" /> },
                ].map(({ label, val, bg, icon }) => (
                    <Card key={label}>
                        <CardContent className="p-5 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                                {loading ? <Skeleton className="h-7 w-28 mt-1" /> : <p className="mt-1 text-2xl font-bold tabular-nums">{val}</p>}
                            </div>
                            <div className={`flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>{icon}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Evolução Mensal (12 meses)</CardTitle></CardHeader>
                    <CardContent className="pl-0 pr-4">
                        {loading ? <Skeleton className="h-52 w-full" /> : (
                            <ResponsiveContainer width="100%" height={210}>
                                <AreaChart data={data?.evolucaoMensal ?? []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="gFat" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={v => fmtC(v).replace('R$ ', '')} width={52} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={v => v === 'faturado' ? 'Faturado' : 'Recebido'} />
                                    <Area type="monotone" dataKey="faturado" name="faturado" stroke="#6366f1" strokeWidth={2} fill="url(#gFat)" dot={false} activeDot={{ r: 4 }} />
                                    <Area type="monotone" dataKey="recebido" name="recebido" stroke="#10b981" strokeWidth={2} fill="url(#gRec)" dot={false} activeDot={{ r: 4 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Recebimentos por Método</CardTitle></CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-52 w-full" /> : (
                            <>
                                <ResponsiveContainer width="100%" height={160}>
                                    <PieChart>
                                        <Pie data={data?.recebimentosPorMetodo ?? []} dataKey="total" nameKey="method" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                                            {(data?.recebimentosPorMetodo ?? []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(v: any) => fmt(Number(v))} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="mt-2 space-y-1">
                                    {(data?.recebimentosPorMetodo ?? []).map((m, i) => (
                                        <div key={m.method} className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                                <span className="truncate max-w-[140px]">{m.method}</span>
                                                <span className="text-xs text-muted-foreground">({m.count})</span>
                                            </div>
                                            <span className="font-semibold tabular-nums">{fmtC(m.total)}</span>
                                        </div>
                                    ))}
                                    {!data?.recebimentosPorMetodo?.length && <p className="text-sm text-muted-foreground text-center py-4">Sem movimentos no período.</p>}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Tables */}
            <Tabs defaultValue="vencidas">
                <TabsList className="mb-3 flex-wrap">
                    <TabsTrigger value="vencidas">
                        Vencidas
                        {data?.parcelasVencidas?.length ? <Badge variant="destructive" className="ml-1.5 text-xs">{data.parcelasVencidas.length}</Badge> : null}
                    </TabsTrigger>
                    <TabsTrigger value="avencer">
                        A Vencer (30d)
                        {data?.parcelasAVencer?.length ? <Badge variant="secondary" className="ml-1.5 text-xs">{data.parcelasAVencer.length}</Badge> : null}
                    </TabsTrigger>
                    <TabsTrigger value="comissoes">Comissões por Vendedor</TabsTrigger>
                </TabsList>

                <TabsContent value="vencidas">
                    <Card><CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader><TableRow>
                                    <TableHead className="pl-4">Cliente</TableHead>
                                    <TableHead className="text-center">Parcela</TableHead>
                                    <TableHead className="text-center">Vencimento</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                    <TableHead className="text-right">Restante</TableHead>
                                    <TableHead className="text-right pr-4">Dias Vencido</TableHead>
                                </TableRow></TableHeader>
                                <TableBody>
                                    {loading ? Array.from({length:5}).map((_,i)=><TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-7 w-full" /></TableCell></TableRow>) :
                                    (data?.parcelasVencidas ?? []).slice(0, 100).map((p, i) => (
                                        <TableRow key={`${p.orderId}-${p.installmentNumber}-${i}`}>
                                            <TableCell className="pl-4 font-medium text-sm max-w-[160px] truncate">{p.customerName || '—'}</TableCell>
                                            <TableCell className="text-center"><Badge variant="outline" className="text-xs">#{p.installmentNumber}</Badge></TableCell>
                                            <TableCell className="text-center text-sm text-muted-foreground">{p.dueDate?.slice(0,10)}</TableCell>
                                            <TableCell className="text-right tabular-nums text-sm">{fmt(p.amount)}</TableCell>
                                            <TableCell className="text-right tabular-nums text-sm font-semibold text-red-600">{fmt(p.remaining)}</TableCell>
                                            <TableCell className="text-right tabular-nums text-sm text-red-500 pr-4">{p.daysOverdue}d</TableCell>
                                        </TableRow>
                                    ))}
                                    {!data?.parcelasVencidas?.length && <TableRow><TableCell colSpan={6} className="text-center py-6 text-sm text-muted-foreground">Nenhuma parcela vencida.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent></Card>
                </TabsContent>

                <TabsContent value="avencer">
                    <Card><CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader><TableRow>
                                    <TableHead className="pl-4">Cliente</TableHead>
                                    <TableHead className="text-center">Parcela</TableHead>
                                    <TableHead className="text-center">Vencimento</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                    <TableHead className="text-right">Restante</TableHead>
                                    <TableHead className="text-right pr-4">Dias Restantes</TableHead>
                                </TableRow></TableHeader>
                                <TableBody>
                                    {loading ? Array.from({length:5}).map((_,i)=><TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-7 w-full" /></TableCell></TableRow>) :
                                    (data?.parcelasAVencer ?? []).map((p, i) => (
                                        <TableRow key={`${p.orderId}-${p.installmentNumber}-${i}`}>
                                            <TableCell className="pl-4 font-medium text-sm max-w-[160px] truncate">{p.customerName || '—'}</TableCell>
                                            <TableCell className="text-center"><Badge variant="outline" className="text-xs">#{p.installmentNumber}</Badge></TableCell>
                                            <TableCell className="text-center text-sm text-muted-foreground">{p.dueDate?.slice(0,10)}</TableCell>
                                            <TableCell className="text-right tabular-nums text-sm">{fmt(p.amount)}</TableCell>
                                            <TableCell className="text-right tabular-nums text-sm font-semibold text-amber-600">{fmt(p.remaining)}</TableCell>
                                            <TableCell className="text-right tabular-nums text-sm text-emerald-600 pr-4">{p.daysUntil}d</TableCell>
                                        </TableRow>
                                    ))}
                                    {!data?.parcelasAVencer?.length && <TableRow><TableCell colSpan={6} className="text-center py-6 text-sm text-muted-foreground">Nenhuma parcela a vencer nos próximos 30 dias.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent></Card>
                </TabsContent>

                <TabsContent value="comissoes">
                    <Card><CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader><TableRow>
                                    <TableHead className="pl-4">Vendedor</TableHead>
                                    <TableHead className="text-right">Gerada</TableHead>
                                    <TableHead className="text-right">Paga</TableHead>
                                    <TableHead className="text-right pr-4">Pendente</TableHead>
                                </TableRow></TableHeader>
                                <TableBody>
                                    {loading ? Array.from({length:4}).map((_,i)=><TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-7 w-full" /></TableCell></TableRow>) :
                                    (data?.comissoesPorVendedor ?? []).map(c => (
                                        <TableRow key={c.sellerId}>
                                            <TableCell className="pl-4 font-medium text-sm">{c.sellerName}</TableCell>
                                            <TableCell className="text-right tabular-nums text-sm">{fmtC(c.gerada)}</TableCell>
                                            <TableCell className="text-right tabular-nums text-sm text-emerald-600">{fmtC(c.paga)}</TableCell>
                                            <TableCell className={`text-right tabular-nums text-sm font-semibold pr-4 ${c.pendente > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>{fmtC(c.pendente)}</TableCell>
                                        </TableRow>
                                    ))}
                                    {!data?.comissoesPorVendedor?.length && <TableRow><TableCell colSpan={4} className="text-center py-6 text-sm text-muted-foreground">Nenhuma comissão no período.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent></Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
