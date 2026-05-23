import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
    User as UserIcon,
    ShoppingBag,
    CreditCard,
    Clock,
    MessageSquare,
    Save,
    Undo2,
    FileText,
    CalendarIcon,
    Pencil,
    X,
    Check,
    Eye,
    AlertCircle,
    Calculator,
    Percent,
    DollarSign,
    Trash2,
    History,
    Printer,
    Loader2,
    ExternalLink,
    RefreshCw,
    Zap
} from 'lucide-react';
import { generateAsaasChargesAction, syncAsaasStatusesAction, cancelAsaasChargeAction } from '@/app/actions/admin/asaas';
import type { AsaasInstallmentCharge } from '@/lib/types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { Order, Installment, PaymentMethod } from '@/lib/types';
import { useAdmin } from '@/context/AdminContext';
import { useAuth } from '@/context/AuthContext';
import { useAudit } from '@/context/AuditContext';
import { useData } from '@/context/DataContext';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface OrderEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    order: Order | null;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatBRL = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) {
        return "";
    }
    return value.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const getStatusVariant = (status: Order['status']): 'secondary' | 'default' | 'outline' | 'destructive' => {
    switch (status) {
        case 'Processando':
            return 'secondary';
        case 'Enviado':
            return 'default';
        case 'Entregue':
            return 'outline';
        case 'Cancelado':
        case 'Excluído':
            return 'destructive';
        default:
            return 'secondary';
    }
};

const safeParseDate = (date: any) => {
    if (!date) return new Date();
    if (date instanceof Date) return date;
    if (typeof date === 'string') return parseISO(date);
    return new Date(date);
};

