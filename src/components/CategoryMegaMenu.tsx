'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Category } from '@/lib/types';

interface Props {
  categories: Category[];
  onSelect: (cat: string, sub?: string) => void;
}

export default function CategoryMegaMenu({ categories, onSelect }: Props) {
  const [open, setOpen] = useState(false);

  const handleSelect = (cat: string, sub?: string) => {
    onSelect(cat, sub);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="whitespace-nowrap">
          Categorias
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[92vw] max-w-4xl p-3"
      >
        <div className="flex justify-between items-center mb-2">
          <Button size="sm" variant="ghost" onClick={() => handleSelect('all')}>
            Todas as Categorias
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[70vh] overflow-auto">
          {categories.map(cat => (
            <div key={cat.id} className="rounded-md border bg-card">
              <div className="px-3 py-2 border-b flex items-center justify-between">
                <span className="text-sm font-semibold capitalize">{cat.name}</span>
                <Button size="sm" variant="ghost" onClick={() => handleSelect(cat.name, 'all')}>
                  Tudo
                </Button>
              </div>
              <div className="p-2 flex flex-wrap gap-2">
                {cat.subcategories.map(sub => (
                  <Button
                    key={sub}
                    size="sm"
                    variant="secondary"
                    className="h-8 rounded-full capitalize"
                    onClick={() => handleSelect(cat.name, sub)}
                  >
                    {sub}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
