'use client';

import { useState, useMemo, useEffect, useCallback, Suspense, useRef } from 'react';
import type { Product, Category } from '@/lib/types';
import ProductCard from '@/components/ProductCard';
import Image from 'next/image';
import Link from 'next/link';
import FilterSheet from '@/components/FilterSheet';
import { useData } from '@/context/DataContext';
import { useSettings } from '@/context/SettingsContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useCart } from '@/context/CartContext';
import { useSearchParams } from 'next/navigation';
import {
  PackageSearch, ChevronLeft, ChevronRight, SlidersHorizontal, Flame,
  Sofa, Refrigerator, WashingMachine, BedDouble, CookingPot, AirVent, Tv, Armchair,
  Smartphone, Package, Microwave, Fan, Lamp, Baby, Bike, Tag, Truck, CreditCard, Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

const PAGE_SIZE = 20;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const normalize = (s: string) => {
  if (!s) return '';
  let n = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  n = n.replace(/s$/, '');
  n = n.replace(/is$/, 'el');
  n = n.replace(/oes$/, 'ao');
  return n;
};

const isSale = (p: Product) => !!p.onSale && typeof p.originalPrice === 'number' && p.originalPrice > p.price;
const discountOf = (p: Product) => (isSale(p) ? 1 - p.price / p.originalPrice! : 0);

const plain = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const ICON_RULES: [RegExp, LucideIcon][] = [
  [/sofa|estofad/, Sofa],
  [/geladeira|refrigerador|freezer/, Refrigerator],
  [/lavar|lavadora|lavanderia|tanquinho/, WashingMachine],
  [/colch|cama|quarto|dormitorio/, BedDouble],
  [/cozinha|fogao|cooktop|panela/, CookingPot],
  [/micro/, Microwave],
  [/ar.?condicionado|climatiza/, AirVent],
  [/ventilador/, Fan],
  [/tv|televis|sala|rack|painel/, Tv],
  [/celular|smartphone|telefon/, Smartphone],
  [/movel|moveis|cadeira|poltrona|mesa/, Armchair],
  [/ilumina|lumin|abajur/, Lamp],
  [/bebe|infantil/, Baby],
  [/bicicleta|bike/, Bike],
  [/eletro/, Refrigerator],
  [/oferta|promo/, Tag],
];

const iconFor = (name: string): LucideIcon => {
  const n = plain(name);
  return ICON_RULES.find(([re]) => re.test(n))?.[1] ?? Package;
};

const MINI_TONES = [
  'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
  'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
  'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200',
];

const PRICE_RANGES = [
  { id: 'all', label: 'Todos os preços', min: 0, max: Infinity },
  { id: '0-500', label: 'Até R$ 500', min: 0, max: 500 },
  { id: '500-1000', label: 'R$ 500 a R$ 1.000', min: 500, max: 1000 },
  { id: '1000-2000', label: 'R$ 1.000 a R$ 2.000', min: 1000, max: 2000 },
  { id: '2000+', label: 'Acima de R$ 2.000', min: 2000, max: Infinity },
];

const SORTS = [
  { id: 'newest', label: 'Novidades' },
  { id: 'price-asc', label: 'Menor preço' },
  { id: 'price-desc', label: 'Maior preço' },
  { id: 'discount', label: 'Maior desconto' },
];

function FiltersFromSearchParams({ apply }: { apply: (cat?: string, sub?: string) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    apply(searchParams.get('cat') || undefined, searchParams.get('sub') || undefined);
  }, [searchParams, apply]);
  return null;
}

/* ---------- Countdown compacto ---------- */
function useCountdown(endDate?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endDate) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [endDate]);
  if (!endDate) return null;
  const diff = +new Date(endDate) - now;
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff / 3600000) % 24);
  const m = Math.floor((diff / 60000) % 60);
  const s = Math.floor((diff / 1000) % 60);
  return { d, h, m, s };
}

