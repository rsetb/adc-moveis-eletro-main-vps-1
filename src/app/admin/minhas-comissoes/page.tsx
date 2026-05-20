

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAdmin, useAdminData } from '@/context/AdminContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, PiggyBank, BadgePercent, Eye, Undo2, Users as UsersIcon, Printer } from 'lucide-react';
import { format, parseISO, isValid, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAudit } from '@/context/AuditContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import type { Order } from '@/lib/types';


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

const formatOrderProducts = (items: Order['items']) => {
  return items.map((item) => `${item.quantity}x ${item.name}`).join(', ');
};

type SellerPerformanceDetails = {
  id: string;
  name: string;
  salesCount: number;
  totalSold: number;
  totalCommission: number;
  orders: Order[];
}

type SellerCommissionDetails = {
  id: string;
  name: string;
  total: number;
  count: number;
  orderIds: string[];
};

const meses = [
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' }, { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' }, { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
];

export default function MyCommissionsPage() {
  const { reverseCommissionPayment, payCommissions } = useAdmin();
  const { orders, commissionPayments, commissionSummary } = useAdminData();
  const { user, users } = useAuth();
  const { logAction } = useAudit();
  const router = useRouter();

  const isAdmin = user?.role === 'admin' || user?.role === 'gerente';
  const isSuperAdmin = user?.role === 'admin';
  const currentMonthKey = format(new Date(), 'yyyy-MM');

  const [mesSelecionado, setMesSelecionado] = useState(() => format(new Date(), 'MM'));
  const [anoSelecionado, setAnoSelecionado] = useState(() => format(new Date(), 'yyyy'));
  const [isPerformanceDetailModalOpen, setIsPerformanceDetailModalOpen] = useState(false);
  const [selectedPerformanceSeller, setSelectedPerformanceSeller] = useState<SellerPerformanceDetails | null>(null);
  const [isCommissionDetailModalOpen, setIsCommissionDetailModalOpen] = useState(false);
  const [selectedCommissionSeller, setSelectedCommissionSeller] = useState<SellerCommissionDetails | null>(null);
  
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [sellerToPay, setSellerToPay] = useState<SellerCommissionDetails | null>(null);
  const [paymentMonth, setPaymentMonth] = useState(() => format(new Date(), 'MM'));
  const [paymentYear, setPaymentYear] = useState(() => format(new Date(), 'yyyy'));

  const getMonthKey = (isoDate: string) => {
    try {
      return format(parseISO(isoDate), 'yyyy-MM');
    } catch {
      return null;
    }
  };

  const anosDisponiveis = useMemo(() => {
    if (!orders) return [anoSelecionado];
    const years = new Set<string>();
    orders.forEach((o) => {
      const date = parseFlexibleDate(o.date);
      if (date) {
        years.add(format(date, 'yyyy'));
      }
    });
    const sorted = Array.from(years).sort((a, b) => Number(b) - Number(a));
    return sorted.length > 0 ? sorted : [anoSelecionado];
  }, [orders, anoSelecionado]);

  useEffect(() => {
    if (!anosDisponiveis.includes(anoSelecionado)) {
      setAnoSelecionado(anosDisponiveis[0]);
    }
  }, [anosDisponiveis, anoSelecionado]);

  const ordersDoPeriodo = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o) => {
      const date = parseFlexibleDate(o.date);
      if (!date) return false;
      return format(date, 'MM') === mesSelecionado && format(date, 'yyyy') === anoSelecionado;
    });
  }, [orders, mesSelecionado, anoSelecionado]);

  const rotuloPeriodo = useMemo(() => {
    const monthLabel = meses.find(m => m.value === mesSelecionado)?.label ?? mesSelecionado;
    return `${monthLabel}/${anoSelecionado}`;
  }, [mesSelecionado, anoSelecionado]);

  const sellerPerformance = useMemo(() => {
    if (!users) return [];

    const performanceMap = new Map<string, SellerPerformanceDetails>();

    users.forEach(seller => {
      if (seller.role === 'vendedor' || seller.role === 'gerente' || seller.role === 'admin' || seller.role === 'vendedor_externo' || seller.role === 'vendedor_cobranca') {
        performanceMap.set(seller.id, { id: seller.id, name: seller.name, salesCount: 0, totalSold: 0, totalCommission: 0, orders: [] });
      }
    });

    ordersDoPeriodo.forEach(order => {
      if (order.sellerId && performanceMap.has(order.sellerId) && order.status !== 'Cancelado' && order.status !== 'Excluído') {
        const sellerData = performanceMap.get(order.sellerId)!;
        sellerData.salesCount += 1;
        sellerData.totalSold += order.total;
        sellerData.totalCommission += order.commission || 0;
        sellerData.orders.push(order);
        performanceMap.set(order.sellerId, sellerData);
      }
    });

    return Array.from(performanceMap.values())
      .sort((a, b) => {
        if (b.totalSold !== a.totalSold) return b.totalSold - a.totalSold;
        return a.name.localeCompare(b.name);
      });
  }, [ordersDoPeriodo, users]);

  const sellerPerformanceWithCommission = useMemo(() => {
    return sellerPerformance.filter((s) => s.salesCount > 0 && s.totalCommission > 0);
  }, [sellerPerformance]);

  const handleOpenPerformanceDetails = (seller: SellerPerformanceDetails) => {
    setSelectedPerformanceSeller(seller);
    setIsPerformanceDetailModalOpen(true);
  };

  const handlePrintSellers = () => {
    const title = `Relatório de Vendas e Comissões por Vendedor - ${rotuloPeriodo}`;
    const originalTitle = document.title;
    document.title = title;
    
    // Simplistic print for the sellers table
    const printContents = document.getElementById('seller-performance-table')?.innerHTML;
    if (!printContents) return;

    const originalContents = document.body.innerHTML;
    document.body.innerHTML = `
      <div style="padding: 20px; font-family: sans-serif;">
        <h1 style="text-align: center; margin-bottom: 20px;">${title}</h1>
        ${printContents}
      </div>
    `;
    window.print();
    document.body.innerHTML = originalContents;
    document.title = originalTitle;
    window.location.reload();
  };

  const handlePrintSingleSeller = () => {
    if (!selectedPerformanceSeller) return;
    const printContents = document.getElementById('seller-report-modal-content')?.innerHTML;
    if (!printContents) return;

    const originalContents = document.body.innerHTML;
    const header = `
      <div style="margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 1rem; border-bottom: 1px solid #ccc; font-family: sans-serif;">
        <div>
          <h1 style="font-size: 1.5rem; font-weight: bold;">Relatório de Vendas e Comissões - ${selectedPerformanceSeller.name}</h1>
          <p style="font-size: 0.9rem; color: #666;">Período: ${rotuloPeriodo}</p>
          <p style="font-size: 0.9rem; color: #666;">Gerado em: ${new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>
    `;

    document.body.innerHTML = `<div style="padding: 20px;">${header}${printContents}</div>`;
    window.print();
    document.body.innerHTML = originalContents;
    window.location.reload();
  }

  const handlePayCommission = async () => {
    if (!sellerToPay) return;
    
    const monthLabel = meses.find(m => m.value === paymentMonth)?.label || paymentMonth;
    const period = `${monthLabel}/${paymentYear}`;
    
    const paymentId = await payCommissions(sellerToPay.id, sellerToPay.name, sellerToPay.total, sellerToPay.orderIds, period, logAction, user);
    if (paymentId) {
      setIsPayModalOpen(false);
      setSellerToPay(null);
      router.push(`/admin/comprovante-comissao/${paymentId}`);
    }
  };

  const openPayModal = (seller: SellerCommissionDetails) => {
    setSellerToPay(seller);
    setIsPayModalOpen(true);
  };

  const handleOpenCommissionDetails = (seller: SellerCommissionDetails) => {
    setSelectedCommissionSeller(seller);
    setIsCommissionDetailModalOpen(true);
  };

  const ordersForSelectedCommissionSeller = useMemo(() => {
    if (!selectedCommissionSeller) return [];
    return orders.filter(o => selectedCommissionSeller.orderIds.includes(o.id));
  }, [selectedCommissionSeller, orders]);
  
  const allPendingCommissions = useMemo(() => {
    if (!orders) return [];
    return orders.filter(o => o.status === 'Entregue' && typeof o.commission === 'number' && o.commission > 0 && !o.commissionPaid);
  }, [orders]);

  const commissionsBySellerGlobal = useMemo(() => {
    if (!isAdmin) return [];
    const bySeller = new Map<string, { id: string; name: string; total: number; count: number; orderIds: string[] }>();
    allPendingCommissions.forEach((order) => {
      const sellerId = order.sellerId || 'unknown';
      const sellerName = order.sellerName || 'Vendedor Desconhecido';
      const current = bySeller.get(sellerId) || { id: sellerId, name: sellerName, total: 0, count: 0, orderIds: [] };
      current.total += order.commission || 0;
      current.count += 1;
      current.orderIds.push(order.id);
      bySeller.set(sellerId, current);
    });
    return Array.from(bySeller.values())
      .filter((s) => s.count > 0)
      .sort((a, b) => b.total - a.total);
  }, [isAdmin, allPendingCommissions]);

  const pendingCommissions = useMemo(() => {
    if (!user || !orders) return [];
    
    let userOrders = orders.filter(o => {
      const isPending = o.status === 'Entregue' && typeof o.commission === 'number' && o.commission > 0 && !o.commissionPaid;
      if (!isPending) return false;
      if (getMonthKey(o.date) !== currentMonthKey) return false;
      if (isAdmin) return true;
      return o.sellerId === user.id;
    });
    return userOrders.sort((a, b) => {
      const aTime = parseISO(a.date).getTime();
      const bTime = parseISO(b.date).getTime();
      return bTime - aTime;
    });
  }, [orders, user, isAdmin, currentMonthKey]);

  const totalPending = pendingCommissions.reduce((acc, order) => acc + (order.commission || 0), 0);

  const myPaidCommissions = useMemo(() => {
    if (!user || !commissionPayments) return [];
    return commissionPayments
      .filter(p => p.sellerId === user.id)
      .filter(p => getMonthKey(p.paymentDate) === currentMonthKey)
      .sort((a,b) => parseISO(b.paymentDate).getTime() - parseISO(a.paymentDate).getTime());
  }, [commissionPayments, user, currentMonthKey]);

  const paidTotal = myPaidCommissions.reduce((acc, p) => acc + p.amount, 0);

  const allPaymentsThisMonth = useMemo(() => {
    if (!commissionPayments) return [];
    return commissionPayments
      .filter((p) => getMonthKey(p.paymentDate) === currentMonthKey)
      .sort((a, b) => parseISO(b.paymentDate).getTime() - parseISO(a.paymentDate).getTime());
  }, [commissionPayments, currentMonthKey]);

  const paidTotalForCards = isAdmin
    ? allPaymentsThisMonth.reduce((acc, p) => acc + p.amount, 0)
    : paidTotal;

  const paidCountForCards = isAdmin ? allPaymentsThisMonth.length : myPaidCommissions.length;


  if (!user) {
    return <p>Carregando...</p>;
  }


  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgePercent className="h-6 w-6" />
            Minhas Comissões
          </CardTitle>
          <CardDescription>
            Acompanhe suas comissões a receber e o histórico de pagamentos.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid gap-4 md:grid-cols-2 mb-8">
                <Card className="bg-amber-500/10 border-amber-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{isAdmin ? 'Comissão Pendente (Equipe)' : 'Saldo a Receber'}</CardTitle>
                        <DollarSign className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{formatCurrency(totalPending)}</div>
                        <p className="text-xs text-muted-foreground">{isAdmin ? `Comissões pendentes de ${pendingCommissions.length} vendas (mês atual).` : `Comissões de ${pendingCommissions.length} vendas entregues.`}</p>
                    </CardContent>
                </Card>
                <Card className="bg-green-500/10 border-green-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{isAdmin ? 'Comissão Paga no Mês (Equipe)' : 'Total Já Recebido'}</CardTitle>
                        <PiggyBank className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{formatCurrency(paidTotalForCards)}</div>
                        <p className="text-xs text-muted-foreground">Total de {paidCountForCards} pagamentos no mês.</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="pending" className="w-full">
                <div className="overflow-x-auto">
                    <TabsList className="w-full justify-start md:w-auto">
                        <TabsTrigger value="pending">Comissões Pendentes</TabsTrigger>
                    <TabsTrigger value="history">Meus Pagamentos</TabsTrigger>
                    {isAdmin && <TabsTrigger value="by_seller_performance">Vendas e Comissões por Vendedor</TabsTrigger>}
                    {isSuperAdmin && <TabsTrigger value="by_seller">Comissões a Pagar</TabsTrigger>}
                    {isSuperAdmin && <TabsTrigger value="all_history">Histórico Geral</TabsTrigger>}
                    </TabsList>
                </div>
                <TabsContent value="pending" className="mt-4">
                     <Card>
                        <CardHeader>
                            <CardTitle>{isAdmin ? 'Comissões Pendentes (Todos os Vendedores)' : 'Minhas Comissões a Receber'}</CardTitle>
                            <CardDescription>{isAdmin ? 'Lista de todas as vendas concluídas de todos os vendedores, cuja comissão ainda não foi paga.' : 'Esta é a lista de todas as suas vendas concluídas cuja comissão ainda não foi paga.'}</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Data da Venda</TableHead>
                                            {isAdmin && <TableHead>Vendedor</TableHead>}
                                            <TableHead>Pedido ID</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead className="text-right">Valor da Comissão</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pendingCommissions.length > 0 ? (
                                            pendingCommissions.map(order => (
                                                <TableRow key={order.id}>
                                                    <TableCell>{format(parseISO(order.date), "dd/MM/yyyy")}</TableCell>
                                                    {isAdmin && <TableCell>{order.sellerName}</TableCell>}
                                                    <TableCell className="font-mono">{order.id}</TableCell>
                                                    <TableCell>{order.customer.name}</TableCell>
                                                    <TableCell className="text-right font-semibold">{formatCurrency(order.commission || 0)}</TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={isAdmin ? 5 : 4} className="h-24 text-center">
                                                  {isAdmin ? 'Nenhuma comissão pendente para a equipe.' : 'Você não tem comissões pendentes.'}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                     </Card>
                </TabsContent>
                {isAdmin && (
                    <TabsContent value="by_seller_performance" className="mt-4">
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2"><UsersIcon className="h-5 w-5" /> Vendas e Comissão por Vendedor</CardTitle>
                                        <CardDescription>
                                            Resumo por mês, com total vendido e comissão gerada. Período: <span className="font-medium">{rotuloPeriodo}</span>
                                        </CardDescription>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                                            <SelectTrigger className="w-full sm:w-[170px]">
                                                <SelectValue placeholder="Mês" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {meses.map(m => (
                                                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
                                            <SelectTrigger className="w-full sm:w-[120px]">
                                                <SelectValue placeholder="Ano" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {anosDisponiveis.map(y => (
                                                    <SelectItem key={y} value={y}>{y}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button variant="outline" onClick={handlePrintSellers}>
                                            <Printer className="mr-2 h-4 w-4" />
                                            Imprimir Relatório
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div id="seller-performance-table" className="rounded-md border overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Vendedor</TableHead>
                                                <TableHead className="text-center">Vendas</TableHead>
                                                <TableHead className="text-right">Total Vendido</TableHead>
                                                <TableHead className="text-right">Comissão Gerada</TableHead>
                                                <TableHead className="text-right">Ações</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {sellerPerformanceWithCommission.length > 0 ? (
                                                sellerPerformanceWithCommission.map(seller => (
                                                    <TableRow key={seller.id}>
                                                        <TableCell className="font-medium">{seller.name}</TableCell>
                                                        <TableCell className="text-center">{seller.salesCount}</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(seller.totalSold)}</TableCell>
                                                        <TableCell className="text-right font-semibold">{formatCurrency(seller.totalCommission)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleOpenPerformanceDetails(seller)}
                                                            >
                                                                <Eye className="mr-2 h-4 w-4" /> Ver Vendas
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-24 text-center">Nenhuma venda com comissão registrada no período.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
                {isSuperAdmin && (
                    <TabsContent value="by_seller" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Comissões a Pagar</CardTitle>
                                <CardDescription>Total de comissão pendente por vendedor (somente pedidos entregues).</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Vendedor</TableHead>
                                                <TableHead className="text-center">Nº de Vendas</TableHead>
                                                <TableHead className="text-right">Comissão Total</TableHead>
                                                <TableHead className="text-right">Ação</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {commissionsBySellerGlobal.length > 0 ? (
                                                commissionsBySellerGlobal.map((seller) => (
                                                    <TableRow key={seller.id}>
                                                        <TableCell className="font-medium">{seller.name}</TableCell>
                                                        <TableCell className="text-center">{seller.count}</TableCell>
                                                        <TableCell className="text-right font-semibold">{formatCurrency(seller.total)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenCommissionDetails(seller as any)}>
                                                                    <Eye className="h-4 w-4" />
                                                                    <span className="sr-only">Ver detalhes</span>
                                                                </Button>
                                                                <Button size="sm" onClick={() => openPayModal(seller as any)}>
                                                                    <DollarSign className="mr-2 h-4 w-4" />
                                                                    Pagar
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="h-24 text-center">Nenhuma comissão pendente para a equipe.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
                <TabsContent value="history" className="mt-4">
                     <Card>
                        <CardHeader>
                            <CardTitle>Meus Pagamentos Recebidos</CardTitle>
                             <CardDescription>Pagamentos de comissão recebidos no mês atual.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Data do Pagamento</TableHead>
                                            <TableHead>Período</TableHead>
                                            <TableHead className="text-right">Valor Recebido</TableHead>
                                            <TableHead className="text-right">Ação</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {myPaidCommissions.length > 0 ? (
                                            myPaidCommissions.map(payment => (
                                                <TableRow key={payment.id}>
                                                    <TableCell>{format(parseISO(payment.paymentDate), "dd/MM/yyyy")}</TableCell>
                                                    <TableCell className="capitalize">{payment.period}</TableCell>
                                                    <TableCell className="text-right font-semibold">{formatCurrency(payment.amount)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button variant="outline" size="sm" asChild>
                                                                <Link href={`/admin/comprovante-comissao/${payment.id}`}>
                                                                    <Eye className="mr-2 h-4 w-4" />
                                                                    Ver Comprovante
                                                                </Link>
                                                            </Button>
                                                             {isAdmin && (
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild>
                                                                        <Button variant="destructive" outline size="sm">
                                                                            <Undo2 className="mr-2 h-4 w-4" />
                                                                            Estornar
                                                                        </Button>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader>
                                                                            <AlertDialogTitle>Confirmar Estorno?</AlertDialogTitle>
                                                                            <AlertDialogDescription>
                                                                                Esta ação não pode ser desfeita. O pagamento será excluído e as comissões dos pedidos voltarão a ficar pendentes.
                                                                            </AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                            <AlertDialogAction onClick={() => reverseCommissionPayment(payment.id, logAction, user)}>
                                                                                Sim, estornar
                                                                            </AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-24 text-center">Nenhum pagamento recebido neste mês.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                     </Card>
                </TabsContent>
                {isSuperAdmin && (
                    <TabsContent value="all_history" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Histórico Geral de Pagamentos</CardTitle>
                                <CardDescription>Pagamentos de comissão de todos os vendedores no mês atual.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Data</TableHead>
                                                <TableHead>Vendedor</TableHead>
                                                <TableHead>Período</TableHead>
                                                <TableHead className="text-right">Valor</TableHead>
                                                <TableHead className="text-right">Ação</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {allPaymentsThisMonth.length > 0 ? (
                                                allPaymentsThisMonth.map(payment => (
                                                    <TableRow key={payment.id}>
                                                        <TableCell>{format(parseISO(payment.paymentDate), "dd/MM/yyyy")}</TableCell>
                                                        <TableCell>{payment.sellerName}</TableCell>
                                                        <TableCell className="capitalize">{payment.period}</TableCell>
                                                        <TableCell className="text-right font-semibold">{formatCurrency(payment.amount)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button variant="outline" size="sm" asChild>
                                                                    <Link href={`/admin/comprovante-comissao/${payment.id}`}>
                                                                        <Eye className="mr-2 h-4 w-4" />
                                                                        Ver Comprovante
                                                                    </Link>
                                                                </Button>
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild>
                                                                        <Button variant="destructive" outline size="sm">
                                                                            <Undo2 className="mr-2 h-4 w-4" />
                                                                            Estornar
                                                                        </Button>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader>
                                                                            <AlertDialogTitle>Confirmar Estorno?</AlertDialogTitle>
                                                                            <AlertDialogDescription>
                                                                                Esta ação não pode ser desfeita. O pagamento será excluído e as comissões dos pedidos voltarão a ficar pendentes.
                                                                            </AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                            <AlertDialogAction onClick={() => reverseCommissionPayment(payment.id, logAction, user)}>
                                                                                Sim, estornar
                                                                            </AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-24 text-center">Nenhum pagamento foi realizado ainda.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
            </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isPerformanceDetailModalOpen} onOpenChange={setIsPerformanceDetailModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Relatório de Vendas - {selectedPerformanceSeller?.name}</DialogTitle>
            <DialogDescription>
              Lista de vendas realizadas pelo vendedor no período selecionado.
            </DialogDescription>
          </DialogHeader>
          <div id="seller-report-modal-content">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              <div className="p-3 rounded-md border bg-muted/30">
                <p className="text-xs text-muted-foreground">Total vendido</p>
                <p className="text-lg font-bold">{formatCurrency(selectedPerformanceSeller?.totalSold ?? 0)}</p>
              </div>
              <div className="p-3 rounded-md border bg-muted/30">
                <p className="text-xs text-muted-foreground">Comissão gerada</p>
                <p className="text-lg font-bold">{formatCurrency(selectedPerformanceSeller?.totalCommission ?? 0)}</p>
              </div>
            </div>
            <div className="hidden print-only space-y-1 text-sm">
              <div className="font-semibold border-b pb-1">
                Data | Pedido | Cliente | Produtos | Valor | Comissão
              </div>
              {(selectedPerformanceSeller?.orders.length ?? 0) > 0 ? (
                selectedPerformanceSeller?.orders.map(order => (
                  <div key={order.id} className="border-b py-1">
                    {(() => {
                      const date = parseFlexibleDate(order.date);
                      return date ? format(date, 'dd/MM/yy') : order.date;
                    })()} | {order.id} | {order.customer.name} | {formatOrderProducts(order.items)} | {formatCurrency(order.total)} | {formatCurrency(order.commission || 0)}
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-muted-foreground">
                  Nenhuma venda encontrada para este vendedor.
                </div>
              )}
            </div>
            <div className="rounded-md border max-h-[60vh] overflow-auto print-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produtos</TableHead>
                    <TableHead className="text-right">Valor da Venda</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(selectedPerformanceSeller?.orders.length ?? 0) > 0 ? (
                    selectedPerformanceSeller?.orders.map(order => (
                      <TableRow key={order.id}>
                        <TableCell>
                          {(() => {
                            const date = parseFlexibleDate(order.date);
                            return date ? format(date, 'dd/MM/yy') : order.date;
                          })()}
                        </TableCell>
                        <TableCell className="font-mono">{order.id}</TableCell>
                        <TableCell>{order.customer.name}</TableCell>
                        <TableCell className="max-w-[260px] truncate" title={formatOrderProducts(order.items)}>
                          {formatOrderProducts(order.items)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(order.total)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(order.commission || 0)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">Nenhuma venda encontrada para este vendedor.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsPerformanceDetailModalOpen(false)}>Fechar</Button>
            <Button onClick={handlePrintSingleSeller}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCommissionDetailModalOpen} onOpenChange={setIsCommissionDetailModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Vendas Pendentes de Comissão</DialogTitle>
            <DialogDescription>
              Lista de vendas para o vendedor <span className="font-bold">{selectedCommissionSeller?.name}</span> que compõem o total da comissão.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Valor Pedido</TableHead>
                  <TableHead className="text-right">Valor Comissão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersForSelectedCommissionSeller.length > 0 ? (
                  ordersForSelectedCommissionSeller.map(order => (
                    <TableRow key={order.id}>
                      <TableCell>
                        {(() => {
                          const date = parseFlexibleDate(order.date);
                          return date ? format(date, 'dd/MM/yy') : order.date;
                        })()}
                      </TableCell>
                      <TableCell className="font-mono">{order.id}</TableCell>
                      <TableCell>{order.customer.name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(order.total)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(order.commission || 0)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">Nenhum pedido encontrado.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPayModalOpen} onOpenChange={setIsPayModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento de Comissão</DialogTitle>
            <DialogDescription>
              Você está registrando um pagamento de <span className="font-bold text-foreground">{formatCurrency(sellerToPay?.total || 0)}</span> para <span className="font-bold text-foreground">{sellerToPay?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="period">Mês de Referência</Label>
              <div className="flex gap-2">
                <Select value={paymentMonth} onValueChange={setPaymentMonth}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {meses.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={paymentYear} onValueChange={setPaymentYear}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {anosDisponiveis.map(y => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Selecione o mês ao qual este pagamento se refere.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPayModalOpen(false)}>Cancelar</Button>
            <Button onClick={handlePayCommission}>
              <DollarSign className="mr-2 h-4 w-4" />
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    
