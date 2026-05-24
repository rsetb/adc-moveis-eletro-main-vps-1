'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdminData } from '@/context/AdminContext';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { getFinancialSummaryAction } from '@/app/actions/admin/financials';
import type { FinancialPeriod, FinancialReport, OverdueInstallment, FinancialReportOrder } from '@/lib/types';
import { format, parseISO, isValid, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltipContent, ChartTooltip } from '@/components/ui/chart';
import {
    DollarSign, TrendingUp, Clock, AlertTriangle, ReceiptText,
    Users, Printer, RefreshCw, Download, ShoppingCart, BadgePercent,
} from 'lucide-react';

// ─── Formatters ──────────────────────────────────────────────────────────────

const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function parseAnyDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const t = value.trim();
    const iso = parseISO(t);
    if (isValid(iso)) return iso;
    const patterns = ['dd/MM/yy HH:mm:ss', 'dd/MM/yyyy HH:mm:ss', 'dd/MM/yy', 'dd/MM/yyyy'];
    for (const p of patterns) { const d = parse(t, p, new Date()); if (isValid(d)) return d; }
    const fb = new Date(t);
    return isValid(fb) ? fb : null;
}

function fmtDate(v: string) {
    const d = parseAnyDate(v);
    return d ? format(d, 'dd/MM/yyyy', { locale: ptBR }) : v;
}

function fmtDue(v: string) {
    const d = parseAnyDate(v);
    if (!d) return v;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Math.floor((today.getTime() - d.getTime()) / 86400000);
    return { label: format(d, 'dd/MM/yy'), days };
}

// ─── Period config ────────────────────────────────────────────────────────────

const PERIODS: { id: FinancialPeriod; label: string }[] = [
    { id: 'today', label: 'Hoje' },
    { id: 'week', label: '7 Dias' },
    { id: 'month', label: 'Mês' },
    { id: 'year', label: 'Ano' },
    { id: 'custom', label: 'Período' },
];

const statusLabel: Record<string, string> = {
    Processando: 'Processando',
    Enviado: 'Enviado',
    Entregue: 'Entregue',
    Cancelado: 'Cancelado',
    Excluído: 'Excluído',
};

