

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAdmin, useAdminData } from '@/context/AdminContext';
import type { Order, Installment, PaymentMethod, User, Payment, Product } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { searchOrdersAction, getBillingDashboardAction, type BillingDashboardSummary } from '@/app/actions/admin/orders';
import { getPendingOrdersAction } from '@/app/actions/admin/pending-orders';
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
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PackageSearch, FileText, CheckCircle, Pencil, User as UserIcon, ShoppingBag, CreditCard, Printer, Undo2, Save, CalendarIcon, MoreHorizontal, Trash2, Users, Filter, X, Trash, History, Percent, UserPlus, Clock, MessageSquare, Eye, Calculator } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO, addMonths, getMonth, getYear, getDate } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import PaymentDialog from '@/components/PaymentDialog';
import { useData } from '@/context/DataContext';
import { useAudit } from '@/context/AuditContext';
import { WhatsAppIcon } from '@/components/WhatsAppIcon';
import { useSettings } from '@/context/SettingsContext';
import Logo from '@/components/Logo';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';


import { OrderEditDialog } from '@/components/OrderEditDialog';
import { PendingOrderReviewDialog } from '@/components/PendingOrderReviewDialog';

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

const dueDateRanges = [
    { value: 'all', label: 'Todos os Vencimentos' },
    { value: '1-5', label: '1 a 5' },
    { value: '6-10', label: '6 a 10' },
    { value: '11-15', label: '11 a 15' },
    { value: '16-20', label: '16 a 20' },
    { value: '21-25', label: '21 a 25' },
    { value: '26-31', label: '26 a 31' },
];

