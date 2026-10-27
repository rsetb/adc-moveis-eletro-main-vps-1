import test from 'node:test';
import assert from 'node:assert/strict';
import { requireSession, requireStaff, requireAdmin, AuthError } from '../src/lib/auth-guard';
import { addProductAction, deleteProductAction, updateProductAction } from '../src/app/actions/admin/products';
import { addCategoryAction, deleteCategoryAction } from '../src/app/actions/admin/categories';
import { addCustomerAction, deleteCustomerAction } from '../src/app/actions/admin/customers';
import { updateOrderStatusAction, recordInstallmentPaymentAction, reverseInstallmentPaymentAction } from '../src/app/actions/admin/orders';
import { payCommissionAction, reverseCommissionPaymentAction } from '../src/app/actions/admin/financials';
import { openCashRegisterAction } from '../src/app/actions/admin/cash';
import { addStockEntryAction, adjustStockAction } from '../src/app/actions/admin/stock';
import { rejectTemporaryOrderToTrashAction, restoreTemporaryOrderFromTrashAction } from '../src/app/actions/admin/pending-orders';
import { generateAsaasChargesAction } from '../src/app/actions/admin/asaas';
import { getRecentPriceChangesAction } from '../src/app/actions/admin/price-changes';
import { POST as itauWebhookPost, GET as itauWebhookGet } from '../src/app/api/itau/webhook/route';
import { NextRequest } from 'next/server';

// ─── 1. Testes de AuthGuard (Núcleo de Autorização) ─────────────────────────

test('AuthGuard: requireSession rejeita quando não há sessão ativa', async () => {
  await assert.rejects(
    async () => {
      await requireSession();
    },
    (err: any) => {
      assert(err instanceof AuthError);
      assert.equal(err.statusCode, 401);
      assert.match(err.message, /Sessão inválida ou ausente/i);
      return true;
    }
  );
});

test('AuthGuard: requireStaff rejeita quando não há sessão', async () => {
  await assert.rejects(
    async () => {
      await requireStaff();
    },
    (err: any) => {
      assert(err instanceof AuthError);
      assert.equal(err.statusCode, 401);
      return true;
    }
  );
});

test('AuthGuard: requireAdmin rejeita quando não há sessão', async () => {
  await assert.rejects(
    async () => {
      await requireAdmin();
    },
    (err: any) => {
      assert(err instanceof AuthError);
      assert.equal(err.statusCode, 401);
      return true;
    }
  );
});

// ─── 2. Testes de Server Actions: Bloqueio Sem Sessão e Anti-Spoofing ───────

test('Server Actions: addProductAction rejeita chamada sem sessão, mesmo com user forjado', async () => {
  const forgedUser: any = { id: 'hacker-1', name: 'Atacante', role: 'admin' };
  const res = await addProductAction({ name: 'Produto Fake', price: 100 }, forgedUser);
  assert.equal(res.success, false);
  assert.match(String(res.error), /Sessão inválida ou ausente/i);
});

test('Server Actions: deleteProductAction rejeita chamada sem sessão', async () => {
  const forgedUser: any = { id: 'hacker-1', name: 'Atacante', role: 'admin' };
  const res = await deleteProductAction('PROD-123456', forgedUser);
  assert.equal(res.success, false);
  assert.match(String(res.error), /Sessão inválida ou ausente/i);
});

test('Server Actions: addCategoryAction e deleteCategoryAction rejeitam sem sessão', async () => {
  const forgedUser: any = { id: 'admin', role: 'admin' };
  const resAdd = await addCategoryAction('Nova Categoria', forgedUser);
  assert.equal(resAdd.success, false);
  assert.match(String(resAdd.error), /Sessão inválida ou ausente/i);

  const resDel = await deleteCategoryAction('cat-123', forgedUser);
  assert.equal(resDel.success, false);
  assert.match(String(resDel.error), /Sessão inválida ou ausente/i);
});

test('Server Actions: addCustomerAction rejeita chamada sem sessão', async () => {
  const forgedUser: any = { id: 'vendedor-1', role: 'admin' };
  const res = await addCustomerAction({ name: 'Cliente Invasor', phone: '11999999999' } as any, forgedUser);
  assert.equal(res.success, false);
  assert.match(String(res.error), /Sessão inválida ou ausente/i);
});

test('Server Actions: deleteCustomerAction rejeita chamada sem sessão', async () => {
  const forgedUser: any = { id: 'admin', role: 'admin' };
  const res = await deleteCustomerAction('CUST-123', forgedUser);
  assert.equal(res.success, false);
  assert.match(String(res.error), /Sessão inválida ou ausente/i);
});

test('Server Actions: updateOrderStatusAction rejeita sem sessão', async () => {
  const forgedUser: any = { id: 'admin', role: 'admin' };
  const res = await updateOrderStatusAction('PED-123', 'Entregue', forgedUser);
  assert.equal(res.success, false);
  assert.match(String((res as any).error), /Sessão inválida ou ausente/i);
});

test('Server Actions: recordInstallmentPaymentAction rejeita sem sessão', async () => {
  const forgedUser: any = { id: 'admin', role: 'admin' };
  const res = await recordInstallmentPaymentAction('PED-123', 1, { amount: 100, method: 'PIX' }, forgedUser);
  assert.equal(res.success, false);
  assert.match(String(res.error), /Sessão inválida ou ausente/i);
});

