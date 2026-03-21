

'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useRef, useState, useEffect } from 'react';
import type { Order, Installment, StoreSettings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Printer, Send, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from '@/hooks/use-toast';
import Logo from '@/components/Logo';
import { getSettingsAction } from '@/app/actions/settings';
import { getOrderForCarnetAction } from '@/app/actions/orders-fetcher';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

function ReceiptContent({ order, installment, settings, via }: { order: Order, installment: Installment, settings: StoreSettings, via: string }) {
    if (!order || !installment) return null;

    const customerName = order.customer.name;
    const document = order.customer.cpf || order.customer.code || 'N/A';

    return (
        <div className="bg-white p-6 text-sm">
            {/* Header */}
            <div className="pb-4 mb-4 border-b border-gray-200">
                <div className="flex justify-between items-start">
                    <div className="flex items-center">
                        <Logo />
                        <div className="w-4" />
                        <div>
                            <h2 className="font-bold text-lg">{settings.storeName}</h2>
                            <div className="text-xs space-y-0.5 text-gray-500">
                                <p className="whitespace-pre-line">{settings.storeAddress}</p>
                                {settings.storePhone && <p>Tel: {settings.storePhone}</p>}
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <h3 className="font-bold text-lg uppercase tracking-wide">Comprovante</h3>
                        <p className="text-xs text-gray-500 uppercase">Via: {via}</p>
                    </div>
                </div>
            </div>

            {/* Details */}
            <div className="space-y-3">
                <div className="grid grid-cols-[80px_1fr]">
                    <span className="font-bold">Cliente:</span>
                    <span>{customerName}</span>
                </div>
                <div className="grid grid-cols-[80px_1fr]">
                    <span className="font-bold">CPF/Cód:</span>
                    <span>{document}</span>
                </div>
                <div className="border-t border-dashed border-black my-2"></div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <span className="font-bold block">Pedido:</span>
                        <span>#{order.id.slice(0, 8)}</span>
                    </div>
                    <div className="text-right">
                        <span className="font-bold block">Data:</span>
                        <span>{order.createdAt ? format(new Date(order.createdAt), 'dd/MM/yyyy') : '-'}</span>
                    </div>
                </div>

                <div className="border-t border-dashed border-black my-2"></div>

                <div className="grid grid-cols-[100px_1fr] items-center">
                    <span className="font-bold">Parcela:</span>
                    <span className="text-lg">{installment.installmentNumber} / {order.installments}</span>
                </div>

                <div className="grid grid-cols-[100px_1fr] items-center">
                    <span className="font-bold">Vencimento:</span>
                    <span>{format(new Date(installment.dueDate), 'dd/MM/yyyy')}</span>
                </div>

                <div className="grid grid-cols-[100px_1fr] items-center">
                    <span className="font-bold">Valor:</span>
                    <span>{formatCurrency(installment.amount)}</span>
                </div>

                <div className="grid grid-cols-[100px_1fr] items-center">
                    <span className="font-bold">Situação:</span>
                    <span className="font-bold">{installment.status}</span>
                </div>

                {((installment.paidAmount || 0) > 0 || installment.status === 'Pago') && (
                    <>
                        <div className="grid grid-cols-[100px_1fr] items-center">
                            <span className="font-bold">Pago em:</span>
                            <span>{installment.paymentDate ? format(new Date(installment.paymentDate), 'dd/MM/yyyy') : '-'}</span>
                        </div>
                        <div className="grid grid-cols-[100px_1fr] items-center">
                            <span className="font-bold">Valor Pago:</span>
                            <span>{formatCurrency(installment.paidAmount || 0)}</span>
                        </div>
                    </>
                )}
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-black text-center text-xs">
                <p>Obrigado pela preferência!</p>
                <p>{format(new Date(), "dd/MM/yyyy HH:mm:ss")}</p>
            </div>
        </div>
    );
}

const initialSettings: StoreSettings = {
    storeName: '',
    storeCity: '',
    storeAddress: '',
    pixKey: '',
    storePhone: ''
};

export default function SingleInstallmentPage() {
    const params = useParams();
    const router = useRouter();
    const [settings, setSettings] = useState<StoreSettings>(initialSettings);
    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const receiptRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        const orderId = params.id as string;
        if (!orderId) {
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const [orderRes, settingsRes] = await Promise.all([
                    getOrderForCarnetAction(orderId),
                    getSettingsAction()
                ]);

                if (orderRes.success && orderRes.data) {
                    setOrder(orderRes.data as Order);
                }

                if (settingsRes.success && settingsRes.data) {
                    setSettings(settingsRes.data as StoreSettings);
                }
            } catch (error) {
                console.error("Error fetching data for installment:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [params.id]);


    const installment = useMemo(() => {
        if (!order || !params.installmentNumber) {
            return null;
        }
        const installmentNum = parseInt(params.installmentNumber as string, 10);
        if (isNaN(installmentNum)) {
            return null;
        }
        return order.installmentDetails?.find(i => i.installmentNumber === installmentNum) || null;
    }, [order, params.installmentNumber]);

    const remainingBalance = useMemo(() => {
        if (!installment) return 0;
        if (installment.status === 'Pago') return 0;
        const paid = Number(installment.paidAmount) || 0;
        const amount = Number(installment.amount) || 0;
        return Math.max(0, amount - paid);
    }, [installment]);


    const handleGeneratePdfAndSend = async () => {
        const input = receiptRef.current;
        if (!input || !order || !installment) return;

        // Temporarily apply a class to the body for print-specific styles
        document.body.classList.add('print-receipt');

        const canvas = await html2canvas(input, {
            scale: 2.5,
            useCORS: true,
            backgroundColor: '#ffffff'
        });

        // Remove the class after rendering
        document.body.classList.remove('print-receipt');

        const imgData = canvas.toDataURL('image/png');

        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;

        const ratio = canvasWidth / canvasHeight;
        let imgWidth = pdfWidth - 20; // with margins
        let imgHeight = imgWidth / ratio;

        if (imgHeight > pdfHeight - 20) {
            imgHeight = pdfHeight - 20;
            imgWidth = imgHeight * ratio;
        }

        const x = (pdfWidth - imgWidth) / 2;
        const y = (pdfHeight - imgHeight) / 2;

        pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
        pdf.save(`comprovante-${order.id}-${installment.installmentNumber}.pdf`);

        const customerName = String(order.customer.name || '').split(' ')[0];
        const phone = order.customer.phone.replace(/\D/g, '');
        const message = `Olá ${customerName}, segue o extrato atualizado da sua parcela nº ${installment.installmentNumber} (pedido ${order.id}).\n\nObrigado!\n*${settings.storeName}*`;

        const webUrl = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;
        window.open(webUrl, '_blank');

        toast({
            title: "Passo 1/2: PDF Gerado!",
            description: "Seu PDF foi baixado. Agora, anexe o arquivo na conversa do WhatsApp que abriu.",
            duration: 10000
        });
    };

    if (isLoading) {
        return <div className="p-8 text-center">Carregando parcela...</div>;
    }

    if (!order || !installment) {
        return (
            <div className="container mx-auto py-24 text-center">
                <h1 className="text-2xl font-bold">Parcela não encontrada</h1>
            </div>
        );
    }

    return (
        <div className="bg-muted/30 print:bg-white">
            <div className="container mx-auto py-8 print:p-0">
                <header className="flex flex-col sm:flex-row justify-between items-center mb-8 print-hidden gap-4">
                    <Button variant="ghost" onClick={() => router.push('/admin/pedidos')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar
                    </Button>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold">Extrato da Parcela</h1>
                        <p className="text-muted-foreground">Pedido: {order.id} / Parcela: {installment.installmentNumber}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleGeneratePdfAndSend} className="pdf-hidden">
                            <Send className="mr-2 h-4 w-4" />
                            Gerar PDF e Abrir WhatsApp
                        </Button>
                        <Button variant="outline" onClick={() => window.print()} className="pdf-hidden">
                            <Printer className="mr-2 h-4 w-4" />
                            Imprimir
                        </Button>
                    </div>
                </header>

                <main ref={receiptRef} className="bg-white p-6 print:grid print:grid-cols-2 print:gap-8 print:p-0">
                    <div className="print:border-r print:border-dashed print:border-black print:pr-4">
                        <ReceiptContent order={order} installment={installment} settings={settings} via="Empresa" />
                    </div>
                    <div className="hidden print:block print:pl-4">
                        <ReceiptContent order={order} installment={installment} settings={settings} via="Cliente" />
                    </div>
                </main>
            </div>
        </div>
    );
}