const statusColor: Record<string, string> = {
    Processando: 'bg-blue-100 text-blue-800',
    Enviado: 'bg-yellow-100 text-yellow-800',
    Entregue: 'bg-green-100 text-green-800',
    Cancelado: 'bg-red-100 text-red-800',
    Excluído: 'bg-gray-100 text-gray-800',
};

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
    title, value, sub, icon: Icon, color = 'text-primary', accent = 'bg-primary/10',
}: {
    title: string; value: string; sub?: string;
    icon: React.ElementType; color?: string; accent?: string;
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <div className={`h-8 w-8 rounded-md flex items-center justify-center ${accent}`}>
                    <Icon className={`h-4 w-4 ${color}`} />
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
            </CardContent>
        </Card>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinanceiroPage() {
    const { commissionSummary } = useAdminData();
    const { settings } = useSettings();
    const { user } = useAuth();
    const isManager = user?.role === 'gerente';

    const [period, setPeriod] = useState<FinancialPeriod>('month');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [report, setReport] = useState<FinancialReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadReport = useCallback(async () => {
        setLoading(true);
        setError('');
        const res = await getFinancialSummaryAction({ period, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined });
        if (res.success && res.data) {
            setReport(res.data);
        } else {
            setError(res.error ?? 'Erro ao carregar dados financeiros.');
        }
        setLoading(false);
    }, [period, dateFrom, dateTo]);

    useEffect(() => {
        if (period !== 'custom') {
            loadReport();
        }
    }, [period, loadReport]);

    const handleCustomSearch = () => {
        if (!dateFrom || !dateTo) return;
        loadReport();
    };

    const handlePrint = () => window.print();

    const handleExportCSV = () => {
        if (!report) return;
        const rows = [
            ['ID', 'Cliente', 'Vendedor', 'Data', 'Status', 'Método', 'Total', 'Entrada', 'Comissão'],
            ...report.recentOrders.map(o => [
                o.id, o.customerName, o.sellerName ?? '', fmtDate(o.date),
                o.status, o.paymentMethod,
                o.total.toFixed(2), o.downPayment.toFixed(2), o.commission.toFixed(2),
            ]),
        ];
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `financeiro-${period}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    const chartConfig = {
        vendido: { label: 'Vendido', color: 'hsl(var(--primary))' },
        recebido: { label: 'Recebido', color: 'hsl(142 76% 36%)' },
    };

    // Overdue table sorted by most overdue first
    const overdueTable = useMemo(() => {
        if (!report) return [];
        return [...report.overdueInstallments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    }, [report]);

    if (isManager) {
        return (
            <div className="text-center py-20 text-muted-foreground">
                Acesse a página de Comissões para ver o desempenho dos vendedores.
            </div>
        );
    }

    return (
        <div className="space-y-6 print:space-y-4">
            {/* Header */}
            <div className="print:hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Financeiro</h1>
                    <p className="text-sm text-muted-foreground">Resumo real de vendas, recebimentos e comissões</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={loadReport} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!report}>
                        <Download className="h-4 w-4 mr-2" />
                        CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={handlePrint}>
                        <Printer className="h-4 w-4 mr-2" />
                        Imprimir
                    </Button>
                </div>
            </div>

            {/* Period filter */}
            <div className="print:hidden flex flex-wrap gap-2 items-center">
                {PERIODS.map(p => (
                    <Button
                        key={p.id}
                        variant={period === p.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPeriod(p.id)}
                    >
                        {p.label}
                    </Button>
                ))}
                {period === 'custom' && (
                    <div className="flex gap-2 items-center">
                        <Input
                            type="date" className="w-36 h-8 text-sm" value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                        />
                        <span className="text-muted-foreground text-sm">até</span>
                        <Input
                            type="date" className="w-36 h-8 text-sm" value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                        />
                        <Button size="sm" onClick={handleCustomSearch} disabled={!dateFrom || !dateTo || loading}>
                            Buscar
                        </Button>
                    </div>
                )}
            </div>

            {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{error}</div>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard
                    title="Total Vendido"
                    value={loading ? '—' : fmt(report?.totalVendido ?? 0)}
                    sub={loading ? '' : `${report?.totalPedidos ?? 0} pedidos`}
                    icon={ShoppingCart}
                    color="text-primary"
                    accent="bg-primary/10"
                />
                <SummaryCard
                    title="Total Recebido"
                    value={loading ? '—' : fmt(report?.totalRecebido ?? 0)}
                    sub="Parcelas pagas + entradas"
                    icon={DollarSign}
                    color="text-emerald-600"
                    accent="bg-emerald-500/10"
                />
                <SummaryCard
                    title="Em Aberto"
                    value={loading ? '—' : fmt(report?.totalEmAberto ?? 0)}
                    sub="Parcelas pendentes"
                    icon={Clock}
                    color="text-amber-600"
                    accent="bg-amber-500/10"
                />
                <SummaryCard
                    title="Vencido"
                    value={loading ? '—' : fmt(report?.totalVencido ?? 0)}
                    sub={loading ? '' : `${report?.parcelasVencidas ?? 0} parcelas`}
                    icon={AlertTriangle}
                    color="text-red-600"
                    accent="bg-red-500/10"
                />
                <SummaryCard
                    title="Lucro Estimado"
                    value={loading ? '—' : fmt(report?.lucroBruto ?? 0)}
                    sub="Vendas − custo dos produtos*"
                    icon={TrendingUp}
                    color="text-green-600"
                    accent="bg-green-500/10"
                />
                <SummaryCard
                    title="Custo Total*"
                    value={loading ? '—' : fmt(report?.custoTotal ?? 0)}
                    sub="Custo estimado (atual)"
                    icon={ReceiptText}
                    color="text-slate-600"
                    accent="bg-slate-500/10"
                />
                <SummaryCard
                    title="Comissões Geradas"
                    value={loading ? '—' : fmt(report?.comissoesGeradas ?? 0)}
                    sub={`A pagar: ${fmt(commissionSummary.totalPendingCommission)}`}
                    icon={BadgePercent}
                    color="text-violet-600"
                    accent="bg-violet-500/10"
                />
                <SummaryCard
                    title="Comissões Pagas"
                    value={loading ? '—' : fmt(report?.comissoesPagas ?? 0)}
                    sub="No período selecionado"
                    icon={Users}
                    color="text-blue-600"
                    accent="bg-blue-500/10"
                />
            </div>

            {/* Chart — last 12 months */}
            <Card>
                <CardHeader>
                    <CardTitle>Histórico — últimos 12 meses</CardTitle>
                    <CardDescription>Comparativo de vendas e recebimentos por mês</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading || !report?.monthlyData?.length ? (
                        <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                            {loading ? 'Carregando...' : 'Sem dados para exibir'}
                        </div>
                    ) : (
                        <ChartContainer config={chartConfig} className="h-72 w-full">
                            <ResponsiveContainer>
                                <BarChart data={report.monthlyData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                                    <CartesianGrid vertical={false} className="stroke-muted" />
                                    <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
                                    <YAxis
                                        tickFormatter={v => fmt(v as number).replace('R$ ', 'R$')}
                                        tickLine={false} axisLine={false} width={90}
                                        className="text-xs"
                                    />
                                    <ChartTooltip
                                        cursor={false}
                                        content={<ChartTooltipContent formatter={v => fmt(v as number)} />}
                                    />
                                    <Bar dataKey="vendido" fill="var(--color-vendido)" radius={3} maxBarSize={32} />
                                    <Bar dataKey="recebido" fill="var(--color-recebido)" radius={3} maxBarSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    )}
                </CardContent>
            </Card>

            {/* Overdue installments */}
            {(overdueTable.length > 0 || !loading) && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            Parcelas Vencidas
                            {overdueTable.length > 0 && (
                                <Badge className="bg-red-100 text-red-800 border-red-200">{overdueTable.length}</Badge>
                            )}
                        </CardTitle>
                        <CardDescription>Parcelas com vencimento anterior a hoje que ainda não foram quitadas</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="py-8 text-center text-muted-foreground text-sm">Carregando...</div>
                        ) : overdueTable.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground text-sm">Nenhuma parcela vencida no período.</div>
                        ) : (
                            <div className="max-h-80 overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Vencimento</TableHead>
                                            <TableHead>Dias</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead className="hidden md:table-cell">Vendedor</TableHead>
                                            <TableHead className="text-center hidden sm:table-cell">Parc.</TableHead>
                                            <TableHead className="text-right">Valor</TableHead>
                                            <TableHead className="text-right">Restante</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {overdueTable.map((inst, i) => {
                                            const due = fmtDue(inst.dueDate);
                                            const daysOverdue = typeof due === 'object' ? due.days : 0;
                                            return (
                                                <TableRow key={`${inst.orderId}-${inst.installmentNumber}-${i}`}>
                                                    <TableCell className="text-sm font-medium whitespace-nowrap">
                                                        {typeof due === 'object' ? due.label : String(due)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className={`text-xs font-semibold ${daysOverdue > 30 ? 'text-red-600' : daysOverdue > 7 ? 'text-orange-500' : 'text-yellow-600'}`}>
                                                            {daysOverdue}d
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-sm max-w-[160px] truncate">{inst.customerName}</TableCell>
                                                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{inst.sellerName ?? '—'}</TableCell>
                                                    <TableCell className="text-center hidden sm:table-cell text-sm">{inst.installmentNumber}</TableCell>
                                                    <TableCell className="text-right text-sm">{fmt(inst.amount)}</TableCell>
                                                    <TableCell className="text-right text-sm font-semibold text-red-600">{fmt(inst.remaining)}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Orders in period */}
            <Card>
                <CardHeader>
                    <CardTitle>Pedidos do Período</CardTitle>
                    <CardDescription>
                        {report ? `${report.totalPedidos} pedido(s) ativos` : 'Carregando...'}
                        {' '}— cancelados não são incluídos
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="py-8 text-center text-muted-foreground text-sm">Carregando...</div>
                    ) : !report?.recentOrders?.length ? (
                        <div className="py-8 text-center text-muted-foreground text-sm">Nenhum pedido no período.</div>
                    ) : (
                        <div className="max-h-96 overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead className="hidden md:table-cell">Vendedor</TableHead>
                                        <TableHead className="hidden sm:table-cell">Método</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right hidden lg:table-cell">Comissão</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {report.recentOrders.map(o => (
                                        <TableRow key={o.id}>
                                            <TableCell className="text-sm whitespace-nowrap">{fmtDate(o.date)}</TableCell>
                                            <TableCell className="text-sm max-w-[140px] truncate">{o.customerName}</TableCell>
                                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{o.sellerName ?? '—'}</TableCell>
                                            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{o.paymentMethod}</TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[o.status] ?? 'bg-gray-100 text-gray-700'}`}>
                                                    {statusLabel[o.status] ?? o.status}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right text-sm font-semibold">{fmt(o.total)}</TableCell>
                                            <TableCell className="hidden lg:table-cell text-right text-sm text-muted-foreground">{o.commission ? fmt(o.commission) : '—'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Print-only view */}
            <div className="hidden print:block">
                <div className="mb-6 border-b pb-4 flex justify-between">
                    <div>
                        <p className="font-bold text-lg">{settings.storeName}</p>
                        <p className="text-sm text-gray-600">{settings.storeAddress}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-bold">Relatório Financeiro</p>
                        <p className="text-sm text-gray-500">{new Date().toLocaleDateString('pt-BR')}</p>
                    </div>
                </div>
                {report && (
                    <>
                        <h2 className="text-base font-semibold mb-2">Resumo</h2>
                        <table className="w-full text-sm border-collapse mb-6">
                            <tbody>
                                {[
                                    ['Total Vendido', fmt(report.totalVendido)],
                                    ['Total Recebido', fmt(report.totalRecebido)],
                                    ['Em Aberto', fmt(report.totalEmAberto)],
                                    ['Vencido', fmt(report.totalVencido)],
                                    ['Lucro Estimado*', fmt(report.lucroBruto)],
                                    ['Comissões Geradas', fmt(report.comissoesGeradas)],
                                    ['Comissões Pagas', fmt(report.comissoesPagas)],
                                    ['Total de Pedidos', String(report.totalPedidos)],
                                    ['Parcelas Vencidas', String(report.parcelasVencidas)],
                                ].map(([label, value]) => (
                                    <tr key={label} className="border-b">
                                        <td className="py-1 font-medium">{label}</td>
                                        <td className="py-1 text-right font-semibold">{value}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p className="text-xs text-gray-400 mb-6">* Custo estimado com base nos valores atuais dos produtos</p>
                        <h2 className="text-base font-semibold mb-2">Pedidos do Período</h2>
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className="border-b-2">
                                    {['Data', 'Cliente', 'Vendedor', 'Método', 'Status', 'Total'].map(h => (
                                        <th key={h} className="text-left py-1 pr-2 font-bold">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {report.recentOrders.map(o => (
                                    <tr key={o.id} className="border-b">
                                        <td className="py-1 pr-2">{fmtDate(o.date)}</td>
                                        <td className="py-1 pr-2">{o.customerName}</td>
                                        <td className="py-1 pr-2">{o.sellerName ?? '—'}</td>
                                        <td className="py-1 pr-2">{o.paymentMethod}</td>
                                        <td className="py-1 pr-2">{o.status}</td>
                                        <td className="py-1 text-right font-semibold">{fmt(o.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                )}
            </div>
        </div>
    );
}
