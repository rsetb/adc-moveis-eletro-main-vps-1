'use client';

import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Truck, Trash2 } from 'lucide-react';
import { freightSchema, parseFreightAmount, type FreightInput, type FreightRow } from '@/lib/freight';
import { readFreightDraft, persistFreightDraft, clearFreightDraft, type FreightDraft } from '@/lib/freight-draft';
import FreightCustomerName from '@/components/FreightCustomerName';
import type { FreightCustomerSearchResult } from '@/lib/freight-customer';

type Result = { success: true; rows: FreightRow[] } | { success: false; error: string };
type Props = {
  initialRows: FreightRow[];
  currentUserId: string;
  saveAction: (input: FreightInput, id?: string, updatedAt?: string, requestId?: string) => Promise<Result>;
  paymentAction: (id: string, paid: boolean, updatedAt: string) => Promise<Result>;
  deleteAction: (id: string) => Promise<Result>;
  searchCustomersAction: (query: string) => Promise<FreightCustomerSearchResult>;
};

const currency = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const showDate = (value: string) => value.slice(0, 10).split('-').reverse().join('/');
function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
}

export default function FreightPaymentsTable({ initialRows, currentUserId, saveAction, paymentAction, deleteAction, searchCustomersAction }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FreightRow | null>(null);
  const [draft, setDraft] = useState<FreightDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const cepRequest = useRef(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [paymentTarget, setPaymentTarget] = useState<FreightRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FreightRow | null>(null);
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filtered = useMemo(() => rows.filter(row =>
    normalize(`${row.customerName} ${row.neighborhood} ${row.orderNumber ?? ''}`).includes(normalize(search)) &&
    (status === 'all' || (status === 'paid' ? !!row.paidAt : !row.paidAt))
  ), [rows, search, status]);
  const pending = rows.reduce((sum, row) => sum + (row.paidAt ? 0 : row.amountCents), 0);
  const paid = rows.reduce((sum, row) => sum + (row.paidAt ? row.amountCents : 0), 0);

  const formValues = editing ?? draft?.input;

  function handleCepMask(e: React.ChangeEvent<HTMLInputElement>) {
    const request = ++cepRequest.current;
    const input = e.target;
    const form = input.form;
    let raw = e.target.value.replace(/\D/g, '');
    if (raw.length > 8) raw = raw.slice(0, 8);
    e.target.value = raw.length > 5 ? raw.slice(0, 5) + '-' + raw.slice(5) : raw;
    if (raw.length === 8) {
      fetch(`https://viacep.com.br/ws/${raw}/json/`).then(r => r.json()).then(data => {
        if (!data.erro && request === cepRequest.current && input.isConnected && input.value.replace(/\D/g, '') === raw) {
          if (form) {
            const addrInput = form.elements.namedItem('address') as HTMLInputElement;
            const neighInput = form.elements.namedItem('neighborhood') as HTMLInputElement;
            if (addrInput && !addrInput.value) { addrInput.value = data.logradouro; }
            if (neighInput && !neighInput.value) { neighInput.value = data.bairro; }
          }
        }
      }).catch(() => { });
    }
  }

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) { e.target.value = ''; return; }
    e.target.value = (parseInt(raw, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  }

  function openNewFreight() {
    setError('');
    try {
      let pendingDraft = readFreightDraft(sessionStorage, currentUserId);
      if (pendingDraft && rows.some(row => row.id === pendingDraft!.requestId)) {
        clearFreightDraft(sessionStorage, currentUserId);
        pendingDraft = null;
      }
      setDraft(pendingDraft);
      setEditing(null);
      setOpen(true);
    } catch {
      setError('Não foi possível recuperar o envio pendente. Verifique o armazenamento do navegador antes de cadastrar outro frete.');
    }
  }

  async function run(action: () => Promise<Result>, created = false) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await action();
      if (!result.success) { setError(result.error); return; }
      setRows(result.rows);
      if (created) {
        try { clearFreightDraft(sessionStorage, currentUserId); } catch { /* O registro retornado confirma o envio. */ }
        setDraft(null);
      }
      setOpen(false);
      setPaymentTarget(null);
      setDeleteTarget(null);
      setNotice('Registro salvo.');
    } catch {
      setError(created ? 'O envio ficou sem confirmação. Clique em Salvar frete novamente; ele não será duplicado.' : 'Não foi possível confirmar a operação. Atualize a página antes de tentar novamente.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Truck className="h-6 w-6" />Pagamentos de frete</h1>
        <p className="mt-1 text-sm text-muted-foreground">Registre os fretes realizados e acompanhe os pagamentos.</p></div>
      <Button onClick={openNewFreight} disabled={busy}><Plus className="mr-2 h-4 w-4" />Novo frete</Button>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      {[['A pagar', currency(pending)], ['Pago', currency(paid)], ['Fretes registrados', String(rows.length)]].map(([label, value]) =>
        <div key={label} className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}
    </div>
    {error && !open && !paymentTarget && !deleteTarget && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1"><Label htmlFor="freight-search">Buscar por cliente, bairro ou pedido</Label><Input id="freight-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Cliente, bairro ou número do pedido" /></div>
      <div><Label htmlFor="freight-status">Situação</Label><select id="freight-status" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={status} onChange={event => setStatus(event.target.value)}><option value="all">Todos</option><option value="pending">Pendentes</option><option value="paid">Pagos</option></select></div>
    </div>
    <div className="overflow-hidden rounded-xl border bg-card"><Table>
      <TableHeader><TableRow><TableHead>Data do frete</TableHead><TableHead>Pedido</TableHead><TableHead>Nome</TableHead><TableHead>Bairro</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Situação</TableHead><TableHead>Registrado por</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
      <TableBody>{filtered.length === 0 ? <TableRow><TableCell colSpan={8} className="h-28 text-center text-muted-foreground">{rows.length ? 'Nenhum frete encontrado para este filtro.' : 'Nenhum frete registrado. Clique em Novo frete para começar.'}</TableCell></TableRow> : filtered.map(row => <TableRow key={row.id}>
        <TableCell className="whitespace-nowrap">{showDate(row.deliveryDate)}</TableCell>
        <TableCell className="max-w-40 break-words">{row.orderNumber || '—'}</TableCell>
        <TableCell className="font-medium">{row.customerName}{row.notes && <p className="max-w-xs whitespace-pre-wrap break-words text-xs font-normal text-muted-foreground">{row.notes}</p>}</TableCell>
        <TableCell>{row.neighborhood}</TableCell><TableCell className="whitespace-nowrap text-right">{currency(row.amountCents)}</TableCell>
        <TableCell><Badge variant={row.paidAt ? 'secondary' : 'outline'}>{row.paidAt ? 'Pago' : 'Pendente'}</Badge>{row.paidAt && <p className="mt-1 text-xs text-muted-foreground">{new Date(row.paidAt).toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' })} · {row.paidByName}</p>}</TableCell>
        <TableCell>{row.createdByName}</TableCell>
        <TableCell><div className="flex justify-end gap-2"><Button variant="outline" size="sm" disabled={busy || !!row.paidAt} aria-label={`Editar frete`} onClick={() => { setEditing(row); setError(''); setOpen(true); }}><Pencil className="h-4 w-4" /></Button><Button variant="destructive" size="icon" className="h-8 w-8" disabled={busy} aria-label={`Excluir frete`} onClick={() => { setError(''); setDeleteTarget(row); }}><Trash2 className="h-4 w-4" /></Button><Button size="sm" variant={row.paidAt ? 'outline' : 'default'} disabled={busy} onClick={() => { setError(''); setPaymentTarget(row); }}>{row.paidAt ? 'Desfazer pagamento' : 'Marcar pago'}</Button></div></TableCell>
      </TableRow>)}</TableBody>
    </Table></div>
    <p className="text-sm text-muted-foreground">{filtered.length} frete(s) exibido(s) · Total exibido: {currency(filtered.reduce((sum, row) => sum + row.amountCents, 0))}</p>

    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{editing ? 'Editar frete' : 'Novo frete'}</DialogTitle></DialogHeader>
      <form autoComplete="off" key={editing?.id ?? draft?.requestId ?? 'new'} className="space-y-4" onSubmit={event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const amountCents = parseFreightAmount(String(form.get('amount')));
        if (amountCents === null) { setError('Informe um valor positivo, por exemplo: 45,50.'); return; }
        const parsed = freightSchema.safeParse({ deliveryDate: form.get('deliveryDate'), orderNumber: form.get('orderNumber'), driverName: formValues?.driverName ?? '', customerName: form.get('freightRecipientQuery'), zipCode: form.get('zipCode'), address: form.get('address'), complement: form.get('complement'), neighborhood: form.get('neighborhood'), amountCents, notes: form.get('notes') });
        if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
        if (editing) {
          void run(() => saveAction(parsed.data, editing.id, editing.updatedAt));
          return;
        }
        try {
          const pendingDraft = draft ?? { requestId: crypto.randomUUID(), input: parsed.data };
          persistFreightDraft(sessionStorage, currentUserId, pendingDraft);
          setDraft(pendingDraft);
          void run(() => saveAction(pendingDraft.input, undefined, undefined, pendingDraft.requestId), true);
        } catch {
          setError('Não foi possível preservar este envio no navegador. Nenhum frete foi enviado.');
        }
      }}>
        {!editing && draft && <p className="text-sm text-muted-foreground">Confirme este envio antes de cadastrar outro frete. Depois de salvo, você poderá editar os dados.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="freight-date">Data do frete</Label><Input id="freight-date" name="deliveryDate" type="date" required readOnly={!editing && !!draft} defaultValue={formValues?.deliveryDate ?? today()} /></div>
          <div><Label htmlFor="freight-order">Número do pedido (opcional)</Label><Input id="freight-order" name="orderNumber" maxLength={60} readOnly={busy || (!editing && !!draft)} defaultValue={formValues?.orderNumber ?? ''} placeholder="Ex.: 001234" /></div>
        </div>
        <FreightCustomerName defaultValue={formValues?.customerName} readOnly={busy || (!editing && !!draft)} searchAction={searchCustomersAction} onCustomerSelected={() => { cepRequest.current++; }} />
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label htmlFor="freight-cep">CEP</Label><Input id="freight-cep" name="zipCode" readOnly={!editing && !!draft} onChange={handleCepMask} defaultValue={formValues?.zipCode ?? ''} placeholder="00000-000" maxLength={9} /></div>
          <div className="sm:col-span-2"><Label htmlFor="freight-address">Endereço</Label><Input id="freight-address" name="address" required readOnly={!editing && !!draft} minLength={2} maxLength={160} defaultValue={formValues?.address ?? ''} /></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="freight-complement">Complemento</Label><Input id="freight-complement" name="complement" readOnly={!editing && !!draft} maxLength={100} defaultValue={formValues?.complement ?? ''} placeholder="Ex: Apto 101" /></div>
          <div><Label htmlFor="freight-neighborhood">Bairro</Label><Input id="freight-neighborhood" name="neighborhood" required readOnly={!editing && !!draft} minLength={2} maxLength={160} defaultValue={formValues?.neighborhood} /></div>
        </div>
        <div><Label htmlFor="freight-amount">Valor do frete (R$)</Label><Input id="freight-amount" name="amount" inputMode="decimal" required readOnly={!editing && !!draft} onChange={handleAmountChange} defaultValue={formValues ? (formValues.amountCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''} placeholder="0,00" /></div>
        <div><Label htmlFor="freight-notes">Observações (opcional)</Label><Textarea id="freight-notes" name="notes" maxLength={1000} readOnly={!editing && !!draft} defaultValue={formValues?.notes} /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar frete'}</Button></div>
      </form>
    </DialogContent></Dialog>
    <Dialog open={!!deleteTarget} onOpenChange={value => { if (!value && !busy) setDeleteTarget(null); }}><DialogContent><DialogHeader><DialogTitle>Excluir frete?</DialogTitle></DialogHeader>
      {deleteTarget && <><p>Tem certeza que deseja excluir o frete de <strong>{deleteTarget.customerName}</strong> ({currency(deleteTarget.amountCents)})?</p><p className="text-sm text-muted-foreground">Esta operação não pode ser desfeita e ele deixará de ser somado nos totais.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setDeleteTarget(null)}>Cancelar</Button><Button variant="destructive" disabled={busy} onClick={() => void run(() => deleteAction(deleteTarget.id))}>{busy ? 'Excluindo…' : 'Excluir definitivamente'}</Button></div></>}
    </DialogContent></Dialog>
    <Dialog open={!!paymentTarget} onOpenChange={value => { if (!value && !busy) setPaymentTarget(null); }}><DialogContent><DialogHeader><DialogTitle>{paymentTarget?.paidAt ? 'Desfazer pagamento?' : 'Confirmar pagamento?'}</DialogTitle></DialogHeader>
      {paymentTarget && <><p>{paymentTarget.customerName} · {paymentTarget.neighborhood} · {currency(paymentTarget.amountCents)}</p><p className="text-sm text-muted-foreground">{paymentTarget.paidAt ? 'O frete voltará a ficar pendente.' : 'Confirme somente depois de realizar o pagamento do frete.'}</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setPaymentTarget(null)}>Cancelar</Button><Button disabled={busy} onClick={() => void run(() => paymentAction(paymentTarget.id, !paymentTarget.paidAt, paymentTarget.updatedAt))}>{busy ? 'Salvando…' : 'Confirmar'}</Button></div></>}
    </DialogContent></Dialog>
  </div>;
}
