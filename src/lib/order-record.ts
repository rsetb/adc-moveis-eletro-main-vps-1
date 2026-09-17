import type { Order } from './types';

/**
 * Maps raw database fields (snake_case) to Order type fields (camelCase).
 * This is necessary because $queryRaw does not respect Prisma model mappings.
 */
export function mapRawOrder(raw: any): Order {
    if (!raw) return raw;

    const safeParse = (val: any) => {
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch { return val; }
        }
        return val;
    };

    return {
        ...raw,
        // Basic mappings
        paymentMethod: raw.paymentMethod ?? raw.payment_method,
        downPayment: raw.downPayment ?? raw.down_payment,
        deliveryFee: raw.deliveryFee ?? raw.delivery_fee,
        installments: raw.installments,
        installmentValue: raw.installmentValue ?? raw.installment_value,
        firstDueDate: raw.firstDueDate ?? (raw.first_due_date ? new Date(raw.first_due_date) : undefined),
        trackingCode: raw.trackingCode ?? raw.tracking_code,
        sellerId: raw.sellerId ?? raw.seller_id,
        sellerName: raw.sellerName ?? raw.seller_name,
        commissionDate: raw.commissionDate ?? raw.commission_date,
        commissionPaid: row_bool(raw.commissionPaid ?? raw.commission_paid),
        isCommissionManual: row_bool(raw.isCommissionManual ?? raw.is_commission_manual),
        createdById: raw.createdById ?? raw.created_by_id,
        createdByName: raw.createdByName ?? raw.created_by_name,
        createdByRole: raw.createdByRole ?? raw.created_by_role,
        createdIp: raw.createdIp ?? raw.created_ip,
        createdAt: raw.createdAt ?? raw.created_at,
        updatedAt: raw.updatedAt ?? raw.updated_at,

        // JSON fields (raw queries often return them as strings or need mapping)
        customer: safeParse(raw.customer),
        items: safeParse(raw.items),
        installmentDetails: safeParse(raw.installmentDetails ?? raw.installment_details),
        installmentCardDetails: safeParse(raw.installmentCardDetails ?? raw.installment_card_details),
        attachments: safeParse(raw.attachments),
        asaas: safeParse(raw.asaas),
        printLogs: safeParse(raw.printLogs ?? raw.print_logs),
    } as unknown as Order;
}

function row_bool(val: any) {
    if (val === null || val === undefined) return val;
    return val === 1 || val === true || val === 'true' || val === '1';
}

