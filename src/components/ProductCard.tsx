'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Badge } from './ui/badge';
import { useCart } from '@/context/CartContext';
import type { Product } from '@/lib/types';
import { ShoppingCart } from 'lucide-react';
import CountdownTimer from './CountdownTimer';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart, setIsCartOpen } = useCart();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleAddToCart = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    addToCart(product);
    setIsCartOpen(true);
  };

  const imageUrl = (product.imageUrls && product.imageUrls.length > 0)
    ? product.imageUrls[0]
    : 'https://placehold.co/600x600.png';

  const maxInstallments = product.maxInstallments ?? 1;
  const isOnSale = product.onSale && typeof product.originalPrice === 'number' && product.originalPrice > 0;
  const displayPrice = isOnSale ? product.originalPrice! : product.price;
  const installmentValue = maxInstallments > 1 ? displayPrice / maxInstallments : 0;
  const showCountdown = product.onSale && product.promotionEndDate && new Date(product.promotionEndDate) > new Date();

  const discountPct = isOnSale
    ? Math.round((1 - product.originalPrice! / product.price) * 100)
    : 0;

  const isLowStock = product.stock > 0 && product.stock <= 3;

  return (
    <Link href={`/produtos/${product.id}`} className="block h-full" aria-label={`Ver detalhes de ${product.name}`}>
      <Card className="flex flex-col overflow-hidden h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group">
        <CardHeader className="p-0 relative">
          {/* Badges de status */}
          <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
            {isOnSale && discountPct > 0 && (
              <Badge className="bg-destructive text-destructive-foreground text-xs font-bold px-2 py-0.5 shadow">
                -{discountPct}%
              </Badge>
            )}
            {isLowStock && (
              <Badge className="bg-amber-500 text-white text-xs px-2 py-0.5 shadow">
                Últimas unidades
              </Badge>
            )}
          </div>

          {/* Imagem com zoom no hover */}
          <div className="relative aspect-square w-full overflow-hidden bg-muted/30">
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              className="object-contain p-3 transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              data-ai-hint={product['data-ai-hint']}
              unoptimized={imageUrl.startsWith('data:')}
            />
          </div>
        </CardHeader>

        <CardContent className="p-4 flex flex-col flex-grow">
          <div className="flex items-center gap-1 mb-2 flex-wrap">
            <Badge variant="secondary" className="capitalize text-xs">{product.category}</Badge>
            {product.subcategory && (
              <Badge variant="outline" className="capitalize text-xs">{product.subcategory}</Badge>
            )}
          </div>

          <CardTitle className="text-sm md:text-base font-semibold leading-snug min-h-[40px] line-clamp-2">
            {product.name}
          </CardTitle>

          {showCountdown && <CountdownTimer endDate={product.promotionEndDate!} />}

          <CardDescription className="text-xs text-muted-foreground mt-1 min-h-[32px] line-clamp-2">
            {product.description}
          </CardDescription>

          <div className="mt-3 pt-3 border-t border-border/50">
            {isOnSale && (
              <p className="text-xs text-muted-foreground line-through">
                De {formatCurrency(product.price)}
              </p>
            )}
            <p className="text-xl font-bold text-primary leading-tight">
              {formatCurrency(displayPrice)}
            </p>
            {installmentValue > 0 && (
              <p className="text-xs text-accent font-semibold mt-0.5">
                {maxInstallments}x de {formatCurrency(installmentValue)} sem juros
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="p-4 pt-0 mt-auto">
          {product.stock > 0 ? (
            <Button
              onClick={handleAddToCart}
              className="w-full bg-accent hover:bg-accent/90 transition-all duration-200 active:scale-95"
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              Adicionar ao Carrinho
            </Button>
          ) : (
            <Button disabled onClick={(e) => e.preventDefault()} className="w-full" variant="secondary">
              Indisponível
            </Button>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
}
