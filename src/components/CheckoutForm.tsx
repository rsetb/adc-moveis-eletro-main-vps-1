

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useCallback } from 'react';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import type { Order, CustomerInfo, PaymentMethod, Product } from '@/lib/types';
import { addMonths, format } from 'date-fns';
import { AlertTriangle, CreditCard, KeyRound, Trash2, ArrowLeft, User, CheckCircle2, Copy, Check, Loader2, ShoppingBag } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useData } from '@/context/DataContext';
import { Textarea } from './ui/textarea';
import Link from 'next/link';
import { maskCpf, maskPhone, onlyDigits } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { allocateNextCustomerCode } from '@/lib/customer-code';
import { findCustomerByCpfAction, createOrderAction, allocateNextCustomerCodeAction } from '@/app/actions/checkout';
import { createTemporaryOrderAction, confirmTemporaryOrderAction, cancelTemporaryOrderAction } from '@/app/actions/checkout-flow';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { WhatsAppIcon } from './WhatsAppIcon';
import PixQRCode from '@/components/PixQRCode';
import { generatePixPayload } from '@/lib/pix';

function isValidCPF(cpf: string) {
  const digits = onlyDigits(String(cpf));
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const rest = (count: number) => {
    let sum = 0;
    for (let index = 0; index < count; index++) {
      const num = Number(digits[index]);
      sum += num * (count + 1 - index);
    }
    return (sum * 10) % 11 % 10;
  };
  return rest(9) === Number(digits[9]) && rest(10) === Number(digits[10]);
}

const checkoutSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(3, 'Nome completo é obrigatório.'),
  cpf: z
    .string()
    .min(1, 'CPF é obrigatório.')
    .refine(isValidCPF, { message: 'CPF inválido.' }),
  phone: z.string().refine((val) => {
    const len = onlyDigits(val).length;
    return len >= 10 && len <= 11;
  }, 'O telefone principal (WhatsApp) é obrigatório.'),
  phone2: z.string().optional(),
  phone3: z.string().optional(),
  email: z.string().email('E-mail inválido.').optional().or(z.literal('')),
  zip: z.string().refine((value) => {
    const justDigits = value.replace(/\D/g, '');
    return justDigits.length === 8;
  }, 'CEP inválido. Deve conter 8 dígitos.'),
  address: z.string().min(3, 'Endereço é obrigatório.'),
  number: z.string().min(1, 'Número é obrigatório.'),
  complement: z.string().optional(),
  neighborhood: z.string().min(2, 'Bairro é obrigatório.'),
  city: z.string().min(2, 'Cidade é obrigatória.'),
  state: z.string().min(2, 'Estado é obrigatória.'),
  observations: z.string().optional(),
  paymentMethod: z.enum(['Crediário', 'Pix', 'Dinheiro', 'Cartão Crédito', 'Cartão Débito']),
  sellerId: z.string().optional(),
  sellerName: z.string().optional(),
});


const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const calculateCommission = (order: Order, allProducts: Product[]) => {
  if (order.isCommissionManual && typeof order.commission === 'number') {
    return order.commission;
  }

  if (!order.sellerId) {
    return 0;
  }

  const fallbackPercentage = 5;

  return order.items.reduce((totalCommission, item) => {
    const product = allProducts.find(p => p.id === item.id);
    const hasExplicitCommissionValue =
      product && typeof product.commissionValue === 'number' && !Number.isNaN(product.commissionValue);

    const commissionType = hasExplicitCommissionValue ? (product!.commissionType || 'percentage') : 'percentage';
    const commissionValue = hasExplicitCommissionValue ? product!.commissionValue! : fallbackPercentage;

    if (commissionType === 'fixed') {
      return totalCommission + (commissionValue * item.quantity);
    }

    if (commissionType === 'percentage') {
      const itemTotal = item.price * item.quantity;
      return totalCommission + (itemTotal * (commissionValue / 100));
    }

    return totalCommission;
  }, 0);
};

