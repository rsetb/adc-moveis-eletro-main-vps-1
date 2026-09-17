'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getFreightReminderAction } from '@/app/actions/admin/freight';
export default function FreightReminder() {
  const [reminder, setReminder] = useState({ count: 0, balance: 0 });
  useEffect(() => {
    let disposed = false;
    let running = false;
    const check = async () => {
      if (running || document.visibilityState === 'hidden') return;
      running = true;
      try { const result = await getFreightReminderAction(); if (!disposed) setReminder(result); }
      catch { if (!disposed) setReminder({ count: 0, balance: 0 }); }
      finally { running = false; }
    };
    void check();
    const interval = setInterval(() => void check(), 30000);
    const visible = () => void check();
    document.addEventListener('visibilitychange', visible);
    return () => { disposed = true; clearInterval(interval); document.removeEventListener('visibilitychange', visible); };
  }, []);
  if (!reminder.count) return null;
  return <div role="alert" className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-amber-500 bg-amber-50 p-4 text-amber-950 shadow-lg print:hidden"><p className="font-semibold">Fretes com pagamento a concluir</p><p className="mt-1 text-sm">Há {reminder.count} frete(s) de hoje ou dias anteriores com saldo de {(reminder.balance / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.</p><Link className="mt-2 inline-block font-semibold underline" href="/admin/fretes">Conferir pagamentos</Link></div>;
}
