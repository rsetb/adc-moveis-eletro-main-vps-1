

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useRef } from 'react';
import type { Product, Category } from '@/lib/types';
import { getProductsAction, getCategoriesAction } from '@/app/actions/data';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';

// This context now only handles PUBLIC data.
// Admin-related data has been moved to AdminContext for performance optimization.
interface DataContextType {
  products: Product[];
  categories: Category[];
  isLoading: boolean;
  updateProductLocally: (product: Product) => void;
  addProductLocally: (product: Product) => void;
  deleteProductLocally: (productId: string) => void;
  refreshData: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const isPolling = useRef(true);

  // Funções de atualização otimista (sem cache)
  const updateProductLocally = (product: Product) => {
    setProducts(prev => prev.map(p => p.id === product.id ? product : p));
  };

  const addProductLocally = (product: Product) => {
    setProducts(prev => {
      const exists = prev.some(p => p.id === product.id);
      if (exists) {
        return prev.map(p => p.id === product.id ? product : p);
      }
      return [...prev, product];
    });
  };

  const deleteProductLocally = (productId: string) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
  };

  const fetchData = React.useCallback(async (showLoading = false) => {
    if (showLoading) {
      setProductsLoading(true);
      setCategoriesLoading(true);
    }

    try {
      const [productsResult, categoriesResult] = await Promise.all([
        getProductsAction(),
        getCategoriesAction()
      ]);

      // Handle Products
      if (productsResult.success && productsResult.data) {
        setProducts(productsResult.data as Product[]);
      } else {
        console.error(productsResult.error);
      }

      // Handle Categories
      if (categoriesResult.success && categoriesResult.data) {
        setCategories(categoriesResult.data as Category[]);
      } else {
        console.error(categoriesResult.error);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      if (showLoading) {
        setProductsLoading(false);
        setCategoriesLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchData(true);

    // Polling interval (Realtime updates)
    const intervalId = setInterval(() => {
      if (isPolling.current) {
        fetchData(false);
      }
    }, 15000); // 15s polling

    return () => {
      clearInterval(intervalId);
      isPolling.current = false;
    };
  }, [fetchData]);

  useRealtimeUpdates((changed) => {
    if (changed.includes('products')) fetchData(false);
  });

  const refreshData = React.useCallback(() => {
    fetchData(false);
  }, [fetchData]);

  const isLoading = productsLoading || categoriesLoading;

  // Return ONLY active products for all public/shared views
  const activeProducts = useMemo(() => {
    return products.filter(p => !p.deletedAt);
  }, [products]);

  const value = useMemo(() => ({
    products: activeProducts,
    categories,
    isLoading,
    updateProductLocally,
    addProductLocally,
    deleteProductLocally,
    refreshData,
  }), [
    activeProducts,
    categories,
    isLoading,
    updateProductLocally,
    addProductLocally,
    deleteProductLocally,
    refreshData,
  ]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
