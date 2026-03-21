'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Category } from '@/lib/types';

interface Props {
  categories: Category[];
  onSelect: (cat: string, sub?: string) => void;
}

export default function TopCategoriesNav({ categories, onSelect }: Props) {
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const selected = categories.find(c => c.name === activeCat);
  const subcats = selected?.subcategories ?? [];

  return (
    <div
      className="container mx-auto relative"
      onMouseLeave={() => setActiveCat(null)}
    >
      <div className="flex items-center gap-2 overflow-x-auto py-2">
        <Button
          variant="ghost"
          className="h-9 px-4 rounded-full text-primary-foreground hover:bg-primary/80 whitespace-nowrap"
          onClick={() => {
            console.debug('TopCategoriesNav: click Todas -> cat=all sub=all');
            onSelect('all', 'all');
          }}
        >
          Todas
        </Button>
        {categories.map((c) => {
          const isActive = activeCat === c.name;
          return (
            <Button
              key={c.id}
              variant="ghost"
              className={`h-9 px-4 rounded-full whitespace-nowrap capitalize ${isActive ? 'bg-white/20 text-white' : 'text-primary-foreground hover:bg-primary/80'}`}
              onClick={() => {
                console.debug('TopCategoriesNav: click categoria', c.name, 'ativo?', isActive);
                const nextActive = isActive ? null : c.name;
                setActiveCat(nextActive);
                if (!isActive) {
                  onSelect(c.name, 'all');
                }
              }}
            >
              {c.name}
            </Button>
          );
        })}
      </div>
      {activeCat && subcats.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-[60]">
          <div
            className="flex flex-wrap items-center gap-2 bg-primary/95 border-t border-white/10 shadow-md px-2 py-2 pointer-events-auto"
            onMouseEnter={() => {
              console.debug('TopCategoriesNav: submenu aberto para', activeCat);
            }}
          >
            <Button
              size="sm"
              variant="secondary"
              className="h-8 rounded-full whitespace-nowrap"
              onClick={() => {
                console.debug('TopCategoriesNav: click Tudo em', activeCat);
                onSelect(activeCat!, 'all');
              }}
            >
              Tudo em {activeCat}
            </Button>
            {subcats.map(sub => (
              <Button
                key={sub}
                size="sm"
                variant="ghost"
                className="h-8 rounded-full whitespace-nowrap capitalize text-primary-foreground hover:bg-primary/70"
                onClick={() => {
                  console.debug('TopCategoriesNav: click subcategoria', sub, 'da categoria', activeCat);
                  onSelect(activeCat!, sub);
                }}
              >
                {sub}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
