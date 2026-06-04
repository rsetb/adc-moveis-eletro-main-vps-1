'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, TrendingUp, AlertTriangle, RefreshCw, Download, Printer, ShieldAlert } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/context/PermissionsContext';
import { hasAccess } from '@/lib/permissions';
import { getCustomersReportAction, type CustomersReportData, type CustomersReportFilters } from '@/app/actions/admin/reports';
import { exportToCSV } from '@/lib/report-export';
import type { FinancialPeriod } from '@/lib/types';

const fmt  = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtC = (v: number) => v >= 1_000_000 ? `R$ ${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `R$ ${(v/1_000).toFixed(1)}k` : fmt(v);

const PERIODS: { id: FinancialPeriod; label: string }[] = [
    { id: 'today', label: 'Hoje' }, { id: 'week', label: '7 dias' },
    { id: 'month', label: 'Mês' }, { id: 'year', label: 'Ano' }, { id: 'custom', label: 'Período' },
];

export default function RelatorioClientesPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { permissions, isLoading: permLoad } = usePermissions();

    const [data,       setData]       = useState<CustomersReportData | null>(null);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [search,     setSearch]     = useState('');
    const [rankPage,   setRankPage]   = useState(0);
    const PAGE_SIZE = 25;

    const [filters, setFilters] = useState<CustomersReportFilters>({ period: 'month', sellerId: '' });
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo,   setDateTo]   = useState('');

    const load = useCallback(async (showRefreshing = false) => {
        if (showRefreshing) setRefreshing(true); else setLoading(true);
        setError(null);
        const result = await getCustomersReportAction({
            ...filters,
            dateFrom: filters.period === 'custom' ? dateFrom : undefined,
            dateTo:   filters.period === 'custom' ? dateTo   : undefined,
        });
        if (result.success && result.data) { setData(result.data); setRankPage(0); }
        else setError(result.error ?? 'Erro ao carregar relatório.');
        setLoading(false); setRefreshing(false);
    }, [filters, dateFrom, dateTo]);

    useEffect(() => {
        if (!user || permLoad || !permissions) return;
        if (!hasAccess(user.role, 'relatorios-clientes', permissions)) { router.replace('/admin/pedidos'); return; }
        load();
    }, [user, permissions, permLoad, router, load]);

    const kpis = data?.kpis;
    const filteredRanking = (data?.rankingClientes ?? []).filter(c =>
        !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.code ?? '').toLowerCase().includes(search.toLowerCase())
    );
    const pagedRanking = filteredRanking.slice(rankPage * PAGE_SIZE, (rankPage + 1) * PAGE_SIZE);
    const totalRankPages = Math.ceil(filteredRanking.length / PAGE_SIZE);

    function handleExportRanking() {
        if (!data) return;
        exportToCSV(`clientes-ranking.csv`,
            ['Nome', 'Código', 'Telefone', 'Total Compras', 'Nº Pedidos'],
            data.rankingClientes.map(c => [c.name, c.code ?? '', c.phone, c.totalCompras, c.quantidadePedidos]),
        );
    }

    return (
        <div className="space-y-5 pb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Relatório de Clientes</h1>
                    {kpis?.periodoLabel && <p className="text-sm text-muted-foreground mt-0.5">{kpis.periodoLabel}</p>}
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-3.5 w-3.5 mr-1.5" />Imprimir</Button>
                    <Button variant="outline" size="sm" onClick={handleExportRanking} disabled={!data}><Download className="h-3.5 w-3.5 mr-1.5" />CSV</Button>
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
                        {data?.sellers && data.sellers.length > 0 && (
                            <Select value={filters.sellerId || 'all'} onValueChange={v => setFilters(f => ({ ...f, sellerId: v === 'all' ? '' : v }))}>
                                <SelectTrigger className="h-8 w-40 text-sm"><SelectValue placeholder="Vendedor" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos vendedores</SelectItem>
                                    {data.sellers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </CardContent>
            </Card>

            {error && <Card className="border-red-200 bg-red-50"><CardContent className="p-4 text-sm text-red-700">{error}</CardContent></Card>}

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Clientes',     val: String(kpis?.totalClientes ?? 0),    bg: 'bg-indigo-100',  icon: <Users className="h-5 w-5 text-indigo-600" /> },
                    { label: 'Ativos no Período',  val: String(kpis?.clientesAtivos ?? 0),   bg: 'bg-emerald-100', icon: <TrendingUp className="h-5 w-5 text-emerald-600" /> },
                    { label: 'Inadimplentes',       val: String(kpis?.inadimplentes ?? 0),    bg: 'bg-red-100',     icon: <AlertTriangle className="h-5 w-5 text-red-600" /> },
                    { label: 'Bloqueados',          val: String(data?.bloqueados?.length ?? 0), bg: 'bg-orange-100', icon: <ShieldAlert className="h-5 w-5 text-orange-600" /> },
                ].map(({ label, val, bg, icon }) => (
                    <Card key={label}>
                        <CardContent className="p-5 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                                {loading ? <Skeleton className="h-7 w-16 mt-1" /> : <p className="mt-1 text-2xl font-bold">{val}</p>}
                            </div>
                            <div className={`flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>{icon}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Highlights */}
            {!loading && (kpis?.maiorCliente || kpis?.maiorSaldo) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {kpis?.maiorCliente && (
                        <Card>
                            <CardContent className="p-5">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Maior Cliente (12 meses)</p>
                                <p className="mt-1 text-lg font-bold truncate">{kpis.maiorCliente.name}</p>
                                <p className="text-sm text-muted-foreground">{fmtC(kpis.maiorCliente.total)}</p>
                            </CardContent>
                        </Card>
                    )}
                    {kpis?.maiorSaldo && (
                        <Card className="border-red-100">
                            <CardContent className="p-5">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Maior Saldo em Aberto</p>
                                <p className="mt-1 text-lg font-bold truncate text-red-600">{kpis.maiorSaldo.name}</p>
                                <p className="text-sm text-red-500">{fmtC(kpis.maiorSaldo.total)}</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* Tables */}
            <Tabs defaultValue="ranking">
                <TabsList className="mb-3 flex-wrap">
                    <TabsTrigger value="ranking">Ranking</TabsTrigger>
                    <TabsTrigger value="inativos">Sem Compra (90d)</TabsTrigger>
                    <TabsTrigger value="inadimplentes">
                        Inadimplentes
                        {data?.inadimplentes?.length ? <Badge variant="destructive" className="ml-1.5 text-xs">{data.inadimplentes.length}</Badge> : null}
                    </TabsTrigger>
                    <TabsTrigger value="bloqueados">
                        Bloqueados
                        {data?.bloqueados?.length ? <Badge variant="secondary" className="ml-1.5 text-xs">{data.bloqueados.length}</Badge> : null}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="ranking">
                    <Card>
                        <div className="p-3 border-b">
                            <Input placeholder="Buscar cliente…" className="h-8 text-sm max-w-xs" value={search} onChange={e => { setSearch(e.target.value); setRankPage(0); }} />
                        </div>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead className="pl-4 w-8">#</TableHead>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>Cód.</TableHead>
                                        <TableHead>Telefone</TableHead>
                                        <TableHead className="text-right">Pedidos</TableHead>
                                        <TableHead className="text-right pr-4">Total Compras</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {loading ? Array.from({length:5}).map((_,i)=><TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-7 w-full" /></TableCell></TableRow>) :
                                        pagedRanking.map((c, i) => (
                                            <TableRow key={`${c.name}-${i}`}>
                                                <TableCell className="pl-4 text-muted-foreground text-xs">{rankPage * PAGE_SIZE + i + 1}</TableCell>
                                                <TableCell className="font-medium text-sm max-w-[160px] truncate">{c.name}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{c.code ?? '—'}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{c.phone}</TableCell>
                                                <TableCell className="text-right tabular-nums text-sm">{c.quantidadePedidos}</TableCell>
                                                <TableCell className="text-right tabular-nums text-sm font-semibold pr-4">{fmtC(c.totalCompras)}</TableCell>
                                            </TableRow>
                                        ))}
                                        {!pagedRanking.length && <TableRow><TableCell colSpan={6} className="text-center py-6 text-sm text-muted-foreground">Nenhum cliente com compras no período.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </div>
                            {totalRankPages > 1 && (
                                <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
                                    <span className="text-muted-foreground">Pág. {rankPage + 1} de {totalRankPages}</span>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" disabled={rankPage === 0} onClick={() => setRankPage(p => p - 1)}>Anterior</Button>
                                        <Button variant="outline" size="sm" disabled={rankPage >= totalRankPages - 1} onClick={() => setRankPage(p => p + 1)}>Próxima</Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="inativos">
                    <Card><CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader><TableRow>
                                    <TableHead className="pl-4">Nome</TableHead>
                                    <TableHead>Cód.</TableHead>
                                    <TableHead>Telefone</TableHead>
                                    <TableHead className="text-right pr-4">Última Compra</TableHead>
                                </TableRow></TableHeader>
                                <TableBody>
                                    {loading ? Array.from({length:5}).map((_,i)=><TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-7 w-full" /></TableCell></TableRow>) :
                                    (data?.semCompraRecente ?? []).map(c => (
                                        <TableRow key={c.id}>
                                            <TableCell className="pl-4 font-medium text-sm max-w-[180px] truncate">{c.name}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{c.code ?? '—'}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{c.phone}</TableCell>
                                            <TableCell className="text-right text-sm text-muted-foreground pr-4">{c.ultimaCompra ? c.ultimaCompra.slice(0, 10) : 'Nunca'}</TableCell>
                                        </TableRow>
                                    ))}
                                    {!data?.semCompraRecente?.length && <TableRow><TableCell colSpan={4} className="text-center py-6 text-sm text-muted-foreground">Todos os clientes compraram nos últimos 90 dias.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent></Card>
                </TabsContent>

                <TabsContent value="inadimplentes">
                    <Card><CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader><TableRow>
                                    <TableHead className="pl-4">Nome</TableHead>
                                    <TableHead>Telefone</TableHead>
                                    <TableHead className="text-right">Parcelas</TableHead>
                                    <TableHead className="text-right pr-4">Total Vencido</TableHead>
                                </TableRow></TableHeader>
                                <TableBody>
                                    {loading ? Array.from({length:5}).map((_,i)=><TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-7 w-full" /></TableCell></TableRow>) :
                                    (data?.inadimplentes ?? []).map((c, i) => (
                                        <TableRow key={`${c.name}-${i}`}>
                                            <TableCell className="pl-4 font-medium text-sm max-w-[180px] truncate">{c.name}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{c.phone}</TableCell>
                                            <TableCell className="text-right tabular-nums text-sm text-red-600 font-medium">{c.parcelasVencidas}</TableCell>
                                            <TableCell className="text-right tabular-nums text-sm font-bold text-red-600 pr-4">{fmtC(c.totalVencido)}</TableCell>
                                        </TableRow>
                                    ))}
                                    {!data?.inadimplentes?.length && <TableRow><TableCell colSpan={4} className="text-center py-6 text-sm text-muted-foreground">Nenhum cliente inadimplente.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent></Card>
                </TabsContent>

                <TabsContent value="bloqueados">
                    <Card><CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader><TableRow>
                                    <TableHead className="pl-4">Nome</TableHead>
                                    <TableHead>Cód.</TableHead>
                                    <TableHead>Telefone</TableHead>
                                    <TableHead className="pr-4">Motivo</TableHead>
                                </TableRow></TableHeader>
                                <TableBody>
                                    {loading ? Array.from({length:3}).map((_,i)=><TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-7 w-full" /></TableCell></TableRow>) :
                                    (data?.bloqueados ?? []).map(c => (
                                        <TableRow key={c.id}>
                                            <TableCell className="pl-4 font-medium text-sm">{c.name}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{c.code ?? '—'}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{c.phone}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground pr-4 max-w-[200px] truncate">{c.blockedReason ?? '—'}</TableCell>
                                        </TableRow>
                                    ))}
                                    {!data?.bloqueados?.length && <TableRow><TableCell colSpan={4} className="text-center py-6 text-sm text-muted-foreground">Nenhum cliente bloqueado.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent></Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
