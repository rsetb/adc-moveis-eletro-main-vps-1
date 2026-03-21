

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAudit } from './AuditContext';
import { useAuth } from './AuthContext';
import type { StoreSettings } from '@/lib/types';
import { getSettingsAction, updateSettingsAction } from '@/app/actions/settings';

const initialSettings: StoreSettings = {
    storeName: 'ADC Móveis',
    storeCity: '',
    storeAddress: '',
    pixKey: '',
    storePhone: '',
    logoUrl: '',
    accessControlEnabled: false,
    commercialHourStart: '08:00',
    commercialHourEnd: '18:00',
    solicitationsTrashRetentionDays: 30,
};

interface SettingsContextType {
    settings: StoreSettings;
    updateSettings: (newSettings: Partial<StoreSettings>) => Promise<void>;
    isLoading: boolean;
    restoreSettings: (settings: StoreSettings) => Promise<void>;
    resetSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
    const [settings, setSettings] = useState<StoreSettings>(initialSettings);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const { logAction } = useAudit();
    const { user } = useAuth();
    const isPolling = useRef(true);


    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const result = await getSettingsAction();
                if (result.success && result.data) {
                    setSettings(result.data);
                }
            } catch (error) {
                console.error("Failed to load settings:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSettings();

        const intervalId = setInterval(() => {
            if (isPolling.current) fetchSettings();
        }, 30000); // 30s polling for settings

        return () => {
            clearInterval(intervalId);
            isPolling.current = false;
        };
    }, []);

    const updateSettings = async (newSettings: Partial<StoreSettings>) => {
        try {
            const cleanedNewSettings = Object.fromEntries(
                Object.entries(newSettings).filter(([, value]) => value !== undefined)
            ) as Partial<StoreSettings>;

            const updatedValue = { ...settings, ...cleanedNewSettings };

            const result = await updateSettingsAction(updatedValue);

            if (!result.success) throw new Error(result.error);

            setSettings(updatedValue);

            logAction('Atualização de Configurações', `Configurações da loja foram alteradas.`, user);
            toast({
                title: "Configurações Salvas!",
                description: "As informações da loja foram atualizadas com sucesso.",
            });
        } catch (error) {
            console.error("Error updating settings:", error);
            toast({ title: "Erro", description: "Não foi possível salvar as configurações.", variant: "destructive" });
        }
    };

    const restoreSettings = async (settingsToRestore: StoreSettings) => {
        await updateSettings(settingsToRestore);
        logAction('Restauração de Configurações', `Configurações da loja foram restauradas de um backup.`, user);
    };

    const resetSettings = async () => {
        await updateSettings(initialSettings);
        logAction('Reset de Configurações', `Configurações da loja foram restauradas para o padrão.`, user);
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, isLoading, restoreSettings, resetSettings }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};


