'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/utils";
import { Order, CustomerInfo } from "@/lib/types";
import { Check, X, AlertTriangle } from "lucide-react";
import Image from "next/image";

interface ReviewOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    order: Partial<Order>;
    customer: CustomerInfo;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading: boolean;
}

export function ReviewOrderDialog({
    open,
    onOpenChange,
    order,
    customer,
    onConfirm,
    onCancel,
    isLoading
}: ReviewOrderDialogProps) {
    if (!order || !customer) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        <Check className="h-6 w-6 text-primary" />
                        Revisar Pedido
                    </DialogTitle>
                    <DialogDescription>
                        Por favor, confira os detalhes do seu pedido antes da confirmação final.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 px-6 py-2">
                    <div className="space-y-6">
                        {/* Customer Info */}
                        <div className="bg-muted/30 p-4 rounded-lg border">
                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                                Dados do Cliente
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground block">Nome:</span>
                                    <span className="font-medium">{customer.name}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">CPF:</span>
                                    <span className="font-medium">{customer.cpf}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Telefone:</span>
                                    <span className="font-medium">{customer.phone}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Email:</span>
                                    <span className="font-medium">{customer.email || '-'}</span>
                                </div>
                                <div className="md:col-span-2">
                                    <span className="text-muted-foreground block">Endereço:</span>
                                    <span className="font-medium">
                                        {customer.address}, {customer.number}
                                        {customer.complement && ` - ${customer.complement}`}
                                        <br />
                                        {customer.neighborhood} - {customer.city}/{customer.state}
                                        <br />
                                        CEP: {customer.zip}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Order Items */}
                        <div>
                            <h3 className="font-semibold mb-3">Itens do Pedido</h3>
                            <div className="space-y-3">
                                {order.items?.map((item: any, index: number) => (
                                    <div key={index} className="flex gap-4 border-b pb-3 last:border-0">
                                        <div className="relative h-16 w-16 bg-muted rounded overflow-hidden flex-shrink-0">
                                            {item.imageUrl && (
                                                <Image 
                                                    src={item.imageUrl} 
                                                    alt={item.name} 
                                                    fill 
                                                    className="object-cover" 
                                                />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">{item.name}</p>
                                            <div className="flex justify-between items-end mt-1">
                                                <p className="text-sm text-muted-foreground">
                                                    {item.quantity}x {formatCurrency(item.price)}
                                                </p>
                                                <p className="font-semibold text-sm">
                                                    {formatCurrency(item.price * item.quantity)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Payment Summary */}
                        <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                            <h3 className="font-semibold mb-3">Resumo do Pagamento</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Forma de Pagamento:</span>
                                    <span className="font-medium">{order.paymentMethod}</span>
                                </div>
                                {order.installments && order.installments > 1 && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Parcelamento:</span>
                                        <span className="font-medium">
                                            {order.installments}x de {formatCurrency(order.installmentValue || 0)}
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between pt-2 border-t mt-2 text-base font-bold">
                                    <span>Total:</span>
                                    <span className="text-primary">{formatCurrency(order.total || 0)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200 text-xs text-yellow-800 flex gap-2">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                            <p>
                                Ao confirmar, seu pedido será processado e o estoque reservado.
                                Caso precise alterar algo, clique em "Editar".
                            </p>
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="p-6 pt-2 border-t bg-muted/10 gap-2 sm:gap-0">
                    <Button 
                        variant="outline" 
                        onClick={onCancel}
                        disabled={isLoading}
                        className="w-full sm:w-auto"
                    >
                        <X className="mr-2 h-4 w-4" />
                        Editar / Cancelar
                    </Button>
                    <Button 
                        onClick={onConfirm} 
                        disabled={isLoading}
                        className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                    >
                        {isLoading ? (
                            "Processando..."
                        ) : (
                            <>
                                <Check className="mr-2 h-4 w-4" />
                                Confirmar Pedido
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
