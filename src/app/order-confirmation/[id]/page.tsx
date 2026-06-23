

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useCart } from '@/context/CartContext';
import { useSettings } from '@/context/SettingsContext';
import { useData } from '@/context/DataContext';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import type { Order } from '@/lib/types';
import { CheckCircle } from 'lucide-react';
import Image from 'next/image';
import { generatePixPayload } from '@/lib/pix';
import PixQRCode from '@/components/PixQRCode';
import { format } from 'date-fns';
import { getOrderByIdAction } from '@/app/actions/order';


const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

import { useToast } from '@/hooks/use-toast';

export default function OrderConfirmationPage() {
  const { lastOrder } = useCart();
  const { settings, isLoading: isSettingsLoading } = useSettings();
  const { products } = useData();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const autoWhatsapp = searchParams.get('autoWhatsapp');
  const [order, setOrder] = useState<Order | null>(null);
  const [isOrdersLoading, setIsLoading] = useState(true);
  const [asaasPixPayload, setAsaasPixPayload] = useState<string | null>(null);
  const [asaasError, setAsaasError] = useState<string | null>(null);
  const [redirectStatus, setRedirectStatus] = useState<string>('');

  useEffect(() => {
    const orderId = params.id as string;

    if (!orderId && lastOrder) {
      setOrder(lastOrder);
      setIsLoading(false);
      return;
    }

    if (!orderId) {
      router.push('/');
      return;
    }

    const fetchOrder = async () => {
      try {
        const result = await getOrderByIdAction(orderId);
        if (result.success && result.data) {
          setOrder(result.data);
        } else {
          console.error("Pedido não encontrado, redirecionando.");
          if (lastOrder) {
            setOrder(lastOrder);
          } else {
            router.push('/');
          }
        }
      } catch (error) {
        console.error("Erro ao buscar pedido:", error);
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [params.id, lastOrder, router]);

  useEffect(() => {
    if (!order) return;
    if (order.paymentMethod !== 'Pix') return;
    if (order.asaas?.pix?.payload) {
      setAsaasPixPayload(order.asaas.pix.payload || null);
      return;
    }

    let canceled = false;
    setAsaasError(null);

    fetch('/api/asaas/pix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.id,
        amount: order.total,
        customer: {
          name: order.customer.name,
          cpfCnpj: order.customer.cpf || '',
          email: order.customer.email || '',
          phone: order.customer.phone || '',
          zip: order.customer.zip || '',
          address: order.customer.address || '',
          number: order.customer.number || '',
          complement: order.customer.complement || '',
          neighborhood: order.customer.neighborhood || '',
          city: order.customer.city || '',
          state: order.customer.state || '',
        },
      }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = typeof data?.error === 'string' ? data.error : 'Falha ao gerar PIX no Asaas.';
          throw new Error(msg);
        }
        return data as any;
      })
      .then(async (data) => {
        const payload = String(data?.pix?.payload || '');
        if (!payload) throw new Error('PIX do Asaas retornou payload vazio.');
        if (canceled) return;
        setAsaasPixPayload(payload);
        const nextAsaas = {
          customerId: String(data?.asaasCustomerId || ''),
          paymentId: String(data?.asaasPaymentId || ''),
          status: data?.status ?? null,
          pix: {
            payload,
            encodedImage: data?.pix?.encodedImage ?? null,
            expirationDate: data?.pix?.encodedImage ?? null,
          },
          updatedAt: new Date().toISOString(),
        };
        setOrder((prev) => (prev ? { ...prev, asaas: nextAsaas } : prev));
      })
      .catch((e) => {
        if (canceled) return;
        setAsaasError(e instanceof Error ? e.message : 'Falha ao gerar PIX no Asaas.');
      });

    return () => {
      canceled = true;
    };
  }, [order]);

  const whatsappUrl = useMemo(() => {
    if (!order || !settings.storePhone) return '';

    const storePhone = settings.storePhone.replace(/\D/g, '');

    // Reconstruct cart items with details for maxInstallments
    const orderItemsWithDetails = order.items.map(item => {
      const productInfo = products.find(p => p.id === item.id);
      return {
        ...item,
        maxInstallments: productInfo?.maxInstallments ?? 1,
      };
    });

    const maxAllowedInstallments = orderItemsWithDetails.length > 0
      ? Math.min(...orderItemsWithDetails.map(item => item.maxInstallments))
      : 1;

    const productsSummary = orderItemsWithDetails.map(item => {
      const totalItem = item.price * item.quantity;
      const installmentValue = totalItem / (item.maxInstallments || 1);
      return `${item.name}\nValor: ${formatCurrency(item.price)}\nQtd: ${item.quantity} un\nSubtotal: ${formatCurrency(totalItem)}\nParcelamento: Até ${item.maxInstallments}x de ${formatCurrency(installmentValue)}`;
    }).join('\n\n');

    const dueDateSource =
      (order as any)?.installmentDetails?.[0]?.dueDate ||
      (order as any)?.firstDueDate;
    const vencText = dueDateSource ? ` Venc ${format(new Date(dueDateSource), 'dd/MM')}` : '';

    const message = `NOVO PEDIDO ONLINE
Cód. Pedido: ${order.id}
Vendedor: ${order.sellerName || 'Não atribuído'}
 
PRODUTOS:
${productsSummary}
 
---------------------------
 
TOTAL DA COMPRA: ${formatCurrency(order.total)}
FORMA DE PAGAMENTO: ${order.paymentMethod}
CONDIÇÃO SUGERIDA: ${order.paymentMethod === 'Crediário' ? `Até ${maxAllowedInstallments}x` : '-'}
 
---------------------------
DADOS DO CLIENTE:
Nome: ${order.customer.name}
Telefone: ${order.customer.phone}
CPF: ${order.customer.cpf || '-'}
Cód. Cliente: ${order.customer.code || '-'}
 
ENDEREÇO DE ENTREGA:
CEP: ${order.customer.zip}
${order.customer.address}, Nº ${order.customer.number}
${order.customer.neighborhood} - ${order.customer.city}/${order.customer.state}
OBSERVAÇÃO: ${(order.observations || '').trim() || '-'}
 
Confirmação de Entrega: O pedido será enviado para o endereço acima.${vencText}`;
    return `https://wa.me/55${storePhone}?text=${encodeURIComponent(message)}`;
  }, [order, settings.storePhone, products]);

  useEffect(() => {
    // Wait for everything to load
    if (!order || !autoWhatsapp || isSettingsLoading) return;

    // Small delay to ensure UI is visible before redirecting (optional but good for UX)
    const timer = setTimeout(() => {
      if (whatsappUrl) {
        setRedirectStatus("Abrindo WhatsApp em nova guia...");
        toast({
          title: "Abrindo WhatsApp...",
          description: "Se não abrir, clique no botão abaixo.",
          duration: 5000,
        });
        window.open(whatsappUrl, '_blank');
      } else {
        setRedirectStatus("Falha: WhatsApp da loja não configurado.");
        toast({
          title: "WhatsApp indisponível",
          description: "O telefone da loja não foi configurado. Vá em Configurações.",
          variant: "destructive",
        });
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [order, autoWhatsapp, whatsappUrl, isSettingsLoading, toast]);

  const pixPayload = useMemo(() => {
    if (!order) return null;
    if (order.paymentMethod !== 'Pix' && order.paymentMethod !== 'Crediário') return null;

    if (order.paymentMethod === 'Pix') {
      if (asaasPixPayload) return asaasPixPayload;
      if (settings.pixKey) {
        const { pixKey, storeName, storeCity } = settings;
        return generatePixPayload(pixKey, storeName, storeCity, order.id, order.total);
      }
      return null;
    }

    if (!settings.pixKey) return null;

    const { pixKey, storeName, storeCity } = settings;

    let amount = order.total;
    let txid = order.id;

    // Generate PIX for the first installment of the "Crediário"
    if (order.installmentDetails && order.installmentDetails.length > 0) {
      amount = order.installmentDetails[0].amount;
      txid = `${order.id}-${order.installmentDetails[0].installmentNumber}`;
    }

    return generatePixPayload(pixKey, storeName, storeCity, txid, amount);
  }, [order, settings, asaasPixPayload]);

  if (isOrdersLoading || !order) {
    return (
      <div className="container mx-auto py-24 text-center">
        <p className="text-lg">Carregando detalhes do pedido...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4">
      <Card className="max-w-4xl mx-auto shadow-lg">
        <CardHeader className="text-center bg-primary/5 rounded-t-lg p-8">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
          <CardTitle className="text-3xl font-headline text-primary">Pedido Realizado com Sucesso!</CardTitle>
          <CardDescription className="text-lg">
            Obrigado pela sua compra, {String(order.customer.name || '').split(' ')[0]}!
          </CardDescription>
          {redirectStatus && (
            <p className={`font-bold mt-2 ${redirectStatus.includes('Falha') ? 'text-red-500' : 'text-blue-600 animate-pulse'}`}>
              {redirectStatus}
            </p>
          )}
          <p className="font-semibold text-muted-foreground">Número do Pedido: <Badge variant="secondary">{order.id}</Badge></p>
          {order.customer.code && (
            <p className="font-semibold text-muted-foreground">
              Seu Código de Cliente: <Badge variant="secondary">{order.customer.code.replace(/^CLI-/i, '')}</Badge>
            </p>
          )}
          {settings.storePhone && (
            <div className="mt-6 flex justify-center">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="bg-green-600 hover:bg-green-700 text-white font-bold py-6 px-8 text-lg rounded-xl shadow-md transition-all hover:scale-105 flex items-center gap-2">
                  <span className="text-2xl">📱</span> Enviar Pedido no WhatsApp
                </Button>
              </a>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-6 md:p-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-lg mb-4">Resumo do Pedido</h3>
              <div className="space-y-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative h-12 w-12 rounded-md overflow-hidden bg-muted">
                        <Image src={item.imageUrl || 'https://placehold.co/100x100.png'} alt={item.name} fill className="object-cover" />
                      </div>
                      <p>{item.name} <span className="text-muted-foreground">x{item.quantity}</span></p>
                    </div>
                    <p>{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-4">Detalhes do Pagamento</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total do Pedido:</span>
                  <span className="font-semibold">{formatCurrency(order.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Forma de Pagamento:</span>
                  <span className="font-semibold">{order.paymentMethod}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parcelas:</span>
                  <span className="font-semibold text-accent">
                    {order.paymentMethod === 'Crediário'
                      ? `${order.installments}x de ${formatCurrency(order.installmentValue)}`
                      : 'À vista'}
                  </span>
                </div>
                {order.paymentMethod === 'Crediário' && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Próximo Vencimento:</span>
                    <span className="font-semibold">
                      {order.installmentDetails && order.installmentDetails.length > 0
                        ? format(new Date(order.installmentDetails[0].dueDate), 'dd/MM/yyyy')
                        : '-'}
                    </span>
                  </div>
                )}
              </div>
              {asaasError && order.paymentMethod === 'Pix' && (
                <p className="mt-4 text-xs text-destructive">{asaasError}</p>
              )}
              {pixPayload && (
                <div className="mt-6">
                  <p className="font-semibold mb-2 text-primary">
                    {order.paymentMethod === 'Crediário' ? 'Pague a 1ª parcela com PIX' : 'Pague com PIX'}
                  </p>
                  <PixQRCode payload={pixPayload} />
                  {order.paymentMethod === 'Crediário' && settings.pixKey && (
                    <p className="mt-4 text-lg text-muted-foreground font-bold text-center">
                      Chave PIX:{' '}
                      <span className="font-mono break-all text-primary text-xl select-all">{settings.pixKey}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <Separator className="my-8" />
          <div>
            <h3 className="font-semibold text-lg mb-4">Informações de Entrega</h3>
            <div className="text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">{order.customer.name}</p>
              {order.customer.code && <p>Código do Cliente: {order.customer.code.replace(/^CLI-/i, '')}</p>}
              <p>{`${order.customer.address}, ${order.customer.number}`}</p>
              <p>{`${order.customer.neighborhood}, ${order.customer.city}, ${order.customer.state} - ${order.customer.zip}`}</p>
              <p>Email: {order.customer.email}</p>
              <p>Telefone: {order.customer.phone}</p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="text-center p-6 bg-muted/50 rounded-b-lg">
          <Link href="/" className="w-full">
            <Button className="w-full md:w-auto">Voltar para a Página Inicial</Button>
          </Link>
        </CardFooter>
      </Card>
    </div >
  );
}
