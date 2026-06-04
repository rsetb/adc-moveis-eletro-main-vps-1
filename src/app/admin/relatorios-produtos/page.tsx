'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, TrendingUp, AlertTriangle, RefreshCw, Download, Printer } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/context/PermissionsContext';
import { hasAccess } from '@/lib/permissions';
import { getProductsReportAction, type ProductsReportData, type ProductsReportFilters } from '@/app/actions/admin/reports';
import { exportToCSV } from '@/lib/report-export';
import type { FinancialPeriod } from '@/lib/types';

const fmt  = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtC = (v: number) => v >= 1_000_000 ? `R$ ${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `R$ ${(v/1_000).toFixed(1)}k` : fmt(v);

const BAR_COLORS = ['#6366f1','#8b5cf6','#a78bfa','#c4b5fd','#ddd6fe','#ede9fe','#0ea5e9','#38bdf8','#7dd3fc','#bae6fd'];
const PERIODS: { id: FinancialPeriod; label: string }[] = [
    { id: 'today', label: 'Hoje' },{ id: 'week', label: '7 dias' },
    { id: 'month', label: 'Mês' },{ id: 'year', label: 'Ano' },{ id: 'custom', label: 'Período' },
];

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border bg-card shadow-md px-3 py-2 text-sm">
            <p className="font-semibold mb-1 truncate max-w-[180px]">{label}</p>
            {payload.map((p: any) => (
                <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' && p.value > 100 ? fmtC(p.value) : p.value}</p>
            ))}
        </div>
    );
}

export default function RelatorioProdutosPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { permissions, isLoading: permLoad } = usePermissions();

    const [data,       setData]       = useState<ProductsReportData | null>(null);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [search,     setSearch]     = useState('');

    const [filters, setFilters] = useState<ProductsReportFilters>({ period: 'month' });
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo,   setDateTo]   = useState('');

    const load = useCallback(async (showRefreshing = false) => {
        if (showRefreshing) setRefreshing(true); else setLoading(true);
        setError(null);
        const result = await getProductsReportAction({
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
        if (!hasAccess(user.role, 'relatorios-produtos', permissions)) { router.replace('/admin/pedidos'); return; }
        load();
    }, [user, permissions, permLoad, router, load]);

    const topChart = (data?.topPorQtd ?? []).slice(0, 10).map(p => ({ name: p.name.length > 20 ? p.name.slice(0, 20) + '…' : p.name, qtd: p.qtd, total: p.total }));
    const catChart  = (data?.vendasPorCategoria ?? []).slice(0, 10);

    const filteredZero = (data?.semVendas ?? []).filter(p =>
        !search || p.name.toLowerCase().includes(search.toLowerCase())
    );

    function handleExportTop() {
        if (!data) return;
        exportToCSV(`produtos-top-${filters.period}.csv`,
            ['Produto', 'Categoria', 'Qtd Vendida', 'Faturamento', 'Lucro Bruto'],
            data.topPorQtd.map(p => [p.name, p.category ?? '', p.qtd, p.total, p.lucro ?? '']),
        );
    }

    return (
        <div className="space-y-5 pb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Relatório de Produtos</h1>
                    {data?.kpis.periodoLabel && <p className="text-sm text-muted-foreground mt-0.5">{data.kpis.periodoLabel}</p>}
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-3.5 w-3.5 mr-1.5" />Imprimir</Button>
                    <Button variant="outline" size="sm" onClick={handleExportTop} disabled={!data}><Download className="h-3.5 w-3.5 mr-1.5" />CSV</Button>
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
                    </div>
                </CardContent>
            </Card>

            {error && <Card className="border-red-200 bg-red-50"><CardContent className="p-4 text-sm text-red-700">{error}</CardContent></Card>}

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Produtos Vendidos',   val: String(data?.kpis.produtosVendidos ?? 0),   bg: 'bg-indigo-100',  icon: <Package className="h-5 w-5 text-indigo-600" /> },
                    { label: 'Qtd Total Vendida',    val: String(data?.kpis.qtyTotal ?? 0),           bg: 'bg-emerald-100', icon: <TrendingUp className="h-5 w-5 text-emerald-600" /> },
                    { label: 'Mais Vendido (qtd)',   val: data?.kpis.topNome ?? '—',                  bg: 'bg-amber-100',   icon: <TrendingUp className="h-5 w-5 text-amber-600" /> },
                    { label: 'Maior Faturamento',    val: data?.kpis.topFaturamentoNome ?? '—',        bg: 'bg-violet-100',  icon: <TrendingUp className="h-5 w-5 text-violet-600" /> },
                ].map(({ label, val, bg, icon }) => (
                    <Card key={label}>
                        <CardContent className="p-5 flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                                {loading ? <Skeleton className="h-7 w-28 mt-1" /> : <p className="mt-1 text-lg font-bold truncate" title={val}>{val}</p>}
                            </div>
                            <div className={`flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>{icon}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Top 10 por Quantidade Vendida</CardTitle></CardHeader>
                    <CardContent className="pl-0 pr-4">
                        {loading ? <Skeleton className="h-52 w-full" /> : (
                            <ResponsiveContainer width="100%" height={210}>
                                <BarChart data={topChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} width={100} tickLine={false} axisLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="qtd" name="Qtd" radius={[0, 4, 4, 0]}>
                                        {topChart.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Faturamento por Categoria</CardTitle></CardHeader>
                    <CardContent className="pl-0 pr-4">
                        {loading ? <Skeleton className="h-52 w-full" /> : (
                            <ResponsiveContainer width="100%" height={210}>
                                <BarChart data={catChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={v => fmtC(v).replace('R$ ','')} />
                                    <YAxis type="category" dataKey="category" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} width={90} tickLine={false} axisLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="total" name="Total" radius={[0, 4, 4, 0]}>
                                        {catChart.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Tables */}
            <Tabs defaultValue="top-qtd">
                <TabsList className="mb-3">
                    <TabsTrigger value="top-qtd">Top por Qtd</TabsTrigger>
                    <TabsTrigger value="top-fat">Top por Faturamento</TabsTrigger>
                    <TabsTrigger value="sem-venda">
                        Sem Venda
                        {data?.semVendas?.length ? <Badge variant="secondary" className="ml-1.5 text-xs">{data.semVendas.length}</Badge> : null}
                    </TabsTrigger>
                    <TabsTrigger value="critico">
                        Est. Crítico
                        {data?.estoqueCritico?.length ? <Badge variant="destructive" className="ml-1.5 text-xs">{data.estoqueCritico.length}</Badge> : null}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="top-qtd">
                    <Card><CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader><TableRow>
                                    <TableHead className="pl-4 w-8">#</TableHead>
                                    <TableHead>Produto</TableHead>
                                    <TableHead>Categoria</TableHead>
                                    <TableHead className="text-right">Qtd</TableHead>
                                    <TableHead className="text-right">Faturamento</TableHead>
                                    <TableHead className="text-right pr-4">Lucro Bruto</TableHead>
                                </TableRow></TableHeader>
                                <TableBody>
                                    {loading ? Array.from({length:5}).map((_,i)=><TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>) :
                                    (data?.topPorQtd ?? []).map((p, i) => (
                                        <TableRow key={p.id}>
                                            <TableCell className="pl-4 text-muted-foreground text-xs">{i+1}</TableCell>
                                            <TableCell className="font-medium text-sm max-w-[200px] truncate">{p.name}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{p.category ?? '—'}</TableCell>
                                            <TableCell className="text-right tabular-nums text-sm">{p.qtd}</TableCell>
                                            <TableCell className="text-right tabular-nums text-sm">{fmtC(p.total)}</TableCell>
                                            <TableCell className="text-right tabular-nums text-sm pr-4">{p.lucro != null ? fmtC(p.lucro) : '—'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent></Card>
                </TabsContent>

                <TabsContent value="top-fat">
                    <Card><CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader><TableRow>
                                    <TableHead className="pl-4 w-8">#</TableHead>
                                    <TableHead>Produto</TableHead>
                                    <TableHead>Categoria</TableHead>
                                    <TableHead className="text-right">Faturamento</TableHead>
                                    <TableHead className="text-right">Qtd</TableHead>
                                    <TableHead className="text-right pr-4">Lucro Bruto</TableHead>
                                </TableRow></TableHeader>
                                <TableBody>
                                    {loading ? Array.from({length:5}).map((_,i)=><TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>) :
                                    (data?.topPorFaturamento ?? []).map((p, i) => (
                                        <TableRow key={p.id}>
                                            <TableCell className="pl-4 text-muted-foreground text-xs">{i+1}</TableCell>
                                            <TableCell className="font-medium text-sm max-w-[200px] truncate">{p.name}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{p.category ?? '—'}</TableCell>
                                            <TableCell className="text-right tabular-nums text-sm font-semibold">{fmtC(p.total)}</TableCell>
                                            <TableCell className="text-right tabular-nums text-sm">{p.qtd}</TableCell>
                                            <TableCell className="text-right tabular-nums text-sm pr-4">{p.lucro != null ? fmtC(p.lucro) : '—'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent></Card>
                </TabsContent>

                <TabsContent value="sem-venda">
                    <Card>
                        <div className="p-3 border-b">
                            <Input placeholder="Buscar produto…" className="h-8 text-sm max-w-xs" value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead className="pl-4">Produto</TableHead>
                                        <TableHead>Categoria</TableHead>
                                        <TableHead className="text-right pr-4">Estoque</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {loading ? Array.from({length:5}).map((_,i)=><TableRow key={i}><TableCell colSpan={3}><Skeleton className="h-6 w-full" /></TableCell></TableRow>) :
                                        filteredZero.slice(0, 100).map(p => (
                                            <TableRow key={p.id}>
                                                <TableCell className="pl-4 font-medium text-sm">{p.name}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{p.category ?? '—'}</TableCell>
                                                <TableCell className="text-right tabular-nums text-sm pr-4">{p.stock}</TableCell>
                                            </TableRow>
                                        ))}
                                        {!filteredZero.length && <TableRow><TableCell colSpan={3} className="text-center py-6 text-sm text-muted-foreground">Todos os produtos tiveram vendas no período.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="critico">
                    <Card><CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader><TableRow>
                                    <TableHead className="pl-4">Produto</TableHead>
                                    <TableHead>Categoria</TableHead>
                                    <TableHead className="text-right">Estoque</TableHead>
                                    <TableHead className="text-right pr-4">Mínimo</TableHead>
                                </TableRow></TableHeader>
                                <TableBody>
                                    {loading ? Array.from({length:5}).map((_,i)=><TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-6 w-full" /></TableCell></TableRow>) :
                                    (data?.estoqueCritico ?? []).map(p => (
                                        <TableRow key={p.id}>
                                            <TableCell className="pl-4 font-medium text-sm">{p.name}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{p.category ?? '—'}</TableCell>
                                            <TableCell className="text-right tabular-nums text-sm font-semibold text-red-600">{p.stock}</TableCell>
                                            <TableCell className="text-right tabular-nums text-sm pr-4">{p.minStock}</TableCell>
                                        </TableRow>
                                    ))}
                                    {!data?.estoqueCritico?.length && <TableRow><TableCell colSpan={4} className="text-center py-6 text-sm text-muted-foreground">Nenhum produto com estoque crítico.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent></Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