const months = [
    { value: 'all', label: 'Todos' },
    { value: '01', label: 'Janeiro' },
    { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' },
    { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
];

export default function OrdersAdminPage() {
    const { updateOrderStatus, recordInstallmentPayment, updateOrderDetails, updateInstallmentDueDate, deleteOrder, permanentlyDeleteOrder, reversePayment, emptyTrash, updateInstallmentAmount } = useAdmin();
    const { orders, customers, loadMoreOrders, loadAllOrders, totalOrders, refreshOrders } = useAdminData();
    const { products } = useData();
    const { user, users } = useAuth();
    const { settings } = useSettings();
    const { logAction } = useAudit();
    const { toast } = useToast();
    const [isClient, setIsClient] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [editedInstallmentValues, setEditedInstallmentValues] = useState<{ [key: number]: string }>({});
    const [openDueDatePopover, setOpenDueDatePopover] = useState<string | null>(null);
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [installmentToPay, setInstallmentToPay] = useState<Installment | null>(null);
    const [filters, setFilters] = useState(() => {
        const today = new Date();
        const day = today.getDate();
        let defaultRange = 'all';
        
        if (day >= 1 && day <= 5) defaultRange = '1-5';
        else if (day >= 6 && day <= 10) defaultRange = '6-10';
        else if (day >= 11 && day <= 15) defaultRange = '11-15';
        else if (day >= 16 && day <= 20) defaultRange = '16-20';
        else if (day >= 21 && day <= 25) defaultRange = '21-25';
        else if (day >= 26) defaultRange = '26-31';

        return {
            search: '',
            status: 'all',
            seller: 'all',
            showOverdue: false,
            showOnTime: false,
            showPaidOff: false,
            dueDateRange: 'all',
            vencimentoTabRange: defaultRange, // Separate state for the Vencimento tab
            month: '',
            year: '',
        };
    });
    const [activeTab, setActiveTab] = useState('active');
    const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
    const [activePage, setActivePage] = useState(1);
    const [deletedPage, setDeletedPage] = useState(1);
    const [vencimentoPage, setVencimentoPage] = useState(1);
    const [viewedOrders, setViewedOrders] = useState<Set<string>>(new Set());
    const [serverSearchResults, setServerSearchResults] = useState<Order[]>([]);
    const [isSearchingServer, setIsSearchingServer] = useState(false);
    const [pendingOrders, setPendingOrders] = useState<any[]>([]);
    const [selectedPendingOrder, setSelectedPendingOrder] = useState<any | null>(null);

    const fetchPendingOrders = useCallback(async () => {
        try {
            const res = await getPendingOrdersAction();
            if (res.success && res.data) {
                // @ts-ignore
                setPendingOrders(res.data);
            }
        } catch (error) {
            console.error("Error loading pending orders:", error);
        }
    }, []);

    useEffect(() => {
        // Load pending orders (web requests)
        fetchPendingOrders();

        // Poll for new requests every 5 seconds
        const interval = setInterval(fetchPendingOrders, 5000);
        return () => clearInterval(interval);
    }, [fetchPendingOrders]);

    // Auto-load all orders after initial load
    useEffect(() => {
        if (totalOrders > 0 && orders.length > 0 && orders.length < totalOrders) {
             const timer = setTimeout(() => {
                 loadAllOrders();
             }, 2000); // Wait 2s after initial render to avoid freezing UI immediately
             return () => clearTimeout(timer);
        }
    }, [totalOrders, orders.length, loadAllOrders]);

    useEffect(() => {
        const term = filters.search.trim();
        if (term.length < 3) {
            setServerSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearchingServer(true);
            try {
                const res = await searchOrdersAction(term);
                if (res.success && res.data) {
                    setServerSearchResults(res.data);
                }
            } catch (e) {
                console.error("Error searching orders", e);
            } finally {
                setIsSearchingServer(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [filters.search]);

    useEffect(() => {
        const stored = localStorage.getItem('viewedOrders');
        if (stored) {
            try {
                setViewedOrders(new Set(JSON.parse(stored)));
            } catch (e) {
                console.error("Erro ao carregar pedidos visualizados", e);
            }
        }
    }, []);

    const markAsViewed = (orderId: string) => {
        setViewedOrders(prev => {
            const next = new Set(prev);
            next.add(orderId);
            localStorage.setItem('viewedOrders', JSON.stringify(Array.from(next)));
            return next;
        });
    };

    const ORDERS_PER_PAGE = 20;

    useEffect(() => {
        setIsClient(true);
    }, []);

    const sellersForFilter = useMemo(() => {
        return users.filter(u => u.role === 'vendedor' || u.role === 'admin' || u.role === 'gerente' || u.role === 'vendedor_externo' || u.role === 'vendedor_cobranca');
    }, [users]);

    const assignableSellers = useMemo(() => {
        return sellersForFilter.filter(u => u.canBeAssigned !== false);
    }, [sellersForFilter]);

    const availableYears = useMemo(() => {
        const currentYear = format(new Date(), 'yyyy');
        if (!orders) return [currentYear];
        const years = new Set<string>();
        years.add(currentYear);
        if (filters.year !== 'all' && filters.year) {
            years.add(filters.year);
        }
        orders.forEach((o) => {
            try {
                years.add(format(parseISO(o.date), 'yyyy'));
            } catch {
            }
        });
        const sorted = Array.from(years).sort((a, b) => Number(b) - Number(a));
        return sorted.length > 0 ? sorted : [currentYear];
    }, [orders, filters.year]);

    const filteredOrders = useMemo(() => {
        let ordersToFilter = orders || [];
        
        if (filters.search.length >= 3 && serverSearchResults.length > 0) {
             const existingIds = new Set(ordersToFilter.map(o => o.id));
             const newOrders = serverSearchResults.filter(o => !existingIds.has(o.id));
             ordersToFilter = [...ordersToFilter, ...newOrders];
        }

        return ordersToFilter.filter(o => {
            const searchTerm = filters.search.toLowerCase();
            const searchMatch = !searchTerm ||
                o.id.toLowerCase().includes(searchTerm) ||
                o.customer.name.toLowerCase().includes(searchTerm) ||
                (o.customer.code || '').toLowerCase().includes(searchTerm);

            const statusMatch = filters.status === 'all' || o.status === filters.status;

            const sellerMatch = (() => {
                if (filters.seller === 'all') return true;
                if (filters.seller === 'unassigned') return !o.sellerId;
                return o.sellerId === filters.seller;
            })();

            const dateMatch = (() => {
                if ((!filters.year || filters.year === 'all') && (!filters.month || filters.month === 'all')) {
                    return true;
                }
                try {
                    const date = parseISO(o.date);
                    const yearOk = !filters.year || filters.year === 'all' || format(date, 'yyyy') === filters.year;
                    const monthOk = !filters.month || filters.month === 'all' || format(date, 'MM') === filters.month;
                    return yearOk && monthOk;
                } catch {
                    return true;
                }
            })();

            const isOverdue = (o.installmentDetails || []).some(inst => inst.status === 'Pendente' && new Date(inst.dueDate) < new Date());
            const hasPendingInstallments = (o.installmentDetails || []).some(inst => inst.status === 'Pendente');
            const isPaidOff = (o.installmentDetails || []).length > 0 && (o.installmentDetails || []).every(inst => inst.status === 'Pago');

            const overdueMatch = !filters.showOverdue || isOverdue;
            const onTimeMatch = !filters.showOnTime || (!isOverdue && (hasPendingInstallments || isPaidOff));
            const paidOffMatch = !filters.showPaidOff || isPaidOff;

            const dueDateMatch = activeTab === 'vencimento' ? true : (filters.dueDateRange === 'all' || (o.installmentDetails || []).some(inst => {
                if (inst.status !== 'Pendente') return false;
                const dueDate = parseISO(inst.dueDate);
                const today = new Date();
                // Only consider installments in the current month and year for this filter
                if (getMonth(dueDate) !== getMonth(today) || getYear(dueDate) !== getYear(today)) {
                    return false;
                }
                const dayOfMonth = getDate(dueDate);
                const [start, end] = String(filters.dueDateRange || '').split('-').map(Number);
                return dayOfMonth >= start && dayOfMonth <= end;
            }));

            const roleMatch = (() => {
                if (user?.role === 'vendedor_cobranca') {
                    // Permite visualizar pedidos onde é vendedor ou criador
                    return o.sellerId === user.id || o.createdByName === user.name;
                }
                return true;
            })();

            return searchMatch && statusMatch && sellerMatch && dateMatch && overdueMatch && onTimeMatch && paidOffMatch && dueDateMatch && roleMatch;
        });
    }, [orders, filters, serverSearchResults, activeTab, user]);

    const { activeOrders, deletedOrders } = useMemo(() => {
        const active: Order[] = [];
        const deleted: Order[] = [];

        filteredOrders.forEach(order => {
            if (order.status === 'Excluído' && order.items.length === 0) {
                // Registration-only record, don't show
            } else if (order.status === 'Excluído') {
                deleted.push(order);
            } else {
                active.push(order);
            }
        });

        // Apply sorting to active orders based on due date if a specific range is selected
        let sortedActive = [...active];
        if (filters.dueDateRange !== 'all') {
            const today = new Date();
            const currentMonth = getMonth(today);
            const currentYear = getYear(today);

            sortedActive.sort((a, b) => {
                const getTargetDate = (order: any) => {
                    const installments = (order.installmentDetails || [])
                        .filter((inst: any) => {
                            if (inst.status !== 'Pendente') return false;
                            const dueDate = parseISO(inst.dueDate);
                            return getMonth(dueDate) === currentMonth && getYear(dueDate) === currentYear;
                        })
                        .sort((i1: any, i2: any) => new Date(i1.dueDate).getTime() - new Date(i2.dueDate).getTime());
                    
                    return installments.length > 0 ? new Date(installments[0].dueDate).getTime() : 0;
                };

                return getTargetDate(a) - getTargetDate(b);
            });
        } else {
            // Default sorting (newest first)
            sortedActive.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }

        return {
            activeOrders: sortedActive,
            deletedOrders: deleted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        };
    }, [filteredOrders, filters.dueDateRange]);

    const vencimentoOrders = useMemo(() => {
        const today = new Date();
        const currentMonth = getMonth(today);
        const currentYear = getYear(today);

        return activeOrders.filter(o => {
            const hasPendingInCurrentMonth = (o.installmentDetails || []).some(inst => {
                if (inst.status !== 'Pendente') return false;
                const dueDate = parseISO(inst.dueDate);
                
                const monthMatch = getMonth(dueDate) === currentMonth;
                const yearMatch = getYear(dueDate) === currentYear;
                
                if (!monthMatch || !yearMatch) return false;

                if (filters.vencimentoTabRange === 'all') return true;
                
                const dayOfMonth = getDate(dueDate);
                const [start, end] = String(filters.vencimentoTabRange).split('-').map(Number);
                return dayOfMonth >= start && dayOfMonth <= end;
            });

            return hasPendingInCurrentMonth;
        }).sort((a, b) => {
            const today = new Date();
            const currentMonth = getMonth(today);
            const currentYear = getYear(today);

            const getTargetDate = (order: any) => {
                const installments = (order.installmentDetails || [])
                    .filter((inst: any) => {
                        if (inst.status !== 'Pendente') return false;
                        const dueDate = parseISO(inst.dueDate);
                        return getMonth(dueDate) === currentMonth && getYear(dueDate) === currentYear;
                    })
                    .sort((i1: any, i2: any) => new Date(i1.dueDate).getTime() - new Date(i2.dueDate).getTime());
                
                return installments.length > 0 ? new Date(installments[0].dueDate).getTime() : 0;
            };

            return getTargetDate(a) - getTargetDate(b);
        });
    }, [activeOrders, filters.vencimentoTabRange]);

    useEffect(() => {
        setVencimentoPage(1);
    }, [filters.vencimentoTabRange]);

    const { paginatedVencimentoOrders, totalVencimentoPages } = useMemo(() => {
        const total = Math.ceil(vencimentoOrders.length / ORDERS_PER_PAGE);
        const paginated = vencimentoOrders.slice((vencimentoPage - 1) * ORDERS_PER_PAGE, vencimentoPage * ORDERS_PER_PAGE);
        return { paginatedVencimentoOrders: paginated, totalVencimentoPages: total };
    }, [vencimentoOrders, vencimentoPage]);

    const { paginatedActiveOrders, totalActivePages } = useMemo(() => {
        const total = Math.ceil(activeOrders.length / ORDERS_PER_PAGE);
        const paginated = activeOrders.slice((activePage - 1) * ORDERS_PER_PAGE, activePage * ORDERS_PER_PAGE);

        return { paginatedActiveOrders: paginated, totalActivePages: total };
    }, [activeOrders, activePage]);

    const { paginatedDeletedOrders, totalDeletedPages } = useMemo(() => {
        const total = Math.ceil(deletedOrders.length / ORDERS_PER_PAGE);
        const paginated = deletedOrders.slice((deletedPage - 1) * ORDERS_PER_PAGE, deletedPage * ORDERS_PER_PAGE);
        return { paginatedDeletedOrders: paginated, totalDeletedPages: total };
    }, [deletedOrders, deletedPage]);

    const [delinquencyStats, setDelinquencyStats] = useState<BillingDashboardSummary | null>(null);

    useEffect(() => {
        const canSee = user?.role === 'admin' || user?.role === 'gerente';
        if (!canSee || !user) return;
        const timer = setTimeout(() => {
            getBillingDashboardAction({}, user).then(res => {
                if (res.success) setDelinquencyStats((res as any).data.summary);
            }).catch(() => {});
        }, 6000);
        return () => clearTimeout(timer);
    }, [user]);

    const filteredPendingOrders = useMemo(() => {
        if (!user || user.role !== 'vendedor_cobranca') {
            return pendingOrders;
        }
        return pendingOrders.filter(order => order.sellerId === user.id);
    }, [pendingOrders, user]);



    const handleFilterChange = (filterName: keyof typeof filters, value: string | boolean) => {
        setFilters(prev => {
            const newFilters = { ...prev, [filterName]: value };
            // Ensure only one of showOverdue, showOnTime or showPaidOff is active
            if (filterName === 'showOverdue' && value) {
                newFilters.showOnTime = false;
                newFilters.showPaidOff = false;
            }
            if (filterName === 'showOnTime' && value) {
                newFilters.showOverdue = false;
                newFilters.showPaidOff = false;
            }
            if (filterName === 'showPaidOff' && value) {
                newFilters.showOverdue = false;
                newFilters.showOnTime = false;
            }
            return newFilters;
        });
        setActivePage(1);
        setDeletedPage(1);
    };

    const clearFilters = () => {
        setFilters(prev => ({
            search: '',
            status: 'all',
            seller: 'all',
            showOverdue: false,
            showOnTime: false,
            showPaidOff: false,
            dueDateRange: 'all',
            vencimentoTabRange: prev.vencimentoTabRange,
            month: '',
            year: '',
        }));
        setActivePage(1);
        setDeletedPage(1);
    };

    const selectedOrderId = selectedOrder?.id;
    useEffect(() => {
        if (!selectedOrderId) return;
        const updatedOrderInList = orders.find(o => o.id === selectedOrderId);
        if (updatedOrderInList) {
            setSelectedOrder(prev => {
                if (!prev || JSON.stringify(updatedOrderInList) === JSON.stringify(prev)) return prev;
                return updatedOrderInList;
            });
        }
    }, [orders, selectedOrderId]);

    const handleOpenDetails = (order: Order) => {
        markAsViewed(order.id);
        setSelectedOrder(order);
        setEditedInstallmentValues({});
        setIsDetailModalOpen(true);
    }



    const handleOpenPaymentDialog = (installment: Installment) => {
        setInstallmentToPay(installment);
        setPaymentDialogOpen(true);
    };

    const handlePaymentSubmit = async (payment: Omit<Payment, 'receivedBy'>) => {
        if (selectedOrder && installmentToPay) {
            await recordInstallmentPayment(selectedOrder.id, installmentToPay.installmentNumber, payment, logAction, user);
            window.open(`/carnet/${selectedOrder.id}/${installmentToPay.installmentNumber}`, '_blank');
        }
        setPaymentDialogOpen(false);
        setInstallmentToPay(null);
    };


    const handleDueDateChange = (orderId: string, installmentNumber: number, date: Date | undefined) => {
        if (date) {
            updateInstallmentDueDate(orderId, installmentNumber, date, logAction, user);
        }
        setOpenDueDatePopover(null);
    }

    const handleDeleteOrder = (orderId: string) => {
        deleteOrder(orderId, logAction, user);
    };

    const handlePermanentlyDeleteOrder = (orderId: string) => {
        permanentlyDeleteOrder(orderId, logAction, user);
        toast({
            title: 'Pedido Excluído!',
            description: 'O pedido foi removido permanentemente.',
            variant: 'destructive',
        });
    };

    const handleRestoreOrder = async (orderId: string) => {
        await updateOrderStatus(orderId, 'Processando', logAction, user);
    };

    const handleInlineStatusChange = async (orderId: string, status: Order['status']) => {
        console.log('[OrdersAdminPage] Inline status change requested', { orderId, status });
        await updateOrderStatus(orderId, status, logAction, user);
    };

    const handleAssignSeller = (order: Order, seller: User) => {
        if (!seller) return;
        const detailsToUpdate: Partial<Order> = {
            sellerId: seller.id,
            sellerName: seller.name,
        };
        updateOrderDetails(order.id, detailsToUpdate, logAction, user);
        toast({
            title: "Vendedor Atribuído!",
            description: `O pedido #${order.id} foi atribuído a ${seller.name}.`
        });
    };

    const handleAssignToMe = (order: Order) => {
        if (!user) return;
        if (user.canBeAssigned === false) return;
        handleAssignSeller(order, user);
    }



    const handleEmptyTrash = () => {
        emptyTrash(logAction, user);
    }

    const handleSendWhatsAppReminder = (order: Order, installment: Installment) => {
        const customerName = String(order.customer.name || '').split(' ')[0];
        const customerPhone = order.customer.phone.replace(/\D/g, '');
        const dueDate = format(parseISO(installment.dueDate), 'dd/MM/yyyy', { locale: ptBR });
        const amount = formatCurrency(installment.amount - (installment.paidAmount || 0));
        const productNames = order.items.map(item => item.name).join(', ');

        const message = `Olá, ${customerName}! Passando para lembrar sobre a sua parcela do carnê (pedido ${order.id}) referente a compra de *${productNames}*.

Vencimento: *${dueDate}*
Valor: *${amount}*

Chave pix: ${settings.pixKey}
Adriano Cavalcante de Oliveira
Banco: Nubank 

Não esqueça de enviar o comprovante!`;

        const whatsappUrl = `https://wa.me/55${customerPhone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    const handlePrintOverdueReport = () => {
        document.body.classList.add('print-overdue-report');
        window.print();
        document.body.classList.remove('print-overdue-report');
    };

    const handleInstallmentValueChange = (instNumber: number, value: string) => {
        setEditedInstallmentValues(prev => ({ ...prev, [instNumber]: value }));
    };

    const handleSaveInstallmentValue = (instNumber: number) => {
        if (!selectedOrder) return;
        const editedValue = editedInstallmentValues[instNumber];
        if (!editedValue) return;
        const newAmount = parseFloat(editedValue.replace(/\./g, '').replace(',', '.'));

        if (isNaN(newAmount) || newAmount < 0) {
            toast({ title: 'Valor Inválido', variant: 'destructive' });
            return;
        }

        updateInstallmentAmount(selectedOrder.id, instNumber, newAmount, logAction, user);
    }

    const overdueOrdersForReport = useMemo(() => {
        return activeOrders.map(order => {
            const overdueInstallment = (order.installmentDetails || []).find(inst => inst.status === 'Pendente' && new Date(inst.dueDate) < new Date());
            return overdueInstallment ? { order, overdueInstallment } : null;
        }).filter(item => item !== null) as { order: Order; overdueInstallment: Installment }[];
    }, [activeOrders]);

    const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'gerente';
    const canEditInstallment = user?.role === 'admin' || user?.role === 'gerente' || user?.role === 'vendedor';
    const canChangeStatus = user?.role === 'admin' || user?.role === 'gerente' || user?.role === 'vendedor' || user?.role === 'vendedor_externo';


    if (!isClient) {
        return (
            <div className="flex justify-center items-center py-24">
                <p>Carregando painel...</p>
            </div>
        );
    }

    return (
        <>
            <div className="print-hidden space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
                        <p className="text-sm text-muted-foreground">Gerencie pedidos e acompanhe parcelas do crediário</p>
                    </div>
                </div>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Gerenciamento de Pedidos</CardTitle>
                        <CardDescription>Visualize e atualize o status dos pedidos recentes.</CardDescription>
                    </CardHeader>
                    {delinquencyStats && (
                        <div className="px-6 pb-4 grid grid-cols-2 gap-3">
                            <div className="rounded-lg border bg-muted/40 px-4 py-3">
                                <p className="text-xs text-muted-foreground mb-1">Taxa de Inadimplência</p>
                                <p className="text-2xl font-bold text-destructive">{(delinquencyStats.delinquencyRate * 100).toFixed(1)}%</p>
                            </div>
                            <div className="rounded-lg border bg-muted/40 px-4 py-3">
                                <p className="text-xs text-muted-foreground mb-1">Clientes em Atraso</p>
                                <p className="text-2xl font-bold">{delinquencyStats.overdueCustomers}</p>
                            </div>
                        </div>
                    )}
                    <CardContent>
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <div className="overflow-x-auto mb-4">
                                <TabsList className="w-full justify-start md:w-auto">
                                    <TabsTrigger value="active">Pedidos Ativos</TabsTrigger>
                                    <TabsTrigger value="web-requests" className="relative">
                                        Solicitações Web
                                        {filteredPendingOrders.length > 0 && (
                                            <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">
                                                {filteredPendingOrders.length}
                                            </Badge>
                                        )}
                                    </TabsTrigger>
                                    {(user?.role === 'admin' || user?.role === 'gerente' || user?.role === 'vendedor') && <TabsTrigger value="vencimento">Vencimento</TabsTrigger>}
                                    {(user?.role === 'admin' || user?.role === 'gerente' || user?.role === 'vendedor') && <TabsTrigger value="deleted">Lixeira</TabsTrigger>}
                                </TabsList>
                            </div>
                            <TabsContent value="web-requests">
                                <div className="rounded-md border overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Data</TableHead>
                                                <TableHead>Cliente</TableHead>
                                                <TableHead>Itens</TableHead>
                                                <TableHead className="text-right">Total</TableHead>
                                                <TableHead className="text-right">Ações</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredPendingOrders.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-24 text-center">
                                                        Nenhuma solicitação pendente.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                filteredPendingOrders.map((order) => (
                                                    <TableRow key={order.id}>
                                                        <TableCell>{format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm')}</TableCell>
                                                        <TableCell>{order.customerName}</TableCell>
                                                        <TableCell>{order.itemsCount} itens</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(order.total)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button 
                                                                size="sm"
                                                                onClick={() => setSelectedPendingOrder(order)}
                                                            >
                                                                Revisar
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>
                            <TabsContent value="vencimento">
                                <div className="flex flex-wrap gap-4 mb-6 p-4 border rounded-lg bg-muted/50">
                                    <div className="flex-grow min-w-[200px]">
                                        <Select value={filters.vencimentoTabRange} onValueChange={(value) => handleFilterChange('vencimentoTabRange', value)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione o intervalo de dias" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {dueDateRanges.map(range => (
                                                    <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        Exibindo pedidos com parcelas pendentes para o mês de <strong>{format(new Date(), 'MMMM', { locale: ptBR })}</strong>.
                                    </div>
                                </div>

                                {paginatedVencimentoOrders.length > 0 ? (
                                    <>
                                        <div className="rounded-md border overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[120px] p-2">Pedido</TableHead>
                                                        <TableHead className="p-2">Cliente</TableHead>
                                                        <TableHead className="p-2">Vendedor</TableHead>
                                                        <TableHead className="w-[100px] p-2">Vencimento</TableHead>
                                                        <TableHead className="text-right p-2">Valor Parcela</TableHead>
                                                        <TableHead className="text-right p-2">Total Pedido</TableHead>
                                                        <TableHead className="text-right w-[150px] p-2">Ações</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {paginatedVencimentoOrders.map((order) => {
                                                        const today = new Date();
                                                        const currentMonth = getMonth(today);
                                                        const currentYear = getYear(today);
                                                        
                                                        const currentMonthInstallments = (order.installmentDetails || [])
                                                            .filter(inst => {
                                                                if (inst.status !== 'Pendente') return false;
                                                                const dueDate = parseISO(inst.dueDate);
                                                                return getMonth(dueDate) === currentMonth && getYear(dueDate) === currentYear;
                                                            })
                                                            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

                                                        const targetInstallment = currentMonthInstallments[0];

                                                        return (
                                                            <TableRow key={order.id} className="text-sm">
                                                                <TableCell className="p-2 font-medium font-mono text-xs">{order.id}</TableCell>
                                                                <TableCell className="p-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="truncate max-w-[200px] font-semibold">{order.customer.name}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="p-2 truncate max-w-[120px]">{order.sellerName}</TableCell>
                                                                <TableCell className="p-2 font-semibold text-blue-600">
                                                                    {targetInstallment ? format(parseISO(targetInstallment.dueDate), 'dd/MM/yy') : '-'}
                                                                </TableCell>
                                                                <TableCell className="p-2 text-right font-bold text-blue-600">
                                                                    {targetInstallment ? formatCurrency(targetInstallment.amount - (targetInstallment.paidAmount || 0)) : '-'}
                                                                </TableCell>
                                                                <TableCell className="p-2 text-right">{formatCurrency(order.total)}</TableCell>
                                                                <TableCell className="p-2 text-right">
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        {targetInstallment && (
                                                                            <Button variant="ghost" size="icon" className="h-7 w-7 bg-green-500/10 text-green-700 hover:bg-green-500/20 hover:text-green-800" onClick={() => handleSendWhatsAppReminder(order, targetInstallment)}>
                                                                                <WhatsAppIcon />
                                                                            </Button>
                                                                        )}
                                                                        <Button variant="outline" size="sm" onClick={() => handleOpenDetails(order)}>
                                                                            <Eye className="h-4 w-4 mr-1" /> Detalhes
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                        {totalVencimentoPages > 1 && (
                                            <div className="flex flex-col gap-4 mt-4">
                                                <div className="flex justify-between items-center">
                                                    <div className="text-xs text-muted-foreground">
                                                        Exibindo {paginatedVencimentoOrders.length} de {vencimentoOrders.length} pedidos com vencimento
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button variant="outline" size="sm" onClick={() => setVencimentoPage(p => Math.max(1, p - 1))} disabled={vencimentoPage === 1}>
                                                            Anterior
                                                        </Button>
                                                        <span className="text-sm">
                                                            Página {vencimentoPage} de {totalVencimentoPages}
                                                        </span>
                                                        <Button variant="outline" size="sm" onClick={() => setVencimentoPage(p => Math.min(totalVencimentoPages, p + 1))} disabled={vencimentoPage === totalVencimentoPages}>
                                                            Próxima
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                                        <CalendarIcon className="mx-auto h-12 w-12" />
                                        <h3 className="mt-4 text-lg font-semibold">Nenhum vencimento encontrado</h3>
                                        <p className="mt-1 text-sm">Não há parcelas pendentes para o intervalo e mês selecionados.</p>
                                    </div>
                                )}
                            </TabsContent>
                            <TabsContent value="active">
                                <div className="flex flex-wrap gap-4 mb-6 p-4 border rounded-lg bg-muted/50">
                                    <div className="flex-grow min-w-[200px] relative">
                                        <Input
                                            placeholder="Buscar por ID, cliente ou código..."
                                            value={filters.search}
                                            onChange={(e) => handleFilterChange('search', e.target.value)}
                                            className="pr-8"
                                        />
                                        {isSearchingServer && (
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-grow min-w-[150px]">
                                        <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Filtrar por status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todos os Status</SelectItem>
                                                <SelectItem value="Processando">Processando</SelectItem>
                                                <SelectItem value="Enviado">Enviado</SelectItem>
                                                <SelectItem value="Entregue">Entregue</SelectItem>
                                                <SelectItem value="Cancelado">Cancelado</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex-grow min-w-[150px]">
                                        <Select value={filters.seller} onValueChange={(value) => handleFilterChange('seller', value)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Filtrar por vendedor" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todos os Vendedores</SelectItem>
                                                <SelectItem value="unassigned">Não atribuído</SelectItem>
                                                {assignableSellers.map(s => (
                                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="min-w-[170px]">
                                        <Select value={filters.month} onValueChange={(value) => handleFilterChange('month', value)}>
                                            <SelectTrigger className="w-full sm:w-[170px]">
                                                <SelectValue placeholder="Mês" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {months.map(m => (
                                                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="min-w-[120px]">
                                        <Select value={filters.year} onValueChange={(value) => handleFilterChange('year', value)}>
                                            <SelectTrigger className="w-full sm:w-[120px]">
                                                <SelectValue placeholder="Ano" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todos</SelectItem>
                                                {availableYears.map(y => (
                                                    <SelectItem key={y} value={y}>{y}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex-grow min-w-[150px]">
                                        <Select value={filters.dueDateRange} onValueChange={(value) => handleFilterChange('dueDateRange', value)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Vencimento no Mês" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {dueDateRanges.map(range => (
                                                    <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button
                                        variant={filters.showOnTime ? 'default' : 'outline'}
                                        className={cn(filters.showOnTime && "bg-green-600 hover:bg-green-700")}
                                        onClick={() => handleFilterChange('showOnTime', !filters.showOnTime)}
                                    >
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Em Dia
                                    </Button>
                                    <Button
                                        variant={filters.showOverdue ? 'destructive' : 'outline'}
                                        onClick={() => handleFilterChange('showOverdue', !filters.showOverdue)}
                                    >
                                        <Clock className="mr-2 h-4 w-4" />
                                        Atrasados
                                    </Button>
                                    <Button
                                        variant={filters.showPaidOff ? 'default' : 'outline'}
                                        className={cn(filters.showPaidOff && "bg-blue-600 hover:bg-blue-700")}
                                        onClick={() => handleFilterChange('showPaidOff', !filters.showPaidOff)}
                                    >
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Quitados
                                    </Button>
                                    <Button variant="outline" onClick={handlePrintOverdueReport}>
                                        <Printer className="mr-2 h-4 w-4" />
                                        Imprimir Relatório
                                    </Button>
                                    <Button variant="ghost" onClick={clearFilters}>
                                        <X className="mr-2 h-4 w-4" />
                                        Limpar
                                    </Button>
                                </div>

                                {paginatedActiveOrders.length > 0 ? (
                                    <>
                                        <div className="rounded-md border overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[120px] p-2">Pedido</TableHead>
                                                        <TableHead className="w-[200px] p-2">Data</TableHead>
                                                        <TableHead className="p-2">Cliente</TableHead>
                                                        <TableHead className="w-[150px] p-2">Produtos</TableHead>
                                                        <TableHead className="p-2">Vendedor</TableHead>
                                                        <TableHead className="w-[100px] p-2">Próx. Venc.</TableHead>
                                                        <TableHead className="text-right p-2">Total</TableHead>
                                                        <TableHead className="text-right p-2">Comissão</TableHead>
                                                        <TableHead className="text-center w-[120px] p-2">Status</TableHead>
                                                        <TableHead className="text-right w-[200px] p-2">Ações</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {paginatedActiveOrders.map((order) => {
                                                        const nextPendingInstallment = order.installmentDetails
                                                            ?.filter(inst => inst.status === 'Pendente')
                                                            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
                                                        const installmentForReminder = nextPendingInstallment || order.installmentDetails?.[0];
                                                        const isOverdue = !!nextPendingInstallment && new Date(nextPendingInstallment.dueDate) < new Date();
                                                        const isPaidOff = (order.installmentDetails || []).length > 0 && (order.installmentDetails || []).every(inst => inst.status === 'Pago');

                                                        return (
                                                            <TableRow key={order.id} className="text-sm">
                                                                <TableCell className="p-2 font-medium font-mono text-xs">{order.id}</TableCell>
                                                                <TableCell className="p-2 whitespace-nowrap">
                                                                    {order.source === 'Online' && !viewedOrders.has(order.id) && (
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <span className="relative flex h-3 w-3">
                                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                                                            </span>
                                                                            <span className="font-semibold text-green-600 text-[10px] uppercase tracking-wider">Catálogo Online</span>
                                                                        </div>
                                                                    )}
                                                                    <span className="text-muted-foreground text-xs">{format(new Date(order.date), "dd/MM/yy HH:mm")}</span>
                                                                </TableCell>
                                                                <TableCell className="p-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <Link href={`/admin/clientes?cpf=${order.customer.cpf}`} passHref>
                                                                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                                                                <UserIcon className="h-4 w-4" />
                                                                                <span className="sr-only">Ver Cliente</span>
                                                                            </Button>
                                                                        </Link>
                                                                        <span className="truncate max-w-[150px]">{order.customer.name}</span>
                                                                        {(() => {
                                                                            const currentCustomer = customers?.find(c => c.id === order.customer.id);
                                                                            const rating = currentCustomer?.rating || order.customer.rating;

                                                                            if (rating === 1) return <Badge variant="destructive" className="ml-1 text-[10px] h-5 px-1 py-0">RUIM</Badge>;
                                                                            if (rating === 2) return <Badge variant="secondary" className="ml-1 bg-yellow-500 text-white hover:bg-yellow-600 border-none text-[10px] h-5 px-1 py-0">REGULAR</Badge>;
                                                                            if (rating === 3) return <Badge variant="default" className="ml-1 bg-green-600 hover:bg-green-700 text-[10px] h-5 px-1 py-0">EXCELENTE</Badge>;
                                                                            return null;
                                                                        })()}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="p-2 text-xs truncate max-w-[150px]">{order.items.map(item => item.name).join(', ')}</TableCell>
                                                                <TableCell className="p-2 truncate max-w-[120px]">{order.sellerName}</TableCell>
                                                                <TableCell className={cn("p-2 whitespace-nowrap", isOverdue && "text-destructive font-semibold", isPaidOff && !nextPendingInstallment && "text-green-600 font-semibold")}>
                                                                    {nextPendingInstallment ? format(new Date(nextPendingInstallment.dueDate), 'dd/MM/yy') : (isPaidOff ? 'Quitado' : '-')}
                                                                </TableCell>
                                                                <TableCell className="p-2 text-right font-semibold">{formatCurrency(order.total)}</TableCell>
                                                                <TableCell className="p-2 text-right font-semibold">
                                                                    {order.status === 'Entregue' ? (
                                                                        <span className="text-green-600">{formatCurrency(order.commission || 0)}</span>
                                                                    ) : (
                                                                        <span className="text-muted-foreground">-</span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="p-2 text-center">
                                                                    <div className="flex flex-col items-center justify-center gap-1">
                                                                        {canChangeStatus ? (
                                                                            <DropdownMenu>
                                                                                <DropdownMenuTrigger asChild>
                                                                                    <Button variant="ghost" size="sm" className="h-7 px-2">
                                                                                        <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
                                                                                    </Button>
                                                                                </DropdownMenuTrigger>
                                                                                <DropdownMenuContent align="center">
                                                                                    <DropdownMenuLabel>Status do Pedido</DropdownMenuLabel>
                                                                                    <DropdownMenuItem onClick={() => handleInlineStatusChange(order.id, 'Processando')}>
                                                                                        Processando
                                                                                    </DropdownMenuItem>
                                                                                    <DropdownMenuItem onClick={() => handleInlineStatusChange(order.id, 'Enviado')}>
                                                                                        Enviado
                                                                                    </DropdownMenuItem>
                                                                                    <DropdownMenuItem onClick={() => handleInlineStatusChange(order.id, 'Entregue')}>
                                                                                        Entregue
                                                                                    </DropdownMenuItem>
                                                                                    <DropdownMenuItem onClick={() => handleInlineStatusChange(order.id, 'Cancelado')}>
                                                                                        Cancelado
                                                                                    </DropdownMenuItem>
                                                                                </DropdownMenuContent>
                                                                            </DropdownMenu>
                                                                        ) : (
                                                                            <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
                                                                        )}
                                                                        {isOverdue ? (
                                                                            <Badge variant="destructive" className="flex items-center gap-1">
                                                                                <Clock className="h-3 w-3" /> Atrasado
                                                                            </Badge>
                                                                        ) : (nextPendingInstallment ? (
                                                                            <Badge variant="default" className="bg-green-600 hover:bg-green-700 flex items-center gap-1">
                                                                                <CheckCircle className="h-3 w-3" /> Em dia
                                                                            </Badge>
                                                                        ) : (isPaidOff && (
                                                                            <Badge variant="default" className="bg-green-600 hover:bg-green-700 flex items-center gap-1">
                                                                                <CheckCircle className="h-3 w-3" /> Quitado
                                                                            </Badge>
                                                                        )))}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="p-2 text-right">
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        {order.installmentDetails && order.installmentDetails.length > 0 && installmentForReminder && (
                                                                            <Button variant="ghost" size="icon" className="h-7 w-7 bg-green-500/10 text-green-700 hover:bg-green-500/20 hover:text-green-800" onClick={() => handleSendWhatsAppReminder(order, installmentForReminder)}>
                                                                                <WhatsAppIcon />
                                                                            </Button>
                                                                        )}
                                                                        {order.paymentMethod === 'Crediário' && (
                                                                            <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                                                                                <Link href={`/carnet/${order.id}`} target="_blank" rel="noopener noreferrer">
                                                                                    <FileText className="h-4 w-4" />
                                                                                    <span className="sr-only">Ver carnê completo</span>
                                                                                </Link>
                                                                            </Button>
                                                                        )}
                                                                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenDetails(order)}>
                                                                            <Eye className="h-4 w-4" />
                                                                        </Button>
                                                                        {user?.role !== 'vendedor_cobranca' && (
                                                                            <DropdownMenu>
                                                                                <DropdownMenuTrigger asChild>
                                                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                                        <UserPlus className="h-4 w-4" />
                                                                                    </Button>
                                                                                </DropdownMenuTrigger>
                                                                                <DropdownMenuContent align="end">
                                                                                    <DropdownMenuLabel>Atribuir a:</DropdownMenuLabel>
                                                                                    {user?.canBeAssigned !== false && (
                                                                                        <DropdownMenuItem onClick={() => handleAssignToMe(order)}>
                                                                                            Atribuir a mim
                                                                                        </DropdownMenuItem>
                                                                                    )}
                                                                                    {user?.canBeAssigned !== false && assignableSellers.length > 0 && <Separator />}
                                                                                    {assignableSellers.length > 0 ? (
                                                                                        assignableSellers.map(s => (
                                                                                            <DropdownMenuItem key={s.id} onClick={() => handleAssignSeller(order, s)}>
                                                                                                {s.name}
                                                                                            </DropdownMenuItem>
                                                                                        ))
                                                                                    ) : (
                                                                                        <DropdownMenuItem disabled>Nenhum vendedor disponível</DropdownMenuItem>
                                                                                    )}
                                                                                </DropdownMenuContent>
                                                                            </DropdownMenu>
                                                                        )}
                                                                        {(user?.role === 'admin' || user?.role === 'gerente' || user?.role === 'vendedor') && (
                                                                            <DropdownMenu>
                                                                                <DropdownMenuTrigger asChild>
                                                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                                        <MoreHorizontal className="h-4 w-4" />
                                                                                    </Button>
                                                                                </DropdownMenuTrigger>
                                                                                <DropdownMenuContent align="end">
                                                                                    <DropdownMenuItem onClick={() => handleDeleteOrder(order.id)} className="text-destructive">
                                                                                        <Trash className="mr-2 h-4 w-4" />
                                                                                        Mover para Lixeira
                                                                                    </DropdownMenuItem>
                                                                                </DropdownMenuContent>
                                                                            </DropdownMenu>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                        {totalActivePages > 1 && (
                                            <div className="flex flex-col gap-4 mt-4">
                                                <div className="flex justify-between items-center">
                                                    <div className="text-xs text-muted-foreground">
                                                        Exibindo {orders.length} de {totalOrders || orders.length} pedidos no total
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button variant="outline" size="sm" onClick={() => setActivePage(p => Math.max(1, p - 1))} disabled={activePage === 1}>
                                                            Anterior
                                                        </Button>
                                                        <span className="text-sm">
                                                            Página {activePage} de {totalActivePages}
                                                        </span>
                                                        <Button variant="outline" size="sm" onClick={() => setActivePage(p => Math.min(totalActivePages, p + 1))} disabled={activePage === totalActivePages}>
                                                            Próxima
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {orders.length < (totalOrders || 0) && (
                                            <div className="mt-6 flex flex-col items-center gap-2 pb-8">
                                                <div className="text-sm text-muted-foreground">
                                                    Você está vendo {orders.length} de {totalOrders} pedidos.
                                                </div>
                                                <Button 
                                                    variant="secondary" 
                                                    className="w-full max-w-md"
                                                    onClick={() => loadMoreOrders()}
                                                >
                                                    Carregar Mais Pedidos Antigos (+1000)
                                                </Button>
                                                <p className="text-xs text-muted-foreground">
                                                    Isso pode levar alguns instantes.
                                                </p>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                                        <PackageSearch className="mx-auto h-12 w-12" />
                                        {!user ? (
                                            <>
                                                <h3 className="mt-4 text-lg font-semibold">Conecte-se para ver os pedidos</h3>
                                                <p className="mt-1 text-sm">Por favor, faça login para acessar o painel de pedidos.</p>
                                                <Link href="/login" className="mt-4 inline-block">
                                                    <Button>
                                                        Fazer Login
                                                    </Button>
                                                </Link>
                                            </>
                                        ) : (
                                            <>
                                                <h3 className="mt-4 text-lg font-semibold">Nenhum pedido encontrado</h3>
                                                <p className="mt-1 text-sm">Ajuste os filtros ou crie um novo pedido.</p>
                                            </>
                                        )}
                                    </div>
                                )}
                            </TabsContent>
                            <TabsContent value="deleted">
                                <div className="flex flex-wrap gap-4 mb-6 p-4 border rounded-lg bg-muted/50">
                                    <div className="flex-grow min-w-[200px]">
                                        <Input
                                            placeholder="Buscar na lixeira por ID, cliente ou código..."
                                            value={filters.search}
                                            onChange={(e) => handleFilterChange('search', e.target.value)}
                                        />
                                    </div>
                                    {user?.role === 'admin' && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" disabled={deletedOrders.length === 0}>
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Esvaziar Lixeira ({deletedOrders.length})
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Esvaziar a lixeira?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Esta ação não pode ser desfeita. Isso irá apagar permanentemente todos os {deletedOrders.length} pedidos na lixeira.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleEmptyTrash}>
                                                        Sim, Esvaziar Lixeira
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </div>
                                {paginatedDeletedOrders.length > 0 ? (
                                    <>
                                        <div className="rounded-md border overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Pedido ID</TableHead>
                                                        <TableHead>Cliente</TableHead>
                                                        <TableHead>Data da Exclusão</TableHead>
                                                        <TableHead className="text-right">Total</TableHead>
                                                        <TableHead className="text-right">Ações</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {paginatedDeletedOrders.map(order => (
                                                        <TableRow key={order.id}>
                                                            <TableCell className="p-2 font-medium">{order.id}</TableCell>
                                                            <TableCell className="p-2">{order.customer.name}</TableCell>
                                                            <TableCell className="p-2">{format(new Date(order.date), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                                                            <TableCell className="p-2 text-right">{formatCurrency(order.total)}</TableCell>
                                                            <TableCell className="p-2 text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <Button variant="outline" size="sm" onClick={() => handleRestoreOrder(order.id)}>
                                                                        <History className="mr-2 h-4 w-4" />
                                                                        Restaurar
                                                                    </Button>
                                                                    {user?.role === 'admin' && (
                                                                        <AlertDialog>
                                                                            <AlertDialogTrigger asChild>
                                                                                <Button variant="destructive" outline size="sm">
                                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                                    Excluir
                                                                                </Button>
                                                                            </AlertDialogTrigger>
                                                                            <AlertDialogContent>
                                                                                <AlertDialogHeader>
                                                                                    <AlertDialogTitle>Excluir Permanentemente?</AlertDialogTitle>
                                                                                    <AlertDialogDescription>
                                                                                        Esta ação é irreversível e irá apagar permanentemente o pedido <span className="font-bold">{order.id}</span>. Você tem certeza?
                                                                                    </AlertDialogDescription>
                                                                                </AlertDialogHeader>
                                                                                <AlertDialogFooter>
                                                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                                    <AlertDialogAction onClick={() => handlePermanentlyDeleteOrder(order.id)}>
                                                                                        Sim, Excluir
                                                                                    </AlertDialogAction>
                                                                                </AlertDialogFooter>
                                                                            </AlertDialogContent>
                                                                        </AlertDialog>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                        {totalDeletedPages > 1 && (
                                            <div className="flex justify-end items-center gap-2 mt-4">
                                                <Button variant="outline" size="sm" onClick={() => setDeletedPage(p => Math.max(1, p - 1))} disabled={deletedPage === 1}>
                                                    Anterior
                                                </Button>
                                                <span className="text-sm">
                                                    Página {deletedPage} de {totalDeletedPages}
                                                </span>
                                                <Button variant="outline" size="sm" onClick={() => setDeletedPage(p => Math.min(totalDeletedPages, p + 1))} disabled={deletedPage === totalDeletedPages}>
                                                    Próxima
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                                        <Trash2 className="mx-auto h-12 w-12" />
                                        <h3 className="mt-4 text-lg font-semibold">A lixeira está vazia</h3>
                                        <p className="mt-1 text-sm">Os pedidos excluídos aparecerão aqui.</p>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>

            <div className="hidden print-only">
                <div className="mb-8">
                    <div className="flex justify-between items-start pb-4 border-b">
                        <div className="flex items-center">
                            <Logo />
                            <div className="w-2" />
                            <div className="text-xs">
                                <p className="font-bold">{settings.storeName}</p>
                                <p className="whitespace-pre-line">{settings.storeAddress}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-bold">Relatório de Pedidos em Atraso</p>
                            <p className="text-sm text-gray-500">Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
                        </div>
                    </div>
                </div>
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="border-b-2">
                            <th className="text-left p-2 font-bold">Cliente</th>
                            <th className="text-left p-2 font-bold">Telefone</th>
                            <th className="text-left p-2 font-bold">Pedido</th>
                            <th className="text-left p-2 font-bold">Parcela</th>
                            <th className="text-right p-2 font-bold">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        {overdueOrdersForReport.length > 0 ? (
                            overdueOrdersForReport.map(({ order, overdueInstallment }) => (
                                <tr key={order.id} className="border-b last:border-none">
                                    <td className="p-2">{order.customer.name}</td>
                                    <td className="p-2">{order.customer.phone}</td>
                                    <td className="p-2 font-mono">{order.id}</td>
                                    <td className="p-2">
                                        {overdueInstallment.installmentNumber} (Venc. {format(parseISO(overdueInstallment.dueDate), 'dd/MM/yy')})
                                    </td>
                                    <td className="text-right p-2 font-semibold">
                                        {formatCurrency(overdueInstallment.amount - (overdueInstallment.paidAmount || 0))}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5} className="text-center p-8">Nenhum pedido em atraso encontrado.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <OrderEditDialog
                open={isDetailModalOpen}
                onOpenChange={setIsDetailModalOpen}
                order={selectedOrder}
            />

            {installmentToPay && selectedOrder && (
                <PaymentDialog
                    isOpen={paymentDialogOpen}
                    onOpenChange={setPaymentDialogOpen}
                    installment={installmentToPay}
                    orderId={selectedOrder.id}
                    customerName={selectedOrder.customer.name}
                    onSubmit={handlePaymentSubmit}
                />
            )}

            <PendingOrderReviewDialog 
                isOpen={!!selectedPendingOrder} 
                onClose={() => setSelectedPendingOrder(null)} 
                order={selectedPendingOrder} 
                onSuccess={() => {
                    fetchPendingOrders();
                    refreshOrders();
                }} 
            />
        </>
    );
}
