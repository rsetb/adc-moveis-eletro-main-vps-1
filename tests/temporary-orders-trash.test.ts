import test from 'node:test';
import assert from 'node:assert/strict';

type Role = 'admin' | 'gerente' | 'vendedor';

type User = {
  id: string;
  name: string;
  role: Role;
};

type TempOrder = {
  id: string;
  createdAt: string;
  data: any;
};

type TrashedTempOrder = TempOrder & {
  deletedAt: string;
  rejectedAt: string;
  rejectedById: string;
  rejectedByName: string;
  rejectedByRole: Role;
  rejectReason: string;
};

function assertTrashPermission(user: User | null) {
  if (!user) throw new Error('Permissão negada: usuário não autenticado.');
  if (user.role !== 'admin' && user.role !== 'gerente') {
    throw new Error('Permissão negada: apenas Admin e Gerente podem acessar a lixeira.');
  }
}

function isWithinRetention(deletedAtIso: string, retentionDays: number, now: Date) {
  const deletedAt = new Date(deletedAtIso);
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  return deletedAt >= cutoff;
}

class InMemoryTemporaryOrderTrashStore {
  private pending = new Map<string, TempOrder>();
  private trash = new Map<string, TrashedTempOrder>();

  create(order: TempOrder) {
    if (this.pending.has(order.id) || this.trash.has(order.id)) throw new Error('ID já existe.');
    this.pending.set(order.id, order);
  }

  hasInPending(id: string) {
    return this.pending.has(id);
  }

  hasInTrash(id: string) {
    return this.trash.has(id);
  }

  rejectToTrash(id: string, deletedAtIso: string, reason: string, user: User | null) {
    assertTrashPermission(user);
    const cleanedReason = reason.trim();
    if (cleanedReason.length < 3) throw new Error('Informe um motivo (mínimo 3 caracteres).');
    const existing = this.pending.get(id);
    if (!existing) throw new Error('Solicitação não encontrada em Pendentes.');
    this.pending.delete(id);
    this.trash.set(id, {
      ...existing,
      deletedAt: deletedAtIso,
      rejectedAt: deletedAtIso,
      rejectedById: user!.id,
      rejectedByName: user!.name,
      rejectedByRole: user!.role,
      rejectReason: cleanedReason,
    });
  }

  restore(id: string, user: User | null, retentionDays: number, now: Date) {
    assertTrashPermission(user);
    const existing = this.trash.get(id);
    if (!existing) throw new Error('Solicitação não encontrada na lixeira.');
    if (!isWithinRetention(existing.deletedAt, retentionDays, now)) throw new Error('Prazo para restauração expirou.');
    this.trash.delete(id);
    const { deletedAt: _deletedAt, rejectedAt: _rejectedAt, rejectedById: _rejectedById, rejectedByName: _rejectedByName, rejectedByRole: _rejectedByRole, rejectReason: _rejectReason, ...restored } = existing;
    this.pending.set(id, restored);
  }

  permanentlyDeleteFromTrash(id: string, user: User | null) {
    assertTrashPermission(user);
    const existing = this.trash.get(id);
    if (!existing) throw new Error('Solicitação não encontrada na lixeira.');
    this.trash.delete(id);
  }
}

test('Rejeição move solicitação para a lixeira com motivo e usuário', () => {
  const store = new InMemoryTemporaryOrderTrashStore();
  store.create({ id: 't1', createdAt: new Date('2026-01-01T10:00:00.000Z').toISOString(), data: { any: true } });

  const user: User = { id: 'u1', name: 'Admin', role: 'admin' };
  store.rejectToTrash('t1', new Date('2026-01-02T10:00:00.000Z').toISOString(), 'Sem estoque', user);

  assert.equal(store.hasInPending('t1'), false);
  assert.equal(store.hasInTrash('t1'), true);
});

test('Restauração devolve a solicitação para Pendentes dentro do prazo', () => {
  const store = new InMemoryTemporaryOrderTrashStore();
  store.create({ id: 't1', createdAt: new Date('2026-01-01T10:00:00.000Z').toISOString(), data: { any: true } });

  const user: User = { id: 'u1', name: 'Gerente', role: 'gerente' };
  const deletedAt = new Date('2026-01-10T10:00:00.000Z').toISOString();
  store.rejectToTrash('t1', deletedAt, 'Cliente cancelou', user);
  store.restore('t1', user, 30, new Date('2026-01-20T10:00:00.000Z'));

  assert.equal(store.hasInPending('t1'), true);
  assert.equal(store.hasInTrash('t1'), false);
});

test('Restauração falha quando o prazo expira', () => {
  const store = new InMemoryTemporaryOrderTrashStore();
  store.create({ id: 't1', createdAt: new Date('2026-01-01T10:00:00.000Z').toISOString(), data: { any: true } });

  const user: User = { id: 'u1', name: 'Admin', role: 'admin' };
  const deletedAt = new Date('2026-01-01T10:00:00.000Z').toISOString();
  store.rejectToTrash('t1', deletedAt, 'Dados inconsistentes', user);

  assert.throws(() => store.restore('t1', user, 30, new Date('2026-02-15T10:00:00.000Z')), /Prazo para restauração expirou/);
});

test('Apenas Admin/Gerente podem rejeitar e restaurar', () => {
  const store = new InMemoryTemporaryOrderTrashStore();
  store.create({ id: 't1', createdAt: new Date('2026-01-01T10:00:00.000Z').toISOString(), data: { any: true } });

  const vendedor: User = { id: 'u2', name: 'Vendedor', role: 'vendedor' };
  assert.throws(() => store.rejectToTrash('t1', new Date().toISOString(), 'Teste', vendedor), /Permissão negada/);
});

test('Excluir permanentemente remove o item da lixeira (sem possibilidade de restauração)', () => {
  const store = new InMemoryTemporaryOrderTrashStore();
  store.create({ id: 't1', createdAt: new Date('2026-01-01T10:00:00.000Z').toISOString(), data: { any: true } });

  const user: User = { id: 'u1', name: 'Admin', role: 'admin' };
  const deletedAt = new Date('2026-01-10T10:00:00.000Z').toISOString();
  store.rejectToTrash('t1', deletedAt, 'Duplicado', user);
  store.permanentlyDeleteFromTrash('t1', user);

  assert.equal(store.hasInTrash('t1'), false);
  assert.equal(store.hasInPending('t1'), false);
  assert.throws(() => store.restore('t1', user, 30, new Date('2026-01-20T10:00:00.000Z')), /Solicitação não encontrada na lixeira/);
});

test('Excluir permanentemente exige permissão e item na lixeira', () => {
  const store = new InMemoryTemporaryOrderTrashStore();
  store.create({ id: 't1', createdAt: new Date('2026-01-01T10:00:00.000Z').toISOString(), data: { any: true } });

  const admin: User = { id: 'u1', name: 'Admin', role: 'admin' };
  const vendedor: User = { id: 'u2', name: 'Vendedor', role: 'vendedor' };

  assert.throws(() => store.permanentlyDeleteFromTrash('t1', admin), /Solicitação não encontrada na lixeira/);
  const deletedAt = new Date('2026-01-10T10:00:00.000Z').toISOString();
  store.rejectToTrash('t1', deletedAt, 'Teste', admin);
  assert.throws(() => store.permanentlyDeleteFromTrash('t1', vendedor), /Permissão negada/);
});
