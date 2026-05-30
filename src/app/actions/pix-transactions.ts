'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function getPixTransactionsAction(filters?: {
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}) {
  try {
    const where: any = {};

    if (filters?.status && filters.status !== 'all') {
      where.status = filters.status;
    }

    if (filters?.startDate || filters?.endDate) {
      where.horario = {};
      if (filters.startDate) where.horario.gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        where.horario.lte = end;
      }
    }

    if (filters?.search) {
      const s = filters.search.toLowerCase();
      where.OR = [
        { pagadorNome: { contains: s, mode: 'insensitive' } },
        { pagadorCpf: { contains: s } },
        { pagadorCnpj: { contains: s } },
        { endToEndId: { contains: s } },
        { infoPagador: { contains: s, mode: 'insensitive' } },
        { orderRef: { contains: s, mode: 'insensitive' } },
      ];
    }

    const transactions = await db.pixTransaction.findMany({
      where,
      orderBy: { horario: 'desc' },
      take: 200,
    });

    return { success: true, data: transactions };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function matchPixToOrderAction(
  transactionId: string,
  orderId: string,
  userId: string,
  userName: string,
) {
  try {
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) return { success: false, error: 'Pedido não encontrado.' };

    await db.pixTransaction.update({
      where: { id: transactionId },
      data: {
        status: 'vinculado',
        orderId,
        orderRef: order.id,
        matchedById: userId,
        matchedByName: userName,
        matchedAt: new Date(),
      },
    });

    revalidatePath('/admin/validar-pix');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function ignorePixTransactionAction(transactionId: string) {
  try {
    await db.pixTransaction.update({
      where: { id: transactionId },
      data: { status: 'ignorado' },
    });
    revalidatePath('/admin/validar-pix');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createManualPixTransactionAction(data: {
  endToEndId: string;
  valor: number;
  horario: string;
  pagadorNome?: string;
  pagadorCpf?: string;
  infoPagador?: string;
}) {
  try {
    const exists = await db.pixTransaction.findUnique({
      where: { endToEndId: data.endToEndId },
    });
    if (exists) return { success: false, error: 'EndToEndId já cadastrado.' };

    const record = await db.pixTransaction.create({
      data: {
        endToEndId: data.endToEndId,
        valor: data.valor,
        horario: new Date(data.horario),
        pagadorNome: data.pagadorNome || null,
        pagadorCpf: data.pagadorCpf || null,
        infoPagador: data.infoPagador || null,
        status: 'recebido',
      },
    });

    revalidatePath('/admin/validar-pix');
    return { success: true, data: record };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
