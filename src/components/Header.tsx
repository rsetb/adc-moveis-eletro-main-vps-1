

'use client';

import Link from 'next/link';
import Logo from './Logo';
import { useCart } from '@/context/CartContext';
import { useData } from '@/context/DataContext';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { useAuth } from '@/context/AuthContext';
import { Button, buttonVariants } from './ui/button';
import { ShoppingBag, User, Search, Sun, Moon } from 'lucide-react';
import { CartSheet } from './CartSheet';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { Input } from './ui/input';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Switch } from './ui/switch';
import TopCategoriesNav from './TopCategoriesNav';

export default function Header() {
  const { cartCount, headerSearch, setHeaderSearch } = useCart();
  const { categories } = useData();
  const { customer } = useCustomerAuth();
  const { user: adminUser } = useAuth();
  const [isClient, setIsClient] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    setShowMobileSearch(false);
  }, [pathname]);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pathname !== '/') {
      router.push('/');
    }
  };

  const customerLink = isClient && customer ? "/area-cliente/minha-conta" : "/area-cliente/login";
  const isDark = isClient && resolvedTheme === 'dark';

  const goToCategory = (cat: string, sub?: string) => {
    const params = new URLSearchParams();
    params.set('cat', cat);
    if (sub) params.set('sub', sub);
    const qs = params.toString();
    const target = '/' + (qs ? `?${qs}` : '') + '#catalog';
    console.debug('Header: goToCategory', { cat, sub, qs, pathname });
    if (pathname === '/') {
      // Already on home — use replace to force searchParams update
      router.replace(target);
    } else {
      router.push(target);
    }
  };

  return (
    <div className="bg-card/80 backdrop-blur-lg border-b sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center p-4 gap-4 relative z-20">
        <Link href="/" className="relative z-50">
          <Logo />
        </Link>

        <div className="flex-grow max-w-2xl hidden md:flex items-center gap-2">
          <div className="flex-1">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produtos..."
                  className="pl-10"
                  value={headerSearch}
                  onChange={(e) => setHeaderSearch(e.target.value)}
                />
              </div>
            </form>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setShowMobileSearch((v) => !v)}
            aria-label="Abrir busca"
          >
            <Search />
          </Button>
          <div className="hidden md:flex items-center gap-2 pr-1">
            <Sun className="h-4 w-4 text-muted-foreground" aria-hidden />
            <Switch
              checked={!!isDark}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              aria-label="Alternar tema claro/escuro"
            />
            <Moon className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
          <Link href={customerLink} className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "sm:w-auto sm:px-4")}>
            <User className="sm:mr-2" />
            <span className="hidden sm:inline">Área do Cliente</span>
          </Link>
          {isClient && (
            <CartSheet>
              <Button variant="ghost" className="relative sm:w-auto sm:px-4">
                <ShoppingBag className="sm:mr-2" />
                <span className="hidden sm:inline">Carrinho</span>
                {cartCount > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold leading-none text-primary-foreground transform translate-x-1/2 -translate-y-1/2 bg-accent rounded-full">
                    {cartCount}
                  </span>
                )}
              </Button>
            </CartSheet>
          )}
        </div>
      </div>
      <div className="hidden md:block bg-primary text-primary-foreground relative z-[60] shadow-sm">
        <TopCategoriesNav categories={categories} onSelect={goToCategory} />
      </div>
      {showMobileSearch && (
        <div className="container mx-auto px-4 pb-4 md:hidden">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produtos..."
                className="pl-10"
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
              />
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
