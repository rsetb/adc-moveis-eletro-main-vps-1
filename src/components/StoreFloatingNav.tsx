'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, LayoutGrid, ShoppingCart, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { useSettings } from '@/context/SettingsContext';
import { WhatsAppIcon } from './WhatsAppIcon';
import { buildWhatsAppLink } from '@/lib/whatsapp-link';
import { cn } from '@/lib/utils';

/** Botão flutuante de WhatsApp + menu inferior fixo (somente celular). */
export default function StoreFloatingNav() {
  const { settings } = useSettings();
  const { cartCount, setIsCartOpen, setIsFilterSheetOpen } = useCart();
  const { customer } = useCustomerAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);

  const waLink = buildWhatsAppLink(
    settings.storePhone,
    `Olá! Vim pelo site da ${settings.storeName || 'loja'} e gostaria de atendimento.`
  );
  const customerLink = isClient && customer ? '/area-cliente/minha-conta' : '/area-cliente/login';

  const itemCls = 'flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold';

  return (
    <>
      {waLink && (
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Falar no WhatsApp"
          className="fixed z-50 right-4 bottom-20 md:bottom-6 h-14 pl-4 pr-5 rounded-full bg-green-700 hover:bg-green-800 text-white font-bold flex items-center gap-2 shadow-lg shadow-green-900/30 print-hidden"
        >
          <WhatsAppIcon className="h-6 w-6" />
          <span className="text-[15px]">WhatsApp</span>
        </a>
      )}

      <nav
        aria-label="Navegação principal"
        className="md:hidden fixed bottom-0 inset-x-0 z-50 h-16 bg-card border-t grid grid-cols-4 print-hidden"
      >
        <Link href="/" className={cn(itemCls, pathname === '/' ? 'text-primary' : 'text-muted-foreground')}>
          <Home className="h-5 w-5" />
          Início
        </Link>
        <button
          type="button"
          className={cn(itemCls, 'text-muted-foreground')}
          onClick={() => {
            if (pathname !== '/') router.push('/');
            setIsFilterSheetOpen(true);
          }}
        >
          <LayoutGrid className="h-5 w-5" />
          Departamentos
        </button>
        <button type="button" className={cn(itemCls, 'text-muted-foreground relative')} onClick={() => setIsCartOpen(true)}>
          <ShoppingCart className="h-5 w-5" />
          Carrinho
          {isClient && cartCount > 0 && (
            <span className="absolute top-1.5 left-1/2 ml-2 min-w-[18px] h-[18px] px-1 rounded-full bg-yellow-400 text-gray-900 text-[10px] font-extrabold flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>
        <Link href={customerLink} className={cn(itemCls, pathname.startsWith('/area-cliente') ? 'text-primary' : 'text-muted-foreground')}>
          <User className="h-5 w-5" />
          Conta
        </Link>
      </nav>
    </>
  );
}
