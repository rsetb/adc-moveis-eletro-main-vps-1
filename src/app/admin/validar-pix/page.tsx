'use client';

import { useEffect, useState, useCallback } from 'react';
import { QrCode, CheckCircle2, XCircle, Link2, Plus, RefreshCw, Search, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  getPixTransactionsAction,
  matchPixToOrderAction,
  ignorePixTransactionAction,
  createManualPixTransactionAction,
} from '@/app/actions/pix-transactions';

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusConfig = {
  recebido: { label: 'Recebido', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  vinculado: { label: 'Vinculado', color: 'bg-green-100 text-green-700 border-green-200' },
  ignorado: { label: 'Ignorado', color: 'bg-gray-100 text-gray-500 border-gray-200' },
};

export default function ValidarPixPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [matchDialog, setMatchDialog] = useState<any | null>(null);
  const [orderIdInput, setOrderIdInput] = useState('');
  const [matchLoading, setMatchLoading] = useState(false);

  const [manualDialog, setManualDialog] = useState(false);
  const [manual, setManual] = useState({ endToEndId: '', valor: '', horario: '', pagadorNome: '', pagadorCpf: '', infoPagador: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getPixTransactionsAction({ status: statusFilter, search, startDate, endDate });
    if (res.success) setTransactions(res.data as any[]);
    setLoading(false);
  }, [statusFilter, search, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  const handleMatch = async () => {
    if (!matchDialog || !orderIdInput.trim()) return;
    setMatchLoading(true);
    const res = await matchPixToOrderAction(matchDialog.id, orderIdInput.trim(), user!.id, user!.name);
    if (res.success) {
      toast({ title: 'PIX vinculado ao pedido!' });
      setMatchDialog(null);
      setOrderIdInput('');
      load();
    } else {
      toast({ title: 'Erro', description: res.error, variant: 'destructive' });
    }
    setMatchLoading(false);
  };

  const handleIgnore = async (id: string) => {
    await ignorePixTransactionAction(id);
    toast({ title: 'Transação ignorada.' });
    load();
  };

  const handleManualSubmit = async () => {
    if (!manual.endToEndId || !manual.valor || !manual.horario) {
      toast({ title: 'Preencha EndToEndId, valor e data/hora.', variant: 'destructive' });
      return;
    }
    const res = await createManualPixTransactionAction({
      endToEndId: manual.endToEndId,
      valor: parseFloat(manual.valor.replace(',', '.')),
      horario: manual.horario,
      pagadorNome: manual.pagadorNome,
      pagadorCpf: manual.pagadorCpf,
      infoPagador: manual.infoPagador,
    });
    if (res.success) {
      toast({ title: 'PIX cadastrado manualmente!' });
      setManualDialog(false);
      setManual({ endToEndId: '', valor: '', horario: '', pagadorNome: '', pagadorCpf: '', infoPagador: '' });
      load();
    } else {
      toast({ title: 'Erro', description: res.error, variant: 'destructive' });
    }
  };

  const total = transactions.reduce((s, t) => s + t.valor, 0);
  const countRecebidos = transactions.filter(t => t.status === 'recebido').length;
  const countVinculados = transactions.filter(t => t.status === 'vinculado').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-500/10 ring-1 ring-green-500/20">
            <QrCode className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Validar PIX</h1>
            <p className="text-sm text-muted-foreground">Consulte e vincule PIX recebidos aos pedidos</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setManualDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Cadastrar Manual
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-blue-100/60 dark:from-blue-950/30 dark:to-blue-950/20 p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-medium text-blue-500 uppercase tracking-wide">Pendentes</p>
            <p className="text-3xl font-bold text-blue-600 mt-0.5">{countRecebidos}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
            <QrCode className="h-6 w-6 text-blue-500" />
          </div>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-green-50 to-green-100/60 dark:from-green-950/30 dark:to-green-950/20 p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-medium text-green-500 uppercase tracking-wide">Vinculados</p>
            <p className="text-3xl font-bold text-green-600 mt-0.5">{countVinculados}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
          </div>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-purple-50 to-purple-100/60 dark:from-purple-950/30 dark:to-purple-950/20 p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-medium text-purple-500 uppercase tracking-wide">Total recebido</p>
            <p className="text-2xl font-bold text-purple-600 mt-0.5">{formatCurrency(total)}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center flex-shrink-0">
            <QrCode className="h-6 w-6 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Webhook info */}
      <Card className="border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            URL do Webhook Itaú → configure no portal do Itaú em <strong>Central PIX → Integradores PIX</strong>:
          </p>
          <code className="mt-1 block text-xs bg-white dark:bg-black/20 border rounded px-3 py-2 font-mono text-amber-800 dark:text-amber-300 select-all">
            {typeof window !== 'undefined' ? `${window.location.origin}/api/itau/webhook` : '/api/itau/webhook'}
          </code>
          <p className="text-xs text-amber-600 mt-1">Configure também <code>ITAU_WEBHOOK_SECRET</code> no .env da aplicação.</p>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card className="shadow-sm">
        <CardContent className="pt-5 pb-5">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-grow min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar por nome, CPF, EndToEndId..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="recebido">Recebidos</SelectItem>
                <SelectItem value="vinculado">Vinculados</SelectItem>
                <SelectItem value="ignorado">Ignorados</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 w-[145px]" />
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 w-[145px]" />
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Transações PIX</CardTitle>
          <CardDescription>{transactions.length} registro(s) encontrado(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-muted-foreground">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 mb-4">
                <QrCode className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Nenhuma transação encontrada</h3>
              <p className="text-sm mt-1">PIX recebidos aparecerão aqui automaticamente via webhook.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map(t => {
                const st = statusConfig[t.status as keyof typeof statusConfig] ?? statusConfig.recebido;
                return (
                  <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/20 px-4 py-3 hover:bg-muted/40 transition-colors">
                    {/* Valor */}
                    <div className="min-w-[110px]">
                      <p className="text-lg font-bold text-green-600">{formatCurrency(t.valor)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(t.horario), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </p>
                    </div>

                    {/* Pagador */}
                    <div className="flex-1 min-w-[150px]">
                      <p className="text-sm font-medium">{t.pagadorNome || '—'}</p>
                      <p className="text-xs text-muted-foreground font-mono">{t.pagadorCpf || t.pagadorCnpj || ''}</p>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-[150px]">
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{t.infoPagador || '—'}</p>
                      <p className="text-[10px] font-mono text-muted-foreground/70 truncate max-w-[200px]">{t.endToEndId}</p>
                    </div>

                    {/* Pedido vinculado */}
                    {t.orderId && (
                      <div className="text-xs text-green-700 font-mono bg-green-50 border border-green-200 rounded px-2 py-1">
                        Pedido: {t.orderRef}
                      </div>
                    )}

                    {/* Status */}
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${st.color}`}>
                      {st.label}
                    </span>

                    {/* Ações */}
                    {t.status === 'recebido' && (
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1.5"
                          onClick={() => { setMatchDialog(t); setOrderIdInput(''); }}
                        >
                          <Link2 className="h-3.5 w-3.5" /> Vincular Pedido
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs text-muted-foreground"
                          onClick={() => handleIgnore(t.id)}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: vincular pedido */}
      <Dialog open={!!matchDialog} onOpenChange={open => !open && setMatchDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular PIX ao Pedido</DialogTitle>
          </DialogHeader>
          {matchDialog && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Valor:</span> <strong className="text-green-600">{formatCurrency(matchDialog.valor)}</strong></p>
                <p><span className="text-muted-foreground">Pagador:</span> {matchDialog.pagadorNome || '—'}</p>
                <p><span className="text-muted-foreground">Horário:</span> {format(new Date(matchDialog.horario), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">ID do Pedido</label>
                <Input
                  placeholder="Cole ou digite o ID do pedido..."
                  value={orderIdInput}
                  onChange={e => setOrderIdInput(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMatchDialog(null)}>Cancelar</Button>
            <Button onClick={handleMatch} disabled={matchLoading || !orderIdInput.trim()}>
              {matchLoading ? 'Vinculando...' : 'Vincular'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: cadastro manual */}
      <Dialog open={manualDialog} onOpenChange={setManualDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastrar PIX Manualmente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">EndToEndId <span className="text-destructive">*</span></label>
              <Input placeholder="E00000000..." value={manual.endToEndId} onChange={e => setManual(p => ({ ...p, endToEndId: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Valor (R$) <span className="text-destructive">*</span></label>
                <Input placeholder="100,00" value={manual.valor} onChange={e => setManual(p => ({ ...p, valor: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Data/Hora <span className="text-destructive">*</span></label>
                <Input type="datetime-local" value={manual.horario} onChange={e => setManual(p => ({ ...p, horario: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Nome do Pagador</label>
              <Input placeholder="Nome..." value={manual.pagadorNome} onChange={e => setManual(p => ({ ...p, pagadorNome: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">CPF do Pagador</label>
              <Input placeholder="000.000.000-00" value={manual.pagadorCpf} onChange={e => setManual(p => ({ ...p, pagadorCpf: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Descrição</label>
              <Input placeholder="Info do pagador..." value={manual.infoPagador} onChange={e => setManual(p => ({ ...p, infoPagador: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualDialog(false)}>Cancelar</Button>
            <Button onClick={handleManualSubmit}>Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
