// In-memory change timestamp tracker.
// When any server action mutates data, it calls notifyChange(key).
// The SSE endpoint watches these timestamps and pushes updates to all connected clients.

export type ChangeKey = 'orders' | 'products' | 'customers';

const timestamps: Record<ChangeKey, number> = {
  orders: Date.now(),
  products: Date.now(),
  customers: Date.now(),
};

export function notifyChange(key: ChangeKey): void {
  timestamps[key] = Date.now();
}

export function getSnapshot(): Record<ChangeKey, number> {
  return { ...timestamps };
}
