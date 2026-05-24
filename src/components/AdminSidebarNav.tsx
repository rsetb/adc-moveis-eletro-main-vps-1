'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/context/PermissionsContext';
import { hasAccess, ALL_SECTIONS } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import type { AppSection } from '@/lib/types';
import {
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
    LucideIcon,
} from 'lucide-react';

const SECTION_ICONS: Partial<Record<AppSection, LucideIcon>> = {
    pedidos: ShoppingCart,
    cobrancas: CreditCard,
    'criar-pedido': PlusCircle,
    solicitacoes: ClipboardList,
    clientes: Users,
    produtos: Package,
    categorias: Tag,
    avarias: AlertTriangle,
    financeiro: BarChart3,
    'minhas-comissoes': BadgePercent,
    pastas: FolderOpen,
    estoque: Warehouse,
    caixa: Landmark,
    auditoria: FileSearch,
    configuracao: Settings,
    usuarios: UserCog,
};

interface AdminSidebarNavProps {
    onNavigate?: () => void;
}

export default function AdminSidebarNav({ onNavigate }: AdminSidebarNavProps) {
    const pathname = usePathname();
    const { user } = useAuth();
    const { permissions } = usePermissions();

    if (!user || !permissions) return null;

    const accessibleItems = ALL_SECTIONS.filter(item => hasAccess(user.role, item.id, permissions));

    return (
        <nav className="px-3 space-y-0.5">
            {accessibleItems.map(item => {
                const Icon = SECTION_ICONS[item.id] ?? Package;
                const isActive = pathname.startsWith(`/admin/${item.id}`);

                return (
                    <Link
                        key={item.id}
                        href={`/admin/${item.id}`}
                        onClick={onNavigate}
                        className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                            isActive
                                ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                        )}
                    >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
