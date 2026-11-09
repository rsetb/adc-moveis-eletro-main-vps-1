'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import type { Product } from '@/lib/types';
import { ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  /** compact: usado nas vitrines horizontais (sem botão) */
  variant?: 'default' | 'compact';
  className?: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export default function ProductCard({ product, variant = 'default', className }: ProductCardProps) {
  const { addToCart, setIsCartOpen } = useCart();

  const handleAddToCart = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
    setIsCartOpen(true);
  };

  const imageUrl = (product.imageUrls && product.imageUrls.length > 0)
    ? product.imageUrls[0]
    : 'https://placehold.co/600x600.png';

  const maxInstallments = product.maxInstallments ?? 1;
  const isOnSale = !!product.onSale && typeof product.originalPrice === 'number' && product.originalPrice > product.price;
  const installmentValue = maxInstallments > 1 ? product.price / maxInstallments : 0;
  const discountPct = isOnSale ? Math.round((1 - product.price / product.originalPrice!) * 100) : 0;

  const isOutOfStock = product.stock <= 0;
  const isLowStock = !isOutOfStock && product.stock <= 3;
  const compact = variant === 'compact';

  return (
    <Link
      href={`/produtos/${product.id}`}
      aria-label={`Ver detalhes de ${product.name}`}
      className={cn(
        'group flex flex-col h-full bg-card rounded-xl border border-border/70 transition-shadow hover:shadow-lg',
        compact ? 'p-2.5 gap-1' : 'p-3 gap-1.5',
        className
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-white">
        <Image
          src={imageUrl}
          alt={product.name}
          fill
          className={cn(
            'object-contain p-2 transition-transform duration-500 group-hover:scale-105',
            isOutOfStock && 'grayscale opacity-60'
          )}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          unoptimized={imageUrl.startsWith('data:')}
        />
        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
          {isOutOfStock ? (
            <span className="bg-gray-600 text-white text-[11px] font-bold px-1.5 py-0.5 rounded">Esgotado</span>
          ) : discountPct > 0 ? (
            <span className="bg-red-700 text-white text-[11px] font-extrabold px-1.5 py-0.5 rounded">-{discountPct}%</span>
          ) : null}
        </div>
      </div>

      <h3 className={cn('text-foreground/80 leading-snug line-clamp-2 mt-1', compact ? 'text-xs min-h-[32px]' : 'text-[13px] min-h-[36px]')}>
        {product.name}
      </h3>

      <div className="flex flex-col gap-0.5 mt-auto">
        {isOnSale && (
          <span className="text-[11px] text-muted-foreground line-through">{formatCurrency(product.originalPrice!)}</span>
        )}
        <span className={cn('font-extrabold text-foreground leading-none', compact ? 'text-base' : 'text-lg md:text-xl')}>
          {formatCurrency(product.price)}{' '}
          <span className="text-[11px] font-semibold text-foreground/70">à vista</span>
        </span>
        {installmentValue > 0 && (
          <span className="text-[11px] md:text-xs font-bold text-emerald-700 dark:text-emerald-400">
            ou {maxInstallments}x de {formatCurrency(installmentValue)} no crediário
          </span>
        )}
        {!compact && isLowStock && (
          <span className="self-start mt-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
            Últimas unidades
          </span>
        )}
      </div>

      {!compact && (
        isOutOfStock ? (
          <span className="mt-2 h-10 rounded-lg bg-muted text-muted-foreground text-sm font-semibold flex items-center justify-center">
            Indisponível
          </span>
        ) : (
          <button
            type="button"
            onClick={handleAddToCart}
            className="mt-2 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-primary/90 active:scale-95 transition"
          >
            <ShoppingCart className="h-4 w-4" />
            Comprar
          </button>
        )
      )}
    </Link>
  );
}
