'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/context/PermissionsContext';
import { hasAccess } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import type { AppSection } from '@/lib/types';
import { getPendingOrdersCountAction } from '@/app/actions/admin/pending-orders';
import { getFreightAccessAction } from '@/app/actions/admin/freight';
import {
    LayoutDashboard,
    ShoppingCart,
    CreditCard,
    PlusCircle,
    ClipboardList,
    Users,
    Package,
    Tag,
    AlertTriangle,
    BarChart3,
    BadgePercent,
    FolderOpen,
    Warehouse,
    Settings,
    UserCog,
    Landmark,
    FileSearch,
    QrCode,
    TrendingUp,
    Truck,
    type LucideIcon,
} from 'lucide-react';

// ─── Nav definitions ──────────────────────────────────────────────────────────

type NavItem = {
    id: AppSection | 'fretes';
    label: string;
    icon: LucideIcon;
};

type NavGroup = {
    id: string;
    label: string;
    items: NavItem[];
};

const GROUPS: NavGroup[] = [
    {
        id: 'geral',
        label: 'Geral',
        items: [
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ],
    },
    {
        id: 'vendas',
        label: 'Vendas',
        items: [
            { id: 'pedidos',      label: 'Pedidos',      icon: ShoppingCart },
            { id: 'criar-pedido', label: 'Nova Venda',   icon: PlusCircle   },
            { id: 'clientes',     label: 'Clientes',     icon: Users        },
            { id: 'solicitacoes', label: 'Solicitações', icon: ClipboardList },
        ],
    },
    {
        id: 'cobranca',
        label: 'Cobrança / Crediário',
        items: [
            { id: 'cobrancas',        label: 'Cobranças', icon: CreditCard   },
            { id: 'minhas-comissoes', label: 'Comissões', icon: BadgePercent },
        ],
    },
    {
        id: 'catalogo',
        label: 'Estoque',
        items: [
            { id: 'produtos',    label: 'Produtos',    icon: Package      },
            { id: 'categorias',  label: 'Categorias',  icon: Tag          },
            { id: 'estoque',     label: 'Estoque',     icon: Warehouse    },
            { id: 'avarias',     label: 'Avarias',     icon: AlertTriangle },
        ],
    },
    {
        id: 'financeiro',
        label: 'Financeiro',
        items: [
            { id: 'financeiro',   label: 'Financeiro',   icon: BarChart3 },
            { id: 'caixa',        label: 'Caixa Diário', icon: Landmark },
            { id: 'validar-pix',  label: 'Validar PIX',  icon: QrCode },
            { id: 'fretes', label: 'Pagamentos de frete', icon: Truck },
        ],
    },
    {
        id: 'relatorios',
        label: 'Relatórios',
        items: [
            { id: 'relatorios-vendas',      label: 'Vendas',      icon: TrendingUp  },
            { id: 'relatorios-produtos',    label: 'Produtos',    icon: Package     },
            { id: 'relatorios-clientes',    label: 'Clientes',    icon: Users       },
            { id: 'relatorios-financeiro',  label: 'Financeiro',  icon: BarChart3   },
        ],
    },
    {
        id: 'admin',
        label: 'Administração',
        items: [
            { id: 'pastas',      label: 'Documentos',   icon: FolderOpen },
            { id: 'auditoria',   label: 'Auditoria',    icon: FileSearch },
            { id: 'usuarios',    label: 'Usuários',     icon: UserCog    },
            { id: 'configuracao', label: 'Configurações', icon: Settings },
        ],
    },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface AdminSidebarNavProps {
    onNavigate?: () => void;
    sidebarCollapsed?: boolean;
}

export default function AdminSidebarNav({ onNavigate, sidebarCollapsed }: AdminSidebarNavProps) {
    const pathname = usePathname();
    const { user } = useAuth();
    const { permissions } = usePermissions();
    const [pendingCount, setPendingCount] = useState(0);
    const [freightAllowed, setFreightAllowed] = useState(false);

    useEffect(() => {
        let active = true;
        setFreightAllowed(false);
        const refresh = () => {
            if (!user) return;
            getFreightAccessAction().then(result => {
                if (active) setFreightAllowed(result.allowed);
            }).catch(() => { if (active) setFreightAllowed(false); });
        };
        refresh();
        window.addEventListener('freight-access-updated', refresh);
        window.addEventListener('focus', refresh);
        return () => {
            active = false;
            window.removeEventListener('freight-access-updated', refresh);
            window.removeEventListener('focus', refresh);
        };
    }, [user?.id]);

    useEffect(() => {
        getPendingOrdersCountAction().then(setPendingCount);
    }, []);

    useEffect(() => {
        const handleOrderUpdated = () => {
            getPendingOrdersCountAction().then(setPendingCount);
        };
        window.addEventListener('order-updated', handleOrderUpdated);
        return () => window.removeEventListener('order-updated', handleOrderUpdated);
    }, []);

    if (!user || !permissions) return null;

    return (
        <nav className={cn('space-y-1', sidebarCollapsed ? 'lg:px-1 px-2' : 'px-2')}>
            {GROUPS.map((group, groupIndex) => {
                const visibleItems = group.items.filter(item =>
                    item.id === 'fretes' ? freightAllowed : hasAccess(user.role, item.id, permissions)
                );
                if (visibleItems.length === 0) return null;

                return (
                    <div key={group.id}>
                        {/* Divider between groups */}
                        {groupIndex > 0 && (
                            <div className={cn(
                                'my-2 border-t border-sidebar-border/50',
                                sidebarCollapsed ? 'lg:mx-1 mx-3' : 'mx-3',
                            )} />
                        )}

                        {/* Group header — hidden when sidebar is collapsed on desktop */}
                        <div
                            className={cn(
                                'flex w-full items-center px-3 py-1.5',
                                'text-sidebar-foreground/40',
                                sidebarCollapsed && 'lg:hidden',
                            )}
                        >
                            <span className="text-[10px] font-bold uppercase tracking-widest select-none">
                                {group.label}
                            </span>
                        </div>

                        {/* Items */}
                        <div>
                            <div className="space-y-0.5 pt-0.5 pb-1">
                                {visibleItems.map(item => {
                                    const Icon = item.icon;
                                    const isActive = pathname.startsWith(`/admin/${item.id}`);

                                    return (
                                        <Link
                                            key={item.id}
                                            href={`/admin/${item.id}`}
                                            onClick={onNavigate}
                                            title={sidebarCollapsed ? item.label : undefined}
                                            className={cn(
                                                'flex items-center rounded-lg text-sm font-medium',
                                                'transition-all duration-150',
                                                sidebarCollapsed
                                                    ? 'lg:justify-center lg:px-0 lg:py-2.5 gap-3 px-3 py-2'
                                                    : 'gap-3 px-3 py-2',
                                                isActive
                                                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                                                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                                            )}
                                        >
                                            <div className="relative flex-shrink-0">
                                                <Icon className="h-4 w-4" />
                                                {item.id === 'solicitacoes' && pendingCount > 0 && (
                                                    <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
                                                        {pendingCount > 9 ? '9+' : pendingCount}
                                                    </span>
                                                )}
                                            </div>
                                            <span className={cn(
                                                'truncate',
                                                sidebarCollapsed && 'lg:hidden',
                                            )}>
                                                {item.label}
                                            </span>
                                            {item.id === 'solicitacoes' && pendingCount > 0 && !sidebarCollapsed && (
                                                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                                    {pendingCount}
                                                </span>
                                            )}
                                            {/* Active dot — hidden when collapsed or when badge is showing */}
                                            {isActive && !sidebarCollapsed && item.id !== 'solicitacoes' && (
                                                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary-foreground/70 flex-shrink-0" />
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })}
        </nav>
    );
}
