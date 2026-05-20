'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/lib/types';
import {
  getUsersAction,
  createUserAction,
  updateUserAction,
  deleteUserAction,
  restoreUsersAction,
  loginAction,
  logoutAction,
  getSessionAction,
  changeMyPasswordAction,
} from '@/app/actions/auth';
import { useAudit } from './AuditContext';

interface AuthContextType {
  user: User | null;
  users: User[];
  login: (username: string, pass: string) => Promise<void>;
  logout: () => void;
  addUser: (data: Omit<User, 'id'>) => Promise<boolean>;
  updateUser: (userId: string, data: Partial<Omit<User, 'id'>>) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  changeMyPassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  isLoading: boolean;
  isAuthenticated: boolean;
  restoreUsers: (users: User[]) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();
  const { logAction } = useAudit();
  const isPolling = useRef(true);

  const fetchUsers = async () => {
    const result = await getUsersAction();
    if (result.success && result.data) {
      setUsers(result.data as User[]);
    }
  };

  const validateSession = async (): Promise<boolean> => {
    const result = await getSessionAction();
    if (!result.success || !result.user) {
      setUser(null);
      setUsers([]);
      return false;
    }
    setUser(result.user as User);
    return true;
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const valid = await validateSession();
      if (valid) await fetchUsers();
      setIsLoading(false);
    };
    init();

    const intervalId = setInterval(async () => {
      if (!isPolling.current) return;
      await validateSession();
      await fetchUsers();
    }, 30000);

    return () => {
      clearInterval(intervalId);
      isPolling.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (username: string, pass: string): Promise<void> => {
    const result = await loginAction(username, pass);
    if (result.success && result.user) {
      setUser(result.user as User);
      await fetchUsers();
      logAction('Login', `Usuário "${result.user.name}" realizou login.`, result.user as User);
      router.push('/admin');
      toast({ title: 'Login bem-sucedido!', description: `Bem-vindo(a), ${result.user.name}.` });
    } else {
      toast({ title: 'Falha no Login', description: result.error ?? 'Credenciais inválidas.', variant: 'destructive' });
    }
  };

  const logout = () => {
    if (user) logAction('Logout', `Usuário "${user.name}" realizou logout.`, user);
    logoutAction().then(() => {
      setUser(null);
      setUsers([]);
      router.push('/login');
    });
  };

  const addUser = async (data: Omit<User, 'id'>): Promise<boolean> => {
    const isUsernameTaken = users.some(u => u.username.toLowerCase() === data.username.toLowerCase());
    if (isUsernameTaken) {
      toast({ title: 'Erro ao Criar Usuário', description: 'Este nome de usuário já está em uso.', variant: 'destructive' });
      return false;
    }
    const result = await createUserAction(data);
    if (result.success && result.data) {
      setUsers(prev => [...prev, result.data as User]);
      logAction('Criação de Usuário', `Novo usuário "${data.name}" (Perfil: ${data.role}) foi criado.`, user);
      toast({ title: 'Usuário Criado!', description: `O usuário ${data.name} foi criado com sucesso.` });
      return true;
    } else {
      toast({ title: 'Erro ao Criar Usuário', description: result.error ?? 'Não foi possível salvar o novo usuário.', variant: 'destructive' });
      return false;
    }
  };

  const updateUser = async (userId: string, data: Partial<Omit<User, 'id'>>) => {
    if (data.username) {
      const isTaken = users.some(u => u.id !== userId && u.username.toLowerCase() === data.username?.toLowerCase());
      if (isTaken) {
        toast({ title: 'Erro ao Atualizar', description: 'Este nome de usuário já está em uso por outra conta.', variant: 'destructive' });
        return;
      }
    }
    const existing = users.find(u => u.id === userId);
    if (existing) {
      let details = `Dados do usuário "${existing.name}" foram alterados.`;
      if (data.name && data.name !== existing.name) details += ` Nome: de "${existing.name}" para "${data.name}".`;
      logAction('Atualização de Usuário', details, user);
    }
    const result = await updateUserAction(userId, data);
    if (result.success) {
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, ...data } as User : u)));
      if (user?.id === userId) {
        const updated = { ...user, ...data };
        delete updated.password;
        setUser(updated);
      }
      toast({ title: 'Usuário Atualizado!', description: 'As informações do usuário foram salvas com sucesso.' });
    } else {
      toast({ title: 'Erro ao Atualizar', description: result.error ?? 'Não foi possível salvar as alterações.', variant: 'destructive' });
      throw new Error(result.error);
    }
  };

  const deleteUser = async (userId: string) => {
    if (user?.id === userId) {
      toast({ title: 'Ação não permitida', description: 'Você não pode excluir seu próprio usuário.', variant: 'destructive' });
      return;
    }
    const toDelete = users.find(u => u.id === userId);
    const result = await deleteUserAction(userId);
    if (result.success) {
      setUsers(prev => prev.filter(u => u.id !== userId));
      if (toDelete) logAction('Exclusão de Usuário', `Usuário "${toDelete.name}" foi excluído.`, user);
      toast({ title: 'Usuário Excluído!', description: 'O usuário foi removido do sistema.', variant: 'destructive', duration: 5000 });
    } else {
      toast({ title: 'Erro ao Excluir', description: result.error ?? 'Não foi possível excluir o usuário.', variant: 'destructive' });
      throw new Error(result.error);
    }
  };

  const changeMyPassword = async (currentPassword: string, newPassword: string): Promise<boolean> => {
    const result = await changeMyPasswordAction(currentPassword, newPassword);
    if (result.success) {
      logAction('Alteração de Senha', `O usuário "${user?.name}" alterou a própria senha.`, user);
      toast({ title: 'Senha Alterada!', description: 'Sua senha foi atualizada com sucesso.' });
      return true;
    }
    toast({ title: 'Erro', description: result.error ?? 'Não foi possível alterar a senha.', variant: 'destructive' });
    return false;
  };

  const restoreUsers = async (usersToRestore: User[]) => {
    const result = await restoreUsersAction(usersToRestore);
    if (result.success) {
      logAction('Restauração de Usuários', 'Todos os usuários foram restaurados a partir de um backup.', user);
      toast({ title: 'Usuários Restaurados!', description: 'A lista de usuários foi substituída com sucesso.' });
      await fetchUsers();
    } else {
      toast({ title: 'Erro', description: result.error, variant: 'destructive' });
    }
  };

  return (
    <AuthContext.Provider value={{ user, users, login, logout, addUser, updateUser, deleteUser, changeMyPassword, isLoading, isAuthenticated: !!user, restoreUsers }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
