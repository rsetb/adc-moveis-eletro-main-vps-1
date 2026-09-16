import test from 'node:test';
import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';
import { createFreightOnce, assertFreightOwnerCanChange, retryFreightTransaction } from '../src/lib/freight-integrity';
import { freightSchema } from '../src/lib/freight';
import { persistFreightDraft, readFreightDraft, clearFreightDraft } from '../src/lib/freight-draft';

const input = freightSchema.parse({ deliveryDate: '2026-09-16', customerName: 'Cliente de teste', neighborhood: 'Centro', amountCents: 4550 });
const actor = { id: 'owner', name: 'Titular' };
const requestId = '896d2c8a-769e-43e7-85d5-776867be6bb3';

function freightStore() {
  const records = new Map<string, { id: string; createdById: string; amountCents: number; events: { details: typeof input }[] }>();
  let writes = 0;
  const tx = {
    freightPayment: {
      async findUnique({ where }: { where: { id: string } }) { return records.get(where.id) ?? null; },
      async create({ data }: { data: { id: string; createdById: string; amountCents: number; events: { create: { details: typeof input } } } }) {
        if (records.has(data.id)) throw Object.assign(new Error('Unique key'), { code: 'P2002' });
        records.set(data.id, { id: data.id, createdById: data.createdById, amountCents: data.amountCents, events: [{ details: data.events.create.details }] });
        writes++;
      },
    },
  } as unknown as Pick<Prisma.TransactionClient, 'freightPayment'>;
  return { tx, records, writes: () => writes };
}

test('repetir envio após perder a resposta cria somente um frete e um evento', async () => {
  const store = freightStore();
  await createFreightOnce(store.tx, requestId, input, actor);
  await createFreightOnce(store.tx, requestId, input, actor);
  assert.equal(store.writes(), 1);
  assert.equal(store.records.get(requestId)?.events.length, 1);
});

test('repetições simultâneas recuperam colisão sem duplicar o frete', async () => {
  const store = freightStore();
  await Promise.all([
    retryFreightTransaction(() => createFreightOnce(store.tx, requestId, input, actor)),
    retryFreightTransaction(() => createFreightOnce(store.tx, requestId, input, actor)),
  ]);
  assert.equal(store.writes(), 1);
});

test('mesmo envio não aceita dados diferentes nem outro autor', async () => {
  const store = freightStore();
  await createFreightOnce(store.tx, requestId, input, actor);
  await assert.rejects(createFreightOnce(store.tx, requestId, { ...input, amountCents: 100 }, actor), /outro lançamento/);
  await assert.rejects(createFreightOnce(store.tx, requestId, input, { id: 'other', name: 'Outro' }), /outro lançamento/);
  assert.equal(store.writes(), 1);
});

test('repetir envio original depois de editar não desfaz a edição', async () => {
  const store = freightStore();
  await createFreightOnce(store.tx, requestId, input, actor);
  store.records.get(requestId)!.amountCents = 9900;
  await createFreightOnce(store.tx, requestId, input, actor);
  assert.equal(store.records.get(requestId)?.amountCents, 9900);
  assert.equal(store.writes(), 1);
});

test('novo identificador permite um segundo frete legítimo com os mesmos dados', async () => {
  const store = freightStore();
  await createFreightOnce(store.tx, requestId, input, actor);
  await createFreightOnce(store.tx, '906d2c8a-769e-43e7-85d5-776867be6bb3', input, actor);
  assert.equal(store.writes(), 2);
});

test('titular não pode ser excluído ou inativado, inclusive por restauração', async () => {
  const tx = { freightAccess: { async findFirst({ where }: { where: { ownerId: string } }) { return where.ownerId === 'owner' ? { ownerId: 'owner' } : null; } } } as unknown as Pick<Prisma.TransactionClient, 'freightAccess'>;
  await assert.rejects(assertFreightOwnerCanChange(tx, 'owner', { deleting: true }), /não pode ser excluída ou desativada/);
  await assert.rejects(assertFreightOwnerCanChange(tx, 'owner', { active: false }), /não pode ser excluída ou desativada/);
  await assertFreightOwnerCanChange(tx, 'owner', { active: true });
  await assertFreightOwnerCanChange(tx, 'other', { deleting: true });
  await assertFreightOwnerCanChange(tx, 'other', { active: false });
});

test('retry refaz a operação após conflito mas não repete erros de autorização', async () => {
  let attempts = 0;
  assert.equal(await retryFreightTransaction(async () => {
    if (++attempts === 1) throw Object.assign(new Error('conflict'), { code: 'P2034' });
    return 'ok';
  }), 'ok');
  assert.equal(attempts, 2);
  attempts = 0;
  await assert.rejects(retryFreightTransaction(async () => { attempts++; throw new Error('Acesso negado'); }), /Acesso negado/);
  assert.equal(attempts, 1);
  attempts = 0;
  await assert.rejects(retryFreightTransaction(async () => { attempts++; throw Object.assign(new Error('conflict'), { code: 'P2034' }); }));
  assert.equal(attempts, 3);
});

test('envio pendente sobrevive à reabertura na mesma sessão e é separado por conta', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  persistFreightDraft(storage, actor.id, { requestId, input });
  const restored = readFreightDraft(storage, actor.id);
  assert.deepEqual(restored, { requestId, input });
  assert.equal(readFreightDraft(storage, 'other'), null);
  clearFreightDraft(storage, actor.id);
  assert.equal(readFreightDraft(storage, actor.id), null);
});
