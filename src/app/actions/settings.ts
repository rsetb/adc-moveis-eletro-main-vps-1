'use server';

import { db } from '@/lib/db';
import type { StoreSettings } from '@/lib/types';

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

export async function getSettingsAction() {
    try {
        const result = await db.config.findUnique({
            where: { key: 'storeSettings' }
        });
        const remote = result ? (result.value as unknown as Partial<StoreSettings>) : {};

        return { success: true, data: { ...initialSettings, ...remote } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateSettingsAction(newSettings: StoreSettings) {
    try {
        await db.config.upsert({
            where: { key: 'storeSettings' },
            update: { value: newSettings as any },
            create: { key: 'storeSettings', value: newSettings as any }
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getAsaasSettingsAction() {
    try {
        const result = await db.config.findUnique({
            where: { key: 'asaasSettings' }
        });
        return { success: true, data: result?.value };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateAsaasSettingsAction(settings: any) {
    try {
        await db.config.upsert({
            where: { key: 'asaasSettings' },
            create: { key: 'asaasSettings', value: settings as any },
            update: { value: settings as any }
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getCustomerCodeCounterAction() {
    try {
        const result = await db.config.findUnique({
            where: { key: 'customerCodeCounter' }
        });
        const raw = result?.value as any;
        const lastNumber = typeof raw === 'number' ? raw : Number(raw?.lastNumber || 0);
        return { success: true, data: { lastNumber } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateCustomerCodeCounterAction(value: number) {
    try {
        const next = { lastNumber: value };
        await db.config.upsert({
            where: { key: 'customerCodeCounter' },
            create: { key: 'customerCodeCounter', value: next as any },
            update: { value: next as any }
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
