
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/lib/types';
import { getUsersAction, createUserAction, updateUserAction, deleteUserAction, restoreUsersAction } from '@/app/actions/auth';
import { useAudit } from './AuditContext';

const initialUsers: User[] = [
  { id: 'user-1', username: 'admin', password: 'adminpassword', name: 'Administrador', role: 'admin', canBeAssigned: true },
  { id: 'user-2', username: 'gerente', password: 'gerentepassword', name: 'Gerente Loja', role: 'gerente', canBeAssigned: true },
  { id: 'user-3', username: 'vendedor', password: 'vendedorpassword', name: 'Vendedor Teste', role: 'vendedor', canBeAssigned: true },
];

interface AuthContextType {
  user: User | null;
  users: User[];
  login: (user: string, pass: string) => void;
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

  // Ref to track if we should polling
  const isPolling = useRef(true);

  // Function to fetch users centralizing logic
  const fetchUsers = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const result = await getUsersAction();

      if (!result.success || !result.data) {
        console.error('Error fetching users:', result.error);
        return;
      }

      setUsers(result.data);

      // Validate session against DB data
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser) as User;
          const validUser = result.data.find(u => u.id === parsedUser.id);

          if (validUser && validUser.active === false) {
            // User inactivated while logged in
            console.warn("User account inactivated. Logging out.");
            localStorage.removeItem('user');
            setUser(null);
            toast({ title: 'Sessão Encerrada', description: 'Sua conta foi inativada pelo administrador.', variant: 'destructive' });
            return;
          }

          if (validUser) {
            // Update session with fresh data
            const updatedUser = { ...validUser };
            delete updatedUser.password;

            // Only update state if data actually changed to avoid render loops (simple check)
            setUser(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(updatedUser)) {
                localStorage.setItem('user', JSON.stringify(updatedUser));
                return updatedUser;
              }
              return prev;
            });
          } else {
            // User deleted
            localStorage.removeItem('user');
            setUser(null);
          }
        }
      } catch (error) {
        console.error("Failed to validate session:", error);
        localStorage.removeItem('user');
        setUser(null);
      }
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchUsers(true);

    // Polling interval (Replace Realtime)
    const intervalId = setInterval(() => {
      if (isPolling.current) {
        fetchUsers(false);
      }
    }, 30000); // Poll every 30 seconds

    return () => {
      clearInterval(intervalId);
      isPolling.current = false;
    };
  }, []);


  const login = (username: string, pass: string) => {
    // Logic remains same - client side filtering of fetched users
    // (This matches previous implementation)
    const foundUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!foundUser) {
      toast({ title: 'Falha no Login', description: 'Usuário não encontrado.', variant: 'destructive' });
      return;
    }

    if (foundUser.active === false) {
      toast({ title: 'Falha no Login', description: 'Esta conta está inativada. Entre em contato com o administrador.', variant: 'destructive' });
      return;
    }

    if (!foundUser.password) {
      toast({ title: 'Falha no Login', description: 'Usuário sem senha cadastrada.', variant: 'destructive' });
      return;
    }

    const isPasswordValid = foundUser.password === pass;
    if (isPasswordValid) {
      const userToStore = { ...foundUser };
      delete userToStore.password;

      setUser(userToStore);
      localStorage.setItem('user', JSON.stringify(userToStore));
      logAction('Login', `Usuário "${foundUser.name}" realizou login.`, userToStore);
      router.push('/admin');
      toast({
        title: 'Login bem-sucedido!',
        description: `Bem-vindo(a), ${foundUser.name}.`,
      });
    } else {
      toast({
        title: 'Falha no Login',
        description: 'Senha inválida.',
        variant: 'destructive',
      });
    }
  };

  const logout = () => {
    if (user) {
      logAction('Logout', `Usuário "${user.name}" realizou logout.`, user);
    }
    setUser(null);
    localStorage.removeItem('user');
    router.push('/login');
  };

  const addUser = async (data: Omit<User, 'id'>): Promise<boolean> => {
    const isUsernameTaken = users.some(u => u.username.toLowerCase() === data.username.toLowerCase());
    if (isUsernameTaken) {
      toast({
        title: 'Erro ao Criar Usuário',
        description: 'Este nome de usuário já está em uso.',
        variant: 'destructive',
      });
      return false;
    }

    const result = await createUserAction(data);

    if (result.success && result.data) {
      const newUser = result.data as User;
      setUsers((prev) => [...prev, newUser]);
      logAction('Criação de Usuário', `Novo usuário "${data.name}" (Perfil: ${data.role}) foi criado.`, user);
      toast({
        title: 'Usuário Criado!',
        description: `O usuário ${data.name} foi criado com sucesso.`,
      });
      return true;
    } else {
      toast({
        title: 'Erro ao Criar Usuário',
        description: 'Não foi possível salvar o novo usuário. ' + result.error,
        variant: 'destructive',
      });
      return false;
    }
  };

  const updateUser = async (userId: string, data: Partial<Omit<User, 'id'>>) => {
    if (data.username) {
      const isUsernameTaken = users.some(u => u.id !== userId && u.username.toLowerCase() === data.username?.toLowerCase());
      if (isUsernameTaken) {
        toast({
          title: 'Erro ao Atualizar',
          description: 'Este nome de usuário já está em uso por outra conta.',
          variant: 'destructive',
        });
        return;
      }
    }

    const updatedUser = users.find(u => u.id === userId);
    if (updatedUser) {
      let details = `Dados do usuário "${updatedUser.name}" foram alterados.`;
      if (data.name && data.name !== updatedUser.name) details += ` Nome: de "${updatedUser.name}" para "${data.name}".`;
      logAction('Atualização de Usuário', details, user);
    }

    const result = await updateUserAction(userId, data);

    if (result.success) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? ({ ...u, ...data } as User) : u)));

      if (user?.id === userId) {
        const updatedCurrentUser = { ...user, ...data };
        delete updatedCurrentUser.password;
        setUser(updatedCurrentUser);
        localStorage.setItem('user', JSON.stringify(updatedCurrentUser));
      }

      toast({
        title: 'Usuário Atualizado!',
        description: 'As informações do usuário foram salvas com sucesso.',
      });
    } else {
      toast({
        title: 'Erro ao Atualizar',
        description: 'Não foi possível salvar as alterações do usuário. ' + result.error,
        variant: 'destructive',
      });
      throw new Error(result.error);
    }
  };

  const deleteUser = async (userId: string) => {
    if (user?.id === userId) {
      toast({ title: 'Ação não permitida', description: 'Você não pode excluir seu próprio usuário.', variant: 'destructive' });
      return;
    }

    const userToDelete = users.find(u => u.id === userId);
    const result = await deleteUserAction(userId);

    if (result.success) {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      if (userToDelete) {
        logAction('Exclusão de Usuário', `Usuário "${userToDelete.name}" foi excluído.`, user);
      }
      toast({
        title: 'Usuário Excluído!',
        description: 'O usuário foi removido do sistema.',
        variant: 'destructive',
        duration: 5000,
      });
    } else {
      toast({
        title: 'Erro ao Excluir',
        description: 'Não foi possível excluir o usuário. ' + result.error,
        variant: 'destructive',
      });
      throw new Error(result.error);
    }
  };

  const changeMyPassword = async (currentPassword: string, newPassword: string): Promise<boolean> => {
    if (!user) {
      toast({ title: "Erro", description: "Você não está logado.", variant: "destructive" });
      return false;
    }

    const currentUserInDB = users.find(u => u.id === user.id);
    if (!currentUserInDB || currentUserInDB.password !== currentPassword) {
      toast({ title: "Erro", description: "A senha atual está incorreta.", variant: "destructive" });
      return false;
    }

    // Reuse updateUser
    const result = await updateUserAction(user.id, { password: newPassword });
    if (result.success) {
      logAction('Alteração de Senha', `O usuário "${user.name}" alterou a própria senha.`, user);
      toast({ title: "Senha Alterada!", description: "Sua senha foi atualizada com sucesso." });
      // Update local state is handled by updateUser (or next poll)
      return true;
    }
    return false;
  };

  const restoreUsers = async (usersToRestore: User[]) => {
    const result = await restoreUsersAction(usersToRestore);
    if (result.success) {
      logAction('Restauração de Usuários', 'Todos os usuários foram restaurados a partir de um backup.', user);
      toast({ title: "Usuários Restaurados!", description: "A lista de usuários foi substituída com sucesso." });
      fetchUsers(false); // Immediate refresh
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
