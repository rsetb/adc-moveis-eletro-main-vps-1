'use client';

import { useState, useEffect, useMemo } from 'react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Product, StockMovement } from '@/lib/types';
import {
    getStockSummaryAction,
    getStockMovementsAction,
    addStockEntryAction,
    adjustStockAction,
} from '@/app/actions/admin/stock';

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
import {
    Package,
    AlertTriangle,
    DollarSign,
    TrendingUp,
    Search,
    PlusCircle,
    SlidersHorizontal,
    History,
    RefreshCw,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const formatDate = (iso: string) => {
    try {
        return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
        return iso;
    }
};

const movementTypeLabel: Record<string, { label: string; color: string }> = {
    ENTRADA: { label: 'Entrada', color: 'bg-green-100 text-green-800' },
    SAIDA: { label: 'Saída', color: 'bg-red-100 text-red-800' },
    AJUSTE: { label: 'Ajuste', color: 'bg-yellow-100 text-yellow-800' },
    AVARIA: { label: 'Avaria', color: 'bg-orange-100 text-orange-800' },
    VENDA: { label: 'Venda', color: 'bg-blue-100 text-blue-800' },
};

type SummaryProduct = {
    id: string;
    name: string;
    stock: number;
    minStock: number | null;
    cost: number | null;
    price: number;
    unit: string | null;
    category: string | null;
};

export default function EstoquePage() {
    const { user } = useAuth();
    const { toast } = useToast();

    const [summary, setSummary] = useState<{
        totalProducts: number;
        lowStock: number;
        totalValue: number;
        recentMovements: number;
        products: SummaryProduct[];
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Entry dialog
    const [entryOpen, setEntryOpen] = useState(false);
    const [entryProduct, setEntryProduct] = useState<SummaryProduct | null>(null);
    const [entryQty, setEntryQty] = useState('');
    const [entryCost, setEntryCost] = useState('');
    const [entryReason, setEntryReason] = useState('');
    const [entrySaving, setEntrySaving] = useState(false);

    // Adjust dialog
    const [adjustOpen, setAdjustOpen] = useState(false);
    const [adjustProduct, setAdjustProduct] = useState<SummaryProduct | null>(null);
    const [adjustNewStock, setAdjustNewStock] = useState('');
    const [adjustReason, setAdjustReason] = useState('');
    const [adjustSaving, setAdjustSaving] = useState(false);

    // History dialog
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyProduct, setHistoryProduct] = useState<SummaryProduct | null>(null);
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    async function loadSummary() {
        setLoading(true);
        const res = await getStockSummaryAction();
        if (res.success && res.data) {
            setSummary(res.data as any);
        } else {
            toast({ title: 'Erro ao carregar estoque', description: res.error, variant: 'destructive' });
        }
        setLoading(false);
    }

    useEffect(() => {
        loadSummary();
    }, []);

    const filtered = useMemo(() => {
        if (!summary) return [];
        const q = search.toLowerCase();
        return summary.products.filter(
            (p) =>
                p.name.toLowerCase().includes(q) ||
                (p.category ?? '').toLowerCase().includes(q)
        );
    }, [summary, search]);

    function openEntry(p: SummaryProduct) {
        setEntryProduct(p);
        setEntryQty('');
        setEntryCost(p.cost != null ? String(p.cost) : '');
        setEntryReason('');
        setEntryOpen(true);
    }

    function openAdjust(p: SummaryProduct) {
        setAdjustProduct(p);
        setAdjustNewStock(String(p.stock));
        setAdjustReason('');
        setAdjustOpen(true);
    }

    async function openHistory(p: SummaryProduct) {
        setHistoryProduct(p);
        setHistoryOpen(true);
        setHistoryLoading(true);
        const res = await getStockMovementsAction(p.id, 50);
        if (res.success && res.data) {
            setMovements(res.data);
        }
        setHistoryLoading(false);
    }

    async function handleEntry() {
        if (!entryProduct) return;
        const qty = Number(entryQty);
        const cost = Number(entryCost);
        if (!qty || qty <= 0) {
            toast({ title: 'Quantidade inválida', variant: 'destructive' });
            return;
        }
        setEntrySaving(true);
        const res = await addStockEntryAction(
            { productId: entryProduct.id, quantity: qty, unitCost: cost, reason: entryReason || undefined },
            user
        );
        setEntrySaving(false);
        if (res.success) {
            toast({ title: 'Entrada registrada com sucesso!' });
            setEntryOpen(false);
            loadSummary();
        } else {
            toast({ title: 'Erro ao registrar entrada', description: res.error, variant: 'destructive' });
        }
    }

    async function handleAdjust() {
        if (!adjustProduct) return;
        const newStock = Number(adjustNewStock);
        if (isNaN(newStock) || newStock < 0) {
            toast({ title: 'Estoque inválido', variant: 'destructive' });
            return;
        }
        setAdjustSaving(true);
        const res = await adjustStockAction(
            { productId: adjustProduct.id, newStock, reason: adjustReason },
            user
        );
        setAdjustSaving(false);
        if (res.success) {
            toast({ title: 'Estoque ajustado com sucesso!' });
            setAdjustOpen(false);
            loadSummary();
        } else {
            toast({ title: 'Erro ao ajustar estoque', description: res.error, variant: 'destructive' });
        }
    }

    const margin = (p: SummaryProduct) => {
        if (!p.cost || !p.price) return null;
        return ((p.price - p.cost) / p.price) * 100;
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Gestão de Estoque</h1>
                    <p className="text-muted-foreground text-sm">Controle entradas, saídas e ajustes de estoque</p>
                </div>
                <Button variant="outline" size="sm" onClick={loadSummary} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary?.totalProducts ?? '—'}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${(summary?.lowStock ?? 0) > 0 ? 'text-orange-500' : ''}`}>
                            {summary?.lowStock ?? '—'}
                        </div>
                        <p className="text-xs text-muted-foreground">abaixo do mínimo</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Valor em Estoque</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {summary ? formatCurrency(summary.totalValue) : '—'}
                        </div>
                        <p className="text-xs text-muted-foreground">custo × quantidade</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Movimentações (7d)</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary?.recentMovements ?? '—'}</div>
                        <p className="text-xs text-muted-foreground">últimos 7 dias</p>
                    </CardContent>
                </Card>
            </div>

            {/* Product Table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between gap-4">
                        <CardTitle>Produtos</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar produto..."
                                className="pl-8"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Produto</TableHead>
                                <TableHead className="text-center">Estoque</TableHead>
                                <TableHead className="text-center hidden md:table-cell">Mínimo</TableHead>
                                <TableHead className="text-right hidden md:table-cell">Custo</TableHead>
                                <TableHead className="text-right hidden md:table-cell">Preço</TableHead>
                                <TableHead className="text-right hidden lg:table-cell">Margem</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        Carregando...
                                    </TableCell>
                                </TableRow>
                            ) : filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        Nenhum produto encontrado.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((p) => {
                                    const isLow = p.minStock != null && p.stock <= p.minStock;
                                    const m = margin(p);
                                    return (
                                        <TableRow key={p.id}>
                                            <TableCell>
                                                <div className="font-medium">{p.name}</div>
                                                <div className="text-xs text-muted-foreground">{p.category ?? ''}</div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge
                                                    className={isLow ? 'bg-orange-100 text-orange-800 border-orange-200' : 'bg-green-100 text-green-800 border-green-200'}
                                                    variant="outline"
                                                >
                                                    {p.stock} {p.unit ?? 'UN'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center hidden md:table-cell text-muted-foreground text-sm">
                                                {p.minStock ?? '—'}
                                            </TableCell>
                                            <TableCell className="text-right hidden md:table-cell text-sm">
                                                {p.cost != null ? formatCurrency(p.cost) : '—'}
                                            </TableCell>
                                            <TableCell className="text-right hidden md:table-cell text-sm">
                                                {formatCurrency(p.price)}
                                            </TableCell>
                                            <TableCell className="text-right hidden lg:table-cell text-sm">
                                                {m != null ? (
                                                    <span className={m < 20 ? 'text-red-600' : m < 40 ? 'text-yellow-600' : 'text-green-600'}>
                                                        {m.toFixed(1)}%
                                                    </span>
                                                ) : '—'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button size="sm" variant="outline" onClick={() => openEntry(p)} title="Registrar entrada">
                                                        <PlusCircle className="h-4 w-4" />
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={() => openAdjust(p)} title="Ajustar estoque">
                                                        <SlidersHorizontal className="h-4 w-4" />
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={() => openHistory(p)} title="Histórico">
                                                        <History className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Entry Dialog */}
            <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Registrar Entrada</DialogTitle>
                        <DialogDescription>{entryProduct?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-1.5">
                            <Label>Quantidade</Label>
                            <Input
                                type="number"
                                min="1"
                                placeholder="Ex: 10"
                                value={entryQty}
                                onChange={(e) => setEntryQty(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Custo unitário (R$)</Label>
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Ex: 25.00"
                                value={entryCost}
                                onChange={(e) => setEntryCost(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Motivo / Observação (opcional)</Label>
                            <Input
                                placeholder="Ex: Compra NF 1234"
                                value={entryReason}
                                onChange={(e) => setEntryReason(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEntryOpen(false)}>Cancelar</Button>
                        <Button onClick={handleEntry} disabled={entrySaving}>
                            {entrySaving ? 'Salvando...' : 'Registrar Entrada'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Adjust Dialog */}
            <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Ajustar Estoque</DialogTitle>
                        <DialogDescription>
                            {adjustProduct?.name} — Atual: {adjustProduct?.stock} {adjustProduct?.unit ?? 'UN'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-1.5">
                            <Label>Novo estoque</Label>
                            <Input
                                type="number"
                                min="0"
                                value={adjustNewStock}
                                onChange={(e) => setAdjustNewStock(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Motivo (obrigatório)</Label>
                            <Textarea
                                placeholder="Ex: Contagem física revelou diferença"
                                value={adjustReason}
                                onChange={(e) => setAdjustReason(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancelar</Button>
                        <Button onClick={handleAdjust} disabled={adjustSaving}>
                            {adjustSaving ? 'Salvando...' : 'Confirmar Ajuste'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* History Dialog */}
            <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Histórico de Movimentações</DialogTitle>
                        <DialogDescription>{historyProduct?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[420px] overflow-auto">
                        {historyLoading ? (
                            <p className="text-center py-6 text-muted-foreground">Carregando...</p>
                        ) : movements.length === 0 ? (
                            <p className="text-center py-6 text-muted-foreground">Nenhuma movimentação registrada.</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead className="text-right">Qtd</TableHead>
                                        <TableHead className="hidden sm:table-cell">Motivo</TableHead>
                                        <TableHead className="hidden sm:table-cell">Usuário</TableHead>
                                        <TableHead>Data</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {movements.map((m) => {
                                        const t = movementTypeLabel[m.type] ?? { label: m.type, color: 'bg-gray-100 text-gray-800' };
                                        return (
                                            <TableRow key={m.id}>
                                                <TableCell>
                                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${t.color}`}>
                                                        {t.label}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right font-medium">{m.quantity}</TableCell>
                                                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground max-w-[200px] truncate">
                                                    {m.reason ?? '—'}
                                                </TableCell>
                                                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                                                    {m.createdByName ?? '—'}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                                    {formatDate(m.createdAt)}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setHistoryOpen(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