function CountdownBadge({ endDate }: { endDate?: string }) {
  const t = useCountdown(endDate);
  if (!t) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const box = 'bg-red-700 text-white font-extrabold px-1.5 py-0.5 rounded tabular-nums';
  return (
    <span className="flex items-center gap-1 text-xs text-foreground/70">
      termina em
      {t.d > 0 && <><span className={box}>{t.d}d</span></>}
      <span className={box}>{pad(t.h)}</span>:<span className={box}>{pad(t.m)}</span>:<span className={box}>{pad(t.s)}</span>
    </span>
  );
}

/* ---------- Vitrine horizontal ---------- */
function Shelf({
  title, products, action, extra, icon,
}: {
  title: string;
  products: Product[];
  action?: () => void;
  extra?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  if (products.length === 0) return null;
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' });
  };
  return (
    <section className="bg-card md:rounded-2xl py-4 md:p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3 px-3 md:px-0 flex-wrap">
        <h2 className="text-lg md:text-2xl font-extrabold flex items-center gap-2">{icon}{title}</h2>
        {extra}
        <div className="ml-auto flex items-center gap-2">
          {action && (
            <button type="button" onClick={action} className="text-sm font-bold text-primary hover:underline">
              Ver todos
            </button>
          )}
          <button type="button" aria-label="Anterior" onClick={() => scroll(-1)} className="hidden md:flex h-10 w-10 rounded-full border items-center justify-center hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" aria-label="Próximo" onClick={() => scroll(1)} className="hidden md:flex h-10 w-10 rounded-full border items-center justify-center hover:bg-muted">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div ref={ref} className="flex gap-2.5 md:gap-3 overflow-x-auto snap-x px-3 md:px-0 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {products.map(p => (
          <div key={p.id} className="snap-start flex-shrink-0 w-[150px] sm:w-[170px] md:w-[calc((100%-60px)/6)] md:min-w-[170px]">
            <ProductCard product={p} variant="compact" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const { products: allProducts, categories, isLoading } = useData();
  const { settings } = useSettings();
  const { headerSearch, setHeaderSearch, setIsFilterSheetOpen } = useCart();

  const [filters, setFilters] = useState({
    category: 'all',
    subcategory: 'all',
    search: '',
    sort: 'newest',
    price: 'all',
    onlyInStock: false,
    onlySale: false,
  });
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    setFilters(prev => ({ ...prev, search: headerSearch }));
  }, [headerSearch]);

  const applyFromSearch = useCallback((cat?: string, sub?: string) => {
    setFilters(prev => {
      if (cat === 'ofertas') return { ...prev, category: 'all', subcategory: 'all', onlySale: true };
      if (cat || sub) {
        return {
          ...prev,
          category: cat ?? prev.category,
          subcategory: sub ?? (cat === 'all' ? 'all' : prev.subcategory),
          onlySale: cat === 'all' ? false : prev.onlySale,
        };
      }
      return { ...prev, category: 'all', subcategory: 'all' };
    });
  }, []);

  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    setFilters(prev => {
      const updated = { ...prev, ...newFilters };
      if (newFilters.category && newFilters.category !== prev.category && newFilters.subcategory === undefined) {
        updated.subcategory = 'all';
      }
      return updated;
    });
    if (newFilters.search !== undefined) setHeaderSearch(newFilters.search);
  };

  // Volta para a primeira página sempre que os filtros mudam
  useEffect(() => setVisible(PAGE_SIZE), [filters]);

  const goToCatalog = (patch: Partial<typeof filters>) => {
    handleFilterChange(patch);
    requestAnimationFrame(() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }));
  };

  const visibleProducts = useMemo(() => allProducts.filter(p => !p.isHidden), [allProducts]);

  const categoryIdMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
  const categoryOf = useCallback((p: Product) => categoryIdMap.get(p.category) || p.category, [categoryIdMap]);

  /* ---------- Vitrines ---------- */
  const deals = useMemo(
    () => visibleProducts.filter(p => isSale(p) && p.stock > 0).sort((a, b) => discountOf(b) - discountOf(a)).slice(0, 12),
    [visibleProducts]
  );

  const dealsEnd = useMemo(() => {
    const ends = deals
      .map(p => p.promotionEndDate)
      .filter((d): d is string => !!d && new Date(d) > new Date())
      .sort();
    return ends[0];
  }, [deals]);

  const newest = useMemo(
    () => visibleProducts
      .filter(p => p.stock > 0)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 12),
    [visibleProducts]
  );

  // Categorias com mais produtos em estoque (para mini-banners e vitrines)
  const topCategories = useMemo(() => {
    const count = new Map<string, number>();
    visibleProducts.forEach(p => {
      if (p.stock <= 0) return;
      const c = normalize(categoryOf(p));
      count.set(c, (count.get(c) ?? 0) + 1);
    });
    return [...categories]
      .map(c => ({ cat: c, n: count.get(normalize(c.name)) ?? 0 }))
      .filter(x => x.n > 0)
      .sort((a, b) => b.n - a.n);
  }, [categories, visibleProducts, categoryOf]);

  const categoryShelves = useMemo(
    () => topCategories.slice(0, 2).map(({ cat }) => ({
      cat,
      items: visibleProducts
        .filter(p => p.stock > 0 && normalize(categoryOf(p)) === normalize(cat.name))
        .sort((a, b) => discountOf(b) - discountOf(a) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 12),
    })),
    [topCategories, visibleProducts, categoryOf]
  );

  const maxInstallments = useMemo(
    () => visibleProducts.reduce((m, p) => Math.max(m, p.maxInstallments ?? 1), 1),
    [visibleProducts]
  );

  const heroProduct = deals[0] ?? newest[0];

  /* ---------- Catálogo filtrado ---------- */
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = [...visibleProducts];

    if (filters.category !== 'all') {
      const catF = normalize(filters.category);
      filtered = filtered.filter(p => p.category && normalize(categoryOf(p)) === catF);
    }
    if (filters.subcategory !== 'all') {
      const subF = normalize(filters.subcategory);
      filtered = filtered.filter(p => p.subcategory && normalize(p.subcategory) === subF);
    }
    if (filters.search) {
      const terms = plain(filters.search).split(/\s+/).filter(Boolean).map(t => t.replace(/s$/, ''));
      filtered = filtered.filter(p => {
        const hay = plain(`${p.name} ${p.code ?? ''} ${categoryOf(p)} ${p.subcategory ?? ''}`);
        return terms.every(t => hay.includes(t));
      });
    }
    const range = PRICE_RANGES.find(r => r.id === filters.price);
    if (range && range.id !== 'all') {
      filtered = filtered.filter(p => p.price >= range.min && p.price < range.max);
    }
    if (filters.onlyInStock) filtered = filtered.filter(p => p.stock > 0);
    if (filters.onlySale) filtered = filtered.filter(isSale);

    const sortArray = (arr: Product[]) => {
      switch (filters.sort) {
        case 'price-asc': return arr.sort((a, b) => a.price - b.price);
        case 'price-desc': return arr.sort((a, b) => b.price - a.price);
        case 'discount': return arr.sort((a, b) => discountOf(b) - discountOf(a));
        default: return arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
    };

    const available = filtered.filter(p => p.stock > 0);
    const unavailable = filtered.filter(p => p.stock <= 0);
    return [...sortArray(available), ...sortArray(unavailable)];
  }, [filters, visibleProducts, categoryOf]);

  const isBrowsing =
    filters.category !== 'all' || filters.subcategory !== 'all' || !!filters.search ||
    filters.onlySale || filters.price !== 'all' || filters.onlyInStock;

  const activeCategory: Category | undefined = categories.find(c => normalize(c.name) === normalize(filters.category));

  const catalogTitle = filters.search
    ? `Resultados para "${filters.search}"`
    : filters.category !== 'all'
      ? `${filters.category}${filters.subcategory !== 'all' ? ` › ${filters.subcategory}` : ''}`
      : filters.onlySale ? 'Ofertas' : 'Todos os produtos';

  const clearFilters = () => handleFilterChange({
    category: 'all', subcategory: 'all', search: '', price: 'all', onlyInStock: false, onlySale: false,
  });

  /* ---------- Sidebar de filtros ---------- */
  const radioCls = 'h-4 w-4 accent-[hsl(var(--primary))]';
  const FiltersPanel = (
    <div className="flex flex-col gap-6 text-sm">
      <div className="flex flex-col gap-2">
        <span className="font-extrabold text-[15px]">Departamento</span>
        <button type="button" onClick={() => handleFilterChange({ category: 'all', subcategory: 'all' })}
          className={cn('text-left py-1 hover:text-primary', filters.category === 'all' && 'font-bold text-primary')}>
          Todos
        </button>
        {categories.map(c => (
          <div key={c.id} className="flex flex-col">
            <button type="button" onClick={() => handleFilterChange({ category: c.name, subcategory: 'all' })}
              className={cn('text-left py-1 capitalize hover:text-primary', normalize(filters.category) === normalize(c.name) && 'font-bold text-primary')}>
              {c.name}
            </button>
            {normalize(filters.category) === normalize(c.name) && c.subcategories.length > 0 && (
              <div className="ml-3 pl-3 border-l flex flex-col">
                {c.subcategories.map(sub => (
                  <button key={sub} type="button" onClick={() => handleFilterChange({ category: c.name, subcategory: sub })}
                    className={cn('text-left py-1 capitalize text-foreground/80 hover:text-primary', filters.subcategory === sub && 'font-bold text-primary')}>
                    {sub}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="font-extrabold text-[15px] mb-2">Preço</legend>
        {PRICE_RANGES.map(r => (
          <label key={r.id} className="flex items-center gap-2.5 min-h-[28px] cursor-pointer">
            <input type="radio" name="preco" className={radioCls} checked={filters.price === r.id}
              onChange={() => handleFilterChange({ price: r.id })} />
            {r.label}
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="font-extrabold text-[15px] mb-2">Disponibilidade</legend>
        <label className="flex items-center gap-2.5 min-h-[28px] cursor-pointer">
          <input type="checkbox" className={radioCls} checked={filters.onlyInStock}
            onChange={e => handleFilterChange({ onlyInStock: e.target.checked })} />
          Somente em estoque
        </label>
        <label className="flex items-center gap-2.5 min-h-[28px] cursor-pointer">
          <input type="checkbox" className={radioCls} checked={filters.onlySale}
            onChange={e => handleFilterChange({ onlySale: e.target.checked })} />
          Em promoção
        </label>
      </fieldset>
      {isBrowsing && (
        <button type="button" onClick={clearFilters} className="h-10 rounded-lg border font-semibold hover:bg-muted">
          Limpar filtros
        </button>
      )}
    </div>
  );

  const ProductGridSkeleton = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 md:gap-3">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="bg-card rounded-xl p-3 flex flex-col gap-2">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      ))}
    </div>
  );

  return (
    <>
      <Suspense>
        <FiltersFromSearchParams apply={applyFromSearch} />
      </Suspense>
      <FilterSheet categories={categories} onFilterChange={handleFilterChange} currentFilters={filters} />

      <div className="container mx-auto px-0 md:px-4 py-3 md:py-5 flex flex-col gap-4 md:gap-6">
        {!isBrowsing && !isLoading && (
          <>
            {/* Hero */}
            <section className="mx-3 md:mx-0 rounded-2xl bg-blue-900 text-white overflow-hidden grid md:grid-cols-[1.2fr_1fr] items-center">
              <div className="p-6 md:p-12 flex flex-col gap-3 md:gap-4">
                <span className="self-start bg-yellow-300 text-yellow-950 text-[11px] md:text-xs font-extrabold px-2.5 py-1 rounded">
                  CREDIÁRIO PRÓPRIO
                </span>
                <h1 className="text-2xl md:text-5xl font-extrabold leading-tight">
                  {maxInstallments > 1 ? <>Sua casa nova em até {maxInstallments}x no crediário</> : <>Sua casa nova com as melhores condições</>}
                </h1>
                <p className="text-blue-100 md:text-lg">
                  Móveis e eletros {settings.storeCity ? <>com entrega em {settings.storeCity}</> : 'com entrega própria'}.
                </p>
                <div className="flex flex-wrap gap-2 mt-1">
                  <button type="button" onClick={() => goToCatalog({ onlySale: deals.length > 0 })}
                    className="bg-yellow-300 text-yellow-950 font-extrabold px-5 md:px-6 h-11 md:h-12 rounded-lg hover:bg-yellow-200">
                    {deals.length > 0 ? 'Ver ofertas' : 'Ver produtos'}
                  </button>
                </div>
              </div>
              {heroProduct && (
                <Link href={`/produtos/${heroProduct.id}`} className="hidden md:block relative h-full min-h-[300px] bg-white/5">
                  <Image
                    src={heroProduct.imageUrls?.[0] || 'https://placehold.co/600x600.png'}
                    alt={heroProduct.name}
                    fill
                    className="object-contain p-8"
                    sizes="40vw"
                    priority
                    unoptimized={(heroProduct.imageUrls?.[0] || '').startsWith('data:')}
                  />
                  <span className="absolute bottom-4 left-4 right-4 bg-white text-gray-900 rounded-xl px-4 py-3 shadow-lg flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold line-clamp-1">{heroProduct.name}</span>
                    <span className="font-extrabold whitespace-nowrap">{formatCurrency(heroProduct.price)}</span>
                  </span>
                </Link>
              )}
            </section>

            {/* Vantagens */}
            <section aria-label="Vantagens" className="mx-3 md:mx-0 flex md:grid md:grid-cols-3 gap-2 md:gap-3 overflow-x-auto [scrollbar-width:none]">
              {[
                { icon: CreditCard, title: 'Crediário próprio', sub: 'Compre sem cartão' },
                { icon: Truck, title: 'Entrega própria', sub: settings.storeCity || 'Consulte sua região' },
                { icon: Store, title: 'Loja física', sub: settings.storeAddress || 'Venha nos visitar' },
              ].map(({ icon: Icon, title, sub }) => (
                <div key={title} className="flex-shrink-0 flex items-center gap-3 bg-card rounded-xl px-4 py-3">
                  <span className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Icon className="h-5 w-5" /></span>
                  <span className="flex flex-col">
                    <span className="font-bold text-sm">{title}</span>
                    <span className="text-xs text-muted-foreground line-clamp-1">{sub}</span>
                  </span>
                </div>
              ))}
            </section>

            {/* Departamentos */}
            {categories.length > 0 && (
              <section aria-label="Departamentos" className="md:bg-card md:rounded-2xl md:p-5">
                <div className="flex md:grid md:grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3 md:gap-2 overflow-x-auto px-3 md:px-0 [scrollbar-width:none]">
                  {categories.map(c => {
                    const Icon = iconFor(c.name);
                    return (
                      <button key={c.id} type="button" onClick={() => goToCatalog({ category: c.name, subcategory: 'all' })}
                        className="flex-shrink-0 w-[72px] md:w-auto flex flex-col items-center gap-1.5 group">
                        <span className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-card md:bg-primary/10 text-primary flex items-center justify-center transition group-hover:bg-primary group-hover:text-primary-foreground">
                          <Icon className="h-7 w-7 md:h-8 md:w-8" strokeWidth={1.7} />
                        </span>
                        <span className="text-xs md:text-[13px] font-semibold text-center capitalize leading-tight line-clamp-2">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Ofertas do dia */}
            <Shelf
              title="Ofertas do dia"
              icon={<Flame className="h-6 w-6 text-red-600" />}
              products={deals}
              extra={<CountdownBadge endDate={dealsEnd} />}
              action={() => goToCatalog({ onlySale: true, sort: 'discount' })}
            />

            {/* Mini-banners por departamento */}
            {topCategories.length > 0 && (
              <section aria-label="Departamentos em destaque" className="mx-3 md:mx-0 grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
                {topCategories.slice(0, 4).map(({ cat, n }, i) => (
                  <button key={cat.id} type="button" onClick={() => goToCatalog({ category: cat.name, subcategory: 'all' })}
                    className={cn('text-left rounded-xl md:rounded-2xl p-4 md:p-5 flex flex-col gap-1 min-h-[88px] md:min-h-[110px] hover:brightness-95 transition', MINI_TONES[i % MINI_TONES.length])}>
                    <span className="text-[11px] md:text-xs font-extrabold tracking-wide uppercase">{cat.name}</span>
                    <span className="text-[15px] md:text-lg font-extrabold leading-tight text-foreground">
                      {cat.subcategories.length > 0 ? cat.subcategories.slice(0, 2).join(' e ') : `${n} produtos disponíveis`}
                    </span>
                    <span className="text-xs md:text-sm font-bold mt-auto">Ver produtos →</span>
                  </button>
                ))}
              </section>
            )}

            <Shelf title="Novidades" products={newest} action={() => goToCatalog({ sort: 'newest' })} />

            {categoryShelves.map(({ cat, items }) => (
              <Shelf
                key={cat.id}
                title={`Destaques em ${cat.name}`}
                products={items}
                action={() => goToCatalog({ category: cat.name, subcategory: 'all' })}
              />
            ))}
          </>
        )}

        {/* Catálogo */}
        <section id="catalog" className="scroll-mt-40 flex gap-5 items-start px-3 md:px-0">
          <aside aria-label="Filtros" className="hidden lg:block w-60 flex-shrink-0 bg-card rounded-2xl p-5 sticky top-44">
            {FiltersPanel}
          </aside>

          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg md:text-2xl font-extrabold capitalize">{catalogTitle}</h2>
                {!isLoading && (
                  <span className="text-sm text-muted-foreground">
                    {filteredAndSortedProducts.length} {filteredAndSortedProducts.length === 1 ? 'produto' : 'produtos'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button type="button" onClick={() => setIsFilterSheetOpen(true)}
                  className="lg:hidden flex-1 sm:flex-none h-11 px-4 rounded-lg border bg-card font-bold text-sm flex items-center justify-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" /> Filtrar
                </button>
                <label htmlFor="ordem" className="sr-only sm:not-sr-only text-sm text-muted-foreground whitespace-nowrap">Ordenar por</label>
                <select id="ordem" value={filters.sort} onChange={e => handleFilterChange({ sort: e.target.value })}
                  className="flex-1 sm:flex-none h-11 rounded-lg border bg-card px-3 text-sm font-semibold">
                  {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>

            {/* Chips de subcategoria */}
            {activeCategory && activeCategory.subcategories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0 [scrollbar-width:none]">
                {['all', ...activeCategory.subcategories].map(sub => (
                  <button key={sub} type="button" onClick={() => handleFilterChange({ category: activeCategory.name, subcategory: sub })}
                    className={cn('flex-shrink-0 h-9 px-4 rounded-full border text-sm font-semibold capitalize whitespace-nowrap',
                      filters.subcategory === sub ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:border-primary')}>
                    {sub === 'all' ? `Tudo em ${activeCategory.name}` : sub}
                  </button>
                ))}
              </div>
            )}

            {isLoading ? (
              <ProductGridSkeleton />
            ) : filteredAndSortedProducts.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 md:gap-3">
                  {filteredAndSortedProducts.slice(0, visible).map(product => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
                {visible < filteredAndSortedProducts.length && (
                  <button type="button" onClick={() => setVisible(v => v + PAGE_SIZE)}
                    className="self-center mt-2 h-12 px-8 rounded-lg border border-primary bg-card text-primary font-bold hover:bg-primary hover:text-primary-foreground transition">
                    Carregar mais produtos ({filteredAndSortedProducts.length - visible} restantes)
                  </button>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 gap-4 bg-card rounded-2xl">
                <PackageSearch className="h-16 w-16 text-muted-foreground/40" />
                <p className="text-lg font-medium text-muted-foreground">Nenhum produto encontrado.</p>
                {isBrowsing && (
                  <button type="button" onClick={clearFilters} className="h-10 px-5 rounded-lg border font-semibold hover:bg-muted">
                    Limpar filtros
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
