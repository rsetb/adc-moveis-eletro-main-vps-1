'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { CashRegister, CashMovement, CashMovementType, CashPaymentMethod } from '@/lib/types';
import {
    getActiveCashRegisterAction,
    getCashRegisterHistoryAction,
    openCashRegisterAction,
    closeCashRegisterAction,
    addCashMovementAction,
} from '@/app/actions/admin/cash';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    ArrowUpCircle,
    ArrowDownCircle,
    LockKeyhole,
    RefreshCw,
    History,
    CheckCircle2,
    AlertTriangle,
    Receipt,
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function fmtDate(str?: string | null) {
    if (!str) return '—';
    try {
        const d = parseISO(String(str));
        return isValid(d) ? format(d, "dd/MM/yy HH:mm", { locale: ptBR }) : str;
    } catch {
        return str;
    }
}

const MOVEMENT_LABELS: Record<string, string> = {
    ABERTURA: 'Abertura',
    RECEBIMENTO: 'Recebimento',
    ENTRADA_PEDIDO: 'Entrada Pedido',
    QUITACAO: 'Quitação',
    SANGRIA: 'Sangria',
    SUPRIMENTO: 'Suprimento',
    ESTORNO: 'Estorno',
};

const MOVEMENT_COLORS: Record<string, string> = {
    ABERTURA: 'bg-blue-100 text-blue-800',
    RECEBIMENTO: 'bg-green-100 text-green-800',
    ENTRADA_PEDIDO: 'bg-emerald-100 text-emerald-800',
    QUITACAO: 'bg-teal-100 text-teal-800',
    SANGRIA: 'bg-red-100 text-red-800',
    SUPRIMENTO: 'bg-purple-100 text-purple-800',
    ESTORNO: 'bg-orange-100 text-orange-800',
};

const PM_LABELS: Record<string, string> = {
    DINHEIRO: 'Dinheiro',
    PIX: 'Pix',
    CARTAO: 'Cartão',
    BOLETO: 'Boleto',
    OUTRO: 'Outro',
};

const isCredit = (type: string) => ['ABERTURA', 'RECEBIMENTO', 'ENTRADA_PEDIDO', 'QUITACAO', 'SUPRIMENTO'].includes(type);
const isDebit = (type: string) => ['SANGRIA', 'ESTORNO'].includes(type);

