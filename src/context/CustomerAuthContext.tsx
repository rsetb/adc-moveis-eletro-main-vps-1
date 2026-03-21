

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { CustomerInfo, Order } from '@/lib/types';
import { customerLoginAction, getCustomerOrdersAction } from '@/app/actions/customer';

interface CustomerAuthContextType {
  customer: CustomerInfo | null;
  customerOrders: Order[];
  login: (cpf: string, pass: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

export const CustomerAuthProvider = ({ children }: { children: ReactNode }) => {
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedCustomer = localStorage.getItem('customer');
      if (storedCustomer) {
        setCustomer(JSON.parse(storedCustomer));
      }
    } catch (error) {
      console.error("Failed to read customer from localStorage", error);
      localStorage.removeItem('customer');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!customer?.cpf) {
      setCustomerOrders([]);
      return;
    }

    const fetchOrders = async () => {
      const result = await getCustomerOrdersAction(customer.cpf!);
      if (result.success && result.data) {
        setCustomerOrders(result.data);
      }
    };

    fetchOrders();

  }, [customer]);

  const login = async (cpf: string, pass: string): Promise<boolean> => {
    const normalizedCpf = cpf.replace(/\D/g, '');

    try {
      const result = await customerLoginAction(normalizedCpf);

      if (!result.success) {
        toast({ title: 'Falha no Login', description: result.error || 'Erro ao logar.', variant: 'destructive' });
        return false;
      }

      const foundCustomer = result.data;

      if (!foundCustomer) {
        toast({ title: 'Falha no Login', description: 'CPF não encontrado.', variant: 'destructive' });
        return false;
      }

      if (!foundCustomer.password) {
        toast({ title: 'Falha no Login', description: 'Esta conta ainda não possui uma senha cadastrada. Ou tente logar com o método antigo se aplicável.', variant: 'destructive' });
        return false;
      }

      if (foundCustomer.password === pass) {
        const customerToStore = { ...foundCustomer };
        delete customerToStore.password;

        setCustomer(customerToStore);
        localStorage.setItem('customer', JSON.stringify(customerToStore));
        router.push('/area-cliente/minha-conta');
        toast({
          title: 'Login bem-sucedido!',
          description: `Bem-vindo(a) de volta, ${(customerToStore.name || '').split(' ')[0]}.`,
        });
        return true;
      } else {
        toast({
          title: 'Falha no Login',
          description: 'Senha inválida.',
          variant: 'destructive',
        });
        return false;
      }

    } catch (error) {
      console.error("Error during login:", error);
      toast({ title: 'Erro de Autenticação', description: 'Não foi possível verificar suas credenciais. Tente novamente.', variant: 'destructive' });
      return false;
    }
  };

  const logout = () => {
    setCustomer(null);
    localStorage.removeItem('customer');
    router.push('/area-cliente/login');
  };

  const value = useMemo(() => ({
    customer,
    customerOrders,
    login,
    logout,
    isLoading,
    isAuthenticated: !!customer,
  }), [customer, customerOrders, isLoading]);


  return (
    <CustomerAuthContext.Provider value={value}>
      {children}
    </CustomerAuthContext.Provider>
  );
};

export const useCustomerAuth = () => {
  const context = useContext(CustomerAuthContext);
  if (context === undefined) {
    throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
  }
  return context;
};
