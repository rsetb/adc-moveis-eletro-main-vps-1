'use client';

import { useState, useEffect, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Eye, Check, X, Loader2, Undo2, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { getPendingOrdersAction, getTrashedPendingOrdersAction, rejectTemporaryOrderToTrashAction, restoreTemporaryOrderFromTrashAction, permanentlyDeleteTemporaryOrderFromTrashAction } from '@/app/actions/admin/pending-orders';
import { confirmTemporaryOrderAction } from '@/app/actions/checkout-flow';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/context/AuthContext';
import { Textarea } from '@/components/ui/textarea';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

function PendingOrdersContent() {
    const [orders, setOrders] = useState<any[]>([]);
    const [trashedOrders, setTrashedOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [tab, setTab] = useState<'pending' | 'trash'>('pending');
    const [rejectReason, setRejectReason] = useState('');
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();
    const targetId = searchParams.get('id');
    const { user } = useAuth();
    const canViewTrash = user?.role === 'admin' || user?.role === 'gerente';

    const fetchPendingOrders = async () => {
        setIsLoading(true);
        try {
            const result = await getPendingOrdersAction();
            if (result.success) {
                const fetchedOrders = (result as any).data || [];
                setOrders(fetchedOrders);
                
                if (targetId) {
                    const found = fetchedOrders.find((o: any) => o.id === targetId);
                    if (found) {
                        setSelectedOrder(found);
                    }
                }
            } else {
                toast({
                    title: "Erro",
                    description: "Não foi possível carregar os pedidos pendentes.",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error("Error fetching orders:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTrashedOrders = async () => {
        if (!canViewTrash) return;
        try {
            const result = await getTrashedPendingOrdersAction(user);
            if (result.success) {
                setTrashedOrders((result as any).data || []);
            } else {
                toast({
                    title: "Erro",
                    description: (result as any).error || "Não foi possível carregar a lixeira.",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error("Error fetching trashed orders:", error);
        }
    };

    useEffect(() => {
        fetchPendingOrders();
        if (canViewTrash) fetchTrashedOrders();
    }, [targetId, canViewTrash]);

    const handleConfirm = async (tempId: string) => {
        if (!confirm('Tem certeza que deseja aprovar este pedido? O estoque será debitado.')) return;

        setIsProcessing(true);
        try {
            const result = await confirmTemporaryOrderAction(tempId);
            
            if (result.success) {
                const orderId = (result as any).orderId;
                toast({
                    title: "Sucesso",
                    description: `Pedido confirmado! ID: ${orderId}`,
                });
                setSelectedOrder(null);
                fetchPendingOrders();
                
                // Optional: Redirect to permanent order details or generate WhatsApp link
                if (orderId && selectedOrder) {
                     // Generate WhatsApp Link logic
                     const whatsappLink = `https://wa.me/55${selectedOrder.details.customerData.phone.replace(/\D/g, '')}?text=Olá ${selectedOrder.details.customerData.name}, seu pedido foi confirmado! ID: ${orderId}`;
                     window.open(whatsappLink, '_blank');
                }
            } else {
                throw new Error((result as any).error || "Erro ao confirmar.");
            }
        } catch (error: any) {
            toast({
                title: "Erro na Confirmação",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async (tempId: string) => {
        const cleanedReason = rejectReason.trim();
        if (cleanedReason.length < 3) {
            toast({
                title: "Motivo obrigatório",
                description: "Informe um motivo (mínimo 3 caracteres) para rejeitar.",
                variant: "destructive"
            });
            return;
        }

        setIsProcessing(true);
        try {
            const result = await rejectTemporaryOrderToTrashAction(tempId, cleanedReason, user);
            if (result.success) {
                toast({
                    title: "Pedido Rejeitado",
                    description: "A solicitação foi enviada para a lixeira.",
                });
                setSelectedOrder(null);
                setRejectReason('');
                await fetchPendingOrders();
                await fetchTrashedOrders();
            } else {
                throw new Error((result as any).error);
            }
        } catch (error: any) {
            toast({
                title: "Erro",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRestore = async (tempId: string) => {
        setIsProcessing(true);
        try {
            const result = await restoreTemporaryOrderFromTrashAction(tempId, user);
            if (result.success) {
                toast({
                    title: "Solicitação Restaurada",
                    description: "A solicitação voltou para Pendentes.",
                });
                setSelectedOrder(null);
                await fetchPendingOrders();
                await fetchTrashedOrders();
            } else {
                throw new Error((result as any).error);
            }
        } catch (error: any) {
            toast({
                title: "Erro",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePermanentDelete = async (tempId: string) => {
        setIsProcessing(true);
        try {
            const result = await permanentlyDeleteTemporaryOrderFromTrashAction(tempId, user);
            if (result.success) {
                toast({
                    title: "Excluído Permanentemente",
                    description: "A solicitação foi removida do sistema e não poderá ser recuperada.",
                    variant: "destructive"
                });
                setSelectedOrder(null);
                await fetchTrashedOrders();
                await fetchPendingOrders();
            } else {
                throw new Error((result as any).error);
            }
        } catch (error: any) {
            toast({
                title: "Erro",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsProcessing(false);
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center">Carregando solicitações...</div>;
    }

    return (
        <>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold font-headline text-primary">Solicitações Web</h1>
                        <TabsList>
                            <TabsTrigger value="pending">Pendentes</TabsTrigger>
                            {canViewTrash && <TabsTrigger value="trash">Lixeira</TabsTrigger>}
                        </TabsList>
                    </div>
                    <Button
                        variant="outline"
                        onClick={async () => {
                            await fetchPendingOrders();
                            await fetchTrashedOrders();
                        }}
                        size="sm"
                    >
                        Atualizar Lista
                    </Button>
                </div>

                <TabsContent value="pending">
                    {orders.length === 0 ? (
                        <Card>
                            <CardContent className="p-12 text-center text-muted-foreground">
                                Nenhuma solicitação pendente no momento.
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Itens</TableHead>
                                        <TableHead>Total</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orders.map((order) => (
                                        <TableRow key={order.id}>
                                            <TableCell>{format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm')}</TableCell>
                                            <TableCell className="font-medium">{order.customerName}</TableCell>
                                            <TableCell>{order.itemsCount} itens</TableCell>
                                            <TableCell>{formatCurrency(order.total)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => setSelectedOrder(order)}
                                                >
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    Revisar
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    )}
                </TabsContent>

                {canViewTrash && (
                    <TabsContent value="trash">
                        {trashedOrders.length === 0 ? (
                            <Card>
                                <CardContent className="p-12 text-center text-muted-foreground">
                                    Nenhuma solicitação na lixeira.
                                </CardContent>
                            </Card>
                        ) : (
                            <Card>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Data</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead>Motivo</TableHead>
                                            <TableHead className="text-right">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {trashedOrders.map((order) => (
                                            <TableRow key={order.id}>
                                                <TableCell className="whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs text-muted-foreground">Recebida: {format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm')}</span>
                                                        <span className="text-xs">Lixeira: {order.deletedAt ? format(new Date(order.deletedAt), 'dd/MM/yyyy HH:mm') : '-'}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="destructive">REJEITADO</Badge>
                                                        <span>{order.customerName}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-[380px] truncate">{order.rejectReason || '-'}</TableCell>
                                                <TableCell className="text-right space-x-2">
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => setSelectedOrder(order)}
                                                    >
                                                        <Eye className="h-4 w-4 mr-2" />
                                                        Ver
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleRestore(order.id)}
                                                        disabled={isProcessing}
                                                    >
                                                        <Undo2 className="h-4 w-4 mr-2" />
                                                        Restaurar
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                disabled={isProcessing}
                                                            >
                                                                <Trash2 className="h-4 w-4 mr-2" />
                                                                Excluir Permanentemente
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Esta ação é irreversível. A solicitação será removida do sistema sem possibilidade de recuperação.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handlePermanentDelete(order.id)} disabled={isProcessing}>
                                                                    Excluir Permanentemente
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Card>
                        )}
                    </TabsContent>
                )}
            </div>
        </Tabs>

            {/* Review Dialog */}
            <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            Revisão de Solicitação
                            {selectedOrder?.deletedAt && <Badge variant="destructive">NA LIXEIRA</Badge>}
                        </DialogTitle>
                        <DialogDescription className="space-y-1">
                            <div>Solicitação recebida em {selectedOrder && format(new Date(selectedOrder.createdAt), 'dd/MM/yyyy HH:mm')}</div>
                            {selectedOrder?.deletedAt && (
                                <div>
                                    Rejeitada em {format(new Date(selectedOrder.deletedAt), 'dd/MM/yyyy HH:mm')} por {selectedOrder.rejectedByName || '—'} ({selectedOrder.rejectedByRole || '—'})
                                </div>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedOrder && (
                        <div className="flex-1 overflow-y-auto pr-2">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="font-semibold mb-2">Dados do Cliente</h3>
                                    <div className="text-sm space-y-1 bg-muted p-3 rounded-md">
                                        <p><span className="font-medium">Nome:</span> {selectedOrder.details.customerData.name}</p>
                                        <p><span className="font-medium">CPF:</span> {selectedOrder.details.customerData.cpf}</p>
                                        <p><span className="font-medium">Tel:</span> {selectedOrder.details.customerData.phone}</p>
                                        <p><span className="font-medium">Endereço:</span> {selectedOrder.details.customerData.address}, {selectedOrder.details.customerData.number}</p>
                                        <p>{selectedOrder.details.customerData.neighborhood} - {selectedOrder.details.customerData.city}/{selectedOrder.details.customerData.state}</p>
                                    </div>

                                    <h3 className="font-semibold mt-4 mb-2">Pagamento</h3>
                                    <div className="text-sm space-y-1 bg-muted p-3 rounded-md">
                                        <p><span className="font-medium">Método:</span> {selectedOrder.details.orderData.paymentMethod}</p>
                                        <p><span className="font-medium">Parcelas:</span> {selectedOrder.details.orderData.installments}x</p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="font-semibold mb-2">Itens do Pedido</h3>
                                    <ScrollArea className="h-[200px] border rounded-md p-2">
                                        <div className="space-y-3">
                                            {selectedOrder.details.orderData.items.map((item: any, idx: number) => (
                                                <div key={idx} className="flex items-center gap-3 text-sm border-b pb-2 last:border-0">
                                                    <div className="relative h-10 w-10 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                                                        {item.imageUrl && (
                                                            <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-medium">{item.name}</p>
                                                        <div className="flex justify-between text-muted-foreground">
                                                            <span>Qtd: {item.quantity}</span>
                                                            <span>{formatCurrency(item.price)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                    <div className="flex justify-between items-center mt-3 font-bold text-lg border-t pt-2">
                                        <span>Total</span>
                                        <span>{formatCurrency(selectedOrder.total)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="mt-4 gap-2 sm:gap-0">
                        {selectedOrder?.deletedAt ? (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => selectedOrder && handleRestore(selectedOrder.id)}
                                    disabled={isProcessing}
                                >
                                    {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : <Undo2 className="mr-2 h-4 w-4" />}
                                    Restaurar
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="destructive"
                                            disabled={isProcessing}
                                        >
                                            {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                            Excluir Permanentemente
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta ação é irreversível. A solicitação será removida do sistema sem possibilidade de recuperação.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => selectedOrder && handlePermanentDelete(selectedOrder.id)} disabled={isProcessing}>
                                                Excluir Permanentemente
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </>
                        ) : (
                            <>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="destructive"
                                            disabled={isProcessing}
                                        >
                                            {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : <X className="mr-2 h-4 w-4" />}
                                            Rejeitar Pedido
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Rejeitar solicitação</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                A solicitação será enviada para a lixeira e poderá ser restaurada dentro do período configurado.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Motivo da rejeição</label>
                                            <Textarea
                                                value={rejectReason}
                                                onChange={(e) => setRejectReason(e.target.value)}
                                                placeholder="Ex: Cliente solicitou cancelamento / Dados inconsistentes / Sem estoque"
                                            />
                                        </div>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => selectedOrder && handleReject(selectedOrder.id)} disabled={isProcessing}>
                                                Confirmar Rejeição
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                <Button
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                    onClick={() => selectedOrder && handleConfirm(selectedOrder.id)}
                                    disabled={isProcessing}
                                >
                                    {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
                                    Confirmar e Gerar Pedido
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        
        </>
    );
}

export default function PendingOrdersPage() {
    return (
        <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <PendingOrdersContent />
        </Suspense>
    );
}
