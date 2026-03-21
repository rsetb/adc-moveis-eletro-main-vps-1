
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import type { RolePermissions } from '@/lib/types';
import { initialPermissions } from '@/lib/permissions';
import { getRolePermissionsAction, updateRolePermissionsAction } from '@/app/actions/permissions';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './AuthContext';
import { useAudit } from './AuditContext';

interface PermissionsContextType {
    permissions: RolePermissions | null;
    updatePermissions: (newPermissions: RolePermissions) => Promise<void>;
    isLoading: boolean;
    resetPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const PermissionsProvider = ({ children }: { children: ReactNode }) => {
    const [permissions, setPermissions] = useState<RolePermissions | null>(initialPermissions);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const { user } = useAuth();
    const { logAction } = useAudit();
    const isPolling = useRef(true);

    const fetchPermissions = useCallback(async () => {
        try {
            const result = await getRolePermissionsAction();
            if (result.success && result.data) {
                setPermissions(result.data);
            }
        } catch (error) {
            console.error("Failed to load permissions:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPermissions();

        // Polling to replace Realtime
        const intervalId = setInterval(() => {
            if (isPolling.current) {
                fetchPermissions();
            }
        }, 15000); // 15s polling for config

        return () => {
            clearInterval(intervalId);
            isPolling.current = false;
        };
    }, [fetchPermissions]);

    const updatePermissions = useCallback(async (newPermissions: RolePermissions) => {
        try {
            const result = await updateRolePermissionsAction(newPermissions);

            if (!result.success) throw new Error(result.error);

            setPermissions(newPermissions); // Optimistic update

            logAction('Atualização de Permissões', 'As permissões de acesso dos perfis foram alteradas.', user);
            toast({
                title: "Permissões Salvas!",
                description: "As regras de acesso foram atualizadas com sucesso.",
            });
        } catch (error) {
            console.error("Error updating permissions:", error);
            toast({ title: "Erro", description: "Não foi possível salvar as permissões.", variant: "destructive" });
        }
    }, [toast, logAction, user]);

    const resetPermissions = useCallback(async () => {
        await updatePermissions(initialPermissions);
    }, [updatePermissions]);

    return (
        <PermissionsContext.Provider value={{ permissions, updatePermissions, isLoading, resetPermissions }}>
            {children}
        </PermissionsContext.Provider>
    );
};

export const usePermissions = () => {
    const context = useContext(PermissionsContext);
    if (context === undefined) {
        throw new Error('usePermissions must be used within a PermissionsProvider');
    }
    return context;
};

