'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/context/PermissionsContext';
import { hasAccess } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import type { AppSection } from '@/lib/types';
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
    ChevronDown,
    QrCode,
    TrendingUp,
    type LucideIcon,
} from 'lucide-react';

// ─── Nav definitions ──────────────────────────────────────────────────────────

type NavItem = {
    id: AppSection;
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
}

export default function AdminSidebarNav({ onNavigate }: AdminSidebarNavProps) {
    const pathname = usePathname();
    const { user } = useAuth();
    const { permissions } = usePermissions();

    // collapsed state: undefined = open, true = collapsed
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    if (!user || !permissions) return null;

    const toggle = (groupId: string) =>
        setCollapsed(prev => ({ ...prev, [groupId]: !prev[groupId] }));

    return (
        <nav className="px-2 space-y-1">
            {GROUPS.map((group, groupIndex) => {
                const visibleItems = group.items.filter(item =>
                    hasAccess(user.role, item.id, permissions)
                );
                if (visibleItems.length === 0) return null;

                const isOpen = !collapsed[group.id];
                const hasActive = visibleItems.some(item =>
                    pathname.startsWith(`/admin/${item.id}`)
                );

                return (
                    <div key={group.id}>
                        {/* Divider between groups */}
                        {groupIndex > 0 && (
                            <div className="mx-3 my-2 border-t border-sidebar-border/50" />
                        )}

                        {/* Group header (collapsible) */}
                        <button
                            onClick={() => toggle(group.id)}
                            className={cn(
                                'flex w-full items-center justify-between px-3 py-1.5 rounded-md transition-colors duration-150',
                                'hover:bg-sidebar-accent/60',
                                hasActive && !isOpen
                                    ? 'text-sidebar-foreground/80'
                                    : 'text-sidebar-foreground/40',
                            )}
                        >
                            <span className="text-[10px] font-bold uppercase tracking-widest select-none">
                                {group.label}
                            </span>
                            <ChevronDown
                                className={cn(
                                    'h-3 w-3 transition-transform duration-200 text-sidebar-foreground/40',
                                    !isOpen && '-rotate-90',
                                )}
                            />
                        </button>

                        {/* Items */}
                        <div
                            className={cn(
                                'overflow-hidden transition-all duration-200',
                                isOpen ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0',
                            )}
                        >
                            <div className="space-y-0.5 pt-0.5 pb-1">
                                {visibleItems.map(item => {
                                    const Icon = item.icon;
                                    const isActive = pathname.startsWith(`/admin/${item.id}`);

                                    return (
                                        <Link
                                            key={item.id}
                                            href={`/admin/${item.id}`}
                                            onClick={onNavigate}
                                            className={cn(
                                                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                                                'transition-all duration-150',
                                                isActive
                                                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                                                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                                            )}
                                        >
                                            <Icon className="h-4 w-4 flex-shrink-0" />
                                            <span className="truncate">{item.label}</span>
                                            {/* Active dot indicator */}
                                            {isActive && (
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
