import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.ITAU_WEBHOOK_SECRET?.trim();

    // Sem configuração do segredo, o serviço deve indicar indisponibilidade e NÃO registrar pagamentos
    if (!webhookSecret) {
      console.warn('[PIX Webhook Itaú] Requisição rejeitada: ITAU_WEBHOOK_SECRET não configurado.');
      return NextResponse.json(
        { error: 'Serviço indisponível. Segredo do webhook não configurado no servidor.' },
        { status: 503 }
      );
    }

    const authHeader = req.headers.get('x-webhook-secret')
      || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado. Token de autenticação ausente.' }, { status: 401 });
    }

    // Comparação em tempo constante contra timing attacks
    const secretBuffer = Buffer.from(webhookSecret);
    const headerBuffer = Buffer.from(authHeader);

    if (secretBuffer.length !== headerBuffer.length || !crypto.timingSafeEqual(secretBuffer, headerBuffer)) {
      return NextResponse.json({ error: 'Não autorizado. Token de autenticação inválido.' }, { status: 401 });
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
  const webhookSecret = process.env.ITAU_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Serviço indisponível. Segredo do webhook não configurado.' }, { status: 503 });
  }
  return NextResponse.json({ status: 'ok', service: 'pix-webhook' });
}
