'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { PermissionsProvider } from '@/context/PermissionsContext';
import { AdminProvider } from '@/context/AdminContext';
import AdminSidebarNav from '@/components/AdminSidebarNav';
import { PriceChangeAlerts } from '@/components/PriceChangeAlerts';
import { useAuth } from '@/context/AuthContext';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
    Building2,
    ChevronDown,
    LogOut,
    Menu,
    Moon,
    Store,
    Sun,
    X,
} from 'lucide-react';
import type { UserRole } from '@/lib/types';

const ROLE_LABELS: Record<UserRole, string> = {
    admin: 'Administrador',
    gerente: 'Gerente',
    vendedor: 'Vendedor',
    vendedor_externo: 'Vendedor Externo',
    vendedor_cobranca: 'Vendedor Cobrança',
};

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
    const { user, logout, isLoading } = useAuth();
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const router = useRouter();

    const isDark = mounted && resolvedTheme === 'dark';
    const userRoleLabel = useMemo(() => (user?.role ? (ROLE_LABELS[user.role] ?? user.role) : ''), [user?.role]);
    const userInitial = useMemo(() => user?.name?.charAt(0)?.toUpperCase() ?? '?', [user?.name]);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (!isLoading && !user) {
            router.replace('/login');
        }
    }, [isLoading, user, router]);

    if (!user) return null;

    return (
        <PermissionsProvider>
            <AdminProvider>
                <div className="flex h-screen overflow-hidden bg-background">

                    {/* ── Mobile overlay ── */}
                    {sidebarOpen && (
                        <div
                            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                            onClick={() => setSidebarOpen(false)}
                        />
                    )}

                    {/* ── Sidebar ── */}
                    <aside className={cn(
                        'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground',
                        'transform transition-transform duration-200 ease-in-out',
                        'lg:static lg:z-auto lg:translate-x-0',
                        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
                    )}>
                        {/* Brand */}
                        <div className="flex h-16 items-center gap-3 px-5 border-b border-sidebar-border flex-shrink-0">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary flex-shrink-0">
                                <Building2 className="h-4 w-4 text-white" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-sidebar-foreground truncate">ADC ERP</p>
                                <p className="text-[11px] text-sidebar-foreground/50 truncate">Painel Administrativo</p>
                            </div>
                            <button
                                onClick={() => setSidebarOpen(false)}
                                className="lg:hidden p-1 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Nav */}
                        <div className="flex-1 overflow-y-auto py-4 sidebar-scroll">
                            <AdminSidebarNav onNavigate={() => setSidebarOpen(false)} />
                        </div>

                        {/* User footer */}
                        <div className="border-t border-sidebar-border p-3 flex-shrink-0">
                            <div className="flex items-center gap-3 rounded-lg px-2 py-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-sm font-semibold text-sidebar-foreground flex-shrink-0">
                                    {userInitial}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate text-sidebar-foreground">{user.name}</p>
                                    <p className="text-[11px] text-sidebar-foreground/50 truncate">{userRoleLabel}</p>
                                </div>
                                <button
                                    onClick={logout}
                                    className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
                                    title="Sair"
                                >
                                    <LogOut className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </aside>

                    {/* ── Right column ── */}
                    <div className="flex flex-1 flex-col overflow-hidden min-w-0">

                        {/* ── Topbar ── */}
                        <header className="flex h-16 items-center gap-3 bg-card px-4 lg:px-6 flex-shrink-0 shadow-[0_1px_0_0_hsl(var(--border))]">
                            {/* Hamburger */}
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-muted transition-colors"
                                aria-label="Abrir menu"
                            >
                                <Menu className="h-5 w-5" />
                            </button>

                            {/* Mobile brand */}
                            <div className="flex items-center gap-2 lg:hidden">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                                    <Building2 className="h-3.5 w-3.5 text-white" />
                                </div>
                                <span className="text-sm font-bold">ADC ERP</span>
                            </div>

                            <div className="flex-1" />

                            {/* Back to store */}
                            <Link
                                href="/"
                                className="hidden sm:inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
                            >
                                <Store className="h-4 w-4" />
                                <span>Loja</span>
                            </Link>

                            {/* Theme toggle */}
                            <button
                                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                aria-label="Alternar tema"
                            >
                                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                            </button>

                            {/* User dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 hover:bg-muted/70 transition-colors">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-sm">
                                            {userInitial}
                                        </div>
                                        <div className="hidden sm:block text-left">
                                            <p className="text-sm font-semibold leading-tight">{user.name.split(' ')[0]}</p>
                                            <p className="text-[10px] text-muted-foreground leading-tight">{userRoleLabel}</p>
                                        </div>
                                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                    <DropdownMenuLabel>
                                        <div>
                                            <p className="font-semibold">{user.name}</p>
                                            <p className="text-xs text-muted-foreground font-normal">{userRoleLabel}</p>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem asChild>
                                        <Link href="/">
                                            <Store className="mr-2 h-4 w-4" />
                                            Ver Loja
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={logout}
                                        className="text-destructive focus:text-destructive"
                                    >
                                        <LogOut className="mr-2 h-4 w-4" />
                                        Sair
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </header>

                        {/* ── Main content ── */}
                        <main className="flex-1 overflow-y-auto bg-background">
                            <div className="p-5 lg:p-7 space-y-1">
                                <PriceChangeAlerts />
                            </div>
                            <div className="px-5 lg:px-7 pb-8">
                                {children}
                            </div>
                        </main>
                    </div>
                </div>
            </AdminProvider>
        </PermissionsProvider>
    );
}
