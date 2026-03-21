'use server';

import { db } from '@/lib/db';
import type { CustomerInfo, User } from '@/lib/types';
import { revalidatePath, unstable_noStore as noStore } from 'next/cache';
import { allocateNextCustomerCode, normalizeCustomerCodeInput, reserveCustomerCodes } from '@/lib/customer-code';
import { matchesAllTokens, normalizeDigits, normalizeSearchText, splitTokens, type CustomerSearchFilters } from '@/lib/customer-search';

export async function addCustomerAction(customerData: CustomerInfo, user: User | null) {
    try {
        const normalizedCode = normalizeCustomerCodeInput((customerData as any)?.code);

        // Prevent duplicate CPF
        if (customerData.cpf) {
            const existing = await db.customer.findFirst({
                where: { cpf: customerData.cpf }
            });
            if (existing) {
                return { success: false, error: 'Um cliente com este CPF já existe.' };
            }
        }

        // Generate a robust ID to prevent collisions (PRIMARY constraint violation)
        // Using timestamp + random suffix to ensure uniqueness even on rapid concurrent requests
        const idToUse = customerData.id || `CUST-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

        if (normalizedCode) {
            const existingByCode = await db.customer.findFirst({ where: { code: normalizedCode } });
            if (existingByCode) {
                return { success: false, error: 'Código de cliente já está em uso.' };
            }
        }

        const dataBase: any = {
            ...customerData,
            code: normalizedCode,
            id: idToUse
        };

        let createdCustomer: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const codeToUse = dataBase.code || await allocateNextCustomerCode();
                createdCustomer = await db.customer.create({
                    data: {
                        ...dataBase,
                        code: codeToUse,
                    }
                });
                break;
            } catch (error: any) {
                if (error?.code === 'P2002' && Array.isArray(error?.meta?.target) && error.meta.target.includes('code')) {
                    dataBase.code = null;
                    continue;
                }
                throw error;
            }
        }

        if (!createdCustomer) {
            return { success: false, error: 'Falha ao criar cliente: código duplicado.' };
        }

        revalidatePath('/admin/clientes');
        return { success: true, data: createdCustomer as unknown as CustomerInfo };
    } catch (error: any) {
        // Handle race conditions for unique constraints
        if (error.code === 'P2002' && error.meta?.target?.includes('cpf')) {
            return { success: false, error: 'Um cliente com este CPF já existe.' };
        }
        if (error.code === 'P2002' && error.meta?.target?.includes('code')) {
            return { success: false, error: 'Código de cliente já está em uso.' };
        }
        return { success: false, error: error.message };
    }
}


export async function getCustomersAction() {
    noStore();
    try {
        const customers = await db.customer.findMany({
            take: 50000,
            orderBy: { name: 'asc' }
        });
        return { success: true, data: customers as unknown as CustomerInfo[] };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export type { CustomerSearchFilters };

export async function searchCustomersAdvancedAction(filters: CustomerSearchFilters, tab: 'active' | 'blocked' | 'trash' | 'all', user: User | null) {
    noStore();
    try {
        const q = String(filters?.q || '').trim();
        const qTokens = splitTokens(q, 8);

        const buildTokenOrAnyField = (token: string) => {
            const isDigits = /^\d+$/.test(token);
            if (isDigits) {
                return [
                    { cpf: { contains: token } },
                    { phone: { contains: token } },
                    { phone2: { contains: token } },
                    { phone3: { contains: token } },
                    { zip: { contains: token } },
                    { number: { contains: token } },
                    { code: { contains: token } },
                    { id: { contains: token } },
                    { address: { contains: token, mode: 'insensitive' } },
                ];
            }
            return [
                { id: { contains: token, mode: 'insensitive' } },
                { code: { contains: token, mode: 'insensitive' } },
                { name: { contains: token, mode: 'insensitive' } },
                { email: { contains: token, mode: 'insensitive' } },
                { zip: { contains: token, mode: 'insensitive' } },
                { address: { contains: token, mode: 'insensitive' } },
                { number: { contains: token, mode: 'insensitive' } },
                { complement: { contains: token, mode: 'insensitive' } },
                { neighborhood: { contains: token, mode: 'insensitive' } },
                { city: { contains: token, mode: 'insensitive' } },
                { state: { contains: token, mode: 'insensitive' } },
                { observations: { contains: token, mode: 'insensitive' } },
                { sellerName: { contains: token, mode: 'insensitive' } },
                { blockedReason: { contains: token, mode: 'insensitive' } },
                { phone: { contains: token } },
                { cpf: { contains: token } },
            ];
        };

        const andClauses: any[] = [];

        if (qTokens.length) {
            andClauses.push(...qTokens.map((t) => ({ OR: buildTokenOrAnyField(t) })));
        }

        const codeTokens = splitTokens(String(filters?.code || ''), 6);
        if (codeTokens.length) {
            andClauses.push(...codeTokens.map((t) => ({ code: { contains: t, mode: 'insensitive' } })));
        }

        const sellerTokens = splitTokens(String(filters?.seller || ''), 6);
        if (sellerTokens.length) {
            andClauses.push(...sellerTokens.map((t) => ({ sellerName: { contains: t, mode: 'insensitive' } })));
        }

        const cityTokens = splitTokens(String(filters?.city || ''), 6);
        if (cityTokens.length) {
            andClauses.push(...cityTokens.map((t) => ({ city: { contains: t, mode: 'insensitive' } })));
        }

        const neighborhoodTokens = splitTokens(String(filters?.neighborhood || ''), 6);
        if (neighborhoodTokens.length) {
            andClauses.push(...neighborhoodTokens.map((t) => ({ neighborhood: { contains: t, mode: 'insensitive' } })));
        }

        const addressTokens = splitTokens(String(filters?.address || ''), 10);
        if (addressTokens.length) {
            andClauses.push(...addressTokens.map((t) => ({
                OR: [
                    { address: { contains: t, mode: 'insensitive' } },
                    { complement: { contains: t, mode: 'insensitive' } },
                    { neighborhood: { contains: t, mode: 'insensitive' } },
                ]
            })));
        }

        const observationsTokens = splitTokens(String(filters?.observations || ''), 10);
        if (observationsTokens.length) {
            andClauses.push(...observationsTokens.map((t) => ({ observations: { contains: t, mode: 'insensitive' } })));
        }

        const zipDigits = normalizeDigits(String(filters?.zip || ''));
        if (zipDigits.length >= 3) {
            andClauses.push({ zip: { contains: zipDigits } });
        }

        const numberDigits = normalizeDigits(String(filters?.number || ''));
        if (numberDigits.length >= 1) {
            andClauses.push({
                OR: [
                    { number: { contains: numberDigits } },
                    { address: { contains: numberDigits, mode: 'insensitive' } },
                ]
            });
        }

        const cpfOrPhoneDigits = normalizeDigits(String(filters?.cpfOrPhone || ''));
        if (cpfOrPhoneDigits.length >= 3) {
            andClauses.push({
                OR: [
                    { cpf: { contains: cpfOrPhoneDigits } },
                    { phone: { contains: cpfOrPhoneDigits } },
                    { phone2: { contains: cpfOrPhoneDigits } },
                    { phone3: { contains: cpfOrPhoneDigits } },
                ]
            });
        }

        if (andClauses.length === 0) {
            return { success: true, data: [] as CustomerInfo[] };
        }

        const where: any = {
            AND: [
                ...(tab === 'all' ? [] : [{ blocked: tab === 'blocked' }]),
                ...(user?.role === 'vendedor_cobranca' ? [{ sellerId: user.id }] : []),
                ...andClauses
            ]
        };

        if (tab === 'trash' || tab === 'all') {
            const qDigits = normalizeDigits(q);
            const trashWhere = qDigits
                ? {
                    OR: [
                        { id: { contains: qDigits } },
                        { cpf: { contains: qDigits } }
                    ]
                }
                : undefined;

            const trash = await db.customerTrash.findMany({
                where: trashWhere,
                take: qDigits ? 400 : 2000,
                orderBy: { deletedAt: 'desc' }
            });

            // Filter JSON data manually for better accuracy
            const trashResults = trash
                .map((t: any) => t?.data)
                .filter((c: any) => {
                    if (!c) return false;
                    if (user?.role === 'vendedor_cobranca' && c.sellerId !== user.id) return false;

                    const allText = normalizeSearchText([
                        c.id,
                        c.code,
                        c.name,
                        c.cpf,
                        c.phone,
                        c.phone2,
                        c.phone3,
                        c.email,
                        c.zip,
                        c.address,
                        c.number,
                        c.complement,
                        c.neighborhood,
                        c.city,
                        c.state,
                        c.observations,
                        c.sellerId,
                        c.sellerName,
                        c.blockedReason,
                        c.rating,
                    ].map((v: any) => (v === null || v === undefined ? '' : String(v))).join(' '));

                    const digitsText = normalizeDigits([
                        c.id,
                        c.code,
                        c.cpf,
                        c.phone,
                        c.phone2,
                        c.phone3,
                        c.zip,
                        c.number,
                        c.address,
                    ].map((v: any) => (v === null || v === undefined ? '' : String(v))).join(' '));

                    if (qTokens.length && !matchesAllTokens(allText, qTokens)) return false;
                    if (codeTokens.length && !matchesAllTokens(normalizeSearchText(String(c.code || '')), codeTokens)) return false;
                    if (sellerTokens.length && !matchesAllTokens(normalizeSearchText(String(c.sellerName || '')), sellerTokens)) return false;
                    if (cityTokens.length && !matchesAllTokens(normalizeSearchText(String(c.city || '')), cityTokens)) return false;
                    if (neighborhoodTokens.length && !matchesAllTokens(normalizeSearchText(String(c.neighborhood || '')), neighborhoodTokens)) return false;
                    if (addressTokens.length && !matchesAllTokens(normalizeSearchText([c.address, c.complement, c.neighborhood].filter(Boolean).join(' ')), addressTokens)) return false;
                    if (observationsTokens.length && !matchesAllTokens(normalizeSearchText(String(c.observations || '')), observationsTokens)) return false;
                    if (zipDigits.length >= 3 && !digitsText.includes(zipDigits)) return false;
                    if (numberDigits.length >= 1 && !digitsText.includes(numberDigits)) return false;
                    if (cpfOrPhoneDigits.length >= 3 && !digitsText.includes(cpfOrPhoneDigits)) return false;

                    return true;
                })
                .map((c: any) => ({ ...(c as any), source: 'trash' })) as CustomerInfo[];

            if (tab === 'trash') {
                return { success: true, data: trashResults };
            }

            // If tab === 'all', we search active/blocked and merge
            const activeBlocked = await db.customer.findMany({
                where,
                take: 200,
                orderBy: { name: 'asc' }
            });

            const activeResults = activeBlocked.map(c => ({ ...(c as any), source: c.blocked ? 'blocked' : 'active' }));
            const trashMapped = trashResults;

            // Combine and avoid duplicates (by ID or CPF)
            const seen = new Set();
            const final = [];

            for (const c of [...activeResults, ...trashMapped]) {
                const key = c.id || c.cpf;
                if (!seen.has(key)) {
                    seen.add(key);
                    final.push(c);
                }
            }

            return { success: true, data: final as unknown as CustomerInfo[] };
        }

        const customers = await db.customer.findMany({
            where,
            take: 200,
            orderBy: { name: 'asc' }
        });
        return { success: true, data: customers as unknown as CustomerInfo[] };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function searchCustomersAction(query: string, tab: 'active' | 'blocked' | 'trash' | 'all', user: User | null) {
    return searchCustomersAdvancedAction({ q: query }, tab, user);
}

export async function updateCustomerAction(customerData: CustomerInfo, user: User | null) {
    try {
        const normalizedCode = normalizeCustomerCodeInput((customerData as any)?.code);
        if (normalizedCode) {
            const existingByCode = await db.customer.findFirst({
                where: {
                    code: normalizedCode,
                    NOT: { id: customerData.id }
                }
            });
            if (existingByCode) {
                return { success: false, error: 'Código de cliente já está em uso.' };
            }
        }

        await db.customer.update({
            where: { id: customerData.id },
            data: { ...(customerData as any), code: normalizedCode }
        });
        revalidatePath('/admin/clientes');
        return { success: true };
    } catch (error: any) {
        if (error.code === 'P2002' && error.meta?.target?.includes('code')) {
            return { success: false, error: 'Código de cliente já está em uso.' };
        }
        return { success: false, error: error.message };
    }
}

export async function deleteCustomerAction(id: string, user: User | null) {
    try {
        if (!user) return { success: false, error: 'Usuário não autenticado.' };
        if (user.role === 'vendedor_cobranca') {
            throw new Error('Permissão negada: Vendedor Cobrança não pode excluir clientes.');
        }

        const customer = await db.customer.findUnique({ where: { id } });
        if (!customer) {
            // Already deleted or not found
            return { success: true };
        }

        const cpfDigits = String(customer.cpf || '').replace(/\D/g, '');
        if (cpfDigits.length !== 11) {
            throw new Error('Não é possível mover para lixeira: CPF inválido.');
        }

        const customerJson = JSON.parse(JSON.stringify(customer));
        const payload = {
            ...customerJson,
            cpf: cpfDigits,
            deletedAt: new Date().toISOString(),
            deletedById: user.id,
            deletedByName: user.name,
            deletedByRole: user.role,
        };

        await db.$transaction(async (tx) => {
            await tx.customerTrash.upsert({
                where: { id: cpfDigits },
                create: {
                    id: cpfDigits,
                    cpf: cpfDigits,
                    data: payload as any,
                },
                update: {
                    cpf: cpfDigits,
                    data: payload as any,
                    deletedAt: new Date(),
                }
            });

            await tx.customer.delete({ where: { id } });
        });

        revalidatePath('/admin/clientes');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getDeletedCustomersAction() {
    noStore();
    try {
        const trash = await db.customerTrash.findMany({
            orderBy: { deletedAt: 'desc' }
        });

        const customers = trash
            .map((t: any) => t?.data)
            .filter(Boolean) as CustomerInfo[];

        return { success: true, data: customers };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function restoreCustomerFromTrashAction(customer: CustomerInfo, user: User | null) {
    try {
        if (!user) return { success: false, error: 'Usuário não autenticado.' };

        const cpfDigits = String(customer.cpf || '').replace(/\D/g, '');
        if (cpfDigits.length !== 11) {
            return { success: false, error: 'CPF inválido.' };
        }

        let normalizedCode = normalizeCustomerCodeInput((customer as any)?.code);
        if (normalizedCode) {
            const conflict = await db.customer.findFirst({
                where: {
                    code: normalizedCode,
                    NOT: { cpf: cpfDigits }
                }
            });
            if (conflict) {
                normalizedCode = await allocateNextCustomerCode();
            }
        }

        const customerToSave = {
            id: customer.id || cpfDigits,
            code: normalizedCode,
            name: customer.name,
            cpf: cpfDigits,
            phone: customer.phone,
            phone2: customer.phone2,
            phone3: customer.phone3,
            email: customer.email,
            zip: customer.zip,
            address: customer.address,
            number: customer.number,
            complement: customer.complement,
            neighborhood: customer.neighborhood,
            city: customer.city,
            state: customer.state,
            password: customer.password,
            observations: customer.observations,
            sellerId: customer.sellerId,
            sellerName: customer.sellerName,
            blocked: false,
            blockedReason: null as any,
            rating: customer.rating,
        };

        const { id: _id, ...customerToUpdate } = customerToSave;

        const saved = await db.$transaction(async (tx) => {
            const upserted = await tx.customer.upsert({
                where: { cpf: cpfDigits },
                create: {
                    ...customerToSave,
                },
                update: {
                    ...customerToUpdate,
                }
            });

            await tx.customerTrash.deleteMany({ where: { cpf: cpfDigits } });
            return upserted;
        });

        revalidatePath('/admin/clientes');
        return { success: true, data: saved as unknown as CustomerInfo };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function permanentlyDeleteCustomerFromTrashAction(customer: CustomerInfo, user: User | null) {
    try {
        if (!user) return { success: false, error: 'Usuário não autenticado.' };
        if (user.role === 'vendedor_cobranca') {
            throw new Error('Permissão negada: Vendedor Cobrança não pode excluir clientes permanentemente.');
        }

        const cpfDigits = String(customer.cpf || '').replace(/\D/g, '');
        if (cpfDigits.length !== 11) {
            return { success: false, error: 'CPF inválido.' };
        }

        await db.customerTrash.deleteMany({ where: { cpf: cpfDigits } });

        revalidatePath('/admin/clientes');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function permanentlyDeleteCustomerAction(id: string, user: User | null) {
    try {
        if (user?.role === 'vendedor_cobranca') {
            throw new Error('Permissão negada: Vendedor Cobrança não pode excluir clientes permanentemente.');
        }

        const existing = await db.customer.findUnique({ where: { id } });
        if (!existing) {
            // If already deleted, just return success
            return { success: true };
        }

        await db.customer.delete({
            where: { id }
        });
        revalidatePath('/admin/clientes');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}


export async function generateCustomerCodesAction(user: User | null) {
    try {
        const customersWithoutCode = await db.customer.findMany({
            where: { OR: [{ code: null }, { code: '' }] },
            orderBy: { createdAt: 'asc' }
        });

        let updatedCount = 0;

        if (customersWithoutCode.length > 0) {
            const { startNumber } = await reserveCustomerCodes(customersWithoutCode.length);

            for (let i = 0; i < customersWithoutCode.length; i++) {
                const cust = customersWithoutCode[i];
                const codeNumber = startNumber + i;
                const code = String(codeNumber).padStart(5, '0');

                await db.customer.update({
                    where: { id: cust.id },
                    data: { code }
                });
                updatedCount++;
            }
        }

        revalidatePath('/admin/clientes');
        return { success: true, count: updatedCount };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
