'use client';

import React, { createContext, useContext, ReactNode, useCallback, useState, useEffect, useMemo, useRef } from 'react';
import type { Order, Product, Installment, CustomerInfo, Category, User, CommissionPayment, Payment, StockAudit, Avaria, ChatSession } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useData } from './DataContext';
import { addMonths, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from './AuthContext';
import { normalizeCpf } from '@/lib/customer-trash';
import { formatCustomerCode, reserveCustomerCodes } from '@/lib/customer-code';
import { toIsoNoon } from '@/lib/utils';

// Server Actions
import { getAdminOrdersAction, updateOrderStatusAction, moveOrderToTrashAction, permanentlyDeleteOrderAction, recordInstallmentPaymentAction, updateOrderDetailsAction, updateInstallmentDueDateAction, updateInstallmentAmountAction, reverseInstallmentPaymentAction } from '@/app/actions/admin/orders';
import { addProductAction, updateProductAction, deleteProductAction } from '@/app/actions/admin/products';
import { saveStockAuditAction, getStockAuditsAction, addAvariaAction, updateAvariaAction, deleteAvariaAction, getAvariasAction } from '@/app/actions/admin/inventory';
import { createOrderAction } from '@/app/actions/checkout';
import { getProductsAction } from '@/app/actions/data';
import { resetOrdersAction, resetProductsAction, resetFinancialsAction, resetAllAdminDataAction, importProductsAction, importCustomersAction, emptyTrashAction, restoreProductAction, permanentlyDeleteProductWithIdAction, fetchDeletedProductsAction } from '@/app/actions/admin/system';
import { addCustomerAction, getCustomersAction, getDeletedCustomersAction, updateCustomerAction, deleteCustomerAction, restoreCustomerFromTrashAction, permanentlyDeleteCustomerFromTrashAction, permanentlyDeleteCustomerAction, generateCustomerCodesAction } from '@/app/actions/admin/customers';
import { payCommissionAction, reverseCommissionPaymentAction, getCommissionPaymentsAction } from '@/app/actions/admin/financials';
import { addCategoryAction, deleteCategoryAction, updateCategoryNameAction, addSubcategoryAction, updateSubcategoryAction, deleteSubcategoryAction } from '@/app/actions/admin/categories';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';

type LogAction = (action: string, details: string, user: User | null) => void;

interface AdminContextType {
  addOrder: (order: Partial<Order> & { firstDueDate: Date }, logAction: LogAction, user: User | null) => Promise<Order | null>;
  addCustomer: (customerData: CustomerInfo, logAction: LogAction, user: User | null) => Promise<void>;
  generateCustomerCodes: (logAction: LogAction, user: User | null) => Promise<{ newCustomers: number; updatedOrders: number }>;
  deleteOrder: (orderId: string, logAction: LogAction, user: User | null) => Promise<void>;
  permanentlyDeleteOrder: (orderId: string, logAction: LogAction, user: User | null) => Promise<void>;
  updateOrderStatus: (orderId: string, status: Order['status'], logAction: LogAction, user: User | null) => Promise<void>;
  recordInstallmentPayment: (orderId: string, installmentNumber: number, payment: Omit<Payment, 'receivedBy'>, logAction: LogAction, user: User | null) => Promise<void>;
  reversePayment: (orderId: string, installmentNumber: number, paymentId: string, logAction: LogAction, user: User | null) => Promise<void>;
  updateInstallmentDueDate: (orderId: string, installmentNumber: number, newDueDate: Date, logAction: LogAction, user: User | null) => Promise<void>;
  updateInstallmentAmount: (orderId: string, installmentNumber: number, newAmount: number, logAction: LogAction, user: User | null) => Promise<void>;
  updateCustomer: (oldCustomer: CustomerInfo, updatedCustomerData: CustomerInfo, logAction: LogAction, user: User | null) => Promise<void>;
  deleteCustomer: (customer: CustomerInfo, logAction: LogAction, user: User | null) => Promise<void>;
  restoreCustomerFromTrash: (customer: CustomerInfo, logAction: LogAction, user: User | null) => Promise<void>;
  permanentlyDeleteCustomerFromTrash: (customer: CustomerInfo, logAction: LogAction, user: User | null) => Promise<void>;
  permanentlyDeleteCustomer: (customerId: string, logAction: LogAction, user: User | null) => Promise<void>;
  importCustomers: (csvData: string, logAction: LogAction, user: User | null) => Promise<void>;
  updateOrderDetails: (orderId: string, details: Partial<Order> & { downPayment?: number, resetDownPayment?: boolean }, logAction: LogAction, user: User | null) => Promise<void>;
  addProduct: (productData: Omit<Product, 'id' | 'data-ai-hint' | 'createdAt'>, logAction: LogAction, user: User | null) => Promise<void>;
  updateProduct: (product: Product, logAction: LogAction, user: User | null) => Promise<void>;
  deleteProduct: (productId: string, logAction: LogAction, user: User | null) => Promise<void>;
  importProducts: (productsToImport: Product[], logAction: LogAction, user: User | null) => Promise<void>;
  addCategory: (categoryName: string, logAction: LogAction, user: User | null) => Promise<void>;
  deleteCategory: (categoryId: string, logAction: LogAction, user: User | null) => Promise<void>;
  updateCategoryName: (categoryId: string, newName: string, logAction: LogAction, user: User | null) => Promise<void>;
  addSubcategory: (categoryId: string, subcategoryName: string, logAction: LogAction, user: User | null) => Promise<void>;
  updateSubcategory: (categoryId: string, oldSub: string, newSub: string, logAction: LogAction, user: User | null) => Promise<void>;
  deleteSubcategory: (categoryId: string, subcategoryName: string, logAction: LogAction, user: User | null) => Promise<void>;
  moveCategory: (categoryId: string, direction: 'up' | 'down', logAction: LogAction, user: User | null) => Promise<void>;
  reorderSubcategories: (categoryId: string, draggedSub: string, targetSub: string, logAction: LogAction, user: User | null) => Promise<void>;
  moveSubcategory: (sourceCategoryId: string, subName: string, targetCategoryId: string, logAction: LogAction, user: User | null) => Promise<void>;
  payCommissions: (sellerId: string, sellerName: string, amount: number, orderIds: string[], period: string, logAction: LogAction, user: User | null) => Promise<string | null>;
  reverseCommissionPayment: (paymentId: string, logAction: LogAction, user: User | null) => Promise<void>;
  restoreAdminData: (data: any, logAction: LogAction, user: User | null) => Promise<void>;
  resetOrders: (logAction: LogAction, user: User | null) => Promise<void>;
  resetProducts: (logAction: LogAction, user: User | null) => Promise<void>;
  resetFinancials: (logAction: LogAction, user: User | null) => Promise<void>;
  resetAllAdminData: (logAction: LogAction, user: User | null) => Promise<void>;
  saveStockAudit: (audit: StockAudit, logAction: LogAction, user: User | null) => Promise<void>;
  addAvaria: (avaria: any, logAction: LogAction, user: User | null) => Promise<void>;
  updateAvaria: (id: string, data: any, logAction: LogAction, user: User | null) => Promise<void>;
  deleteAvaria: (id: string, logAction: LogAction, user: User | null) => Promise<void>;
  emptyTrash: (logAction: LogAction, user: User | null) => Promise<void>;
  restoreProduct: (product: Product, logAction: LogAction, user: User | null) => Promise<void>;
  permanentlyDeleteProduct: (productId: string, logAction: LogAction, user: User | null) => Promise<void>;
  fetchDeletedProducts: () => Promise<Product[]>;
  loadMoreOrders: () => Promise<void>;
  loadAllOrders: () => Promise<void>;
  refreshOrders: () => Promise<void>;
  orders: Order[];
  totalOrders: number;
  ordersLimit: number;
  commissionPayments: CommissionPayment[];
  stockAudits: StockAudit[];
  avarias: Avaria[];
  chatSessions: ChatSession[];
  customers: CustomerInfo[];
  deletedCustomers: CustomerInfo[];
  customerOrders: { [key: string]: Order[] };
  customerFinancials: { [key: string]: { totalComprado: number, totalPago: number, saldoDevedor: number } };
  financialSummary: { totalVendido: number, totalRecebido: number, totalPendente: number, lucroBruto: number, monthlyData: { name: string, total: number }[] };
  commissionSummary: { totalPendingCommission: number, commissionsBySeller: { id: string; name: string; total: number; count: number; orderIds: string[] }[] };
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

// Helper for installment calculation
function recalculateInstallments(total: number, installmentsCount: number, orderId: string, firstDueDate: string): Installment[] {
  if (installmentsCount <= 0 || total < 0) return [];
  const totalInCents = Math.round(total * 100);
  const baseInstallmentValueInCents = Math.floor(totalInCents / installmentsCount);
  let remainderInCents = totalInCents % installmentsCount;
  const newInstallmentDetails: Installment[] = [];
  for (let i = 0; i < installmentsCount; i++) {
    let installmentValueCents = baseInstallmentValueInCents;
    if (remainderInCents > 0) {
      installmentValueCents++;
      remainderInCents--;
    }
    newInstallmentDetails.push({
      id: `inst-${orderId}-${i + 1}`,
      installmentNumber: i + 1,
      amount: installmentValueCents / 100,
      dueDate: addMonths(new Date(firstDueDate), i).toISOString(),
      status: 'Pendente',
      paidAmount: 0,
      payments: [],
    });
  }
  return newInstallmentDetails;
}

export const AdminProvider = ({ children }: { children: ReactNode }) => {
  const { products: productsData, categories, updateProductLocally, addProductLocally, deleteProductLocally, refreshData } = useData();
  const { toast } = useToast();
  const { user, users } = useAuth();

  // Use local state for orders, etc.
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalOrders, setTotalOrders] = useState<number>(0);
  const [ordersLimit, setOrdersLimit] = useState<number>(1000);
  const [customers, setCustomers] = useState<CustomerInfo[]>([]);
  const [commissionPayments, setCommissionPayments] = useState<CommissionPayment[]>([]);
  const [stockAudits, setStockAudits] = useState<StockAudit[]>([]);
  const [avarias, setAvarias] = useState<Avaria[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [deletedCustomers, setDeletedCustomers] = useState<CustomerInfo[]>([]);

  const lastUpdateRef = useRef<number>(0);

  // Polling Function
  const fetchData = useCallback(async () => {
    // Skip polling if a user action occurred recently (winthin 15s) to prevent stale data override
    if (Date.now() - lastUpdateRef.current < 15000) return;

    try {
      // 1) Carrega pedidos primeiro para aparecerem o mais rápido possível
      const ordersResult = await getAdminOrdersAction(ordersLimit);
      
      // Verificação dupla: se o usuário realizou uma ação enquanto o pedido estava sendo carregado,
      // ignoramos este resultado para evitar sobrescrever o estado otimista/local com dados antigos (stale).
      if (Date.now() - lastUpdateRef.current < 15000) {
        console.log('[AdminContext] Polling result ignored due to recent user action.');
        return;
      }

      if (ordersResult.success && ordersResult.data) {
        // Handle new return structure { orders, total }
        if ('orders' in ordersResult.data) {
           setOrders(ordersResult.data.orders);
           setTotalOrders(ordersResult.data.total);
        } else {
           // Fallback for safety
           setOrders(ordersResult.data as unknown as Order[]);
        }
      }

      // 2) Em paralelo, busca o restante sem travar a lista de pedidos
      const results = await Promise.allSettled([
        getCustomersAction(),
        getDeletedCustomersAction(),
        getCommissionPaymentsAction(),
        getStockAuditsAction(),
        getAvariasAction()
      ]);

      if (results[0].status === 'fulfilled' && results[0].value.success && results[0].value.data) {
        setCustomers(results[0].value.data);
      }
      if (results[1].status === 'fulfilled' && results[1].value.success && results[1].value.data) {
        setDeletedCustomers(results[1].value.data);
      }
      if (results[2].status === 'fulfilled' && results[2].value.success && results[2].value.data) {
        setCommissionPayments(results[2].value.data);
      }
      if (results[3].status === 'fulfilled' && results[3].value.success && results[3].value.data) {
        setStockAudits(results[3].value.data);
      }
      if (results[4].status === 'fulfilled' && results[4].value.success && results[4].value.data) {
        setAvarias(results[4].value.data);
      }
    } catch (error) {
      console.error('[AdminContext] Polling error:', error);
    }
  }, [ordersLimit]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // 15s polling to reduce server load
    return () => clearInterval(interval);
  }, [fetchData]);

  useRealtimeUpdates((changed) => {
    if (changed.includes('orders') || changed.includes('customers') || changed.includes('products')) {
      lastUpdateRef.current = 0;
      fetchData();
    }
  });

  // Set up event listener for forced updates
  useEffect(() => {
    const handleOrderUpdated = () => {
      console.log("[AdminContext] Order update event received, refreshing data...");
      lastUpdateRef.current = 0;
      fetchData();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('order-updated', handleOrderUpdated);
      return () => window.removeEventListener('order-updated', handleOrderUpdated);
    }
  }, [fetchData]);

  const loadMoreOrders = async () => {
      setOrdersLimit(prev => prev + 1000);
      // fetchData will be called by useEffect when ordersLimit changes
  };

  const loadAllOrders = async () => {
      setOrdersLimit(100000); // Load virtually all
  };

  const refreshOrders = async () => {
      lastUpdateRef.current = 0; // Force update ignoring debounce
      await fetchData();
  };

  const addOrder = async (order: Partial<Order> & { firstDueDate: Date }, logAction: LogAction, user: User | null): Promise<Order | null> => {
    lastUpdateRef.current = Date.now(); // Pause polling on new order creation attempt
    lastUpdateRef.current = Date.now(); // Pause polling on new order creation attempt (and success)
    const orderId = `PED-${Date.now().toString().slice(-6)}`;
    const subtotal = order.items?.reduce((acc, item) => acc + item.price * item.quantity, 0) || 0;
    const total = subtotal - (order.discount || 0);
    const totalFinanced = total - (order.downPayment || 0);

    let installmentDetails: Installment[] = [];
    let installmentValue = 0;

    if ((order.installments || 0) > 0 && order.firstDueDate) {
      const firstDueDateStr = toIsoNoon(order.firstDueDate);
      installmentDetails = recalculateInstallments(totalFinanced, order.installments!, orderId, firstDueDateStr);
      installmentValue = installmentDetails[0]?.amount || 0;
    }

    const orderData: Order = {
      ...order,
      id: orderId,
      total,
      subtotal,
      installmentDetails,
      installmentValue,
      status: 'Processando',
      createdAt: new Date().toISOString(),
      date: new Date().toISOString(), // Ensure current date is set for immediate display
      items: order.items || [],
      customer: order.customer!,
      sellerId: order.sellerId || user?.id || '',
      sellerName: order.sellerName || user?.name || '',
      createdByName: order.createdByName || user?.name || undefined,
      createdByRole: order.createdByRole || user?.role || undefined,
    } as Order;

    const res = await createOrderAction(orderData, order.customer);
    if (!res.success) {
      throw new Error((res as any).error || 'Failed to create order');
    }

    logAction('Criação de Pedido', `Pedido ${orderId} criado.`, user);
    setOrders(prev => [orderData, ...prev]);
    setTotalOrders(prev => prev + 1); // Update total count immediately
    return orderData;
  };

  const deleteOrder = async (orderId: string, logAction: LogAction, user: User | null) => {
    lastUpdateRef.current = Date.now();
    const res = await moveOrderToTrashAction(orderId, user);
    if (res.success) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'Excluído' } : o));
      logAction('Exclusão de Pedido', `Pedido ${orderId} movido para lixeira.`, user);
      toast({ title: 'Pedido na Lixeira', description: `O pedido #${orderId} foi movido para a lixeira.` });
    } else {
      toast({ title: 'Erro ao excluir', description: (res as any).error || 'Erro desconhecido', variant: 'destructive' });
    }
  };

  const permanentlyDeleteOrder = async (orderId: string, logAction: LogAction, user: User | null) => {
    lastUpdateRef.current = Date.now();
    const res = await permanentlyDeleteOrderAction(orderId, user);
    if (res.success) {
      setOrders(prev => prev.filter(o => o.id !== orderId));
      logAction('Exclusão Permanente', `Pedido ${orderId} excluído.`, user);
      toast({ title: 'Pedido Excluído', description: `O pedido #${orderId} foi removido permanentemente.` });
    } else {
      toast({ title: 'Erro ao excluir permanentemente', description: (res as any).error || 'Erro desconhecido', variant: 'destructive' });
    }
  };

  const updateOrderStatus = async (orderId: string, status: Order['status'], logAction: LogAction, user: User | null) => {
    lastUpdateRef.current = Date.now();

    console.log('[AdminContext.updateOrderStatus] Local update', { orderId, status });

    const originalStatus = orders.find(o => o.id === orderId)?.status;
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));

    const res = await updateOrderStatusAction(orderId, status, user);

    console.log('[AdminContext.updateOrderStatus] Server response', { success: res.success, error: (res as any).error });

    if (res.success) {
      logAction('Status Atualizado', `Pedido ${orderId} alterado para ${status}.`, user);

      if ((res as any).data) {
        const serverOrder = (res as any).data as unknown as Order;
        console.log('[AdminContext.updateOrderStatus] Applying server data status:', serverOrder.status);
        setOrders(prev => prev.map(o => o.id === orderId ? serverOrder : o));
      } else {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      }
    } else {
      if (originalStatus) setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: originalStatus } : o));
      toast({ title: "Erro", description: (res as any).error || 'Erro desconhecido', variant: 'destructive' });
    }
  };

  const recordInstallmentPayment = async (orderId: string, installmentNumber: number, payment: Omit<Payment, 'receivedBy'>, logAction: LogAction, user: User | null) => {
    const res = await recordInstallmentPaymentAction(orderId, installmentNumber, payment, user);
    if (res.success) {
      lastUpdateRef.current = Date.now(); // Update timestamp to pause polling
      logAction('Pagamento de Parcela', `Pagamento de R$ ${payment.amount} registrado na parcela ${installmentNumber} do pedido ${orderId}.`, user);

      // Update local state immediately
      setOrders(prev => prev.map(o => {
        if (o.id === orderId) {
          const updatedInstallments = o.installmentDetails?.map(inst => {
            if (inst.installmentNumber === installmentNumber) {
              const currentPaid = inst.paidAmount || 0;
              const newPaid = currentPaid + payment.amount;
              // Check if paid enough (allowing for small float differences)
              const isPaid = newPaid >= (inst.amount - 0.01);

              return {
                ...inst,
                paidAmount: newPaid,
                status: (isPaid ? 'Pago' : 'Parcial') as Installment['status'],
                payments: [...(inst.payments || []), { ...payment, receivedBy: user?.name }]
              };
            }
            return inst;
          });
          return { ...o, installmentDetails: updatedInstallments };
        }
        return o;
      }));
    } else {
      toast({ title: "Erro ao registrar pagamento", description: (res as any).error || 'Erro desconhecido', variant: 'destructive' });
    }
  };

  const addProduct = async (productData: Omit<Product, 'id' | 'data-ai-hint' | 'createdAt'>, logAction: LogAction, user: User | null) => {
    const res = await addProductAction(productData, user);
    if (!res.success) {
      throw new Error((res as any).error || 'Erro ao salvar produto.');
    }

    const created = (res as any).data as Product | undefined;
    if (created) {
      addProductLocally(created);
    }
    logAction('Produto Criado', `Produto ${productData.name} criado.`, user);
    lastUpdateRef.current = Date.now();
    toast({ title: 'Produto salvo', description: `Produto ${productData.name} cadastrado.` });
  };

  const updateProduct = async (product: Product, logAction: LogAction, user: User | null) => {
    const res = await updateProductAction(product, user);
    if (!res.success) {
      throw new Error((res as any).error || 'Erro ao atualizar produto.');
    }

    logAction('Produto Atualizado', `Produto ${product.name} atualizado.`, user);
    lastUpdateRef.current = Date.now();
    updateProductLocally(product);
    toast({ title: 'Produto atualizado', description: `Produto ${product.name} salvo.` });
  };

  const deleteProduct = async (productId: string, logAction: LogAction, user: User | null) => {
    const res = await deleteProductAction(productId, user);
    if (!res.success) {
      throw new Error((res as any).error || 'Erro ao remover produto.');
    }

    logAction('Produto Removido', `Produto ${productId} removido.`, user);
    lastUpdateRef.current = Date.now();
    deleteProductLocally(productId);
    toast({ title: 'Produto removido', description: `Produto ${productId} removido.` });
  };

  const addCustomer = async (customerData: CustomerInfo, logAction: LogAction, user: User | null) => {
    lastUpdateRef.current = Date.now();
    
    // Optimistic Add
    const tempId = customerData.id || `temp-${Date.now()}`;
    const optimisticCustomer = { ...customerData, id: tempId, code: customerData.code || '...' };
    
    setCustomers(prev => {
      const updated = [...prev, optimisticCustomer];
      return updated.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    });

    const res = await addCustomerAction(customerData, user);
    
    if (res.success) {
      logAction('Cliente Adicionado', `Cliente ${customerData.name} adicionado.`, user);
      
      // Replace optimistic with real data
      const newCustomer = res.data || { ...customerData, code: 'PENDING' };
      
      setCustomers(prev => {
        const filtered = prev.filter(c => c.id !== tempId);
        const updated = [...filtered, newCustomer];
        return updated.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      });
      
      toast({ title: 'Cliente adicionado', description: `Cliente ${customerData.name} cadastrado. Código: ${newCustomer.code}` });
    } else {
      // Revert on error
      setCustomers(prev => prev.filter(c => c.id !== tempId));
      toast({ title: "Erro", description: (res as any).error || 'Erro desconhecido', variant: 'destructive' });
    }
  };

  // Partial implementations for complex logic
  const generateCustomerCodes = async (logAction: LogAction, user: User | null) => {
    const res = await generateCustomerCodesAction(user);
    if (res.success) {
      logAction('Códigos Gerados', `Gerados códigos para ${res.count || 0} clientes.`, user);
      return { newCustomers: res.count || 0, updatedOrders: 0 };
    }
    return { newCustomers: 0, updatedOrders: 0 };
  };
  const reversePayment = async (orderId: string, installmentNumber: number, paymentId: string, logAction: LogAction, user: User | null) => {
    const res = await reverseInstallmentPaymentAction(orderId, installmentNumber, paymentId, user);
    if (res.success) {
      lastUpdateRef.current = Date.now(); // Update timestamp to pause polling
      logAction('Estorno de Pagamento', `Pagamento estornado na parcela ${installmentNumber} do pedido ${orderId}.`, user);

      // Update local state immediately
      setOrders(prev => prev.map(o => {
        if (o.id === orderId) {
          const updatedInstallments = o.installmentDetails?.map(inst => {
            if (inst.installmentNumber === installmentNumber) {
              const paymentToRemove = inst.payments.find(p => p.id === paymentId);
              if (!paymentToRemove) return inst;

              const currentPaid = inst.paidAmount || 0;
              const newPaid = Math.max(0, currentPaid - paymentToRemove.amount);
              // Determine new status
              let newStatus: Installment['status'] = 'Pendente';
              if (newPaid >= (inst.amount - 0.01)) {
                newStatus = 'Pago';
              } else if (newPaid > 0) {
                newStatus = 'Parcial';
              }

              const updatedPayments = inst.payments.filter(p => p.id !== paymentId);

              return {
                ...inst,
                paidAmount: newPaid,
                status: newStatus,
                payments: updatedPayments
              };
            }
            return inst;
          });
          return { ...o, installmentDetails: updatedInstallments };
        }
        return o;
      }));
      toast({ title: "Pagamento Estornado", description: "O pagamento foi removido com sucesso." });
    } else {
      toast({ title: "Erro ao estornar", description: (res as any).error || 'Erro desconhecido', variant: 'destructive' });
    }
  };
  const updateInstallmentDueDate = async (orderId: string, installmentNumber: number, newDueDate: Date, logAction: LogAction, user: User | null) => {
    lastUpdateRef.current = Date.now(); // Update timestamp to pause polling

    // Local update to reflect change immediately (Optimistic Update)
    const updateOrderList = (prev: Order[]) => prev.map(o => {
      if (o.id === orderId) {
        const updatedInstallments = o.installmentDetails?.map(inst =>
          inst.installmentNumber === installmentNumber ? { ...inst, dueDate: toIsoNoon(newDueDate) } : inst
        );
        return { ...o, installmentDetails: updatedInstallments };
      }
      return o;
    });

    setOrders(updateOrderList);

    const res = await updateInstallmentDueDateAction(orderId, installmentNumber, newDueDate.toISOString(), user);
    if (res.success) {
      logAction('Vencimento de Parcela Atualizado', `Vencimento da parcela ${installmentNumber} do pedido ${orderId} alterado.`, user);
    } else {
      toast({ title: "Erro", description: (res as any).error || 'Erro desconhecido', variant: 'destructive' });
      // Refresh to revert state correctly from server
      fetchData();
    }
  };

  const updateInstallmentAmount = async (orderId: string, installmentNumber: number, newAmount: number, logAction: LogAction, user: User | null) => {
    const res = await updateInstallmentAmountAction(orderId, installmentNumber, newAmount, user);
    if (res.success) {
      lastUpdateRef.current = Date.now(); // Update timestamp to pause polling
      logAction('Valor de Parcela Atualizado', `Valor da parcela ${installmentNumber} do pedido ${orderId} alterado para R$ ${newAmount}.`, user);
      setOrders(prev => prev.map(o => {
        if (o.id === orderId) {
          const updatedInstallments = o.installmentDetails?.map(inst =>
            inst.installmentNumber === installmentNumber ? { ...inst, amount: newAmount } : inst
          );
          return { ...o, installmentDetails: updatedInstallments };
        }
        return o;
      }));
    } else {
      toast({ title: "Erro", description: (res as any).error || 'Erro desconhecido', variant: 'destructive' });
    }
  };
  const updateCustomer = async (oldCustomer: CustomerInfo, updatedCustomerData: CustomerInfo, logAction: LogAction, user: User | null) => {
    lastUpdateRef.current = Date.now();
    
    // Optimistic Update
    setCustomers(prev => prev.map(c => c.id === updatedCustomerData.id ? updatedCustomerData : c));

    const res = await updateCustomerAction(updatedCustomerData, user);
    
    if (res.success) {
      logAction('Cliente Atualizado', `Cliente ${updatedCustomerData.name} atualizado.`, user);
      toast({ title: 'Cliente atualizado', description: `Os dados de ${updatedCustomerData.name} foram salvos.` });
    } else {
      // Revert on error
      setCustomers(prev => prev.map(c => c.id === oldCustomer.id ? oldCustomer : c));
      toast({ title: "Erro", description: (res as any).error || 'Erro desconhecido', variant: 'destructive' });
    }
  };

  const deleteCustomer = async (customer: CustomerInfo, logAction: LogAction, user: User | null) => {
    lastUpdateRef.current = Date.now();
    
    // Optimistic Update
    setCustomers(prev => prev.filter(c => c.id !== customer.id));
    setDeletedCustomers(prev => {
      const cpfDigits = String(customer.cpf || '').replace(/\D/g, '');
      const next = cpfDigits ? { ...customer, cpf: cpfDigits } : customer;
      // Filter out if already exists to avoid dupes
      const filtered = prev.filter(c => c.id !== customer.id);
      return [next, ...filtered];
    });

    const res = await deleteCustomerAction(customer.id, user);
    if (res.success) {
      logAction('Cliente Excluído', `Cliente ${customer.name} movido para lixeira.`, user);
      toast({ title: 'Cliente na Lixeira', description: `O cliente ${customer.name} foi movido para a lixeira.` });
    } else {
      // Revert on error
      setCustomers(prev => [...prev, customer]);
      setDeletedCustomers(prev => prev.filter(c => c.id !== customer.id));
      toast({ title: "Erro", description: (res as any).error || 'Erro desconhecido', variant: 'destructive' });
    }
  };

  const restoreCustomerFromTrash = async (customer: CustomerInfo, logAction: LogAction, user: User | null) => {
    lastUpdateRef.current = Date.now();

    // Optimistic Update
    const cpfDigits = String(customer.cpf || '').replace(/\D/g, '');
    setDeletedCustomers(prev => prev.filter(c => String(c.cpf || '').replace(/\D/g, '') !== cpfDigits));
    setCustomers(prev => [customer, ...prev.filter(c => String(c.cpf || '').replace(/\D/g, '') !== cpfDigits)]);

    const res = await restoreCustomerFromTrashAction(customer, user);
    if (res.success) {
      const restored = (res as any).data ? ((res as any).data as CustomerInfo) : customer;
      // Update with server data if available
      setCustomers(prev => prev.map(c => c.id === customer.id ? restored : c));
      
      logAction('Cliente Restaurado', `Cliente ${customer.name} restaurado da lixeira.`, user);
      toast({ title: 'Cliente Restaurado', description: `O cliente ${restored.name} voltou para a lista.` });
    } else {
      // Revert on error
      setDeletedCustomers(prev => [...prev, customer]);
      setCustomers(prev => prev.filter(c => c.id !== customer.id));
      toast({ title: "Erro", description: (res as any).error || 'Erro desconhecido', variant: 'destructive' });
    }
  };

  const permanentlyDeleteCustomerFromTrash = async (customer: CustomerInfo, logAction: LogAction, user: User | null) => {
    lastUpdateRef.current = Date.now();

    // Optimistic Update
    const cpfDigits = String(customer.cpf || '').replace(/\D/g, '');
    setDeletedCustomers(prev => prev.filter(c => String(c.cpf || '').replace(/\D/g, '') !== cpfDigits));

    const res = await permanentlyDeleteCustomerFromTrashAction(customer, user);
    if (res.success) {
      logAction('Cliente Excluído Permanentemente', `Cliente ${customer.name} removido da lixeira.`, user);
      toast({ title: 'Cliente Excluído', description: `O cliente ${customer.name} foi removido da lixeira.` });
    } else {
      // Revert on error
      setDeletedCustomers(prev => [...prev, customer]);
      toast({ title: "Erro", description: (res as any).error || 'Erro desconhecido', variant: 'destructive' });
    }
  };

  const permanentlyDeleteCustomer = async (customerId: string, logAction: LogAction, user: User | null) => {
    lastUpdateRef.current = Date.now();
    
    // Find customer for potential revert
    const customerToDelete = customers.find(c => c.id === customerId) || deletedCustomers.find(c => c.id === customerId);

    // Optimistic Update
    setCustomers(prev => prev.filter(c => c.id !== customerId));
    setDeletedCustomers(prev => prev.filter(c => c.id !== customerId));

    const res = await permanentlyDeleteCustomerAction(customerId, user);
    if (res.success) {
      logAction('Cliente Excluído Permanentemente', `Cliente ${customerId} excluído permanentemente.`, user);
      toast({ title: 'Cliente Excluído Permanentemente', description: `O cadastro do cliente foi removido do sistema.` });
    } else {
      // Revert on error if we have the data
      if (customerToDelete) {
         setCustomers(prev => [...prev, customerToDelete]);
      }
      toast({ title: "Erro", description: (res as any).error || 'Erro desconhecido', variant: 'destructive' });
      // Force refresh to be sure
      refreshOrders();
    }
  };
  const importCustomers = async (csvData: string, logAction: LogAction, user: User | null) => {
    // Assuming csvData is actually JSON string based on usual usage in this app or we parse CSV here.
    // The signature says csvData key but usage in page might be JSON. 
    // Let's assume the user passes parsed object or JSON string. 
    try {
      const parsed = JSON.parse(csvData);
      const list = Array.isArray(parsed) ? parsed : [];
      if (list.length > 0) {
        await importCustomersAction(list, user);
        logAction('Importação de Clientes', `${list.length} clientes importados.`, user);
      }
    } catch (e) {
      console.error("Invalid Import Data", e);
    }
  };
  const updateOrderDetails = async (orderId: string, details: Partial<Order> & { downPayment?: number, resetDownPayment?: boolean }, logAction: LogAction, user: User | null) => {
    lastUpdateRef.current = Date.now();

    const currentOrder = orders.find(o => o.id === orderId);
    if (!currentOrder) return;

    console.log('[updateOrderDetails] Start', {
      orderId,
      details,
      currentDiscount: currentOrder.discount,
      currentDownPayment: currentOrder.downPayment,
      currentTotal: currentOrder.total
    });

    const { resetDownPayment, ...orderDetails } = details;

    const updatePayload: Record<string, any> = { ...orderDetails };

    if (resetDownPayment) {
      updatePayload.downPayment = 0;
    }

    const projectedOrder = { ...currentOrder, ...updatePayload };

    const shouldRecalcTotals = orderDetails.items !== undefined || orderDetails.discount !== undefined;
    const projectedItems = Array.isArray(projectedOrder.items) ? projectedOrder.items : [];

    const computedSubtotal = projectedItems.reduce((acc: number, item: any) => {
      const price = Number(item?.price || 0);
      const quantity = Number(item?.quantity || 0);
      return acc + (price * quantity);
    }, 0);

    const subtotal = shouldRecalcTotals
      ? computedSubtotal
      : (typeof projectedOrder.subtotal === 'number'
        ? projectedOrder.subtotal
        : computedSubtotal);

    const totalBase = shouldRecalcTotals
      ? (subtotal - (Number(projectedOrder.discount || 0)))
      : (typeof projectedOrder.total === 'number'
        ? projectedOrder.total
        : (subtotal - (Number(projectedOrder.discount || 0))));

    const downPaymentValue = Number(projectedOrder.downPayment || 0);
    const totalFinanced = totalBase - downPaymentValue;

    console.log('[updateOrderDetails] Calculated values', {
      subtotal,
      discount: projectedOrder.discount,
      downPayment: projectedOrder.downPayment,
      newTotal: totalBase,
      totalFinanced
    });

    if (shouldRecalcTotals) {
      updatePayload.total = totalBase;
      updatePayload.subtotal = subtotal;
    }

    if (resetDownPayment || orderDetails.downPayment !== undefined) {
      updatePayload.downPayment = downPaymentValue;
    }

    const needsRecalculation =
      orderDetails.installments !== undefined ||
      orderDetails.discount !== undefined ||
      orderDetails.downPayment !== undefined ||
      resetDownPayment ||
      (orderDetails.paymentMethod === 'Crediário' && currentOrder.paymentMethod !== 'Crediário');

    if (needsRecalculation && projectedOrder.paymentMethod === 'Crediário') {
      const firstDueDate = projectedOrder.installmentDetails?.[0]?.dueDate || addMonths(new Date(), 1).toISOString();

      const newInstallmentDetails = recalculateInstallments(
        totalFinanced,
        projectedOrder.installments || 1,
        orderId,
        firstDueDate
      );
      updatePayload.installmentDetails = newInstallmentDetails;
      updatePayload.installmentValue = newInstallmentDetails[0]?.amount || 0;
      updatePayload.installments = projectedOrder.installments || 1;
    } else if (projectedOrder.paymentMethod !== 'Crediário' && orderDetails.paymentMethod !== undefined) {
      updatePayload.installmentDetails = [];
      updatePayload.installmentValue = 0;
      updatePayload.installments = 0;
    }

    console.log('[updateOrderDetails] Sending payload to server', updatePayload);

    const res = await import('@/app/actions/admin/orders').then(mod => mod.updateOrderDetailsAction(orderId, updatePayload, user));

    if (res.success) {
      if ((res as any).data) {
        console.log('[updateOrderDetails] Server returned order with totals', {
          discount: ((res as any).data as Order).discount,
          downPayment: ((res as any).data as Order).downPayment,
          total: ((res as any).data as Order).total
        });
        setOrders(prev => prev.map(o => o.id === orderId ? ((res as any).data as Order) : o));
      } else {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updatePayload } : o));
      }
      logAction('Atualização de Pedido', `Detalhes do pedido ${orderId} atualizados.`, user);
    } else {
      console.error('[updateOrderDetails] Server action failed:', (res as any).error);
      toast({ title: "Erro ao atualizar", description: (res as any).error || "Falha ao salvar no banco de dados", variant: "destructive" });
    }
  };

  const importProducts = async (productsToImport: Product[], logAction: LogAction, user: User | null) => {
    const res = await importProductsAction(productsToImport, user);
    if (res.success) {
      logAction('Importação de Produtos', `${productsToImport.length} produtos importados.`, user);
      // Refresh handled by polling
    }
  };
  const addCategory = async (categoryName: string, logAction: LogAction, user: User | null) => {
    const res = await addCategoryAction(categoryName, user);
    if (res.success) {
      logAction('Categoria Criada', `Categoria ${categoryName} criada.`, user);
      refreshData();
    }
  };
  const deleteCategory = async (categoryId: string, logAction: LogAction, user: User | null) => {
    const res = await deleteCategoryAction(categoryId, user);
    if (res.success) {
      logAction('Categoria Removida', `Categoria removida.`, user);
      refreshData();
    }
  };
  const updateCategoryName = async (categoryId: string, newName: string, logAction: LogAction, user: User | null) => {
    const res = await updateCategoryNameAction(categoryId, newName, user);
    if (res.success) {
      logAction('Categoria Atualizada', `Categoria atualizada para ${newName}.`, user);
      refreshData();
    }
  };
  const addSubcategory = async (categoryId: string, subcategoryName: string, logAction: LogAction, user: User | null) => {
    const res = await addSubcategoryAction(categoryId, subcategoryName, user);
    if (res.success) {
      logAction('Subcategoria Criada', `Subcategoria ${subcategoryName} criada.`, user);
      refreshData();
    }
  };
  const updateSubcategory = async (categoryId: string, oldSub: string, newSub: string, logAction: LogAction, user: User | null) => {
    const res = await updateSubcategoryAction(categoryId, oldSub, newSub, user);
    if (res.success) {
      logAction('Subcategoria Atualizada', `Subcategoria ${oldSub} -> ${newSub}.`, user);
      refreshData();
    }
  };
  const deleteSubcategory = async (categoryId: string, subcategoryName: string, logAction: LogAction, user: User | null) => {
    const res = await deleteSubcategoryAction(categoryId, subcategoryName, user);
    if (res.success) {
      logAction('Subcategoria Removida', `Subcategoria ${subcategoryName} removida.`, user);
      refreshData();
    }
  };
  const moveCategory = async () => { };
  const reorderSubcategories = async () => { };
  const moveSubcategory = async () => { };
  const payCommissions = async (sellerId: string, sellerName: string, amount: number, orderIds: string[], period: string, logAction: LogAction, user: User | null) => {
    lastUpdateRef.current = Date.now();
    const res = await payCommissionAction(sellerId, sellerName, amount, orderIds, period, user);
    if (res.success) {
      logAction('Pagamento de Comissão', `Pagamento de R$ ${amount.toFixed(2)} para ${sellerName}.`, user);
      
      // Real-time update
      const newPayment = (res as any).data;
      if (newPayment) {
        setCommissionPayments(prev => [newPayment, ...prev]);
        setOrders(prev => prev.map(o => orderIds.includes(o.id) ? { ...o, commissionPaid: true } : o));
      }
      
      return res.data;
    }
    return null;
  };
  const reverseCommissionPayment = async (paymentId: string, logAction: LogAction, user: User | null) => {
    lastUpdateRef.current = Date.now();
    const res = await reverseCommissionPaymentAction(paymentId, user);
    if (res.success) {
      logAction('Estorno de Comissão', `Pagamento ${paymentId} estornado.`, user);
      
      // Real-time update
      const paymentToReverse = commissionPayments.find(p => p.id === paymentId);
      if (paymentToReverse) {
        const orderIds = paymentToReverse.orderIds || [];
        setCommissionPayments(prev => prev.filter(p => p.id !== paymentId));
        setOrders(prev => prev.map(o => orderIds.includes(o.id) ? { ...o, commissionPaid: false } : o));
      }
      
      toast({ title: "Sucesso", description: "Estorno realizado com sucesso." });
    } else {
      toast({ title: "Erro", description: (res as any).error || "Erro ao estornar pagamento.", variant: "destructive" });
    }
  };
  const saveStockAudit = async (audit: StockAudit, logAction: LogAction, user: User | null) => {
    const res = await saveStockAuditAction(audit, user);
    if (res.success) {
      logAction('Auditoria Salva', `Auditoria de estoque salva.`, user);
      setStockAudits(prev => [...prev.filter(a => a.id !== audit.id), audit]);
    }
  };
  const addAvaria = async (avaria: any, logAction: LogAction, user: User | null) => {
    const res = await addAvariaAction(avaria, user);
    if (res.success) {
      logAction('Avaria Adicionada', `Avaria adicionada.`, user);
      setAvarias(prev => [...prev, avaria]);
    }
  };
  const updateAvaria = async (id: string, data: any, logAction: LogAction, user: User | null) => {
    const res = await updateAvariaAction(id, data, user);
    if (res.success) {
      logAction('Avaria Atualizada', `Avaria atualizada.`, user);
      setAvarias(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));
    }
  };
  const deleteAvaria = async (id: string, logAction: LogAction, user: User | null) => {
    lastUpdateRef.current = Date.now();
    const res = await deleteAvariaAction(id, user);
    if (res.success) {
      logAction('Avaria Excluída', `Avaria excluída.`, user);
      setAvarias(prev => prev.filter(a => a.id !== id));
      toast({ title: 'Avaria excluída', description: 'O registro de avaria foi removido.' });
    }
  };
  const emptyTrash = async (logAction: LogAction, user: User | null) => {
    lastUpdateRef.current = Date.now();
    const res = await emptyTrashAction(user);
    if ((res as any)?.success === false) {
      toast({ title: 'Erro', description: (res as any).error || 'Erro ao esvaziar lixeira', variant: 'destructive' });
      return;
    }
    logAction('Lixeira Esvaziada', 'Lixeira de produtos e pedidos esvaziada.', user);
    setOrders(prev => prev.filter(o => o.status !== 'Excluído'));
    toast({ title: 'Lixeira Esvaziada', description: 'Todos os itens excluídos foram removidos permanentemente.' });
  };
  const restoreProduct = async (product: Product, logAction: LogAction, user: User | null) => {
    const res = await restoreProductAction(product.id, user);
    if (!(res as any)?.success) { toast({ title: 'Erro ao restaurar produto', variant: 'destructive' }); return; }
    logAction('Produto Restaurado', `Produto ${product.name} restaurado.`, user);
    updateProductLocally({ ...product, deletedAt: undefined });
  };
  const permanentlyDeleteProduct = async (productId: string, logAction: LogAction, user: User | null) => {
    const res = await permanentlyDeleteProductWithIdAction(productId, user);
    if (!(res as any)?.success) { toast({ title: 'Erro ao excluir produto', variant: 'destructive' }); return; }
    logAction('Produto Excluído Permanentemente', `Produto ${productId} apagado.`, user);
    deleteProductLocally(productId);
  };
  const fetchDeletedProducts = async () => {
    const res = await fetchDeletedProductsAction();
    return res.success && res.data ? res.data : [];
  };

  const restoreAdminData = async () => { }; // Deprecated or specific backup restore logic
  const resetOrders = async (logAction: LogAction, user: User | null) => {
    await resetOrdersAction(user);
    logAction('Reset de Pedidos', 'Todos os pedidos foram apagados.', user);
    setOrders([]);
  };
  const resetProducts = async (logAction: LogAction, user: User | null) => {
    await resetProductsAction(user);
    logAction('Reset de Produtos', 'Todos os produtos foram apagados.', user);
  };
  const resetFinancials = async (logAction: LogAction, user: User | null) => {
    await resetFinancialsAction(user);
    logAction('Reset Financeiro', 'Dados financeiros resetados.', user);
  };
  const resetAllAdminData = async (logAction: LogAction, user: User | null) => {
    await resetAllAdminDataAction(user);
    logAction('Reset Geral', 'Todos os dados do sistema foram apagados.', user);
    setOrders([]);
    setCustomers([]);
  };

  // Computed
  const customersForUI = useMemo(() => customers, [customers]);
  const customerOrders = useMemo(() => {
    const map: Record<string, Order[]> = {};

    for (const order of orders) {
      const customer: any = (order as any)?.customer;
      const cpfFromCustomer = normalizeCpf(String(customer?.cpf || ''));
      const cpfFromId = normalizeCpf(String(customer?.id || ''));

      const key =
        (cpfFromCustomer.length === 11 ? cpfFromCustomer : '') ||
        (cpfFromId.length === 11 ? cpfFromId : '') ||
        `${String(customer?.name || '')}-${String(customer?.phone || '')}`;

      if (!key) continue;
      if (!map[key]) map[key] = [];
      map[key].push(order);
    }

    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    }

    return map;
  }, [orders]);

  const customerFinancials = useMemo(() => {
    const financials: Record<string, { totalComprado: number; totalPago: number; saldoDevedor: number }> = {};

    for (const [key, list] of Object.entries(customerOrders)) {
      let totalComprado = 0;
      let totalPago = 0;

      for (const order of list) {
        if (order.status === 'Excluído' || order.status === 'Cancelado') continue;

        totalComprado += Number(order.total || 0);

        if (order.paymentMethod === 'Crediário') {
          totalPago += Number(order.downPayment || 0);
          const installments: any[] = Array.isArray((order as any).installmentDetails) ? ((order as any).installmentDetails as any[]) : [];
          for (const inst of installments) {
            totalPago += Number(inst?.paidAmount || 0);
          }
        } else if (order.paymentMethod === 'Dinheiro' || order.paymentMethod === 'Cartão Crédito' || order.paymentMethod === 'Cartão Débito') {
          totalPago += Number(order.total || 0);
        } else if (order.paymentMethod === 'Pix') {
          const asaas = (order as any)?.asaas;
          const isLegacyPix = !asaas?.paymentId;
          const isPaid = isLegacyPix || !!asaas?.paidAt;
          if (isPaid) totalPago += Number(order.total || 0);
        }
      }

      financials[key] = {
        totalComprado,
        totalPago,
        saldoDevedor: Math.max(0, totalComprado - totalPago),
      };
    }

    return financials;
  }, [customerOrders]);
  const financialSummary = useMemo(() => ({ totalVendido: 0, totalRecebido: 0, totalPendente: 0, lucroBruto: 0, monthlyData: [] }), [orders]);
  const commissionSummary = useMemo(() => ({ totalPendingCommission: 0, commissionsBySeller: [] }), [orders]);

  const value = {
    addOrder, addCustomer, generateCustomerCodes, deleteOrder, permanentlyDeleteOrder, updateOrderStatus, recordInstallmentPayment, reversePayment, updateInstallmentDueDate, updateInstallmentAmount, updateCustomer, deleteCustomer, restoreCustomerFromTrash, permanentlyDeleteCustomerFromTrash, importCustomers, updateOrderDetails,
    addProduct, updateProduct, deleteProduct, importProducts,
    addCategory, deleteCategory, updateCategoryName, addSubcategory, updateSubcategory, deleteSubcategory, moveCategory, reorderSubcategories, moveSubcategory,
    payCommissions, reverseCommissionPayment,
    restoreAdminData, resetOrders, resetProducts, resetFinancials, resetAllAdminData,
    saveStockAudit, addAvaria, updateAvaria, deleteAvaria,
    emptyTrash,
    restoreProduct, permanentlyDeleteProduct, fetchDeletedProducts,
    permanentlyDeleteCustomer,
    orders, commissionPayments, stockAudits, avarias, chatSessions, customers: customersForUI, deletedCustomers, customerOrders, customerFinancials,
    financialSummary,
    commissionSummary,
    loadMoreOrders,
    loadAllOrders,
    refreshOrders,
    totalOrders,
    ordersLimit
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (context === undefined) throw new Error('useAdmin must be used within an AdminProvider');
  return context;
};

export const useAdminData = useAdmin;