function sanitizeCustomerForFirestore(customer: CustomerInfo): Record<string, any> {
  const obj: Record<string, any> = {};
  Object.entries(customer).forEach(([key, value]) => {
    if (value !== undefined) obj[key] = value;
  });
  if (obj.password === undefined || obj.password === '') {
    delete obj.password;
  }
  return obj;
}

export default function CheckoutForm() {
  const { cartItems, getCartTotal, clearCart, lastOrder, setLastOrder, removeFromCart } = useCart();
  const { settings } = useSettings();
  const { products } = useData();
  const router = useRouter();
  const { toast } = useToast();
  const [isNewCustomer, setIsNewCustomer] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasOpenedWhatsApp, setHasOpenedWhatsApp] = useState(false);
  const [blockedCustomer, setBlockedCustomer] = useState<CustomerInfo | null>(null);

  /* Removed Client-Side Review State */
  const [tempOrderId, setTempOrderId] = useState<string | null>(null);
  
  const form = useForm<z.infer<typeof checkoutSchema>>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      code: '',
      name: '',
      cpf: '',
      phone: '',
      phone2: '',
      phone3: '',
      email: '',
      zip: '',
      address: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: 'Fortaleza',
      state: 'CE',
      observations: '',
      paymentMethod: 'Crediário',
    },
  });

  useEffect(() => {
    if (!isSuccess && cartItems.length === 0 && typeof window !== 'undefined') {
      router.push('/');
    }
  }, [cartItems, router, isSuccess]);

  const handleCpfChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const maskedValue = maskCpf(e.target.value);
    form.setValue('cpf', maskedValue);

    const cpfDigits = onlyDigits(maskedValue);
    if (cpfDigits.length === 11) {
      void (async () => {
        try {
          console.log('[CHECKOUT] Buscando cliente pelo CPF...', { maskedValue, cpfDigits });
          const result = await findCustomerByCpfAction(cpfDigits);

          console.log('[CHECKOUT] Resultado da busca de cliente', result);

          if (!result.success) throw new Error(result.error);

          if (result.data) {
            const customerData = result.data as CustomerInfo;

            if (result.source === 'active' && customerData.blocked) {
              setBlockedCustomer(customerData);
              form.setValue('cpf', '');
              return;
            }

            const sanitizedData = {
              name: customerData.name || '',
              cpf: customerData.cpf || maskedValue,
              phone: customerData.phone || '',
              phone2: customerData.phone2 || '',
              phone3: customerData.phone3 || '',
              email: customerData.email || '',
              zip: customerData.zip || '',
              address: customerData.address || '',
              number: customerData.number || '',
              complement: customerData.complement || '',
              neighborhood: customerData.neighborhood || '',
              city: customerData.city || 'Fortaleza',
              state: customerData.state || 'CE',
              code: customerData.code || '',
              sellerId: customerData.sellerId || undefined,
              sellerName: customerData.sellerName || undefined,
              paymentMethod: 'Crediário' as const,
              observations: form.getValues('observations') || '',
            };

            form.reset(sanitizedData);
            setIsNewCustomer(false);

            if (result.source === 'trash') {
              toast({ title: "Cliente Encontrado na Lixeira!", description: "Seus dados foram recuperados automaticamente." });
            } else {
              toast({ title: "Cliente Encontrado!", description: "Seus dados foram preenchidos automaticamente." });
            }
          } else {
            setIsNewCustomer(true);
            form.setValue('code', '');
            form.setValue('sellerId', undefined);
            form.setValue('sellerName', undefined);
          }
        } catch (error) {
          console.error("Error searching customer:", error);
          setIsNewCustomer(true);
          form.setValue('code', '');
        }
      })();
    }
  }, [form, toast]);


  const cartItemsWithDetails = useMemo(() => {
    return cartItems.map(item => {
      const productInfo = products.find(p => p.id === item.id);
      return {
        ...item,
        stock: productInfo?.stock ?? 0,
        hasEnoughStock: (productInfo?.stock ?? 0) >= item.quantity,
        maxInstallments: productInfo?.maxInstallments ?? 1,
      };
    });
  }, [cartItems, products]);

  const maxAllowedInstallments = useMemo(() => {
    if (cartItemsWithDetails.length === 0) return 1;
    const maxInstallmentsArray = cartItemsWithDetails.map(item => item.maxInstallments);
    return Math.min(...maxInstallmentsArray);
  }, [cartItemsWithDetails]);

  const isCartValid = cartItemsWithDetails.every(item => item.hasEnoughStock);

  // Debug logs
  useEffect(() => {
    if (!isCartValid && cartItems.length > 0) {
      console.warn("[CHECKOUT] Carrinho inválido (falta estoque):", cartItemsWithDetails.filter(i => !i.hasEnoughStock));
    }
  }, [isCartValid, cartItems.length, cartItemsWithDetails]);

  useEffect(() => {
    const errors = form.formState.errors;
    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0) {
      const errorSummary = errorKeys.map(key => ({
        campo: key,
        erro: (errors as any)[key]?.message
      }));
      console.warn("[CHECKOUT] ❌ BLOQUEIO DE VALIDAÇÃO DETECTADO:");
      // Imprime como tabela para fácil leitura
      console.table(errorSummary);
      // Imprime como string para garantir que saia no copy/paste
      console.warn("DETALHES DOS ERROS (Se a tabela não aparecer): " + JSON.stringify(errorSummary, null, 2));
    }
  }, [form.formState.errors]);

  const sellerName = form.watch('sellerName');
  const paymentMethod = form.watch('paymentMethod');

  const handleZipBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const zip = e.target.value.replace(/\D/g, '');

    if (zip.length !== 8) {
      return;
    }

    try {
      const response = await fetch(`https://viacep.com.br/ws/${zip}/json/`);
      if (!response.ok) {
        throw new Error('Falha ao buscar CEP.');
      }
      const data = await response.json();

      if (data.erro) {
        toast({
          title: "CEP não encontrado",
          description: "Por favor, verifique o CEP e tente novamente.",
          variant: "destructive",
        });
        return;
      }

      form.setValue('address', data.logradouro || '');
      form.setValue('neighborhood', data.bairro || '');
      form.setValue('city', data.localidade || '');
      form.setValue('state', data.uf || '');

      toast({
        title: "Endereço Encontrado!",
        description: "Seu endereço foi preenchido automaticamente.",
      });

    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      toast({
        title: "Erro de Rede",
        description: "Não foi possível buscar o CEP. Verifique sua conexão.",
        variant: "destructive",
      });
    }
  };


  const total = getCartTotal();

  const orderMaxInstallments = useMemo(() => {
    if (!lastOrder) return 1;
    const minMax = lastOrder.items.reduce((min, item) => {
      const product = products.find(p => p.id === item.id);
      const max = product?.maxInstallments ?? 1;
      return max < min ? max : min;
    }, 99);
    return minMax === 99 ? 1 : minMax;
  }, [lastOrder, products]);

  const getWhatsAppUrl = useCallback(() => {
    if (!lastOrder || !tempOrderId) return null;

    let storePhone = settings?.storePhone?.replace(/\D/g, '') || '5588999999999';
    if (storePhone && !storePhone.startsWith('55')) {
      storePhone = `55${storePhone}`;
    }
    const finalMaxInstallments = orderMaxInstallments;

    const customer = lastOrder.customer;
    
    const productsText = lastOrder.items.map(item => {
      const product = products.find(p => p.id === item.id);
      const maxInstallments = product?.maxInstallments ?? 1;
      const totalItem = item.price * item.quantity;
      const installmentValue = totalItem / maxInstallments;

      return `${item.name}
Valor: ${formatCurrency(item.price)}
Qtd: ${item.quantity} un
Subtotal: ${formatCurrency(totalItem)}
Parcelamento: Até ${maxInstallments}x de ${formatCurrency(installmentValue)}`;
    }).join('\n\n');

    const dueDateSource =
      (lastOrder as any)?.installmentDetails?.[0]?.dueDate ||
      (lastOrder as any)?.firstDueDate;
    const vencText = dueDateSource ? ` Venc ${format(new Date(dueDateSource), 'dd/MM')}` : '';

    const message = `NOVO PEDIDO ONLINE
Cód. Pedido (Temporário): ${tempOrderId}
Vendedor: ${lastOrder.sellerName || 'Não atribuído'}
 
PRODUTOS:
${productsText}
 
---------------------------
 
TOTAL DA COMPRA: ${formatCurrency(lastOrder.total)}
FORMA DE PAGAMENTO: ${lastOrder.paymentMethod}
CONDIÇÃO SUGERIDA: ${lastOrder.paymentMethod === 'Crediário' ? `Até ${finalMaxInstallments}x` : '-'}
 
---------------------------
DADOS DO CLIENTE:
Nome: ${customer.name}
Telefone: ${customer.phone}
CPF: ${customer.cpf}
Cód. Cliente: ${customer.code || 'Novo'}
 
ENDEREÇO DE ENTREGA:
CEP: ${customer.zip}
${customer.address}, Nº ${customer.number}
${customer.neighborhood} - ${customer.city}/${customer.state}
OBSERVAÇÃO: ${(lastOrder.observations || '').trim() || '-'}
 
Confirmação de Entrega: O pedido será enviado para o endereço acima.${vencText}`;
    
    return `https://wa.me/${storePhone}?text=${encodeURIComponent(message)}`;
  }, [lastOrder, tempOrderId, settings, orderMaxInstallments, products]);

  useEffect(() => {
    if (isSuccess && !hasOpenedWhatsApp && lastOrder && tempOrderId) {
      const url = getWhatsAppUrl();
      if (url) {
        window.open(url, '_blank');
        setHasOpenedWhatsApp(true);
      }
    }
  }, [isSuccess, hasOpenedWhatsApp, lastOrder, tempOrderId, getWhatsAppUrl]);

  if (isSuccess) {
    const pixPayload = lastOrder && lastOrder.paymentMethod === 'Pix' && settings?.pixKey 
      ? generatePixPayload(settings.pixKey, settings.storeName || 'Loja', settings.storeCity || 'Cidade', tempOrderId || 'PEDIDO', lastOrder.total)
      : null;

    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-6 animate-in fade-in duration-500">
        <div className="rounded-full bg-green-100 p-6 dark:bg-green-900/20">
          <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400" />
        </div>
        <div className="space-y-2 px-4">
          <h2 className="text-2xl font-bold tracking-tighter sm:text-4xl font-headline text-green-700 dark:text-green-400">
            Pedido Realizado com Sucesso!
          </h2>
          <p className="text-base text-muted-foreground max-w-[600px] mx-auto leading-relaxed">
            Recebemos sua solicitação. <br />
            {tempOrderId ? <span className="font-semibold text-foreground block mt-1">Pedido Temporário #{tempOrderId}</span> : ''}
            <span className="block mt-2 text-sm">
              Aguarde, um de nossos vendedores entrará em contato para confirmar o estoque e a entrega.
            </span>
          </p>
        </div>

        {/* Order Summary for Customer */}
        {lastOrder && (
          <div className="w-full max-w-md bg-card border shadow-sm rounded-xl overflow-hidden text-left mx-4">
            <div className="bg-muted/30 px-4 py-3 border-b">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" /> Resumo do Pedido
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <ul className="space-y-4">
                {lastOrder.items.map((item, index) => {
                  const product = products.find(p => p.id === item.id);
                  const maxInstallments = product?.maxInstallments ?? 1;
                  const itemTotal = item.price * item.quantity;
                  const installmentValue = itemTotal / maxInstallments;

                  return (
                    <li key={index} className="flex flex-col border-b border-dashed border-gray-100 pb-4 last:border-0 last:pb-0">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1">
                          <span className="font-medium text-base line-clamp-2 leading-tight">
                            <span className="text-muted-foreground text-sm font-normal mr-1">{item.quantity}x</span>
                            {item.name}
                          </span>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <span className="font-bold whitespace-nowrap text-base">{formatCurrency(itemTotal)}</span>
                          {maxInstallments > 1 && (
                            <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium whitespace-nowrap">
                              Até {maxInstallments}x de {formatCurrency(installmentValue)}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <Separator />
              <div className="flex justify-between items-end">
                <span className="text-sm font-medium text-muted-foreground">Total do Pedido</span>
                <span className="text-xl font-bold text-primary">{formatCurrency(lastOrder.total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Warning Message */}
        <div className="w-full max-w-md px-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm flex gap-3 text-left animate-in slide-in-from-bottom-2 duration-500 delay-300 shadow-sm">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <p className="leading-snug">
              <strong className="block mb-1 text-amber-900">Atenção Necessária</strong>
              É necessário enviar o pedido para o WhatsApp da loja para concluir a compra e confirmar o estoque.
            </p>
          </div>
        </div>

        {pixPayload && (
          <div className="flex flex-col items-center gap-4 p-6 border rounded-lg bg-muted/30 max-w-sm w-full animate-in zoom-in-95 duration-300">
             <h3 className="font-semibold text-lg font-headline">Pagamento via Pix</h3>
             <div className="bg-white p-2 rounded-lg">
                <PixQRCode payload={pixPayload} />
             </div>
             {settings?.pixKey && (
               <div className="w-full space-y-2">
                 <p className="text-sm text-muted-foreground text-left">Chave Pix:</p>
                 <div className="flex items-center gap-2 p-2 bg-background border rounded text-sm font-mono break-all">
                   <span className="flex-1 text-left line-clamp-1">{settings.pixKey}</span>
                   <Button
                     variant="ghost"
                     size="icon"
                     className="h-8 w-8 shrink-0 hover:bg-muted"
                     onClick={() => {
                        navigator.clipboard.writeText(settings.pixKey);
                        toast({ title: "Copiado!", description: "Chave Pix copiada para a área de transferência." });
                     }}
                   >
                     <Copy className="h-4 w-4" />
                   </Button>
                 </div>
               </div>
             )}
             <p className="text-xs text-muted-foreground">
               Após o pagamento, envie o comprovante pelo WhatsApp.
             </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 mt-8">
           <Button 
            size="lg" 
            className="bg-[#25D366] hover:bg-[#128C7E] text-white gap-2"
            onClick={() => {
              const url = getWhatsAppUrl();
              if (url) window.open(url, '_blank');
            }}
          >
            <WhatsAppIcon className="h-5 w-5" />
            Enviar Pedido para Vendedor
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/">Voltar para o Catálogo</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return null;
  }

  async function onSubmit(values: z.infer<typeof checkoutSchema>) {
    console.log("[CHECKOUT] Iniciando submissão do pedido...", values);
    const { sellerId: formSellerId, sellerName: formSellerName, paymentMethod: formPaymentMethod, ...customerValues } = values;

    // Resolve ID and Code (avoiding CPF as ID)
    const cpfDigits = onlyDigits(customerValues.cpf);
    let customerId = '';
    let customerCode = (customerValues.code || '').trim();

    // Check existing customer by CPF to reuse ID/Code
    const existingRes = await findCustomerByCpfAction(cpfDigits);
    if (existingRes.success && existingRes.data) {
        customerId = existingRes.data.id;
        if (!customerCode) customerCode = existingRes.data.code || '';
    }

    // Generate safe ID for new customer
    if (!customerId) {
        customerId = `CUST-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    }
    
    // Allocate code if still missing
    if (!customerCode) {
         const allocRes = await allocateNextCustomerCodeAction();
         if (allocRes.success && allocRes.code) customerCode = allocRes.code;
    }

    const customerData: CustomerInfo = {
      ...customerValues,
      id: customerId,
      code: customerCode,
    };

    if (customerData.cpf && isNewCustomer) {
      customerData.password = customerData.cpf.substring(0, 6);
    }

    const finalPaymentMethod = formPaymentMethod as PaymentMethod;
    const isCrediario = finalPaymentMethod === 'Crediário';
    const finalInstallments = isCrediario ? maxAllowedInstallments : 0;
    const orderDate = new Date();

    const prefix = cartItems.length > 0 ? 'PED' : 'REG';
    const orderId = `${prefix}-${Date.now().toString().slice(-6)}`;

    const installmentDetails = (() => {
      if (!isCrediario || finalInstallments <= 0) return [];
      const totalInCents = Math.round(total * 100);
      const baseInstallmentValueInCents = Math.floor(totalInCents / finalInstallments);
      let remainderInCents = totalInCents % finalInstallments;

      return Array.from({ length: finalInstallments }, (_, i) => {
        let installmentValueCents = baseInstallmentValueInCents;
        if (remainderInCents > 0) {
          installmentValueCents++;
          remainderInCents--;
        }

        return {
          id: `inst-${orderId}-${i + 1}`,
          installmentNumber: i + 1,
          amount: installmentValueCents / 100,
          dueDate: addMonths(orderDate, i + 1).toISOString(),
          status: 'Pendente' as const,
          paidAmount: 0,
          payments: [],
        };
      });
    })();

    const finalInstallmentValue = installmentDetails[0]?.amount || 0;

    const order: Partial<Order> & { firstDueDate: Date } = {
      customer: customerData,
      items: cartItems.map(({ ...item }) => item),
      total,
      installments: finalInstallments,
      installmentValue: finalInstallmentValue,
      date: orderDate.toISOString(),
      firstDueDate: addMonths(orderDate, 1),
      status: 'Processando',
      paymentMethod: finalPaymentMethod,
      installmentDetails,
      sellerId: formSellerId,
      sellerName: formSellerName,
      observations: values.observations,
      source: 'Online',
    };

    try {
      const cpfDigits = onlyDigits(customerData.cpf || '');
      let code = (customerData.code || '').trim();

      if (!code) {
        // Check existing code via action or allocate new
        const existingRes = await findCustomerByCpfAction(cpfDigits);
        if (existingRes.success && existingRes.data && existingRes.data.code) {
          code = existingRes.data.code;
        } else {
          const allocRes = await allocateNextCustomerCodeAction();
          if (allocRes.success && allocRes.code) code = allocRes.code;
        }
      }

      const orderToSave: Order = {
        ...(order as any),
        id: orderId,
        customer: {
          ...customerData,
          code,
        },
        sellerId: order.sellerId || '',
        sellerName: order.sellerName || 'Não atribuído',
        commissionPaid: false,
        createdByName: customerData.name || '',
        createdByRole: 'cliente',
        commission: 0,
      };

      orderToSave.commission = calculateCommission(orderToSave, products);

      // We pass the full customer data for upsert
      const payload: any = {
        id: orderToSave.id,
        date: orderToSave.date,
        customer: orderToSave.customer,
        items: orderToSave.items,
        total: orderToSave.total,
        subtotal: orderToSave.subtotal || orderToSave.total,
        discount: orderToSave.discount || 0,
        downPayment: orderToSave.downPayment || 0,
        paymentMethod: orderToSave.paymentMethod,
        installments: orderToSave.installments,
        installmentValue: orderToSave.installmentValue,
        installmentDetails: orderToSave.installmentDetails,
        firstDueDate: orderToSave.firstDueDate?.toISOString(),
        status: orderToSave.status,
        observations: orderToSave.observations,
        sellerId: orderToSave.sellerId,
        sellerName: orderToSave.sellerName,
        commission: orderToSave.commission,
        commissionPaid: orderToSave.commissionPaid,
        createdByName: orderToSave.createdByName,
        createdByRole: orderToSave.createdByRole,
        source: orderToSave.source,
      };

      // We pass the full customer data for upsert
      const customerPayload = {
        id: onlyDigits(customerData.cpf || ''),
        cpf: onlyDigits(customerData.cpf || ''),
        name: customerData.name,
        phone: customerData.phone,
        zip: customerData.zip,
        address: customerData.address,
        number: customerData.number,
        complement: customerData.complement,
        neighborhood: customerData.neighborhood,
        city: customerData.city,
        state: customerData.state,
        code: code,
        password: customerData.password || (isNewCustomer ? onlyDigits(customerData.cpf || '').substring(0, 6) : undefined)
      };

      // Create Temporary Order for Review
      const tempRes = await createTemporaryOrderAction({ orderData: payload, customerData: customerPayload });

      if (!tempRes.success) {
        throw new Error(tempRes.error || 'Erro ao criar pedido temporário.');
      }

      setTempOrderId(tempRes.id!);
      
      // Store last order for context (though not yet permanent)
      setLastOrder(orderToSave);

      // Show success message
      toast({
        title: "Solicitação Recebida!",
        description: `Seu pedido foi enviado para análise. Aguarde a confirmação do vendedor.`,
      });

      setIsSuccess(true);
      clearCart();
      // Redirect removed to keep the user on the "success" view
    } catch (error) {
      console.error("Failed to process order:", error);
      toast({
        title: "Erro ao Finalizar Pedido",
        description: error instanceof Error ? error.message : "Não foi possível completar o pedido.",
        variant: "destructive"
      });
    }
  }

  /* 
   * Review Dialog has been removed per user instruction. 
   * The confirmation flow is now strictly for Admins/Sellers.
   */

  return (
    <div className="grid md:grid-cols-2 gap-12">
      <div>
        <h3 className="text-xl font-semibold mb-4 font-headline">Resumo do Pedido</h3>
        <div className="space-y-4">
          {cartItemsWithDetails.map((item) => (
            <div key={item.id} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="flex items-start gap-3 flex-grow">
                <div className="relative h-16 w-16 sm:h-16 sm:w-16 rounded-md overflow-hidden flex-shrink-0">
                  <Image src={item.imageUrl || 'https://placehold.co/100x100.png'} alt={item.name} fill className="object-cover" />
                </div>
                <div className="flex-grow min-w-0">
                  <p className="font-semibold text-sm sm:text-base leading-tight">{item.name}</p>
                  <p className="text-sm text-muted-foreground">Qtd: {item.quantity}</p>
                  <p className="text-sm text-accent font-bold">(em até {item.maxInstallments}x)</p>
                  {!item.hasEnoughStock && (
                    <div className="flex items-center gap-1 text-xs text-destructive mt-1">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Estoque: {item.stock}. Ajuste a quantidade.</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-2 pl-[76px] sm:pl-0">
                <p className="font-semibold text-base">{formatCurrency(item.price * item.quantity)}</p>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeFromCart(item.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Separator />
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div>
            <h3 className="text-xl font-semibold mb-4 font-headline">Pagamento</h3>
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                  <span className="text-xl">💳</span>
                </div>
                <div>
                  <p className="font-semibold text-primary">Pagamento via Crediário</p>
                  <p className="text-sm text-muted-foreground">
                    1ª parcela com vencimento para: <strong>{format(addMonths(new Date(), 1), 'dd/MM/yyyy')}</strong>
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800">
              <span className="text-lg leading-none mt-0.5">⚠️</span>
              <p className="text-sm">
                <strong>Atenção:</strong> Na entrega do produto, você deverá pagar a entrada no valor de{' '}
                <strong>{formatCurrency(total / maxAllowedInstallments)}</strong>{' '}
                (equivalente ao valor de 1 parcela).
              </p>
            </div>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-4 font-headline">Informações do Cliente</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          placeholder="000.000.000-00"
                          {...field}
                          onChange={handleCpfChange}
                          inputMode="numeric"
                          maxLength={14}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código do Cliente</FormLabel>
                      <FormControl>
                        <Input placeholder="Gerado automaticamente" {...field} disabled />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome Completo <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                {sellerName && (
                  <div className="md:col-span-2">
                    <FormLabel>Vendedor Responsável</FormLabel>
                    <div className="flex items-center gap-2 h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{sellerName}</span>
                    </div>
                  </div>
                )}
                <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Telefone (WhatsApp) <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="(99) 99999-9999" {...field} onChange={e => field.onChange(maskPhone(e.target.value))} inputMode="tel" maxLength={15} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              {isNewCustomer && (
                <div className="p-3 bg-blue-500/10 text-blue-800 rounded-lg text-sm flex items-start gap-2">
                  <KeyRound className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <p><strong>Atenção:</strong> Se este for seu primeiro pedido, a senha de acesso para a Área do Cliente será os <strong>6 primeiros dígitos do seu CPF</strong>.</p>
                </div>
              )}
              <h4 className="text-lg font-semibold pt-4">Endereço de Entrega</h4>
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 rounded-lg text-sm flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-amber-600" />
                <p><strong>Atenção:</strong> O entregador não sobe escada.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <FormField control={form.control} name="zip" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>CEP <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="00000-000" {...field} onBlur={handleZipBlur} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="address" render={({ field }) => (<FormItem className="md:col-span-4"><FormLabel>Endereço <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="Rua, Av." {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="number" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Número <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="123" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="complement" render={({ field }) => (<FormItem className="md:col-span-4"><FormLabel>Complemento</FormLabel><FormControl><Input placeholder="Apto, bloco, casa, etc." {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="neighborhood" render={({ field }) => (<FormItem className="md:col-span-3"><FormLabel>Bairro <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="city" render={({ field }) => (<FormItem className="md:col-span-3"><FormLabel>Cidade <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="state" render={({ field }) => (<FormItem className="md:col-span-6"><FormLabel>Estado <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField
                control={form.control}
                name="observations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Ex: Deixar na portaria, ponto de referência..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800">
            <span className="text-lg leading-none mt-0.5">🚚</span>
            <p className="text-sm">
              <strong>Taxa de entrega:</strong> O valor da entrega pode variar conforme sua localização. Consulte o vendedor ao finalizar o pedido para confirmar a taxa da sua região.
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" size="lg" className="w-full sm:w-auto text-lg" disabled={!isCartValid || form.formState.isSubmitting}>
              Finalizar Compra
            </Button>
          </div>
        </form>
      </Form>

      <Dialog open={!!blockedCustomer} onOpenChange={(open) => !open && setBlockedCustomer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Entre em contato conosco
            </DialogTitle>
            <DialogDescription className="pt-2">
              Identificamos uma pendência em seu cadastro. Para prosseguir com sua compra, por favor, entre em contato com nosso atendimento pelo WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="sm:justify-start">
            <Button asChild className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white">
              <Link
                href={`https://wa.me/${settings?.storePhone?.replace(/\D/g, '') || ''}?text=Olá, estou tentando fazer um pedido (CPF: ${blockedCustomer?.cpf}) mas meu cadastro aparece como bloqueado. Poderia me ajudar?`}
                target="_blank"
              >
                <WhatsAppIcon className="mr-2 h-4 w-4" />
                Falar com Vendedor no WhatsApp
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
