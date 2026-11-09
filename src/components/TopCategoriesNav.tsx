'use client';

import { useState } from 'react';
import type { Category } from '@/lib/types';
import { Menu, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  categories: Category[];
  onSelect: (cat: string, sub?: string) => void;
}

export default function TopCategoriesNav({ categories, onSelect }: Props) {
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const selected = categories.find(c => c.name === activeCat);
  const subcats = selected?.subcategories ?? [];

  return (
    <div className="container mx-auto px-4 relative" onMouseLeave={() => setActiveCat(null)}>
      <div className="flex items-center gap-1 overflow-x-auto">
        <button
          type="button"
          className="flex items-center gap-2 h-11 pr-4 font-bold text-sm whitespace-nowrap hover:text-yellow-300 transition-colors"
          onClick={() => onSelect('all', 'all')}
        >
          <Menu className="h-5 w-5" />
          Todos os departamentos
        </button>
        {categories.map((c) => {
          const isActive = activeCat === c.name;
          return (
            <button
              key={c.id}
              type="button"
              className={cn(
                'h-11 px-3 text-sm whitespace-nowrap capitalize transition-colors border-b-2',
                isActive ? 'border-yellow-300 text-yellow-300' : 'border-transparent hover:text-yellow-300'
              )}
              onMouseEnter={() => setActiveCat(c.name)}
              onClick={() => onSelect(c.name, 'all')}
            >
              {c.name}
            </button>
          );
        })}
        <button
          type="button"
          className="flex items-center gap-1.5 h-11 px-3 ml-1 text-sm font-bold text-yellow-300 whitespace-nowrap border-l border-white/20 hover:text-yellow-200"
          onClick={() => onSelect('ofertas', 'all')}
        >
          <Tag className="h-4 w-4" />
          Ofertas
        </button>
      </div>
      {activeCat && subcats.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-[60] px-4">
          <div className="bg-card text-foreground rounded-b-xl shadow-xl border border-t-0 p-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
              onClick={() => onSelect(activeCat!, 'all')}
            >
              Tudo em {activeCat}
            </button>
            {subcats.map(sub => (
              <button
                key={sub}
                type="button"
                className="h-9 px-4 rounded-full border text-sm capitalize hover:border-primary hover:text-primary"
                onClick={() => onSelect(activeCat!, sub)}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
