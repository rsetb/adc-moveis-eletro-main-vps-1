import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function onlyDigits(value: string) {
  return (value || "").replace(/\D/g, "")
}

export function maskCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

export function maskPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length === 0) return ""
  if (digits.length <= 2) return `(${digits}`

  const area = digits.slice(0, 2)
  const rest = digits.slice(2)

  if (rest.length === 0) return `(${area})`
  if (rest.length <= 4) return `(${area}) ${rest}`
  if (rest.length <= 8) return `(${area}) ${rest.slice(0, 4)}-${rest.slice(4)}`
  return `(${area}) ${rest.slice(0, 5)}-${rest.slice(5)}`
}

export function maskZip(value: string) {
  const digits = onlyDigits(value).slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

export const toIsoNoon = (value: Date | string) => {
  const d = new Date(value);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
};

export type BillingPriority = 'critical' | 'warning' | 'upcoming' | null;

const utcMidnightMs = (d: Date) => {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

export const getBillingPriority = (now: Date, dueDate: Date) => {
  const nowMs = utcMidnightMs(now);
  const dueMs = utcMidnightMs(dueDate);
  const diffDays = Math.floor((nowMs - dueMs) / (24 * 60 * 60 * 1000));
  const daysOverdue = Math.max(0, diffDays);
  const daysUntilDue = Math.max(0, -diffDays);

  if (daysOverdue >= 90) return { priority: 'critical' as BillingPriority, daysOverdue, daysUntilDue };
  if (daysOverdue >= 30) return { priority: 'warning' as BillingPriority, daysOverdue, daysUntilDue };
  if (daysOverdue === 0 && daysUntilDue <= 7) return { priority: 'upcoming' as BillingPriority, daysOverdue, daysUntilDue };
  return { priority: null as BillingPriority, daysOverdue, daysUntilDue };
};

export type StockDelta = { productId: string; delta: number };

export const computeStockDeltas = (previousItems: any[], nextItems: any[]): StockDelta[] => {
  const safeArray = (v: any) => (Array.isArray(v) ? v : []);

  const summarize = (items: any[]) => {
    const map = new Map<string, number>();
    for (const item of safeArray(items)) {
      const id = String(item?.id || '').trim();
      if (!id || id.startsWith('CUSTOM-')) continue;
      const quantity = Number(item?.quantity || 0);
      if (!Number.isFinite(quantity) || quantity <= 0) continue;
      map.set(id, (map.get(id) || 0) + quantity);
    }
    return map;
  };

  const prev = summarize(previousItems);
  const next = summarize(nextItems);
  const ids = new Set<string>([...prev.keys(), ...next.keys()]);

  const deltas: StockDelta[] = [];
  for (const id of ids) {
    const oldQty = prev.get(id) || 0;
    const newQty = next.get(id) || 0;
    const delta = newQty - oldQty;
    if (delta !== 0) deltas.push({ productId: id, delta });
  }

  deltas.sort((a, b) => a.productId.localeCompare(b.productId));
  return deltas;
};
