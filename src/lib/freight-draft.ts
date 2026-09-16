import { z } from 'zod';
import { freightSchema } from './freight';

const draftSchema = z.object({ requestId: z.string().uuid(), input: freightSchema }).strict();
export type FreightDraft = z.infer<typeof draftSchema>;
type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const key = (userId: string) => `freight-pending:${userId}`;

export function readFreightDraft(storage: DraftStorage, userId: string): FreightDraft | null {
  const saved = storage.getItem(key(userId));
  return saved ? draftSchema.parse(JSON.parse(saved)) : null;
}

export function persistFreightDraft(storage: DraftStorage, userId: string, draft: FreightDraft): void {
  storage.setItem(key(userId), JSON.stringify(draftSchema.parse(draft)));
}

export function clearFreightDraft(storage: DraftStorage, userId: string): void {
  storage.removeItem(key(userId));
}
