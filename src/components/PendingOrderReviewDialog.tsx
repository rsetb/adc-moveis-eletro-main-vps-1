
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { confirmTemporaryOrderAction, cancelTemporaryOrderAction } from '@/app/actions/checkout-flow';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
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
import { Textarea } from '@/components/ui/textarea';

interface PendingOrderReviewDialogProps {
    isOpen: boolean;
    onClose: () => void;
    order: any | null;
    onSuccess: () => void;
}

export function PendingOrderReviewDialog({ isOpen, onClose, order, onSuccess }: PendingOrderReviewDialogProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const { toast } = useToast();
    const { user } = useAuth();

    const handleConfirm = async () => {
        if (!order) return;
        if (!confirm('Tem certeza que deseja aprovar este pedido? O estoque será debitado.')) return;

        setIsProcessing(true);
        try {
            const result = await confirmTemporaryOrderAction(order.id);
            
            if (result.success) {
                const orderId = (result as any).orderId;
                toast({
                    title: "Sucesso",
                    description: `Pedido confirmado! ID: ${orderId}`,
                });
                
                // Força atualização da lista de pedidos no contexto global
                if (typeof window !== 'undefined') {
                    // Dispatch a custom event that the admin context can listen to
                    window.dispatchEvent(new Event('order-updated'));
                }
                
                onSuccess();
                onClose();
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

    const handleReject = async () => {
        if (!order) return;
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
            const result = await cancelTemporaryOrderAction(order.id, cleanedReason, user);
            if (result.success) {
                toast({
                    title: "Pedido Rejeitado",
                    description: "A solicitação foi enviada para a lixeira.",
                });
                setRejectReason('');
                onSuccess();
                onClose();
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

    if (!order) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Revisão de Pedido</DialogTitle>
                    <DialogDescription>
                        Solicitação recebida em {format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm')}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="font-semibold mb-2">Dados do Cliente</h3>
                            <div className="text-sm space-y-1 bg-muted p-3 rounded-md">
                                <p><span className="font-medium">Nome:</span> {order.details.customerData.name}</p>
                                <p><span className="font-medium">CPF:</span> {order.details.customerData.cpf}</p>
                                <p><span className="font-medium">Tel:</span> {order.details.customerData.phone}</p>
                                <p><span className="font-medium">Endereço:</span> {order.details.customerData.address}, {order.details.customerData.number}</p>
                                <p>{order.details.customerData.neighborhood} - {order.details.customerData.city}/{order.details.customerData.state}</p>
                                {order.details.customerData.rating && (
                                    <div className="flex items-center mt-2">
                                        <span className="font-medium mr-2">Classificação:</span>
                                        {(() => {
                                            const rating = order.details.customerData.rating;
                                            if (rating === 1) return <Badge variant="destructive" className="text-[10px] h-5 px-2">RUIM</Badge>;
                                            if (rating === 2) return <Badge variant="secondary" className="bg-yellow-500 text-white hover:bg-yellow-600 border-none text-[10px] h-5 px-2">REGULAR</Badge>;
                                            if (rating === 3) return <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-[10px] h-5 px-2">EXCELENTE</Badge>;
                                            return null;
                                        })()}
                                    </div>
                                )}
                            </div>

                            <h3 className="font-semibold mt-4 mb-2">Pagamento</h3>
                            <div className="text-sm space-y-1 bg-muted p-3 rounded-md">
                                <p><span className="font-medium">Método:</span> {order.details.orderData.paymentMethod}</p>
                                <p><span className="font-medium">Parcelas:</span> {order.details.orderData.installments}x</p>
                            </div>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2">Itens do Pedido</h3>
                            <ScrollArea className="h-[200px] border rounded-md p-2">
                                <div className="space-y-3">
                                    {order.details.orderData.items.map((item: any, idx: number) => (
                                        <div key={idx} className="flex items-center gap-3 text-sm border-b pb-2 last:border-0">
                                            {/* Image placeholder or actual image if available */}
                                            {item.imageUrl ? (
                                                <div className="relative h-10 w-10 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                                                    <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
                                                </div>
                                            ) : (
                                                <div className="h-10 w-10 bg-gray-100 rounded flex items-center justify-center text-xs text-muted-foreground">
                                                    Img
                                                </div>
                                            )}
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
                                <span>{formatCurrency(order.total)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="mt-4 gap-2 sm:gap-0">
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
                                <AlertDialogAction onClick={handleReject} disabled={isProcessing}>
                                    Confirmar Rejeição
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <Button 
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={handleConfirm}
                        disabled={isProcessing}
                    >
                        {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
                        Confirmar e Gerar Pedido
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
