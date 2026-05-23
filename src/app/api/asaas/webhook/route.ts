import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import type { AsaasSettings } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const webhookSchema = z.object({
  event: z.string().min(1),
  payment: z
    .object({
      id: z.string().min(1),
      status: z.string().nullish(),
      externalReference: z.string().nullish(),
      value: z.number().nullish(),
      netValue: z.number().nullish(),
      paymentDate: z.string().nullish(),
      confirmedDate: z.string().nullish(),
    })
    .passthrough(),
}).passthrough();

function isPaidStatus(status?: string | null) {
  const s = (status || '').toUpperCase();
  return s === 'RECEIVED' || s === 'CONFIRMED';
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido.' }, { status: 400 });
  }

  const parsed = webhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const { event, payment } = parsed.data;
  const paymentId = payment.id;
  const externalReference = (payment.externalReference || '').trim();

  try {
    // Buscar token do webhook nas configurações
    let expectedToken = (process.env.ASAAS_WEBHOOK_TOKEN || '').trim();
    if (!expectedToken) {
      const settingsData = await db.config.findUnique({ where: { key: 'asaasSettings' } });
      if (settingsData?.value) {
        const settings = settingsData.value as AsaasSettings;
        expectedToken = (settings.webhookToken || '').trim();
      }
    }

    const providedToken = (request.headers.get('asaas-access-token') || '').trim();
    if (!expectedToken || !providedToken || providedToken !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Detect per-installment charge: externalReference = "{orderId}__{installmentNumber}"
    const isInstallmentCharge = externalReference.includes('__');

    if (isInstallmentCharge && isPaidStatus(payment.status)) {
      const separatorIdx = externalReference.lastIndexOf('__');
      const orderId = externalReference.substring(0, separatorIdx);
      const installmentNumber = parseInt(externalReference.substring(separatorIdx + 2));

      if (orderId && !isNaN(installmentNumber)) {
        const order = await db.order.findUnique({ where: { id: orderId } });
        if (order) {
          const installmentDetails = (order.installmentDetails as any[]) || [];
          const installment = installmentDetails.find((i: any) => i.installmentNumber === installmentNumber);

          if (installment && installment.status !== 'Pago') {
            installment.paidAmount = installment.amount;
            installment.status = 'Pago';
            installment.paymentDate = payment.paymentDate || payment.confirmedDate || new Date().toISOString();
            installment.payments = [
              ...(installment.payments || []),
              {
                id: `ASAAS-${paymentId}`,
                amount: payment.value || installment.amount,
                date: installment.paymentDate,
                method: 'Pix',
                receivedBy: 'Asaas (automático)',
              },
            ];

            const existingAsaas = (order.asaas as any) || {};
            const updatedCharges = (existingAsaas.charges || []).map((c: any) =>
              c.installmentNumber === installmentNumber ? { ...c, status: payment.status } : c
            );

            await db.order.update({
              where: { id: orderId },
              data: {
                installmentDetails: installmentDetails as any,
                asaas: { ...existingAsaas, charges: updatedCharges } as any,
              },
            });
          }
        }
      }

      return NextResponse.json({ ok: true });
    }

    // Legacy: single payment per order (externalReference = orderId)
    let orderId = externalReference;
    if (!orderId) {
      const orderByPayment = await db.order.findFirst({
        where: {
          asaas: {
            path: ['paymentId'],
            equals: paymentId,
          },
        },
        select: { id: true },
      });
      if (orderByPayment?.id) {
        orderId = orderByPayment.id;
      }
    }

    if (!orderId) {
      return NextResponse.json({ ok: true });
    }

    const orderData = await db.order.findUnique({
      where: { id: orderId },
      select: { asaas: true },
    });

    if (!orderData) {
      return NextResponse.json({ ok: true });
    }

    const status = payment.status || null;
    const nowIso = new Date().toISOString();
    const existingAsaas = (orderData.asaas || {}) as any;

    const patchAsaas = {
      ...existingAsaas,
      paymentId,
      status,
      lastEvent: event,
      updatedAt: nowIso,
      paidAt: isPaidStatus(status) ? (payment.paymentDate || payment.confirmedDate || nowIso) : (existingAsaas.paidAt || null),
    };

    await db.order.update({
      where: { id: orderId },
      data: { asaas: patchAsaas },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Webhook error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro inesperado.' }, { status: 500 });
  }
}
