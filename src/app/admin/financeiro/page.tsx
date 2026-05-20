'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAdmin, useAdminData } from '@/context/AdminContext';
import type { Order } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Legend } from 'recharts';
import { ChartContainer, ChartTooltipContent, ChartTooltip } from '@/components/ui/chart';
import { DollarSign, Clock, Percent, TrendingUp, Printer, ShoppingCart, Users as UsersIcon } from 'lucide-react';
import { format, isValid, parse, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { useAudit } from '@/context/AuditContext';


const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const parseFlexibleDate = (value: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const isoParsed = parseISO(trimmed);
  if (isValid(isoParsed)) return isoParsed;

  const patterns = [
    'dd/MM/yy HH:mm:ss',
    'dd/MM/yyyy HH:mm:ss',
    'dd/MM/yy HH:mm',
    'dd/MM/yyyy HH:mm',
    'dd/MM/yy',
    'dd/MM/yyyy',
  ];

  for (const pattern of patterns) {
    const parsed = parse(trimmed, pattern, new Date());
    if (isValid(parsed)) return parsed;
  }

  const fallback = new Date(trimmed);
  return isValid(fallback) ? fallback : null;
};

export default function FinanceiroPage() {
  const { orders, financialSummary, commissionSummary } = useAdminData();
  const { settings } = useSettings();
  const { user, users } = useAuth();
  const { logAction } = useAudit();
  const router = useRouter();
  const isManager = user?.role === 'gerente';
  const [printTitle, setPrintTitle] = useState('');

  const deliveredOrders = useMemo(() => {
    if (!orders) return [];
    return orders
      .filter((o) => o.status === 'Entregue')
      .sort((a, b) => {
        const timeA = parseFlexibleDate(a.date)?.getTime() ?? 0;
        const timeB = parseFlexibleDate(b.date)?.getTime() ?? 0;
        return timeB - timeA;
      });
  }, [orders]);

  const handlePrint = (type: 'sales' | 'profits' | 'all') => {
    let title = 'Relatório Financeiro';

    document.body.classList.remove('print-sales-only', 'print-profits-only');

    if (type === 'sales') {
      title = 'Relatório de Vendas';
      document.body.classList.add('print-sales-only');
    } else if (type === 'profits') {
      title = 'Relatório de Lucros';
      document.body.classList.add('print-profits-only');
    }

    setPrintTitle(title);

    setTimeout(() => {
      window.print();
      document.body.className = '';
    }, 100);
  };

  const chartConfig = {
    total: {
      label: 'Vendas',
      color: 'hsl(var(--primary))',
    },
  };

  return (
    <div className="space-y-8">
      <div className="print-hidden space-y-6">
        <div className="rounded-xl border bg-gradient-to-r from-primary/10 via-background to-background p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
              <p className="text-sm text-muted-foreground">
                Resumo de vendas, lucros e comissões, com relatórios para impressão.
              </p>
            </div>
            {!isManager && (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => handlePrint('all')}>
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir Tudo
                </Button>
                <Button variant="outline" onClick={() => handlePrint('sales')}>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Vendas
                </Button>
                <Button variant="outline" onClick={() => handlePrint('profits')}>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Lucros
                </Button>
              </div>
            )}
          </div>
        </div>
        {isManager ? (
          <div className="text-center py-12 text-muted-foreground">
            Acesse a página de Comissões para ver o desempenho dos vendedores.
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <DollarSign className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-sm font-medium">Vendas do Mês</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tracking-tight">{formatCurrency(financialSummary.totalVendido)}</div>
                  <p className="text-xs text-muted-foreground">Pedidos do mês atual</p>
                </CardContent>
              </Card>
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-sm font-medium">Lucro Bruto</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tracking-tight">{formatCurrency(financialSummary.lucroBruto)}</div>
                  <p className="text-xs text-muted-foreground">Receita − custo</p>
                </CardContent>
              </Card>
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
                      <Clock className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-sm font-medium">Contas a Receber</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tracking-tight">{formatCurrency(financialSummary.totalPendente)}</div>
                  <p className="text-xs text-muted-foreground">Parcelas pendentes</p>
                </CardContent>
              </Card>
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-500/10 text-blue-600">
                      <Percent className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-sm font-medium">Comissões a Pagar</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tracking-tight">{formatCurrency(commissionSummary.totalPendingCommission)}</div>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              <Card className="overflow-hidden">
                <CardHeader className="space-y-1">
                  <CardTitle>Vendas Mensais</CardTitle>
                  <CardDescription>Histórico dos totais vendidos por mês.</CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                  <ChartContainer config={chartConfig} className="h-[350px] w-full">
                    <ResponsiveContainer>
                      <BarChart data={financialSummary.monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="name"
                          tickLine={false}
                          tickMargin={10}
                          axisLine={false}
                          className="capitalize"
                        />
                        <YAxis
                          tickFormatter={(value) => formatCurrency(value as number)}
                          tickLine={false}
                          axisLine={false}
                          width={100}
                        />
                        <ChartTooltip
                          cursor={false}
                          content={<ChartTooltipContent
                            formatter={(value) => formatCurrency(value as number)}
                          />}
                        />
                        <Legend />
                        <Bar dataKey="total" fill="var(--color-total)" radius={4} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>

      {/* Print-only view */}
      <div className="hidden print-only">
        <div className="mb-8">
          <div className="flex justify-between items-start pb-4 border-b">
            <div>
              <div className="text-xs">
                <p className="font-bold">{settings.storeName}</p>
                <p className="whitespace-pre-line">{settings.storeAddress}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">{new Date().toLocaleDateString('pt-BR')}</p>
              <p className="text-lg font-bold">{printTitle}</p>
            </div>
          </div>
        </div>

        <div className="print-section print-section-profits print-section-sales space-y-6">
          <h2 className="text-xl font-semibold text-center">Resumo Financeiro</h2>
          <table className="w-full text-base border-collapse">
            <tbody>
              <tr className="border-b">
                <td className="p-2 font-medium">Vendas do Mês</td>
                <td className="p-2 text-right font-bold">{formatCurrency(financialSummary.totalVendido)}</td>
              </tr>
              <tr className="border-b">
                <td className="p-2 font-medium">Lucro Bruto</td>
                <td className="p-2 text-right font-bold">{formatCurrency(financialSummary.lucroBruto)}</td>
              </tr>
              <tr className="border-b">
                <td className="p-2 font-medium">Contas a Receber</td>
                <td className="p-2 text-right font-bold">{formatCurrency(financialSummary.totalPendente)}</td>
              </tr>
              <tr className="border-b">
                <td className="p-2 font-medium">Comissões a Pagar</td>
                <td className="p-2 text-right font-bold">{formatCurrency(commissionSummary.totalPendingCommission)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="print-section print-section-sales mt-8">
          <h2 className="text-xl font-semibold text-center mb-4">Vendas Mensais</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2">
                <th className="text-left p-2 font-bold">Mês/Ano</th>
                <th className="text-left p-2 font-bold">Total Vendido</th>
              </tr>
            </thead>
            <tbody>
              {financialSummary.monthlyData.map(item => (
                <tr key={item.name} className="border-b last:border-none">
                  <td className="p-2 capitalize">{item.name}</td>
                  <td className="p-2 text-right font-semibold">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-8">
            <h2 className="text-xl font-semibold text-center mb-4">Relatório de Vendas Entregues</h2>
            {deliveredOrders.length > 0 ? (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2">
                    <th className="text-left p-2 font-bold">Data</th>
                    <th className="text-left p-2 font-bold">Pedido</th>
                    <th className="text-left p-2 font-bold">Cliente</th>
                    <th className="text-left p-2 font-bold">Vendedor</th>
                    <th className="text-left p-2 font-bold">Valor</th>
                    <th className="text-left p-2 font-bold">Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveredOrders.map(order => (
                    <tr key={order.id} className="border-b last:border-none">
                      <td className="p-2">
                        {(() => {
                          const date = parseFlexibleDate(order.date);
                          return date ? format(date, 'dd/MM/yy') : order.date;
                        })()}
                      </td>
                      <td className="p-2 font-mono">{order.id}</td>
                      <td className="p-2">{order.customer.name}</td>
                      <td className="p-2">{order.sellerName}</td>
                      <td className="p-2 text-right">{formatCurrency(order.total)}</td>
                      <td className="p-2 text-right font-semibold">{formatCurrency(order.commission || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <ShoppingCart className="mx-auto h-8 w-8" />
                <p className="mt-2">Nenhuma venda entregue no período.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