export default function CaixaPage() {
    const { user } = useAuth();
    const { toast } = useToast();

    const [activeCash, setActiveCash] = useState<CashRegister | null>(null);
    const [history, setHistory] = useState<CashRegister[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Dialog states
    const [openDialog, setOpenDialog] = useState(false);
    const [openAmount, setOpenAmount] = useState('0');
    const [openLoading, setOpenLoading] = useState(false);

    const [closeDialog, setCloseDialog] = useState(false);
    const [closeAmount, setCloseAmount] = useState('');
    const [closeLoading, setCloseLoading] = useState(false);

    const [sangria, setSangria] = useState(false);
    const [sangriaAmount, setSangriaAmount] = useState('');
    const [sangriaReason, setSangriaReason] = useState('');
    const [sangriaLoading, setSangriaLoading] = useState(false);

    const [suprimento, setSuprimento] = useState(false);
    const [suprimentoAmount, setSuprimentoAmount] = useState('');
    const [suprimentoReason, setSuprimentoReason] = useState('');
    const [suprimentoLoading, setSuprimentoLoading] = useState(false);

    const load = useCallback(async () => {
        setRefreshing(true);
        const [activeRes, histRes] = await Promise.all([
            getActiveCashRegisterAction(),
            getCashRegisterHistoryAction(20),
        ]);
        if (activeRes.success) setActiveCash(activeRes.data ?? null);
        if (histRes.success) setHistory(histRes.data ?? []);
        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    // Computed metrics from active cash movements
    const metrics = useMemo(() => {
        if (!activeCash?.movements) return { saldo: 0, totalRecebido: 0, sangrias: 0, suprimentos: 0, estornos: 0 };
        const mvs = activeCash.movements;
        let saldo = 0, totalRecebido = 0, sangrias = 0, suprimentos = 0, estornos = 0;
        for (const m of mvs) {
            const amt = Number(m.amount);
            if (isCredit(m.type)) saldo += amt;
            if (isDebit(m.type)) saldo -= amt;
            if (['RECEBIMENTO', 'ENTRADA_PEDIDO', 'QUITACAO'].includes(m.type)) totalRecebido += amt;
            if (m.type === 'SANGRIA') sangrias += amt;
            if (m.type === 'SUPRIMENTO') suprimentos += amt;
            if (m.type === 'ESTORNO') estornos += amt;
        }
        return { saldo, totalRecebido, sangrias, suprimentos, estornos };
    }, [activeCash]);

    async function handleOpen() {
        if (!user) return;
        setOpenLoading(true);
        const res = await openCashRegisterAction(Number(openAmount.replace(',', '.')) || 0, user);
        setOpenLoading(false);
        if (res.success) {
            toast({ title: 'Caixa aberto com sucesso.' });
            setOpenDialog(false);
            setOpenAmount('0');
            load();
        } else {
            toast({ variant: 'destructive', title: res.error ?? 'Erro ao abrir caixa.' });
        }
    }

    async function handleClose() {
        if (!user || !activeCash) return;
        setCloseLoading(true);
        const res = await closeCashRegisterAction(activeCash.id, Number(closeAmount.replace(',', '.')) || 0, user);
        setCloseLoading(false);
        if (res.success) {
            toast({ title: 'Caixa fechado com sucesso.' });
            setCloseDialog(false);
            setCloseAmount('');
            load();
        } else {
            toast({ variant: 'destructive', title: res.error ?? 'Erro ao fechar caixa.' });
        }
    }

    async function handleSangria() {
        if (!user || !activeCash) return;
        const amt = Number(sangriaAmount.replace(',', '.'));
        if (!amt || amt <= 0) { toast({ variant: 'destructive', title: 'Informe um valor válido.' }); return; }
        setSangriaLoading(true);
        const res = await addCashMovementAction(activeCash.id, 'SANGRIA', 'DINHEIRO', amt, user, { reason: sangriaReason || 'Sangria de caixa' });
        setSangriaLoading(false);
        if (res.success) {
            toast({ title: 'Sangria registrada.' });
            setSangria(false);
            setSangriaAmount('');
            setSangriaReason('');
            load();
        } else {
            toast({ variant: 'destructive', title: res.error ?? 'Erro ao registrar sangria.' });
        }
    }

    async function handleSuprimento() {
        if (!user || !activeCash) return;
        const amt = Number(suprimentoAmount.replace(',', '.'));
        if (!amt || amt <= 0) { toast({ variant: 'destructive', title: 'Informe um valor válido.' }); return; }
        setSuprimentoLoading(true);
        const res = await addCashMovementAction(activeCash.id, 'SUPRIMENTO', 'DINHEIRO', amt, user, { reason: suprimentoReason || 'Suprimento de caixa' });
        setSuprimentoLoading(false);
        if (res.success) {
            toast({ title: 'Suprimento registrado.' });
            setSuprimento(false);
            setSuprimentoAmount('');
            setSuprimentoReason('');
            load();
        } else {
            toast({ variant: 'destructive', title: res.error ?? 'Erro ao registrar suprimento.' });
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;
    }

    const closedHistory = history.filter(r => r.status === 'FECHADO');

    return (
        <div className="flex flex-col gap-6 p-4 md:p-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h1 className="text-2xl font-bold">Caixa</h1>
                    {activeCash && (
                        <p className="text-sm text-muted-foreground">
                            Aberto em {fmtDate(activeCash.openedAt)} por {activeCash.openedByName}
                        </p>
                    )}
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
                        <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                        Atualizar
                    </Button>
                    {activeCash ? (
                        <>
                            <Button variant="outline" size="sm" onClick={() => setSangria(true)}>
                                <ArrowDownCircle className="h-4 w-4 mr-1 text-red-500" />
                                Sangria
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setSuprimento(true)}>
                                <ArrowUpCircle className="h-4 w-4 mr-1 text-purple-500" />
                                Suprimento
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => { setCloseAmount(String(metrics.saldo.toFixed(2))); setCloseDialog(true); }}>
                                <LockKeyhole className="h-4 w-4 mr-1" />
                                Fechar Caixa
                            </Button>
                        </>
                    ) : (
                        <Button size="sm" onClick={() => setOpenDialog(true)}>
                            <DollarSign className="h-4 w-4 mr-1" />
                            Abrir Caixa
                        </Button>
                    )}
                </div>
            </div>

            {/* Closed banner */}
            {!activeCash && (
                <Card className="border-yellow-300 bg-yellow-50">
                    <CardContent className="pt-6 flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        <p className="text-yellow-800 font-medium">Nenhum caixa aberto. Abra o caixa para registrar pagamentos.</p>
                    </CardContent>
                </Card>
            )}

            {/* Cards */}
            {activeCash && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Atual</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-green-600">{fmt(metrics.saldo)}</p>
                            <p className="text-xs text-muted-foreground mt-1">Abertura: {fmt(activeCash.openingAmount)}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Recebido</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-emerald-600">{fmt(metrics.totalRecebido)}</p>
                            <p className="text-xs text-muted-foreground mt-1">Parcelas + entradas</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Sangrias</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-red-600">{fmt(metrics.sangrias)}</p>
                            <p className="text-xs text-muted-foreground mt-1">Retiradas do caixa</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Estornos</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-orange-600">{fmt(metrics.estornos)}</p>
                            <p className="text-xs text-muted-foreground mt-1">Pagamentos estornados</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Movement table */}
            {activeCash && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Receipt className="h-4 w-4" />
                            Movimentações do Caixa
                            <span className="ml-auto text-sm font-normal text-muted-foreground">
                                {activeCash.movements?.length ?? 0} registros
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Forma</TableHead>
                                        <TableHead>Valor</TableHead>
                                        <TableHead>Observação</TableHead>
                                        <TableHead>Operador</TableHead>
                                        <TableHead>Hora</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(activeCash.movements ?? []).length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                                Nenhuma movimentação registrada.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        [...(activeCash.movements ?? [])].reverse().map(m => (
                                            <TableRow key={m.id}>
                                                <TableCell>
                                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${MOVEMENT_COLORS[m.type] ?? 'bg-gray-100 text-gray-700'}`}>
                                                        {MOVEMENT_LABELS[m.type] ?? m.type}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-sm">{PM_LABELS[m.paymentMethod] ?? m.paymentMethod}</TableCell>
                                                <TableCell className={`font-medium text-sm ${isDebit(m.type) ? 'text-red-600' : 'text-green-600'}`}>
                                                    {isDebit(m.type) ? '-' : '+'}{fmt(Number(m.amount))}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{m.reason ?? '—'}</TableCell>
                                                <TableCell className="text-sm">{m.createdByName ?? '—'}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{fmtDate(m.createdAt)}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* History */}
            {closedHistory.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <History className="h-4 w-4" />
                            Histórico de Caixas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Abertura</TableHead>
                                        <TableHead>Fechamento</TableHead>
                                        <TableHead>Operador</TableHead>
                                        <TableHead>Valor Abertura</TableHead>
                                        <TableHead>Esperado</TableHead>
                                        <TableHead>Contado</TableHead>
                                        <TableHead>Diferença</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {closedHistory.map(r => {
                                        const diff = Number(r.difference ?? 0);
                                        return (
                                            <TableRow key={r.id}>
                                                <TableCell className="text-sm">{fmtDate(r.openedAt)}</TableCell>
                                                <TableCell className="text-sm">{fmtDate(r.closedAt)}</TableCell>
                                                <TableCell className="text-sm">{r.openedByName}</TableCell>
                                                <TableCell className="text-sm">{fmt(r.openingAmount)}</TableCell>
                                                <TableCell className="text-sm">{fmt(Number(r.expectedAmount ?? 0))}</TableCell>
                                                <TableCell className="text-sm">{fmt(Number(r.closingAmount ?? 0))}</TableCell>
                                                <TableCell className={`text-sm font-medium ${diff < 0 ? 'text-red-600' : diff > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                                                    {diff >= 0 ? '+' : ''}{fmt(diff)}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Open Dialog ── */}
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Abrir Caixa</DialogTitle>
                        <DialogDescription>Informe o valor inicial em dinheiro no caixa.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <Label>Valor de Abertura (R$)</Label>
                        <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={openAmount}
                            onChange={e => setOpenAmount(e.target.value)}
                            placeholder="0,00"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button>
                        <Button onClick={handleOpen} disabled={openLoading}>
                            {openLoading ? 'Abrindo...' : 'Abrir Caixa'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Close Dialog ── */}
            <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Fechar Caixa</DialogTitle>
                        <DialogDescription>Conte o dinheiro físico e informe o valor total.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="rounded-lg bg-muted p-3 space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Saldo esperado:</span>
                                <span className="font-medium">{fmt(metrics.saldo)}</span>
                            </div>
                        </div>
                        <div>
                            <Label>Valor Contado em Caixa (R$)</Label>
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={closeAmount}
                                onChange={e => setCloseAmount(e.target.value)}
                                placeholder="0,00"
                                className="mt-1"
                            />
                        </div>
                        {closeAmount !== '' && (
                            <div className="rounded-lg bg-muted p-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Diferença:</span>
                                    <span className={`font-bold ${(Number(closeAmount.replace(',', '.')) - metrics.saldo) < 0 ? 'text-red-600' : (Number(closeAmount.replace(',', '.')) - metrics.saldo) > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                                        {(() => {
                                            const d = Number(closeAmount.replace(',', '.')) - metrics.saldo;
                                            return `${d >= 0 ? '+' : ''}${fmt(d)}`;
                                        })()}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCloseDialog(false)}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleClose} disabled={closeLoading || closeAmount === ''}>
                            {closeLoading ? 'Fechando...' : 'Confirmar Fechamento'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Sangria Dialog ── */}
            <Dialog open={sangria} onOpenChange={setSangria}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Sangria de Caixa</DialogTitle>
                        <DialogDescription>Registre uma retirada de dinheiro do caixa.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <Label>Valor (R$)</Label>
                            <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={sangriaAmount}
                                onChange={e => setSangriaAmount(e.target.value)}
                                placeholder="0,00"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Motivo</Label>
                            <Textarea
                                value={sangriaReason}
                                onChange={e => setSangriaReason(e.target.value)}
                                placeholder="Ex.: Pagamento de fornecedor..."
                                rows={3}
                                className="mt-1"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSangria(false)}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleSangria} disabled={sangriaLoading}>
                            {sangriaLoading ? 'Registrando...' : 'Registrar Sangria'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Suprimento Dialog ── */}
            <Dialog open={suprimento} onOpenChange={setSuprimento}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Suprimento de Caixa</DialogTitle>
                        <DialogDescription>Registre uma entrada de dinheiro no caixa.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <Label>Valor (R$)</Label>
                            <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={suprimentoAmount}
                                onChange={e => setSuprimentoAmount(e.target.value)}
                                placeholder="0,00"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Motivo</Label>
                            <Textarea
                                value={suprimentoReason}
                                onChange={e => setSuprimentoReason(e.target.value)}
                                placeholder="Ex.: Troco, reforço de caixa..."
                                rows={3}
                                className="mt-1"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSuprimento(false)}>Cancelar</Button>
                        <Button onClick={handleSuprimento} disabled={suprimentoLoading}>
                            {suprimentoLoading ? 'Registrando...' : 'Registrar Suprimento'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
