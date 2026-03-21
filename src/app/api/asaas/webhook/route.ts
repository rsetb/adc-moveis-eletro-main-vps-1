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
      status: z.string().optional(),
      externalReference: z.string().optional(),
      value: z.number().optional(),
      netValue: z.number().optional(),
      paymentDate: z.string().optional(),
      confirmedDate: z.string().optional(),
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

    let orderId = externalReference;
    if (!orderId) {
      const orderByPayment = await db.order.findFirst({
        where: {
          asaas: {
            path: '$.paymentId',
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
