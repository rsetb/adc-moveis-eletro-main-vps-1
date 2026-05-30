'use server';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Itaú envia o webhook com um header de autenticação
// Configure ITAU_WEBHOOK_SECRET no .env com o token que você definiu no portal do Itaú
const WEBHOOK_SECRET = process.env.ITAU_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  try {
    // Valida o token de autenticação do webhook
    if (WEBHOOK_SECRET) {
      const authHeader = req.headers.get('x-webhook-secret')
        || req.headers.get('authorization')?.replace('Bearer ', '');

      if (authHeader !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await req.json();

    // O Itaú envia um array de PIX recebidos
    // Formato: { pix: [{ endToEndId, txid, valor, horario, pagador, infoPagador }] }
    const pixList: any[] = body?.pix ?? (Array.isArray(body) ? body : [body]);

    const created: string[] = [];

    for (const pix of pixList) {
      const endToEndId = pix.endToEndId ?? pix.end_to_end_id;
      if (!endToEndId) continue;

      // Evita duplicatas
      const exists = await db.pixTransaction.findUnique({ where: { endToEndId } });
      if (exists) continue;

      const valor = parseFloat(String(pix.valor ?? pix.value ?? '0'));
      const horario = new Date(pix.horario ?? pix.timestamp ?? Date.now());

      const pagador = pix.pagador ?? {};
      const pagadorNome: string = pagador.nome ?? pix.payerName ?? '';
      const pagadorCpf: string = pagador.cpf ?? pix.payerCpf ?? '';
      const pagadorCnpj: string = pagador.cnpj ?? pix.payerCnpj ?? '';
      const infoPagador: string = pix.infoPagador ?? pix.description ?? '';

      const record = await db.pixTransaction.create({
        data: {
          endToEndId,
          txid: pix.txid ?? null,
          valor,
          horario,
          pagadorNome,
          pagadorCpf: pagadorCpf || null,
          pagadorCnpj: pagadorCnpj || null,
          infoPagador: infoPagador || null,
          status: 'recebido',
          raw: pix,
        },
      });

      created.push(record.id);
    }

    return NextResponse.json({ received: created.length, ids: created });
  } catch (err: any) {
    console.error('[PIX Webhook]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// GET para verificar se o webhook está ativo (Itaú faz uma requisição de verificação)
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'pix-webhook' });
}
