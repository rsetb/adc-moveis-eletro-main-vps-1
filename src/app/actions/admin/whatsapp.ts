'use server';

import { db } from '@/lib/db';
import type { User } from '@/lib/types';
import { getSession } from '@/lib/session';

async function assertAuth() {
  const session = await getSession();
  if (!session) throw new Error('Sem permissão.');
}

export async function getWhatsappSessionsAction(customerId: string) {
  try {
    await assertAuth();
    const sessions = await (db as any).whatsappSession.findMany({
      where: { customerId },
      orderBy: { importedAt: 'desc' },
      select: { id: true, title: true, importedAt: true, importedBy: true, messageCount: true },
    });
    return { success: true, data: sessions as any[] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getWhatsappMessagesAction(sessionId: string) {
  try {
    await assertAuth();
    const messages = await (db as any).whatsappMessage.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' },
    });
    return { success: true, data: messages as any[] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteWhatsappSessionAction(sessionId: string, user: User | null) {
  try {
    await assertAuth();
    await (db as any).whatsappSession.delete({ where: { id: sessionId } });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
