'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Download, FileDown, RefreshCcw, Send, DollarSign, User } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/context/PermissionsContext';
import { hasAccess } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/context/SettingsContext';
import PaymentDialog from '@/components/PaymentDialog';

import { getBillingDashboardAction, recordInstallmentPaymentAction, type BillingDashboardFilters, type BillingDashboardRow } from '@/app/actions/admin/orders';
import type { Installment, Payment } from '@/lib/types';

type SortKey = 'customerName' | 'amountDue' | 'dueDate' | 'daysOverdue' | 'daysUntilDue';
type SortDir = 'asc' | 'desc';

const formatCurrency = (value: number) => {
  if (isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const normalize = (text: string) => {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

const priorityBadge = (row: BillingDashboardRow) => {
  if (row.priority === 'critical') return <Badge variant="destructive">Crítico</Badge>;
  if (row.priority === 'warning') return <Badge className="bg-orange-500 text-white hover:bg-orange-500">Atenção</Badge>;
  return <Badge variant="secondary">Vencendo</Badge>;
};

const sortRows = (rows: BillingDashboardRow[], sortKey: SortKey, sortDir: SortDir) => {
  const dir = sortDir === 'asc' ? 1 : -1;
  const toValue = (r: BillingDashboardRow) => {
    switch (sortKey) {
      case 'customerName':
        return normalize(r.customerName);
      case 'amountDue':
        return r.amountDue;
      case 'dueDate':
        return new Date(r.dueDate).getTime();
      case 'daysOverdue':
        return r.daysOverdue;
      case 'daysUntilDue':
        return r.daysUntilDue;
      default:
        return 0;
    }
  };

  return [...rows].sort((a, b) => {
    const av = toValue(a);
    const bv = toValue(b);
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return normalize(a.customerName).localeCompare(normalize(b.customerName));
  });
};

const paginate = <T,>(items: T[], page: number, pageSize: number) => {
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
};

const toCsv = (rows: BillingDashboardRow[], kind: 'overdue' | 'upcoming') => {
  const headers =
    kind === 'overdue'
      ? ['Cliente', 'Telefone', 'Pedido', 'Parcela', 'Valor Devido', 'Dias em Atraso', 'Vencimento', 'Prioridade']
      : ['Cliente', 'Telefone', 'Pedido', 'Parcela', 'Valor', 'Vencimento', 'Prioridade'];

  const lines = [headers.join(';')];

  for (const r of rows) {
    const due = format(parseISO(r.dueDate), 'dd/MM/yyyy', { locale: ptBR });
    const priority = r.priority === 'critical' ? 'Crítico' : r.priority === 'warning' ? 'Atenção' : 'Vencendo';
    const base = [r.customerName, r.customerPhone, r.orderId, String(r.installmentNumber), formatCurrency(r.amountDue), due, priority];

    if (kind === 'overdue') {
      lines.push([base[0], base[1], base[2], base[3], base[4], String(r.daysOverdue), base[5], base[6]].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(';'));
    } else {
      lines.push([base[0], base[1], base[2], base[3], base[4], base[5], base[6]].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(';'));
    }
  }

  return '\uFEFF' + lines.join('\n');
};

export default function CobrancasDashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { permissions, isLoading: permLoading } = usePermissions();
  const { settings } = useSettings();
  const { toast } = useToast();

  const canAccess = useMemo(() => {
    if (!user || !permissions) return false;
    return hasAccess(user.role, 'cobrancas', permissions);
  }, [user, permissions]);

  const [filters, setFilters] = useState<BillingDashboardFilters>({
    status: 'all',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string>('');

  const [critical, setCritical] = useState<BillingDashboardRow[]>([]);
  const [warning, setWarning] = useState<BillingDashboardRow[]>([]);
  const [upcoming, setUpcoming] = useState<BillingDashboardRow[]>([]);
  const [summary, setSummary] = useState<{ overdueCustomers: number; overdueAmount: number; totalOpenAmount: number; delinquencyRate: number }>({
    overdueCustomers: 0,
    overdueAmount: 0,
    totalOpenAmount: 0,
    delinquencyRate: 0,
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await getBillingDashboardAction(filters, user);
      if (!res.success || !res.data) {
        throw new Error((res as any).error || 'Falha ao carregar dashboard.');
      }
      setCritical(res.data.critical || []);
      setWarning(res.data.warning || []);
      setUpcoming(res.data.upcoming || []);
      setSummary(res.data.summary);
      setGeneratedAt(res.data.generatedAt || '');
    } catch (e: any) {
      toast({ title: 'Erro ao carregar cobranças', description: e?.message || 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [filters, toast, user]);

  useEffect(() => {
    if (authLoading || permLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!canAccess) return;

    fetchDashboard();

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(fetchDashboard, 30000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [authLoading, permLoading, user, canAccess, router, fetchDashboard]);

  const overdueRows = useMemo(() => {
    const list = [...critical, ...warning];
    return list.sort((a, b) => {
      const aP = a.priority === 'critical' ? 0 : 1;
      const bP = b.priority === 'critical' ? 0 : 1;
      if (aP !== bP) return aP - bP;
      return b.daysOverdue - a.daysOverdue || normalize(a.customerName).localeCompare(normalize(b.customerName));
    });
  }, [critical, warning]);

  const [overdueSortKey, setOverdueSortKey] = useState<SortKey>('daysOverdue');
  const [overdueSortDir, setOverdueSortDir] = useState<SortDir>('desc');
  const [overduePage, setOverduePage] = useState(1);
  const [overdueSearch, setOverdueSearch] = useState('');

  const [upcomingSortKey, setUpcomingSortKey] = useState<SortKey>('daysUntilDue');
  const [upcomingSortDir, setUpcomingSortDir] = useState<SortDir>('asc');
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [upcomingSearch, setUpcomingSearch] = useState('');

  const pageSize = 20;

  const sortedOverdue = useMemo(() => sortRows(overdueRows, overdueSortKey, overdueSortDir), [overdueRows, overdueSortKey, overdueSortDir]);
  const sortedUpcoming = useMemo(() => sortRows(upcoming, upcomingSortKey, upcomingSortDir), [upcoming, upcomingSortKey, upcomingSortDir]);

  const overdueSearchNeedle = useMemo(() => normalize(overdueSearch), [overdueSearch]);
  const upcomingSearchNeedle = useMemo(() => normalize(upcomingSearch), [upcomingSearch]);

  const filteredOverdue = useMemo(() => {
    if (!overdueSearchNeedle) return sortedOverdue;
    return sortedOverdue.filter((r) => {
      const due = format(parseISO(r.dueDate), 'dd/MM/yyyy', { locale: ptBR });
      const hay = normalize(`${r.customerName} ${r.customerPhone} ${r.customerCpf} ${r.orderId} ${r.installmentNumber} ${due}`);
      return hay.includes(overdueSearchNeedle);
    });
  }, [overdueSearchNeedle, sortedOverdue]);

  const filteredUpcoming = useMemo(() => {
    if (!upcomingSearchNeedle) return sortedUpcoming;
    return sortedUpcoming.filter((r) => {
      const due = format(parseISO(r.dueDate), 'dd/MM/yyyy', { locale: ptBR });
      const hay = normalize(`${r.customerName} ${r.customerPhone} ${r.customerCpf} ${r.orderId} ${r.installmentNumber} ${due}`);
      return hay.includes(upcomingSearchNeedle);
    });
  }, [sortedUpcoming, upcomingSearchNeedle]);

  const paginatedOverdue = useMemo(() => paginate(filteredOverdue, overduePage, pageSize), [filteredOverdue, overduePage]);
  const paginatedUpcoming = useMemo(() => paginate(filteredUpcoming, upcomingPage, pageSize), [filteredUpcoming, upcomingPage]);

  const overduePages = Math.max(1, Math.ceil(filteredOverdue.length / pageSize));
  const upcomingPages = Math.max(1, Math.ceil(filteredUpcoming.length / pageSize));

  useEffect(() => {
    setOverduePage(1);
  }, [overdueSortKey, overdueSortDir, filters, overdueSearch]);

  useEffect(() => {
    setUpcomingPage(1);
  }, [upcomingSortKey, upcomingSortDir, filters, upcomingSearch]);

  const toggleSort = (section: 'overdue' | 'upcoming', key: SortKey) => {
    if (section === 'overdue') {
      setOverdueSortKey((prev) => {
        if (prev !== key) {
          setOverdueSortDir(key === 'customerName' ? 'asc' : 'desc');
          return key;
        }
        setOverdueSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      });
      return;
    }

    setUpcomingSortKey((prev) => {
      if (prev !== key) {
        setUpcomingSortDir(key === 'customerName' ? 'asc' : 'desc');
        return key;
      }
      setUpcomingSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return prev;
    });
  };

  const downloadTextFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportExcel = (kind: 'overdue' | 'upcoming') => {
    const rows = kind === 'overdue' ? filteredOverdue : filteredUpcoming;
    const date = new Date().toISOString().slice(0, 10);
    downloadTextFile(toCsv(rows, kind), `cobrancas-${kind}-${date}.csv`, 'text/csv;charset=utf-8');
  };

  const exportPdf = async (elementId: string, filename: string) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position = position - pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    pdf.save(filename);
  };

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [rowToPay, setRowToPay] = useState<BillingDashboardRow | null>(null);

  const installmentForDialog: Installment | null = useMemo(() => {
    if (!rowToPay) return null;
    return {
      id: `inst-${rowToPay.orderId}-${rowToPay.installmentNumber}`,
      installmentNumber: rowToPay.installmentNumber,
      dueDate: rowToPay.dueDate,
      amount: rowToPay.installmentAmount,
      status: rowToPay.installmentStatus,
      paidAmount: rowToPay.paidAmount,
      payments: [],
    };
  }, [rowToPay]);

  const handleSubmitPayment = async (payment: Payment) => {
    if (!user || !rowToPay) return;
    try {
      const res = await recordInstallmentPaymentAction(rowToPay.orderId, rowToPay.installmentNumber, payment, user);
      if (!res.success) throw new Error((res as any).error || 'Falha ao registrar pagamento.');
      setPaymentDialogOpen(false);
      setRowToPay(null);
      await fetchDashboard();
      toast({ title: 'Pagamento registrado', description: 'A parcela foi atualizada com sucesso.' });
    } catch (e: any) {
      toast({ title: 'Erro ao registrar pagamento', description: e?.message || 'Erro desconhecido', variant: 'destructive' });
    }
  };

  const sendReminder = (r: BillingDashboardRow) => {
    const phoneDigits = String(r.customerPhone || '').replace(/\D/g, '');
    if (!phoneDigits) {
      toast({ title: 'Telefone inválido', description: 'Cliente sem telefone para WhatsApp.', variant: 'destructive' });
      return;
    }
    const firstName = String(r.customerName || '').trim().split(' ')[0] || 'Olá';
    const due = format(parseISO(r.dueDate), 'dd/MM/yyyy', { locale: ptBR });
    const amount = formatCurrency(r.amountDue);
    const pixKey = String((settings as any)?.pixKey || '').trim();

    const message = `Olá, ${firstName}! Passando para lembrar sobre a sua parcela do carnê (pedido ${r.orderId} - parcela ${r.installmentNumber}).
\nVencimento: *${due}*
\nValor: *${amount}*
${pixKey ? `\n\nChave pix: ${pixKey}` : ''}`;

    const whatsappUrl = `https://wa.me/55${phoneDigits}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (authLoading || permLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!user) return null;

  if (!canAccess) {
    return (
      <div className="py-10">
        <Card>
          <CardHeader>
            <CardTitle>Acesso negado</CardTitle>
            <CardDescription>Você não tem permissão para acessar Cobranças.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const overdueFromUi = String(filters.dueFrom || '');
  const overdueToUi = String(filters.dueTo || '');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard de Cobranças</h1>
          <p className="text-sm text-muted-foreground">
            {generatedAt ? `Atualizado em ${format(parseISO(generatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}` : ' '}
          </p>
        </div>
        <Button variant="outline" onClick={fetchDashboard} disabled={isLoading}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Clientes em Atraso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.overdueCustomers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Valor em Atraso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(summary.overdueAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Taxa de Inadimplência</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{(summary.delinquencyRate * 100).toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground mt-1">
              Aberto total: {formatCurrency(summary.totalOpenAmount)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Refine por período, valor, cliente e status.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Vencimento (de)</div>
              <Input
                type="date"
                value={overdueFromUi}
                onChange={(e) => setFilters((prev) => ({ ...prev, dueFrom: e.target.value || undefined }))}
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Vencimento (até)</div>
              <Input
                type="date"
                value={overdueToUi}
                onChange={(e) => setFilters((prev) => ({ ...prev, dueTo: e.target.value || undefined }))}
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Valor (mín/máx)</div>
              <div className="flex gap-2">
                <Input
                  inputMode="decimal"
                  placeholder="Min"
                  value={filters.minAmount === undefined ? '' : String(filters.minAmount)}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setFilters((prev) => ({ ...prev, minAmount: v === '' ? undefined : Number(v) }));
                  }}
                />
                <Input
                  inputMode="decimal"
                  placeholder="Máx"
                  value={filters.maxAmount === undefined ? '' : String(filters.maxAmount)}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setFilters((prev) => ({ ...prev, maxAmount: v === '' ? undefined : Number(v) }));
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Cliente</div>
              <Input
                placeholder="Nome ou telefone..."
                value={filters.customer || ''}
                onChange={(e) => setFilters((prev) => ({ ...prev, customer: e.target.value || undefined }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="text-xs text-muted-foreground">Status</div>
              <Select
                value={filters.status || 'all'}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, status: v as BillingDashboardFilters['status'] }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="overdue_critical">Atraso Crítico (90+ dias)</SelectItem>
                  <SelectItem value="overdue_warning">Atraso (30-89 dias)</SelectItem>
                  <SelectItem value="upcoming">Vencimentos (até 7 dias)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2 md:col-span-2">
              <Button
                variant="outline"
                onClick={() => {
                  setFilters({ status: 'all' });
                }}
              >
                Limpar
              </Button>
              <Button onClick={fetchDashboard} disabled={isLoading}>
                Filtrar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Clientes em Atraso Crítico</CardTitle>
            <CardDescription>Vermelho: 90+ dias. Laranja: 30-89 dias.</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <Input
              placeholder="Buscar (cliente, telefone, pedido...)"
              value={overdueSearch}
              onChange={(e) => setOverdueSearch(e.target.value)}
              className="w-full sm:w-72"
            />
            <Button variant="outline" onClick={() => exportExcel('overdue')} disabled={filteredOverdue.length === 0}>
              <FileDown className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
            <Button variant="outline" onClick={() => exportPdf('overdue-section', 'cobrancas-atraso.pdf')} disabled={filteredOverdue.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent id="overdue-section">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[260px] cursor-pointer" onClick={() => toggleSort('overdue', 'customerName')}>Cliente</TableHead>
                  <TableHead className="min-w-[140px]">Telefone</TableHead>
                  <TableHead className="min-w-[120px]">Pedido</TableHead>
                  <TableHead className="min-w-[90px]">Parcela</TableHead>
                  <TableHead className="min-w-[140px] text-right cursor-pointer" onClick={() => toggleSort('overdue', 'amountDue')}>Valor devido</TableHead>
                  <TableHead className="min-w-[140px] text-center cursor-pointer" onClick={() => toggleSort('overdue', 'daysOverdue')}>Dias em atraso</TableHead>
                  <TableHead className="min-w-[160px] cursor-pointer" onClick={() => toggleSort('overdue', 'dueDate')}>Vencimento</TableHead>
                  <TableHead className="min-w-[120px]">Prioridade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOverdue.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      Nenhum cliente em atraso crítico com os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedOverdue.map((r) => (
                    <TableRow key={`${r.orderId}-${r.installmentNumber}-${r.priority}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${r.priority === 'critical' ? 'bg-red-500' : 'bg-orange-500'}`}
                            aria-hidden
                          />
                          <span className="truncate">{r.customerName}</span>
                          {r.customerCpf ? (
                            <Button variant="ghost" size="icon" asChild className="h-7 w-7">
                              <Link href={`/admin/clientes?cpf=${encodeURIComponent(r.customerCpf)}`} aria-label="Abrir cadastro do cliente">
                                <User className="h-4 w-4" aria-hidden />
                                <span className="sr-only">Abrir cadastro do cliente</span>
                              </Link>
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7" disabled aria-label="CPF não informado">
                              <User className="h-4 w-4" aria-hidden />
                              <span className="sr-only">CPF não informado</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.customerPhone}</TableCell>
                      <TableCell className="font-mono text-xs">{r.orderId}</TableCell>
                      <TableCell className="text-center">{r.installmentNumber}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(r.amountDue)}</TableCell>
                      <TableCell className="text-center">
                        <span className={r.priority === 'critical' ? 'text-red-600 font-semibold' : 'text-orange-600 font-semibold'}>
                          {r.daysOverdue}
                        </span>
                      </TableCell>
                      <TableCell>{format(parseISO(r.dueDate), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                      <TableCell>{priorityBadge(r)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {overduePages > 1 && (
            <div className="flex items-center justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setOverduePage((p) => Math.max(1, p - 1))} disabled={overduePage === 1}>
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">Página {overduePage} de {overduePages}</span>
              <Button variant="outline" size="sm" onClick={() => setOverduePage((p) => Math.min(overduePages, p + 1))} disabled={overduePage === overduePages}>
                Próxima
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Vencimentos Próximos</CardTitle>
            <CardDescription>Boletos/parcelas a vencer em até 7 dias.</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <Input
              placeholder="Buscar (cliente, telefone, pedido...)"
              value={upcomingSearch}
              onChange={(e) => setUpcomingSearch(e.target.value)}
              className="w-full sm:w-72"
            />
            <Button variant="outline" onClick={() => exportExcel('upcoming')} disabled={filteredUpcoming.length === 0}>
              <FileDown className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
            <Button variant="outline" onClick={() => exportPdf('upcoming-section', 'cobrancas-vencimentos.pdf')} disabled={filteredUpcoming.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent id="upcoming-section">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('upcoming', 'customerName')}>Cliente</TableHead>
                  <TableHead className="hidden lg:table-cell">Telefone</TableHead>
                  <TableHead className="hidden xl:table-cell">Pedido</TableHead>
                  <TableHead className="text-center">Parcela</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('upcoming', 'amountDue')}>Valor</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('upcoming', 'dueDate')}>Vencimento</TableHead>
                  <TableHead className="text-center cursor-pointer whitespace-nowrap" onClick={() => toggleSort('upcoming', 'daysUntilDue')}>Faltam</TableHead>
                  <TableHead className="text-right w-[120px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUpcoming.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      Nenhum vencimento próximo com os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUpcoming.map((r) => (
                    <TableRow key={`${r.orderId}-${r.installmentNumber}-upcoming`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-blue-500" aria-hidden />
                          <span className="truncate max-w-[220px] md:max-w-[320px]">{r.customerName}</span>
                          {r.customerCpf ? (
                            <Button variant="ghost" size="icon" asChild className="h-7 w-7">
                              <Link href={`/admin/clientes?cpf=${encodeURIComponent(r.customerCpf)}`} aria-label="Abrir cadastro do cliente">
                                <User className="h-4 w-4" aria-hidden />
                                <span className="sr-only">Abrir cadastro do cliente</span>
                              </Link>
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7" disabled aria-label="CPF não informado">
                              <User className="h-4 w-4" aria-hidden />
                              <span className="sr-only">CPF não informado</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell font-mono text-xs whitespace-nowrap">{r.customerPhone}</TableCell>
                      <TableCell className="hidden xl:table-cell font-mono text-xs whitespace-nowrap">{r.orderId}</TableCell>
                      <TableCell className="text-center">{r.installmentNumber}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(r.amountDue)}</TableCell>
                      <TableCell className="whitespace-nowrap">{format(parseISO(r.dueDate), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                      <TableCell className="text-center">{r.daysUntilDue}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="icon"
                            onClick={() => {
                              setRowToPay(r);
                              setPaymentDialogOpen(true);
                            }}
                            aria-label="Registrar pagamento"
                          >
                            <DollarSign className="h-4 w-4" aria-hidden />
                            <span className="sr-only">Registrar pagamento</span>
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => sendReminder(r)} aria-label="Enviar lembrete">
                            <Send className="h-4 w-4" aria-hidden />
                            <span className="sr-only">Lembrete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {upcomingPages > 1 && (
            <div className="flex items-center justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setUpcomingPage((p) => Math.max(1, p - 1))} disabled={upcomingPage === 1}>
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">Página {upcomingPage} de {upcomingPages}</span>
              <Button variant="outline" size="sm" onClick={() => setUpcomingPage((p) => Math.min(upcomingPages, p + 1))} disabled={upcomingPage === upcomingPages}>
                Próxima
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {installmentForDialog && rowToPay && (
        <PaymentDialog
          isOpen={paymentDialogOpen}
          onOpenChange={(open) => {
            setPaymentDialogOpen(open);
            if (!open) setRowToPay(null);
          }}
          installment={installmentForDialog}
          orderId={rowToPay.orderId}
          customerName={rowToPay.customerName}
          onSubmit={handleSubmitPayment}
        />
      )}
    </div>
  );
}