test('Server Actions: reverseInstallmentPaymentAction rejeita sem sessão', async () => {
  const forgedUser: any = { id: 'admin', role: 'admin' };
  const res = await reverseInstallmentPaymentAction('PED-123', 1, 'PAY-1', forgedUser);
  assert.equal(res.success, false);
  assert.match(String(res.error), /Sessão inválida ou ausente/i);
});

test('Server Actions: payCommissionAction rejeita sem sessão', async () => {
  const forgedUser: any = { id: 'admin', role: 'admin' };
  const res = await payCommissionAction('seller-1', 'Vendedor', 200, ['PED-1'], '01/2026', forgedUser);
  assert.equal(res.success, false);
  assert.match(String(res.error), /Sessão inválida ou ausente/i);
});

test('Server Actions: openCashRegisterAction rejeita sem sessão', async () => {
  const forgedUser: any = { id: 'admin', role: 'admin' };
  const res = await openCashRegisterAction(100, forgedUser);
  assert.equal(res.success, false);
  assert.match(String(res.error), /Sessão inválida ou ausente/i);
});

test('Server Actions: addStockEntryAction e adjustStockAction rejeitam sem sessão', async () => {
  const forgedUser: any = { id: 'admin', role: 'admin' };
  const resEntry = await addStockEntryAction({ productId: 'prod-1', quantity: 10, unitCost: 50 }, forgedUser);
  assert.equal(resEntry.success, false);
  assert.match(String(resEntry.error), /Sessão inválida ou ausente/i);

  const resAdjust = await adjustStockAction({ productId: 'prod-1', newStock: 100, reason: 'Ajuste manual' }, forgedUser);
  assert.equal(resAdjust.success, false);
  assert.match(String(resAdjust.error), /Sessão inválida ou ausente/i);
});

test('Server Actions: rejectTemporaryOrderToTrashAction e restoreTemporaryOrderFromTrashAction rejeitam sem sessão', async () => {
  const forgedUser: any = { id: 'admin', role: 'admin' };
  const resReject = await rejectTemporaryOrderToTrashAction('temp-1', 'Cancelamento', forgedUser);
  assert.equal(resReject.success, false);
  assert.match(String(resReject.error), /Sessão inválida ou ausente/i);

  const resRestore = await restoreTemporaryOrderFromTrashAction('temp-1', forgedUser);
  assert.equal(resRestore.success, false);
  assert.match(String(resRestore.error), /Sessão inválida ou ausente/i);
});

test('Server Actions: generateAsaasChargesAction rejeita sem sessão', async () => {
  const forgedUser: any = { id: 'admin', role: 'admin' };
  const res = await generateAsaasChargesAction('order-1', forgedUser);
  assert.equal(res.success, false);
  assert.match(String(res.error), /Sessão inválida ou ausente/i);
});

test('Server Actions: getRecentPriceChangesAction rejeita sem sessão', async () => {
  const res = await getRecentPriceChangesAction();
  assert.equal(res.success, false);
  assert.match(String(res.error), /Sessão inválida ou ausente/i);
});

// ─── 3. Testes do Webhook Itaú (Fail-Closed & Autenticação) ─────────────────

test('Webhook Itaú: Retorna 503 quando ITAU_WEBHOOK_SECRET não está configurado', async () => {
  const originalSecret = process.env.ITAU_WEBHOOK_SECRET;
  delete process.env.ITAU_WEBHOOK_SECRET;

  try {
    const req = new NextRequest('http://localhost:3000/api/itau/webhook', {
      method: 'POST',
      body: JSON.stringify({ pix: [{ endToEndId: 'FAKE-123', valor: 500 }] }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await itauWebhookPost(req);
    assert.equal(res.status, 503);

    const json = await res.json();
    assert.match(json.error, /Serviço indisponível/i);

    const getRes = await itauWebhookGet();
    assert.equal(getRes.status, 503);
  } finally {
    if (originalSecret !== undefined) {
      process.env.ITAU_WEBHOOK_SECRET = originalSecret;
    }
  }
});

test('Webhook Itaú: Retorna 401 quando o segredo está configurado mas token é ausente ou inválido', async () => {
  const originalSecret = process.env.ITAU_WEBHOOK_SECRET;
  process.env.ITAU_WEBHOOK_SECRET = 'segredo-super-forte-itau-2026';

  try {
    // 1. Sem header
    const reqNoHeader = new NextRequest('http://localhost:3000/api/itau/webhook', {
      method: 'POST',
      body: JSON.stringify({ pix: [{ endToEndId: 'FAKE-123', valor: 500 }] }),
      headers: { 'content-type': 'application/json' },
    });
    const resNoHeader = await itauWebhookPost(reqNoHeader);
    assert.equal(resNoHeader.status, 401);

    // 2. Com token incorreto
    const reqWrongToken = new NextRequest('http://localhost:3000/api/itau/webhook', {
      method: 'POST',
      body: JSON.stringify({ pix: [{ endToEndId: 'FAKE-123', valor: 500 }] }),
      headers: {
        'content-type': 'application/json',
        'x-webhook-secret': 'token-incorreto-hacker',
      },
    });
    const resWrongToken = await itauWebhookPost(reqWrongToken);
    assert.equal(resWrongToken.status, 401);

    // 3. GET com segredo configurado retorna 200 ok
    const getRes = await itauWebhookGet();
    assert.equal(getRes.status, 200);
  } finally {
    if (originalSecret !== undefined) {
      process.env.ITAU_WEBHOOK_SECRET = originalSecret;
    } else {
      delete process.env.ITAU_WEBHOOK_SECRET;
    }
  }
});
