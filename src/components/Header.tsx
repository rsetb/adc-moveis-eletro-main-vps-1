'use client';

import Link from 'next/link';
import Logo from './Logo';
import { useCart } from '@/context/CartContext';
import { useData } from '@/context/DataContext';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { useSettings } from '@/context/SettingsContext';
import { ShoppingCart, User, Search, MapPin, Menu } from 'lucide-react';
import { CartSheet } from './CartSheet';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import TopCategoriesNav from './TopCategoriesNav';
import { displayText } from '@/lib/display-text';

export default function Header() {
  const { cartCount, headerSearch, setHeaderSearch, setIsFilterSheetOpen } = useCart();
  const { categories } = useData();
  const { customer } = useCustomerAuth();
  const { settings } = useSettings();
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pathname !== '/') {
      router.push('/#catalog');
    } else {
      document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const customerLink = isClient && customer ? '/area-cliente/minha-conta' : '/area-cliente/login';
  const firstName = isClient && customer?.name ? customer.name.split(' ')[0] : null;

  const goToCategory = (cat: string, sub?: string) => {
    const params = new URLSearchParams();
    params.set('cat', cat);
    if (sub) params.set('sub', sub);
    const target = `/?${params.toString()}#catalog`;
    if (pathname === '/') {
      router.replace(target);
    } else {
      router.push(target);
    }
  };

  const openDepartments = () => {
    if (pathname !== '/') router.push('/');
    setIsFilterSheetOpen(true);
  };

  const searchInput = (id: string) => (
    <form onSubmit={handleSearch} className="w-full">
      <label htmlFor={id} className="sr-only">Buscar produtos</label>
      <div className="flex items-center bg-white rounded-lg h-11 md:h-12 pl-4 pr-1.5">
        <input
          id={id}
          placeholder="Busque por sofá, geladeira, colchão…"
          className="flex-1 bg-transparent outline-none text-[15px] text-gray-900 placeholder:text-gray-500"
          value={headerSearch}
          onChange={(e) => setHeaderSearch(e.target.value)}
        />
        <button
          type="submit"
          aria-label="Buscar"
          className="h-9 w-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>
    </form>
  );

  return (
    <div className="sticky top-0 z-50 print-hidden">
      {/* Faixa superior (desktop) */}
      <div className="hidden md:block bg-blue-900 text-blue-100 text-xs">
        <div className="container mx-auto px-4 py-1.5 flex justify-between gap-4">
          <span>Crediário próprio · Compre sem cartão de crédito</span>
          <span className="flex gap-5">
            <Link href={customerLink} className="hover:text-white">Acompanhar pedido</Link>
            {settings.storePhone && (
              <a href={`tel:${settings.storePhone.replace(/\D/g, '')}`} className="hover:text-white">
                Atendimento: {settings.storePhone}
              </a>
            )}
          </span>
        </div>
      </div>

      <header className="bg-primary text-primary-foreground shadow-md">
        <div className="container mx-auto px-2 md:px-4 py-2 md:py-4 flex items-center gap-2 md:gap-6">
          <button
            type="button"
            aria-label="Departamentos"
            className="md:hidden h-11 w-11 flex items-center justify-center"
            onClick={openDepartments}
          >
            <Menu className="h-6 w-6" />
          </button>

          <Link href="/" className="flex-shrink-0 mr-auto md:mr-0">
            <Logo onDark />
          </Link>

          <div className="hidden md:block flex-1 max-w-2xl">{searchInput('busca-desktop')}</div>

          {settings.storeCity && (
            <span className="hidden lg:flex items-center gap-2 text-xs leading-tight">
              <MapPin className="h-5 w-5" />
              <span>Entregamos em<br /><strong className="text-sm">{displayText(settings.storeCity)}</strong></span>
            </span>
          )}

          <Link href={customerLink} className="flex items-center gap-2 h-11 px-2 text-xs leading-tight">
            <User className="h-6 w-6" />
            <span className="hidden md:inline">
              {firstName ? <>Olá, {firstName}<br /><strong className="text-sm">Minha conta</strong></> : <>Bem-vindo :)<br /><strong className="text-sm">Entre ou cadastre-se</strong></>}
            </span>
          </Link>

          {isClient && (
            <CartSheet>
              <button type="button" aria-label={`Carrinho, ${cartCount} itens`} className="relative h-11 w-11 flex items-center justify-center">
                <ShoppingCart className="h-6 w-6" />
                {cartCount > 0 && (
                  <span className="absolute top-0.5 right-0 min-w-[18px] h-[18px] px-1 rounded-full bg-yellow-400 text-gray-900 text-[11px] font-extrabold flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>
            </CartSheet>
          )}
        </div>

        {/* Busca sempre visível no celular */}
        <div className="md:hidden px-3 pb-3">{searchInput('busca-mobile')}</div>

        <nav aria-label="Departamentos" className="hidden md:block border-t border-white/15 relative z-[60]">
          <TopCategoriesNav categories={categories} onSelect={goToCategory} />
        </nav>
      </header>

      {settings.storeCity && (
        <div className="md:hidden bg-blue-900 text-blue-100 text-xs px-4 py-2 flex items-center gap-1.5">
          <MapPin className="h-4 w-4" />
          Entregamos em <strong className="text-white">{displayText(settings.storeCity)}</strong>
        </div>
      )}
    </div>
  );
}
