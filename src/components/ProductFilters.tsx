

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Category } from '@/lib/types';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ProductFiltersProps {
  onFilterChange: (filters: {
    category?: string;
    subcategory?: string;
  }) => void;
  categories: Category[];
  currentFilters: {
      category: string;
      subcategory: string;
      search: string;
      sort: string;
  }
}

export default function ProductFilters({ onFilterChange, categories, currentFilters }: ProductFiltersProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const handleCategoryClick = (category: Category) => {
    // If it's already selected, filter by it (main category). If it has no subcategories, also filter.
    if (selectedCategory?.id === category.id || category.subcategories.length === 0) {
      setSelectedCategory(null);
      onFilterChange({ category: category.name, subcategory: 'all' });
    } else {
      setSelectedCategory(category);
      onFilterChange({ category: category.name, subcategory: 'all' });
    }
  };

  const handleSubcategoryClick = (subcategory: string) => {
    if (selectedCategory) {
      onFilterChange({ category: selectedCategory.name, subcategory: subcategory });
    }
  }
  
  const handleShowAll = () => {
    setSelectedCategory(null);
    onFilterChange({ category: 'all', subcategory: 'all' });
  }

  return (
    <div className="bg-card p-3 rounded-lg shadow-sm mb-6 border">
      <div className="overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max px-1 py-1">
          <Button
            variant={currentFilters.category === 'all' ? 'default' : 'outline'}
            onClick={handleShowAll}
            className="h-9 rounded-full px-4 text-xs whitespace-nowrap"
          >
            Todas
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={currentFilters.category === cat.name ? 'default' : 'outline'}
              onClick={() => handleCategoryClick(cat)}
              className="h-9 rounded-full px-4 text-xs whitespace-nowrap capitalize"
            >
              {cat.name}
            </Button>
          ))}
        </div>
      </div>
       <AnimatePresence>
        {selectedCategory && selectedCategory.subcategories.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t">
              <div className="overflow-x-auto">
                <div className="flex items-center gap-2 min-w-max px-1 py-1">
                  {selectedCategory.subcategories.map((sub) => (
                    <Button
                      key={sub}
                      variant={currentFilters.subcategory === sub ? 'secondary' : 'ghost'}
                      onClick={() => handleSubcategoryClick(sub)}
                      className="h-8 rounded-full px-3 text-xs whitespace-nowrap capitalize"
                    >
                      {sub}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