export function OrderEditDialog({ open, onOpenChange, order }: OrderEditDialogProps) {
    const { updateOrderStatus, updateOrderDetails, updateInstallmentDueDate, updateInstallmentAmount, recordInstallmentPayment, reversePayment } = useAdmin();
    const { user } = useAuth();
    const { toast } = useToast();
    const { products } = useData();
    const { logAction: auditLogAction } = useAudit();

    // Local state for editing
    const [installmentsInput, setInstallmentsInput] = useState(1);
    const [commissionInput, setCommissionInput] = useState('0,00');
    const [observationsInput, setObservationsInput] = useState('');
    const [discountInput, setDiscountInput] = useState(0);
    const [downPaymentInput, setDownPaymentInput] = useState(0);
    const [isDiscountUpdating, setIsDiscountUpdating] = useState(false);
    const [isDownPaymentUpdating, setIsDownPaymentUpdating] = useState(false);
    const [isObservationsUpdating, setIsObservationsUpdating] = useState(false);
    const [editingInstallment, setEditingInstallment] = useState<{ number: number, value: string } | null>(null);
    const [datePopoverOpen, setDatePopoverOpen] = useState<number | null>(null);
    const [orderDateInput, setOrderDateInput] = useState<Date | undefined>(undefined);
    const [orderDatePopoverOpen, setOrderDatePopoverOpen] = useState(false);
    const [isOrderDateUpdating, setIsOrderDateUpdating] = useState(false);

    // Asaas state
    const [asaasCharges, setAsaasCharges] = useState<AsaasInstallmentCharge[]>([]);
    const [isGeneratingAsaas, setIsGeneratingAsaas] = useState(false);
    const [isSyncingAsaas, setIsSyncingAsaas] = useState(false);

    // Payment Popover State
    const [paymentPopoverOpen, setPaymentPopoverOpen] = useState<number | null>(null);
    const [paymentAmountInput, setPaymentAmountInput] = useState<string>('');
    const [paymentMethodInput, setPaymentMethodInput] = useState<PaymentMethod>('Pix');
    const [cashReceivedInput, setCashReceivedInput] = useState<string>(''); // For change calculation
    const [changeAmount, setChangeAmount] = useState<number>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'gerente';
    const canEditInstallments = isManagerOrAdmin || user?.role === 'vendedor' || user?.role === 'vendedor_externo' || user?.role === 'vendedor_cobranca';
    
    // Permission Logic
    const canEditOrderDetails = user?.role !== 'vendedor_cobranca'; // Cannot change status, discount, etc.
    const canEditDiscountAndDownPayment = user?.role !== 'vendedor_cobranca'; // Vendedor Cobrança cannot edit discount and down payment here
    const canReceivePayments = true; // Everyone can receive payments (including Vendedor Cobrança)
    const canReversePayments = user?.role !== 'vendedor_cobranca'; // Vendedor Cobrança CANNOT reverse/undo payments

    useEffect(() => {
        if (order) {
            setInstallmentsInput(order.installments || 1);
            setCommissionInput(formatBRL(order.commission));
            setObservationsInput(order.observations || '');
            setDiscountInput(order.discount || 0);
            setDownPaymentInput(0);
            setOrderDateInput(safeParseDate(order.createdAt || order.date));
            setAsaasCharges((order.asaas?.charges as AsaasInstallmentCharge[]) || []);
        }
    }, [order?.id]);

    // Recalculate change whenever cash received or payment amount changes
    useEffect(() => {
        if (paymentMethodInput === 'Dinheiro') {
            const amountToPay = parseFloat(paymentAmountInput.replace(/\./g, '').replace(',', '.') || '0');
            const cashGiven = parseFloat(cashReceivedInput.replace(/\./g, '').replace(',', '.') || '0');
            if (!isNaN(amountToPay) && !isNaN(cashGiven) && cashGiven >= amountToPay) {
                setChangeAmount(cashGiven - amountToPay);
            } else {
                setChangeAmount(0);
            }
        } else {
            setChangeAmount(0);
        }
    }, [paymentAmountInput, cashReceivedInput, paymentMethodInput]);


    const maxAllowedInstallments = useMemo(() => {
        if (!order || !products) return 10;
        const orderProductIds = order.items.map(item => item.id);
        const orderProducts = products.filter(p => orderProductIds.includes(p.id));
        if (orderProducts.length === 0) return 10;

        const maxInstallmentsArray = orderProducts.map(p => p.maxInstallments ?? 10);
        return Math.min(...maxInstallmentsArray);
    }, [order, products]);

    const handleUpdateOrderStatus = (status: Order['status']) => {
        if (order && user) {
            updateOrderStatus(order.id, status, auditLogAction, user);
        }
    };

    const handleUpdatePaymentMethod = (paymentMethod: PaymentMethod) => {
        if (!order || !user) return;
        updateOrderDetails(order.id, { paymentMethod }, auditLogAction, user);
    };

    const handleUpdateInstallments = () => {
        if (!order || !installmentsInput || !user) return;

        if (installmentsInput > maxAllowedInstallments) {
            toast({ title: "Limite de Parcelas Excedido", description: `O número máximo de parcelas para este pedido é ${maxAllowedInstallments}.`, variant: "destructive" });
            return;
        }

        console.log('[OrderEditDialog] Atualizando parcelas com desconto', {
            orderId: order.id,
            installments: installmentsInput,
            discountInput,
            currentDiscount: order.discount,
            total: order.total
        });

        updateOrderDetails(order.id, {
            installments: installmentsInput,
            discount: discountInput
        }, auditLogAction, user);
    };

    const handleCalculateCommission = () => {
        if (!order || !user) return;
        updateOrderDetails(order.id, { isCommissionManual: false }, auditLogAction, user);
        toast({ title: 'Comissão Recalculada!', description: `A comissão do pedido #${order.id} foi recalculada.` });
    };

    const handleUpdateCommission = () => {
        if (!order || !user) return;
        const value = parseFloat(commissionInput.replace(/\./g, '').replace(',', '.'));
        if (isNaN(value) || value < 0) {
            toast({ title: 'Valor inválido', description: 'Por favor, insira um valor de comissão válido.', variant: 'destructive' });
            return;
        }
        updateOrderDetails(order.id, { commission: value, isCommissionManual: true }, auditLogAction, user);
    };

    const handleUpdateOrderDate = async () => {
        if (!order || !user || !orderDateInput) return;
        setIsOrderDateUpdating(true);
        const current = safeParseDate(order.createdAt || order.date);
        const merged = new Date(orderDateInput);
        merged.setHours(current.getHours(), current.getMinutes(), current.getSeconds(), current.getMilliseconds());
        const iso = merged.toISOString();
        await updateOrderDetails(order.id, { date: iso, createdAt: iso }, auditLogAction, user);
        setIsOrderDateUpdating(false);
        setOrderDatePopoverOpen(false);
    };

    const handleUpdateDiscount = async () => {
        if (!order || !user || isDiscountUpdating) return;
        const subtotal = order.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

        if (isNaN(discountInput) || discountInput < 0 || discountInput > subtotal) {
            toast({ title: 'Desconto inválido', description: 'O valor do desconto não pode ser negativo ou maior que o subtotal do pedido.', variant: 'destructive' });
            return;
        }

        console.log('[OrderEditDialog] Aplicando desconto', {
            orderId: order.id,
            subtotal,
            discountInput,
            currentDiscount: order.discount,
            total: order.total
        });

        setIsDiscountUpdating(true);
        try {
            await updateOrderDetails(order.id, { discount: discountInput }, auditLogAction, user);
            setDiscountInput(0);
        } finally {
            setIsDiscountUpdating(false);
        }
    };

    const handleResetDiscount = async () => {
        if (!order || !user || isDiscountUpdating || (order.discount || 0) <= 0) return;

        console.log('[OrderEditDialog] Resetando desconto', {
            orderId: order.id,
            currentDiscount: order.discount
        });

        setIsDiscountUpdating(true);
        try {
            await updateOrderDetails(order.id, { discount: 0 }, auditLogAction, user);
            setDiscountInput(0);
        } finally {
            setIsDiscountUpdating(false);
        }
    };

    const handleAddDownPayment = async () => {
        if (!order || !user || isDownPaymentUpdating) return;
        if (isNaN(downPaymentInput) || downPaymentInput <= 0) {
            toast({ title: 'Valor inválido', description: 'Por favor, insira um valor de entrada válido.', variant: 'destructive' });
            return;
        }

        console.log('[OrderEditDialog] Aplicando entrada', {
            orderId: order.id,
            downPaymentInput,
            currentDownPayment: order.downPayment,
            total: order.total
        });

        setIsDownPaymentUpdating(true);
        try {
            await updateOrderDetails(order.id, { downPayment: downPaymentInput }, auditLogAction, user);
            setDownPaymentInput(0);
        } finally {
            setIsDownPaymentUpdating(false);
        }
    };

    const handleResetDownPayment = async () => {
        if (!order || !user || isDownPaymentUpdating || (order.downPayment || 0) <= 0) return;
        console.log('[OrderEditDialog] Resetando entrada', {
            orderId: order.id,
            currentDownPayment: order.downPayment
        });
        setIsDownPaymentUpdating(true);
        try {
            await updateOrderDetails(order.id, { downPayment: 0, resetDownPayment: true }, auditLogAction, user);
        } finally {
            setIsDownPaymentUpdating(false);
        }
    };

    const handleUpdateObservations = async () => {
        if (!order || !user) return;
        setIsObservationsUpdating(true);
        try {
            await updateOrderDetails(order.id, { observations: observationsInput }, auditLogAction, user);
            toast({ title: 'Observações Atualizadas', description: 'As observações foram salvas com sucesso.' });
        } finally {
            setIsObservationsUpdating(false);
        }
    };

    const handleSaveInstallmentAmount = async () => {
        if (!order || !editingInstallment || !user) return;
        const newAmount = parseFloat(editingInstallment.value.replace(/\./g, '').replace(',', '.'));

        if (isNaN(newAmount) || newAmount < 0) {
            toast({ title: 'Valor Inválido', variant: 'destructive' });
            return;
        }

        await updateInstallmentAmount(order.id, editingInstallment.number, newAmount, auditLogAction, user);
        setEditingInstallment(null);
    };

    const handleDateSelect = async (installmentNumber: number, date: Date | undefined) => {
        if (!order || !date || !user) return;
        await updateInstallmentDueDate(order.id, installmentNumber, date, auditLogAction, user);
        setDatePopoverOpen(null);
    };

    const handleOpenPaymentPopover = (installment: Installment) => {
        const remaining = installment.amount - (installment.paidAmount || 0);
        setPaymentAmountInput(formatBRL(remaining));
        setPaymentMethodInput('Pix');
        setPaymentPopoverOpen(installment.installmentNumber);
    };

    const handleConfirmPayment = async (installmentNumber: number) => {
        if (!order || !user || isSubmitting) return;

        const amount = parseFloat(paymentAmountInput.replace(/\./g, '').replace(',', '.'));
        if (isNaN(amount) || amount <= 0) {
            toast({ title: "Valor Inválido", description: "Insira um valor maior que zero.", variant: "destructive" });
            return;
        }

        const payment = {
            id: crypto.randomUUID(),
            amount: amount,
            date: new Date().toISOString(),
            method: paymentMethodInput as any,
        };

        setIsSubmitting(true);
        try {
            await recordInstallmentPayment(order.id, installmentNumber, payment, auditLogAction, user);
            setPaymentPopoverOpen(null);
            toast({ title: "Pagamento Registrado", description: `Pagamento de ${formatCurrency(amount)} registrado na parcela ${installmentNumber}.` });
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Erro ao registrar pagamento.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReversePayment = async (installmentNumber: number, paymentId: string) => {
        if (!order || !user || isSubmitting) return;
        if (confirm('Tem certeza que deseja estornar este pagamento?')) {
            setIsSubmitting(true);
            try {
                await reversePayment(order.id, installmentNumber, paymentId, auditLogAction, user);
            } catch (error) {
                console.error(error);
                toast({ title: "Erro", description: "Erro ao estornar pagamento.", variant: "destructive" });
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const handleSendWhatsApp = (installment: Installment) => {
        if (!order) return;

        const phone = order.customer.phone.replace(/\D/g, '');
        const dueDate = format(parseISO(installment.dueDate), 'dd/MM/yyyy');
        const value = formatCurrency(installment.amount);
        const customerName = String(order.customer.name || '').split(' ')[0]; // First name

        const message = `Olá ${customerName}, referente à parcela ${installment.installmentNumber} do seu pedido, com vencimento em ${dueDate}, no valor de ${value}. Gostaria de saber se já efetuou o pagamento?`;

        const encodedMessage = encodeURIComponent(message);
        window.open(`https://wa.me/55${phone}?text=${encodedMessage}`, '_blank');
    };

    const handleGenerateAsaasCharges = async () => {
        if (!order || !user || isGeneratingAsaas) return;
        setIsGeneratingAsaas(true);
        try {
            const res = await generateAsaasChargesAction(order.id, user);
            if (res.success) {
                setAsaasCharges((res as any).data.charges || []);
                toast({ title: 'Cobranças geradas!', description: 'As cobranças foram criadas no Asaas com sucesso.' });
            } else {
                toast({ title: 'Erro', description: (res as any).error, variant: 'destructive' });
            }
        } finally {
            setIsGeneratingAsaas(false);
        }
    };

    const handleSyncAsaasStatuses = async () => {
        if (!order || !user || isSyncingAsaas) return;
        setIsSyncingAsaas(true);
        try {
            const res = await syncAsaasStatusesAction(order.id, user);
            if (res.success) {
                setAsaasCharges((res as any).data.charges || []);
                toast({ title: 'Status sincronizado!', description: 'Status das cobranças atualizado do Asaas.' });
            } else {
                toast({ title: 'Erro', description: (res as any).error, variant: 'destructive' });
            }
        } finally {
            setIsSyncingAsaas(false);
        }
    };

    const handleCancelAsaasCharge = async (installmentNumber: number) => {
        if (!order || !user) return;
        if (!confirm(`Cancelar a cobrança da parcela ${installmentNumber} no Asaas?`)) return;
        const res = await cancelAsaasChargeAction(order.id, installmentNumber, user);
        if (res.success) {
            setAsaasCharges((res as any).data.charges || []);
            toast({ title: 'Cobrança cancelada', description: `Parcela ${installmentNumber} cancelada no Asaas.` });
        } else {
            toast({ title: 'Erro', description: (res as any).error, variant: 'destructive' });
        }
    };

    if (!order) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle>Pedido: {order.id}</DialogTitle>
                    <DialogDescription>
                        Gerencie o status, faturamento e detalhes do pedido.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-grow p-1 pr-4 -mr-4 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4">
                                <UserIcon className="w-8 h-8 text-primary" />
                                <CardTitle className="text-lg">Cliente</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm space-y-1">
                                <p><strong>Nome:</strong> {order.customer.name}</p>
                                <p><strong>CPF:</strong> {order.customer.cpf}</p>
                                <p><strong>Telefone:</strong> {order.customer.phone}</p>
                                <p><strong>Endereço:</strong> {`${order.customer.address}, ${order.customer.city}`}</p>
                                <Link href={`/admin/clientes?cpf=${order.customer.cpf}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-2')}>
                                    <Eye className='mr-2 h-4 w-4' /> Ver Cadastro Completo
                                </Link>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4">
                                <ShoppingBag className="w-8 h-8 text-primary" />
                                <CardTitle className="text-lg">Resumo da Compra</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 text-sm">
                                    {order.items.map(item => (
                                        <div key={item.id} className="flex justify-between items-center">
                                            <span>{item.name} x {item.quantity}</span>
                                            <span>{formatCurrency(item.price * item.quantity)}</span>
                                        </div>
                                    ))}
                                    <Separator />
                                    {(order.downPayment || 0) > 0 && (
                                        <div className="flex justify-between items-center text-green-600">
                                            <span>Entrada</span>
                                            <span>- {formatCurrency(order.downPayment || 0)}</span>
                                        </div>
                                    )}
                                    {(order.discount || 0) > 0 && (
                                        <div className="flex justify-between items-center text-destructive">
                                            <span>Desconto</span>
                                            <span>- {formatCurrency(order.discount || 0)}</span>
                                        </div>
                                    )}
                                </div>
                                <Separator className="my-3" />
                                <div className="flex justify-between font-bold text-base">
                                    <span>TOTAL</span>
                                    <span>{formatCurrency(order.total)}</span>
                                </div>
                                <div className="flex justify-between text-sm mt-2">
                                    <span>Vendedor:</span>
                                    <span>{order.sellerName}</span>
                                </div>
                                <Separator className="my-3" />

                                {order.status === 'Entregue' && (
                                    <>
                                        <div className="flex justify-between text-base items-center">
                                            <span className="font-semibold text-green-600 flex items-center gap-2"><Percent className="h-4 w-4" />Comissão (5%):</span>
                                            <span className="font-bold text-green-600">{formatCurrency(order.commission || 0)}</span>
                                        </div>
                                        {/* Commission is now always automatic and read-only for Delivered orders */}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4">
                            <CreditCard className="w-8 h-8 text-primary" />
                            <CardTitle className="text-lg">Faturamento e Status</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                                <div>
                                    <label className="text-sm font-medium">Status do Pedido</label>
                                    <Select disabled={!canEditOrderDetails} value={order.status} onValueChange={(status) => handleUpdateOrderStatus(status as Order['status'])}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Alterar status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Processando">Processando</SelectItem>
                                            <SelectItem value="Enviado">Enviado</SelectItem>
                                            <SelectItem value="Entregue">Entregue</SelectItem>
                                            <SelectItem value="Cancelado">Cancelado</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Badge variant={getStatusVariant(order.status)} className="h-10 text-sm w-fit">{order.status}</Badge>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                                <div>
                                    <label className="text-sm font-medium">Desconto (R$)</label>
                                    {(order.discount || 0) > 0 ? (
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-muted px-3 py-2 text-sm">
                                                <span>{formatCurrency(order.discount || 0)}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-destructive"
                                                    onClick={handleResetDiscount}
                                                    disabled={isDiscountUpdating || !canEditDiscountAndDownPayment}
                                                >
                                                    <Undo2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <Input
                                                inputMode="decimal"
                                                value={formatBRL(discountInput)}
                                                onChange={(e) => {
                                                    const rawValue = e.target.value.replace(/\D/g, '');
                                                    setDiscountInput(Number(rawValue) / 100);
                                                }}
                                                className="h-9"
                                                disabled={isDiscountUpdating || !canEditDiscountAndDownPayment}
                                            />
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={handleUpdateDiscount}
                                                disabled={isDiscountUpdating || !canEditDiscountAndDownPayment}
                                            >
                                                <Save className="mr-2 h-4 w-4" /> Aplicar
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Entrada</label>
                                    {(order.downPayment || 0) > 0 ? (
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-muted px-3 py-2 text-sm">
                                                <span>{formatCurrency(order.downPayment || 0)}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-destructive"
                                                    onClick={handleResetDownPayment}
                                                    disabled={isDownPaymentUpdating || !canEditDiscountAndDownPayment}
                                                >
                                                    <Undo2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <Input
                                                inputMode="decimal"
                                                value={formatBRL(downPaymentInput)}
                                                onChange={(e) => {
                                                    const rawValue = e.target.value.replace(/\D/g, '');
                                                    setDownPaymentInput(Number(rawValue) / 100);
                                                }}
                                                className="h-9"
                                                disabled={isDownPaymentUpdating || !canEditDiscountAndDownPayment}
                                            />
                                            <Button size="sm" variant="outline" onClick={handleAddDownPayment} disabled={isDownPaymentUpdating || !canEditDiscountAndDownPayment}>
                                                <Save className="mr-2 h-4 w-4" /> Aplicar
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Forma de Pagamento</label>
                                    <Select disabled={!canEditOrderDetails} value={order.paymentMethod} onValueChange={(value) => handleUpdatePaymentMethod(value as PaymentMethod)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Alterar forma de pagamento" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Crediário">Crediário</SelectItem>
                                            <SelectItem value="Pix">Pix</SelectItem>
                                            <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                                            <SelectItem value="Cartão Crédito">Cartão Crédito</SelectItem>
                                            <SelectItem value="Cartão Débito">Cartão Débito</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {order.paymentMethod === 'Crediário' && (
                                    <div>
                                        <label className="text-sm font-medium">Parcelas (Max: {maxAllowedInstallments})</label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="number"
                                                value={installmentsInput}
                                                onChange={(e) => setInstallmentsInput(Number(e.target.value))}
                                                min="1" max={maxAllowedInstallments}
                                                className="w-24"
                                                disabled={!canEditOrderDetails}
                                                onKeyDown={(e) => e.key === 'Enter' && handleUpdateInstallments()}
                                            />
                                            <Button disabled={!canEditOrderDetails} size="sm" onClick={handleUpdateInstallments}>
                                                <Save className="mr-2 h-4 w-4" /> Salvar
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {order.paymentMethod === 'Crediário' && order.installmentDetails && order.installmentDetails.length > 0 && (
                        <Card>
                            <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4">
                                <FileText className="w-8 h-8 text-primary" />
                                <CardTitle className="text-lg">Detalhamento das Parcelas</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Parcela</TableHead>
                                            <TableHead>Vencimento</TableHead>
                                            <TableHead>Valor</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className='text-right'>Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {order.installmentDetails.map((installment) => (
                                            <TableRow key={installment.installmentNumber}>
                                                <TableCell>{installment.installmentNumber}ª Parcela</TableCell>
                                                <TableCell>
                                                    <Popover open={datePopoverOpen === installment.installmentNumber} onOpenChange={(open) => setDatePopoverOpen(open ? installment.installmentNumber : null)}>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-full justify-start text-left font-normal p-0 hover:bg-transparent">
                                                                {installment.dueDate ? format(parseISO(installment.dueDate), 'dd/MM/yyyy') : '-'}
                                                                {installment.status === 'Pendente' && canEditInstallments && <Pencil className="ml-2 h-3 w-3 opacity-50" />}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        {installment.status === 'Pendente' && canEditInstallments && (
                                                            <PopoverContent className="w-auto p-0">
                                                                <Calendar
                                                                    mode="single"
                                                                    selected={parseISO(installment.dueDate)}
                                                                    defaultMonth={parseISO(installment.dueDate)}
                                                                    onSelect={(date) => handleDateSelect(installment.installmentNumber, date)}
                                                                    initialFocus
                                                                />
                                                            </PopoverContent>
                                                        )}
                                                    </Popover>
                                                </TableCell>
                                                <TableCell>
                                                    {editingInstallment?.number === installment.installmentNumber ? (
                                                        <div className="flex items-center gap-1">
                                                            <Input
                                                                className="h-7 w-20 text-right p-1"
                                                                value={editingInstallment.value}
                                                                onChange={(e) => {
                                                                    const rawValue = e.target.value.replace(/\D/g, '');
                                                                    const value = (Number(rawValue) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                                                                    setEditingInstallment({ ...editingInstallment, value });
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') handleSaveInstallmentAmount();
                                                                    if (e.key === 'Escape') setEditingInstallment(null);
                                                                }}
                                                            />
                                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600" onClick={handleSaveInstallmentAmount}>
                                                                <Check className="h-4 w-4" />
                                                            </Button>
                                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => setEditingInstallment(null)}>
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 group">
                                                            {formatCurrency(installment.amount)}
                                                            {installment.status === 'Pendente' && canEditInstallments && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    onClick={() => setEditingInstallment({ number: installment.installmentNumber, value: formatBRL(installment.amount) })}
                                                                >
                                                                    <Pencil className="h-3 w-3" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={installment.status === 'Pago' ? 'default' : 'secondary'} className={cn(installment.status === 'Pago' && "bg-green-600 hover:bg-green-700")}>
                                                        {installment.status}
                                                    </Badge>
                                                    {(installment.paidAmount || 0) > 0 && installment.status !== 'Pago' && (
                                                        <div className="flex flex-col text-xs text-muted-foreground ml-2">
                                                            <span>(Pago: {formatCurrency(installment.paidAmount)})</span>
                                                            <span className="text-destructive font-medium">Restante: {formatCurrency(installment.amount - (installment.paidAmount || 0))}</span>
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className='text-right'>
                                                    <div className="flex justify-end gap-2">

                                                        {canReceivePayments && (
                                                            <Popover open={paymentPopoverOpen === installment.installmentNumber} onOpenChange={(open) => {
                                                                if (open) handleOpenPaymentPopover(installment);
                                                                else setPaymentPopoverOpen(null);
                                                            }}>
                                                                <PopoverTrigger asChild>
                                                                    <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700">
                                                                        <DollarSign className="h-4 w-4" />
                                                                        <span className="sr-only">Receber Pagamento</span>
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-80">
                                                                    <div className="grid gap-4">
                                                                        <div className="space-y-2">
                                                                            <h4 className="font-medium leading-none">Receber Pagamento</h4>
                                                                            <p className="text-sm text-muted-foreground">
                                                                                Parcela {installment.installmentNumber} de {order.installments}
                                                                            </p>
                                                                            <div className="text-xs">
                                                                                <span className="font-semibold">Valor da Parcela:</span> {formatCurrency(installment.amount)}<br />
                                                                                <span className="font-semibold">Já Pago:</span> {formatCurrency(installment.paidAmount || 0)}<br />
                                                                                <span className="font-semibold text-red-600">Restante:</span> {formatCurrency(installment.amount - (installment.paidAmount || 0))}
                                                                            </div>
                                                                        </div>
                                                                        <div className="grid gap-2">
                                                                            <div className="grid grid-cols-3 items-center gap-4">
                                                                                <label htmlFor="amount" className="text-right text-sm">Valor a Pagar</label>
                                                                                <Input
                                                                                    id="amount"
                                                                                    value={paymentAmountInput}
                                                                                    onChange={(e) => {
                                                                                        const rawValue = e.target.value.replace(/\D/g, '');
                                                                                        const value = (Number(rawValue) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                                                                                        setPaymentAmountInput(value);
                                                                                    }}
                                                                                    className="col-span-2 h-8"
                                                                                />
                                                                            </div>
                                                                            <div className="grid grid-cols-3 items-center gap-4">
                                                                                <label htmlFor="method" className="text-right text-sm">Método</label>
                                                                                <Select value={paymentMethodInput} onValueChange={(v) => setPaymentMethodInput(v as PaymentMethod)}>
                                                                                    <SelectTrigger className="col-span-2 h-8">
                                                                                        <SelectValue placeholder="Selecione" />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent>
                                                                                        <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                                                                                        <SelectItem value="Pix">Pix</SelectItem>
                                                                                        <SelectItem value="Cartão Crédito">Cartão Crédito</SelectItem>
                                                                                        <SelectItem value="Cartão Débito">Cartão Débito</SelectItem>
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            </div>
                                                                        </div>

                                                                        {/* History Section */}
                                                                        {installment.payments && installment.payments.length > 0 && (
                                                                            <div className="border-t pt-2 mt-2">
                                                                                <div className="flex items-center gap-1 mb-2 text-xs font-semibold text-muted-foreground">
                                                                                    <History className="h-3 w-3" /> Histórico de Pagamentos
                                                                                </div>
                                                                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                                                                    {installment.payments.map((p) => (
                                                                                        <div key={p.id} className="flex justify-between items-center text-xs bg-muted/50 p-1.5 rounded bg-slate-50 border">
                                                                                            <div className="flex flex-col">
                                                                                                <span className="font-bold">{formatCurrency(p.amount)}</span>
                                                                                                <span className="text-[10px] text-muted-foreground">{p.date ? format(parseISO(p.date), 'dd/MM/yy HH:mm') : '-'} - {p.method}</span>
                                                                                            </div>
                                                                                            <Button
                                                                                                variant="ghost"
                                                                                                size="icon"
                                                                                                className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                                                                                onClick={() => handleReversePayment(installment.installmentNumber, p.id)}
                                                                                                disabled={!canReversePayments || isSubmitting}
                                                                                            >
                                                                                                <Trash2 className="h-3 w-3" />
                                                                                            </Button>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        <Button onClick={() => handleConfirmPayment(installment.installmentNumber)} className="w-full h-8" disabled={!canReceivePayments || isSubmitting}>
                                                                            {isSubmitting ? 'Processando...' : 'Confirmar Recebimento'}
                                                                        </Button>
                                                                    </div>
                                                                </PopoverContent>
                                                            </Popover>
                                                        )}

                                                        <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700" onClick={() => handleSendWhatsApp(installment)}>
                                                            <MessageSquare className="h-4 w-4" />
                                                            <span className="sr-only">Enviar WhatsApp</span>
                                                        </Button>

                                                        {((installment.paidAmount || 0) > 0 || installment.status === 'Pago') && (
                                                            <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700" onClick={() => window.open(`/carnet/${order.id}/${installment.installmentNumber}`, '_blank')}>
                                                                <Printer className="h-4 w-4" />
                                                                <span className="sr-only">Imprimir Comprovante</span>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    {order.paymentMethod === 'Crediário' && isManagerOrAdmin && (
                        <Card>
                            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
                                <div className="flex items-center gap-4">
                                    <Zap className="w-8 h-8 text-violet-600" />
                                    <div>
                                        <CardTitle className="text-lg">Cobranças Asaas</CardTitle>
                                        <p className="text-xs text-muted-foreground mt-0.5">Gere cobranças por parcela via PIX/Boleto</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {asaasCharges.length > 0 && (
                                        <Button size="sm" variant="outline" onClick={handleSyncAsaasStatuses} disabled={isSyncingAsaas}>
                                            {isSyncingAsaas ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                            Sincronizar
                                        </Button>
                                    )}
                                    <Button size="sm" onClick={handleGenerateAsaasCharges} disabled={isGeneratingAsaas} className="bg-violet-600 hover:bg-violet-700 text-white">
                                        {isGeneratingAsaas ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                                        Gerar Cobranças
                                    </Button>
                                </div>
                            </CardHeader>
                            {asaasCharges.length > 0 && (
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Parcela</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Ações</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {asaasCharges.map((charge) => {
                                                const statusMap: Record<string, { label: string; color: string }> = {
                                                    PENDING: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
                                                    RECEIVED: { label: 'Pago', color: 'bg-green-100 text-green-800' },
                                                    CONFIRMED: { label: 'Confirmado', color: 'bg-green-100 text-green-800' },
                                                    OVERDUE: { label: 'Vencida', color: 'bg-red-100 text-red-800' },
                                                    REFUNDED: { label: 'Estornado', color: 'bg-gray-100 text-gray-800' },
                                                    CANCELLED: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800' },
                                                };
                                                const s = statusMap[charge.status] || { label: charge.status, color: 'bg-gray-100 text-gray-800' };
                                                const isCancellable = !['RECEIVED', 'CONFIRMED', 'REFUNDED', 'CANCELLED'].includes(charge.status);
                                                return (
                                                    <TableRow key={charge.installmentNumber}>
                                                        <TableCell className="font-medium">{charge.installmentNumber}ª Parcela</TableCell>
                                                        <TableCell>
                                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>
                                                                {s.label}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                {charge.invoiceUrl && (
                                                                    <Button size="sm" variant="outline" className="h-8 gap-1 text-violet-700 border-violet-200 hover:bg-violet-50" asChild>
                                                                        <a href={charge.invoiceUrl} target="_blank" rel="noopener noreferrer">
                                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                                            Fatura
                                                                        </a>
                                                                    </Button>
                                                                )}
                                                                {isCancellable && (
                                                                    <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-destructive border-destructive/20 hover:bg-destructive/10" onClick={() => handleCancelAsaasCharge(charge.installmentNumber)}>
                                                                        <X className="h-4 w-4" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            )}
                        </Card>
                    )}

                    <Card>
                        <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4">
                            <MessageSquare className="w-8 h-8 text-primary" />
                            <CardTitle className="text-lg">Observações do Pedido</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-2">
                                <Textarea
                                    placeholder="Nenhuma observação registrada. Adicione uma aqui..."
                                    value={observationsInput}
                                    onChange={(e) => setObservationsInput(e.target.value)}
                                    rows={2}
                                />
                                <Button size="sm" variant="outline" onClick={handleUpdateObservations} disabled={isObservationsUpdating} className="self-end">
                                    {isObservationsUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Collapsible>
                        <Card>
                            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
                                <div className="flex items-center gap-4">
                                    <Clock className="w-8 h-8 text-primary" />
                                    <CardTitle className="text-lg">Criação</CardTitle>
                                </div>
                                <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm" className="w-9 p-0">
                                        <Eye className="h-4 w-4" />
                                        <span className="sr-only">Toggle</span>
                                    </Button>
                                </CollapsibleTrigger>
                            </CardHeader>
                            <CollapsibleContent>
                                <CardContent className="text-sm space-y-1 pt-0">
                                    <div className="flex flex-col gap-1">
                                        <p><span className="font-semibold">Criado por:</span> {order.createdByName || 'Sistema'}</p>
                                        <p><span className="font-semibold">Origem:</span> {order.source === 'Online' ? '🌐 Catálogo Online' : '📝 Manual'}</p>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold">Data de Criação:</span>
                                            <Popover open={orderDatePopoverOpen} onOpenChange={(open) => canEditOrderDetails && setOrderDatePopoverOpen(open)}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className={cn("h-8 justify-start text-left font-normal", !canEditOrderDetails && "pointer-events-none opacity-70")}
                                                    >
                                                        {orderDateInput ? format(orderDateInput, 'dd/MM/yyyy') : 'Escolha uma data'}
                                                        {canEditOrderDetails && <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />}
                                                    </Button>
                                                </PopoverTrigger>
                                                {canEditOrderDetails && (
                                                    <PopoverContent className="w-auto p-0" align="start">
                                                        <Calendar
                                                            mode="single"
                                                            selected={orderDateInput}
                                                            onSelect={(d) => d && setOrderDateInput(d)}
                                                            defaultMonth={orderDateInput}
                                                            disabled={(d) => d > new Date() || d < new Date("1900-01-01")}
                                                            initialFocus
                                                        />
                                                    </PopoverContent>
                                                )}
                                            </Popover>
                                            {canEditOrderDetails && (
                                                <Button size="sm" variant="outline" className="h-8" onClick={handleUpdateOrderDate} disabled={!orderDateInput || isOrderDateUpdating}>
                                                    <Save className="mr-2 h-4 w-4" /> Salvar
                                                </Button>
                                            )}
                                        </div>
                                        <p><span className="font-semibold">Registrado em:</span> {format(safeParseDate(order.createdAt || order.date), "dd/MM/yyyy 'às' HH:mm")}</p>
                                        <p><span className="font-semibold">IP:</span> {order.createdIp || '-'}</p>
                                    </div>
                                </CardContent>
                            </CollapsibleContent>
                        </Card>
                    </Collapsible>
                </div>
                <DialogFooter className="pt-4 border-t">
                    {order.paymentMethod === 'Crediário' && (
                        <Button variant="secondary" asChild>
                            <Link href={`/carnet/${order.id}`} target="_blank" rel="noopener noreferrer">
                                <FileText className="mr-2 h-4 w-4" />
                                Ver Carnê Completo
                            </Link>
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog >
    );
}
