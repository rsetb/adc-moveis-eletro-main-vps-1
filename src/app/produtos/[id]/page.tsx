'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, CreditCard, Info, Minus, Plus, ShoppingCart, Store, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { useData } from '@/context/DataContext';
import { useSettings } from '@/context/SettingsContext';
import CountdownTimer from '@/components/CountdownTimer';
import PublicPageLayout from '@/app/(public)/layout';
import ProductCard from '@/components/ProductCard';
import { WhatsAppIcon } from '@/components/WhatsAppIcon';
import { buildWhatsAppLink } from '@/lib/whatsapp-link';
import { cn } from '@/lib/utils';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const PLACEHOLDER = 'https://placehold.co/600x600.png';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToCart, setIsCartOpen } = useCart();
  const { products, categories, isLoading: isProductsLoading } = useData();
  const { settings } = useSettings();
  const id = params.id as string;

  const [imageIndex, setImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const mobileGalleryRef = useRef<HTMLDivElement>(null);

  const product = useMemo(() => {
    if (isProductsLoading || !products) return null;
    return products.find(p => p.id === id) || null;
  }, [id, products, isProductsLoading]);

  const categoryName = useMemo(() => {
    if (!product) return '';
    return categories.find(c => c.id === product.category)?.name || product.category;
  }, [product, categories]);

  const similarProducts = useMemo(() => {
    if (!product || !products) return [];
    const base = products.filter(p => !p.isHidden && p.id !== product.id && p.stock > 0);
    const sameCat = (p: typeof product) =>
      (categories.find(c => c.id === p.category)?.name || p.category || '').toLowerCase() === categoryName.toLowerCase();
    const bySub = base.filter(p => p.subcategory && product.subcategory && p.subcategory.toLowerCase() === product.subcategory.toLowerCase());
    const byCat = base.filter(sameCat);
    return (bySub.length >= 4 ? bySub : byCat)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 12);
  }, [product, products, categories, categoryName]);

  if (isProductsLoading) {
    return (
      <PublicPageLayout>
        <div className="container mx-auto py-24 text-center text-muted-foreground">Carregando produto...</div>
      </PublicPageLayout>
    );
  }

  if (!product) {
    return (
      <PublicPageLayout>
        <div className="container mx-auto py-24 text-center">
          <h1 className="text-2xl font-bold">Produto não encontrado</h1>
          <p className="text-muted-foreground mt-2">O produto que você está procurando não existe ou foi removido.</p>
          <Button onClick={() => router.push('/')} className="mt-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para a loja
          </Button>
        </div>
      </PublicPageLayout>
    );
  }

  const images = product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls : [PLACEHOLDER];
  const currentImage = images[Math.min(imageIndex, images.length - 1)];
  const isOutOfStock = product.stock <= 0;
  const isLowStock = !isOutOfStock && product.stock <= 3;
  const maxInstallments = product.maxInstallments ?? 1;
  const installmentValue = maxInstallments > 1 ? product.price / maxInstallments : 0;
  const isOnSale = !!product.onSale && typeof product.originalPrice === 'number' && product.originalPrice > product.price;
  const discountPct = isOnSale ? Math.round((1 - product.price / product.originalPrice!) * 100) : 0;
  const showCountdown = product.onSale && product.promotionEndDate && new Date(product.promotionEndDate) > new Date();
  const code = product.code?.replace(/^ITEM-/i, '');

  const zonesWithFee = (settings.deliveryZones ?? []).filter(z => z.fee > 0);
  const deliverySub = [
    settings.storeCity,
    zonesWithFee.length > 0
      ? zonesWithFee.map(z => `${z.name}: taxa de ${formatCurrency(z.fee)}`).join(' · ')
      : null,
  ].filter(Boolean).join(' · ') || 'Consulte sua região';

  const productUrl = typeof window !== 'undefined' ? window.location.href : '';
  const waLink = buildWhatsAppLink(
    settings.storePhone,
    `Olá! Tenho interesse no produto: ${product.name}${code ? ` (cód. ${code})` : ''} — ${formatCurrency(product.price)}. ${productUrl}`.trim()
  );

  const specs = [
    code && { k: 'Código', v: code },
    categoryName && { k: 'Departamento', v: categoryName },
    product.subcategory && { k: 'Categoria', v: product.subcategory },
    product.dimensions && { k: 'Dimensões', v: product.dimensions },
    product.unit && { k: 'Unidade', v: product.unit },
  ].filter(Boolean) as { k: string; v: string }[];

  const handleAddToCart = () => {
    addToCart(product, quantity);
    setIsCartOpen(true);
  };

  const handleBuyNow = () => {
    addToCart(product, quantity);
    setIsCartOpen(false);
    router.push('/checkout');
  };

  const goToImage = (i: number) => {
    const next = (i + images.length) % images.length;
    setImageIndex(next);
    const el = mobileGalleryRef.current;
    if (el) el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
  };

  const priceBlock = (
    <div className="flex flex-col gap-1.5">
      {isOnSale && (
        <span className="text-sm text-muted-foreground">
          de <span className="line-through">{formatCurrency(product.originalPrice!)}</span> por
        </span>
      )}
      <span className="flex items-baseline gap-2">
        <span className="text-3xl md:text-4xl font-extrabold leading-none">{formatCurrency(product.price)}</span>
        <span className="text-sm font-semibold text-foreground/70">à vista</span>
      </span>
      {installmentValue > 0 && (
        <span className="mt-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 px-3 py-2.5 text-sm md:text-[15px] text-emerald-800 dark:text-emerald-300">
          ou <strong>{maxInstallments}x de {formatCurrency(installmentValue)}</strong> no crediário próprio
        </span>
      )}
      {product.paymentCondition && (
        <span className="mt-1 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-[13px] text-amber-900 dark:text-amber-200">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          {product.paymentCondition}
        </span>
      )}
    </div>
  );

  const stockLine = (
    <div className="flex items-center gap-2 text-sm">
      <span className={cn('h-2.5 w-2.5 rounded-full', isOutOfStock ? 'bg-gray-400' : isLowStock ? 'bg-amber-500' : 'bg-green-600')} />
      {isOutOfStock ? (
        <span className="font-bold text-muted-foreground">Produto indisponível no momento</span>
      ) : isLowStock ? (
        <span className="font-bold text-amber-700 dark:text-amber-400">Últimas {product.stock} {product.stock === 1 ? 'unidade' : 'unidades'}</span>
      ) : (
        <span className="font-bold text-green-700 dark:text-green-400">Em estoque <span className="font-normal text-muted-foreground">· pronta entrega</span></span>
      )}
    </div>
  );

  const perks = (
    <div className="border rounded-xl divide-y bg-card">
      {[
        { icon: Truck, title: 'Entrega própria', sub: deliverySub },
        { icon: CreditCard, title: 'Crediário próprio', sub: 'Compre sem cartão de crédito' },
        { icon: Store, title: 'Loja física', sub: settings.storeAddress || 'Veja o produto pessoalmente' },
      ].map(({ icon: Icon, title, sub }) => (
        <div key={title} className="flex items-center gap-3 px-3.5 py-3">
          <span className="h-9 w-9 flex-shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <span className="flex flex-col min-w-0">
            <span className="text-sm font-bold">{title}</span>
            <span className="text-xs md:text-[13px] text-muted-foreground">{sub}</span>
          </span>
        </div>
      ))}
    </div>
  );

  const whatsappButton = waLink && (
    <a
      href={waLink}
      target="_blank"
      rel="noopener noreferrer"
      className="h-12 rounded-xl bg-green-100 hover:bg-green-200 dark:bg-green-950 dark:hover:bg-green-900 text-green-800 dark:text-green-300 font-bold flex items-center justify-center gap-2 transition-colors"
    >
      <WhatsAppIcon className="h-5 w-5" />
      Comprar pelo WhatsApp
    </a>
  );

  return (
    <PublicPageLayout>
      <div className="container mx-auto px-0 md:px-4 pt-0 md:pt-4 pb-36 md:pb-10 flex flex-col gap-3 md:gap-5">

        {/* Caminho */}
        <nav aria-label="Caminho" className="hidden md:flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
          <Link href="/" className="hover:text-primary">Início</Link>
          {categoryName && (
            <>
              <span>›</span>
              <Link href={`/?cat=${encodeURIComponent(categoryName)}#catalog`} className="hover:text-primary capitalize">{categoryName}</Link>
            </>
          )}
          {product.subcategory && (
            <>
              <span>›</span>
              <Link href={`/?cat=${encodeURIComponent(categoryName)}&sub=${encodeURIComponent(product.subcategory)}#catalog`} className="hover:text-primary capitalize">{product.subcategory}</Link>
            </>
          )}
          <span>›</span>
          <span className="text-foreground line-clamp-1">{product.name}</span>
        </nav>

        <section className="bg-card md:rounded-2xl md:p-7 flex flex-col md:flex-row md:justify-between gap-0 md:gap-10 md:items-start">

          {/* Galeria */}
          <div className="w-full md:max-w-[640px] md:flex-1 min-w-0">
            {/* Celular: título acima da foto */}
            <div className="md:hidden px-4 pt-3 pb-2 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground capitalize">
                {[categoryName, product.subcategory].filter(Boolean).join(' › ')}{code ? ` · Cód. ${code}` : ''}
              </span>
              <h1 className="text-lg font-bold leading-snug">{product.name}</h1>
            </div>

            {/* Celular: carrossel com deslize */}
            <div className="md:hidden px-4">
              <div className="relative">
                <div
                  ref={mobileGalleryRef}
                  className="flex overflow-x-auto snap-x snap-mandatory rounded-xl bg-muted/40 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    const i = Math.round(el.scrollLeft / el.clientWidth);
                    if (i !== imageIndex) setImageIndex(i);
                  }}
                >
                  {images.map((url, i) => (
                    <div key={i} className="relative w-full flex-shrink-0 snap-center aspect-square">
                      <Image
                        src={url}
                        alt={`${product.name} - imagem ${i + 1}`}
                        fill
                        className={cn('object-contain p-2', isOutOfStock && 'grayscale opacity-60')}
                        sizes="100vw"
                        priority={i === 0}
                        unoptimized={url.startsWith('data:')}
                      />
                    </div>
                  ))}
                </div>
                {discountPct > 0 && (
                  <span className="absolute top-2.5 left-2.5 bg-red-700 text-white text-xs font-extrabold px-2 py-1 rounded-md">-{discountPct}%</span>
                )}
                {isOutOfStock && (
                  <span className="absolute top-2.5 left-2.5 bg-gray-600 text-white text-xs font-bold px-2 py-1 rounded-md">Esgotado</span>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex justify-center gap-1.5 py-3">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Ver foto ${i + 1}`}
                      onClick={() => goToImage(i)}
                      className={cn('h-1.5 rounded-full transition-all', i === imageIndex ? 'w-5 bg-primary' : 'w-1.5 bg-gray-300')}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Computador: miniaturas + foto principal */}
            <div className="hidden md:flex gap-3.5 items-start">
              {images.length > 1 && (
                <div className="flex flex-col gap-2.5 max-h-[540px] overflow-y-auto">
                  {images.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Ver foto ${i + 1}`}
                      onClick={() => setImageIndex(i)}
                      onMouseEnter={() => setImageIndex(i)}
                      className={cn(
                        'relative h-[76px] w-[76px] flex-shrink-0 rounded-lg overflow-hidden bg-muted/40',
                        i === imageIndex ? 'border-2 border-primary' : 'border border-border hover:border-primary/60'
                      )}
                    >
                      <Image src={url} alt="" fill className="object-contain p-1" sizes="76px" unoptimized={url.startsWith('data:')} />
                    </button>
                  ))}
                </div>
              )}
              <div className="relative flex-1 min-w-0 max-w-[540px] aspect-square rounded-xl bg-muted/40 overflow-hidden">
                <Image
                  src={currentImage}
                  alt={product.name}
                  fill
                  className={cn('object-contain p-4', isOutOfStock && 'grayscale opacity-60')}
                  sizes="540px"
                  priority
                  unoptimized={currentImage.startsWith('data:')}
                />
                {isOutOfStock ? (
                  <span className="absolute top-3.5 left-3.5 bg-gray-600 text-white text-sm font-bold px-2.5 py-1 rounded-md">Esgotado</span>
                ) : discountPct > 0 ? (
                  <span className="absolute top-3.5 left-3.5 bg-red-700 text-white text-sm font-extrabold px-2.5 py-1 rounded-md">-{discountPct}%</span>
                ) : null}
                {images.length > 1 && (
                  <>
                    <button type="button" aria-label="Foto anterior" onClick={() => goToImage(imageIndex - 1)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 shadow flex items-center justify-center text-gray-800 hover:bg-white">
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button type="button" aria-label="Próxima foto" onClick={() => goToImage(imageIndex + 1)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 shadow flex items-center justify-center text-gray-800 hover:bg-white">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <span className="absolute bottom-3.5 right-3.5 bg-white border text-xs text-gray-700 px-2.5 py-1 rounded-full">
                      {imageIndex + 1} / {images.length}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Caixa de compra */}
          <div className="w-full md:max-w-[520px] md:flex-1 min-w-0 flex flex-col gap-4 px-4 pb-4 md:p-0">
            <div className="hidden md:flex flex-col gap-1.5">
              <h1 className="text-2xl font-bold leading-tight">{product.name}</h1>
              <span className="text-[13px] text-muted-foreground capitalize">
                {code ? `Código: ${code} · ` : ''}{[categoryName, product.subcategory].filter(Boolean).join(' › ')}
              </span>
            </div>

            <div className="md:border md:rounded-xl md:p-5">{priceBlock}</div>

            {showCountdown && <CountdownTimer endDate={product.promotionEndDate!} />}

            {stockLine}

            {!isOutOfStock && (
              <div className="hidden md:flex items-center gap-3">
                <span className="text-sm font-semibold">Quantidade</span>
                <span className="flex items-center border rounded-lg h-11">
                  <button type="button" aria-label="Diminuir quantidade" disabled={quantity <= 1}
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="h-11 w-11 flex items-center justify-center disabled:opacity-40">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-9 text-center font-bold tabular-nums" aria-live="polite">{quantity}</span>
                  <button type="button" aria-label="Aumentar quantidade" disabled={quantity >= product.stock}
                    onClick={() => setQuantity(q => Math.min(product.stock, q + 1))}
                    className="h-11 w-11 flex items-center justify-center disabled:opacity-40">
                    <Plus className="h-4 w-4" />
                  </button>
                </span>
              </div>
            )}

            <div className="hidden md:flex flex-col gap-2.5">
              {isOutOfStock ? (
                <button type="button" disabled className="h-14 rounded-xl bg-muted text-muted-foreground font-bold">Produto indisponível</button>
              ) : (
                <>
                  <button type="button" onClick={handleBuyNow}
                    className="h-14 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-[17px] font-extrabold transition-colors">
                    Comprar agora
                  </button>
                  <button type="button" onClick={handleAddToCart}
                    className="h-12 rounded-xl border-2 border-primary text-primary font-bold hover:bg-primary/5 flex items-center justify-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Adicionar ao carrinho
                  </button>
                </>
              )}
              {whatsappButton}
            </div>

            <div className="md:hidden">{whatsappButton}</div>

            {perks}
          </div>
        </section>

        {/* Descrição + ficha técnica */}
        {(product.longDescription || product.description || specs.length > 0) && (
          <section className="flex flex-col lg:flex-row gap-3 md:gap-5 items-stretch lg:items-start">
            {(product.longDescription || product.description) && (
              <div className="flex-[2] min-w-0 bg-card md:rounded-2xl p-4 md:p-7 flex flex-col gap-3">
                <h2 className="text-lg md:text-[22px] font-extrabold">Informações do produto</h2>
                {product.description && product.description !== product.longDescription && (
                  <p className="text-[15px] font-medium text-foreground/90">{product.description}</p>
                )}
                {product.longDescription && (
                  <p className="text-sm md:text-[15px] leading-relaxed text-foreground/80 whitespace-pre-line">{product.longDescription}</p>
                )}
              </div>
            )}
            {specs.length > 0 && (
              <div className="flex-1 min-w-0 lg:max-w-[420px] bg-card md:rounded-2xl p-4 md:p-7 flex flex-col gap-3">
                <h2 className="text-lg md:text-[22px] font-extrabold">Ficha técnica</h2>
                <dl className="border rounded-lg overflow-hidden text-sm">
                  {specs.map((s, i) => (
                    <div key={s.k} className={cn('flex gap-3 px-3.5 py-2.5', i % 2 === 0 && 'bg-muted/50')}>
                      <dt className="w-32 flex-shrink-0 text-muted-foreground">{s.k}</dt>
                      <dd className="font-semibold capitalize">{s.v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </section>
        )}

        {/* Similares */}
        {similarProducts.length > 0 && (
          <section className="bg-card md:rounded-2xl py-4 md:p-5 flex flex-col gap-3">
            <div className="flex items-center px-4 md:px-0">
              <h2 className="text-lg md:text-[22px] font-extrabold">Você também pode gostar</h2>
              {categoryName && (
                <Link href={`/?cat=${encodeURIComponent(categoryName)}#catalog`} className="ml-auto text-sm font-bold text-primary hover:underline">
                  Ver todos
                </Link>
              )}
            </div>
            <div className="flex gap-2.5 md:gap-3 overflow-x-auto snap-x px-4 md:px-0 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {similarProducts.map(sp => (
                <div key={sp.id} className="snap-start flex-shrink-0 w-[150px] sm:w-[170px] md:w-[calc((100%-60px)/6)] md:min-w-[170px]">
                  <ProductCard product={sp} variant="compact" />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Celular: barra de compra fixa acima do menu inferior */}
      <div className="md:hidden fixed inset-x-0 bottom-16 z-40 bg-card border-t px-3 py-2.5 flex items-center gap-2.5 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] print-hidden">
        <span className="flex flex-col flex-shrink-0">
          <span className="text-lg font-extrabold leading-tight">{formatCurrency(product.price)}</span>
          {installmentValue > 0 && (
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">ou {maxInstallments}x {formatCurrency(installmentValue)}</span>
          )}
        </span>
        {isOutOfStock ? (
          <button type="button" disabled className="flex-1 h-12 rounded-xl bg-muted text-muted-foreground font-bold">Indisponível</button>
        ) : (
          <>
            <button type="button" aria-label="Adicionar ao carrinho" onClick={handleAddToCart}
              className="h-12 w-12 flex-shrink-0 rounded-xl border-2 border-primary text-primary flex items-center justify-center">
              <ShoppingCart className="h-5 w-5" />
            </button>
            <button type="button" onClick={handleBuyNow}
              className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground text-base font-extrabold">
              Comprar
            </button>
          </>
        )}
      </div>
    </PublicPageLayout>
  );
}
