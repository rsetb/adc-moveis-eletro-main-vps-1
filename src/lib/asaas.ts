export type AsaasConfig = {
    baseUrl: string;
    token: string;
};

function asaasHeaders(token: string) {
    return { 'Content-Type': 'application/json', access_token: token };
}

async function asaasRequest<T>(config: AsaasConfig, path: string, method = 'GET', body?: object): Promise<T> {
    const url = `${config.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    const res = await fetch(url, {
        method,
        headers: asaasHeaders(config.token),
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
    });

    const text = await res.text();
    let json: any = null;
    if (text) { try { json = JSON.parse(text); } catch { json = { raw: text }; } }

    if (!res.ok) {
        const msg = (json?.errors as any[])?.[0]?.description || `Asaas HTTP ${res.status}`;
        throw new Error(msg);
    }

    return json as T;
}

export async function findOrCreateAsaasCustomer(config: AsaasConfig, params: {
    name: string;
    cpf: string;
    phone?: string;
}): Promise<string> {
    const cpf = params.cpf.replace(/\D/g, '');
    const list = await asaasRequest<{ data?: Array<{ id: string }> }>(config, `/customers?cpfCnpj=${encodeURIComponent(cpf)}`);
    if (list.data?.length) return list.data[0].id;

    const created = await asaasRequest<{ id: string }>(config, '/customers', 'POST', {
        name: params.name,
        cpfCnpj: cpf,
        mobilePhone: params.phone?.replace(/\D/g, '') || undefined,
        notificationDisabled: false,
    });
    return created.id;
}

export async function createAsaasInstallmentCharge(config: AsaasConfig, params: {
    customerId: string;
    value: number;
    dueDate: string;
    description: string;
    externalReference: string;
}): Promise<{ id: string; status: string; invoiceUrl: string }> {
    return asaasRequest(config, '/payments', 'POST', {
        customer: params.customerId,
        billingType: 'UNDEFINED',
        value: params.value,
        dueDate: params.dueDate,
        description: params.description,
        externalReference: params.externalReference,
        notificationEnabled: true,
    });
}

export async function getAsaasPayment(config: AsaasConfig, chargeId: string): Promise<{
    id: string;
    status: string;
    value: number;
    invoiceUrl: string;
    paymentDate?: string;
}> {
    return asaasRequest(config, `/payments/${encodeURIComponent(chargeId)}`);
}

export async function cancelAsaasPayment(config: AsaasConfig, chargeId: string): Promise<void> {
    await asaasRequest(config, `/payments/${encodeURIComponent(chargeId)}`, 'DELETE');
}
