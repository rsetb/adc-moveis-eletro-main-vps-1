'use client';

import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Truck, Trash2, Printer, Eye, RotateCcw } from 'lucide-react';
import { freightSchema, parseFreightAmount, type FreightInput, type FreightRow } from '@/lib/freight';
import { readFreightDraft, persistFreightDraft, clearFreightDraft, type FreightDraft } from '@/lib/freight-draft';
import FreightCustomerName from '@/components/FreightCustomerName';
import type { FreightCustomerSearchResult } from '@/lib/freight-customer';

import { received, paymentStatus, statusLabels, type FreightPaymentInput } from '@/lib/freight-payment';
import { filterFreights, freightReport } from '@/lib/freight-report';

type Result = { success: true; rows: FreightRow[] } | { success: false; error: string };
type Props = {
  initialRows: FreightRow[];
  currentUserId: string;
  saveAction: (input: FreightInput, id?: string, updatedAt?: string, requestId?: string) => Promise<Result>;
  paymentAction: (id: string, input: FreightPaymentInput, updatedAt: string) => Promise<Result>;
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
  const [selectedDate, setSelectedDate] = useState(today);
  const [status, setStatus] = useState('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FreightRow | null>(null);
  const [draft, setDraft] = useState<FreightDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const cepRequest = useRef(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [viewTarget, setViewTarget] = useState<FreightRow | null>(null);
  const [refundTarget, setRefundTarget] = useState<FreightRow | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<FreightRow | null>(null);
  const [paymentChoice, setPaymentChoice] = useState<'pending' | 'partial' | 'paid'>('paid');
  const [deleteTarget, setDeleteTarget] = useState<FreightRow | null>(null);
  const filtered = useMemo(() => filterFreights(rows, selectedDate, search, status), [rows, selectedDate, search, status]);
  const pending = filtered.reduce((sum, row) => sum + (row.amountCents - received(row)), 0);
  const paid = filtered.reduce((sum, row) => sum + received(row), 0);

  function printReport() {
    const report = window.open('', '_blank');
    if (!report) { setError('Permita abrir a janela do relatório no navegador para imprimir.'); return; }
    report.opener = null;
    report.document.write(freightReport(filtered, selectedDate, search, status));
    report.document.close();
    report.focus();
  }

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
      setRefundTarget(null);
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
      <div className="flex gap-2"><Button variant="outline" onClick={printReport}><Printer className="mr-2 h-4 w-4" />Imprimir relatório</Button><Button onClick={openNewFreight} disabled={busy}><Plus className="mr-2 h-4 w-4" />Novo frete</Button></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      {[['A pagar', currency(pending)], ['Pago', currency(paid)], ['Fretes registrados', String(filtered.length)]].map(([label, value]) =>
        <div key={label} className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}
    </div>
    {error && !open && !paymentTarget && !refundTarget && !deleteTarget && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    <div className="flex flex-wrap items-end gap-3">
      <div><Label htmlFor="freight-filter-date">Data do frete</Label><Input id="freight-filter-date" type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} /></div><Button variant="outline" onClick={() => setSelectedDate(today())}>Hoje</Button><Button variant="outline" onClick={() => setSelectedDate('')}>Todas as datas</Button>
      <div className="min-w-56 flex-1"><Label htmlFor="freight-search">Buscar por cliente, bairro ou pedido</Label><Input id="freight-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Cliente, bairro ou número do pedido" /></div>
      <div><Label htmlFor="freight-status">Situação</Label><select id="freight-status" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={status} onChange={event => setStatus(event.target.value)}><option value="all">Todos</option><option value="pending">Pendentes</option><option value="partial">Parciais</option><option value="paid">Pagos totais</option></select></div>
    </div>
    <div className="overflow-hidden rounded-xl border bg-card"><Table>
      <TableHeader><TableRow><TableHead>Data do frete</TableHead><TableHead>Pedido</TableHead><TableHead>Nome</TableHead><TableHead>Bairro</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Situação</TableHead><TableHead>Registrado por</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
      <TableBody>{filtered.length === 0 ? <TableRow><TableCell colSpan={8} className="h-28 text-center text-muted-foreground">{rows.length ? 'Nenhum frete encontrado para este filtro.' : 'Nenhum frete registrado. Clique em Novo frete para começar.'}</TableCell></TableRow> : filtered.map(row => <TableRow key={row.id}>
        <TableCell className="whitespace-nowrap">{showDate(row.deliveryDate)}</TableCell>
        <TableCell className="max-w-40 break-words">{row.orderNumber || '—'}</TableCell>
        <TableCell className="font-medium">{row.customerName}{row.notes && <p className="max-w-xs whitespace-pre-wrap break-words text-xs font-normal text-muted-foreground">{row.notes}</p>}</TableCell>
        <TableCell>{row.neighborhood}</TableCell><TableCell className="whitespace-nowrap text-right">{currency(row.amountCents)}<p className="text-xs text-muted-foreground">Recebido: {currency(received(row))}<br />Saldo: {currency(row.amountCents - received(row))}</p></TableCell>
        <TableCell><Badge variant={row.paidAt ? 'secondary' : 'outline'}>{statusLabels[paymentStatus(row)]}</Badge>{received(row) > 0 && <p className="mt-1 text-xs text-muted-foreground">Último recebimento por: {row.paidByName || 'Não informado'}{row.paidAt && <> · {new Date(row.paidAt).toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' })}</>}</p>}</TableCell>
        <TableCell>{row.createdByName}</TableCell>
        <TableCell><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" size="icon" className="h-8 w-8" aria-label="Ver frete" title="Ver frete" onClick={() => setViewTarget(row)}><Eye className="h-4 w-4" /></Button>{received(row) > 0 && <Button variant="outline" size="sm" disabled={busy} onClick={() => { setError(''); setRefundTarget(row); }}><RotateCcw className="mr-1 h-4 w-4" />Estornar</Button>}<Button variant="outline" size="sm" disabled={busy || received(row) > 0} aria-label={`Editar frete`} onClick={() => { setEditing(row); setError(''); setOpen(true); }}><Pencil className="h-4 w-4" /></Button><Button variant="destructive" size="icon" className="h-8 w-8" disabled={busy} aria-label={`Excluir frete`} onClick={() => { setError(''); setDeleteTarget(row); }}><Trash2 className="h-4 w-4" /></Button><Button size="sm" variant={row.paidAt ? 'outline' : 'default'} disabled={busy} onClick={() => { setError(''); setPaymentChoice(received(row) >= row.amountCents ? 'pending' : 'paid'); setPaymentTarget(row); }}>Editar situação</Button></div></TableCell>
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
    <Dialog open={!!viewTarget} onOpenChange={value => { if (!value) setViewTarget(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Detalhes do frete</DialogTitle></DialogHeader>
      {viewTarget && <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">{[
          ['Cliente', viewTarget.customerName], ['Data do frete', showDate(viewTarget.deliveryDate)], ['Pedido', viewTarget.orderNumber || '—'], ['Situação', statusLabels[paymentStatus(viewTarget)]],
          ['CEP', viewTarget.zipCode || '—'], ['Endereço', viewTarget.address || '—'], ['Complemento', viewTarget.complement || '—'], ['Bairro', viewTarget.neighborhood],
          ['Valor total', currency(viewTarget.amountCents)], ['Recebido', currency(received(viewTarget))], ['Saldo', currency(viewTarget.amountCents - received(viewTarget))], ['Registrado por', viewTarget.createdByName],
          ['Último recebimento por', viewTarget.paidByName || '—'], ['Última forma de pagamento', viewTarget.paymentMethod || '—'],
        ].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap break-words font-medium">{value}</dd></div>)}</dl>
        <div><p className="text-sm text-muted-foreground">Observações</p><p className="whitespace-pre-wrap break-words">{viewTarget.notes || '—'}</p></div>
        <h3 className="font-semibold">Histórico de recebimentos e alterações</h3>
        <p className="text-xs text-muted-foreground">O responsável é a conta que confirmou a operação no sistema.</p>
        {viewTarget.history?.length ? <ul className="space-y-2">{viewTarget.history.map(event => <li key={event.id} className="rounded-md border p-3 text-sm"><p className="font-medium">{{ CRIADO: 'Frete criado', EDITADO: 'Frete editado', PAGO: 'Pagamento total registrado', PAGAMENTO_REGISTRADO: 'Pagamento recebido', PAGAMENTO_DESFEITO: 'Estorno de pagamentos' }[event.action] || event.action}</p><p>{event.action === 'PAGAMENTO_REGISTRADO' || event.action === 'PAGO' ? 'Recebido por' : 'Realizado por'}: {event.actorName} · {new Date(event.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })}</p>{event.amountCents !== null && <p>Valor: {currency(event.amountCents)}</p>}{event.method && <p>Forma: {event.method}</p>}</li>)}</ul> : <p className="text-sm text-muted-foreground">Nenhum evento disponível.</p>}
      </div>}
    </DialogContent></Dialog>
    <Dialog open={!!refundTarget} onOpenChange={value => { if (!value && !busy) setRefundTarget(null); }}><DialogContent><DialogHeader><DialogTitle>Estornar pagamentos do frete?</DialogTitle></DialogHeader>
      {refundTarget && <><p>{refundTarget.customerName}</p><p>Serão estornados todos os recebimentos deste frete, no total de <strong>{currency(received(refundTarget))}</strong>. O saldo voltará a {currency(refundTarget.amountCents)} e a situação ficará Pendente.</p><p className="text-sm text-muted-foreground">O histórico será preservado com seu usuário, data e valor do estorno. Esta ação registra o estorno no sistema; não devolve dinheiro por banco ou cartão.</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setRefundTarget(null)}>Cancelar</Button><Button variant="destructive" disabled={busy} onClick={() => void run(() => paymentAction(refundTarget.id, { status: 'pending', amountCents: 0 }, refundTarget.updatedAt))}>{busy ? 'Estornando…' : 'Confirmar estorno'}</Button></div></>}
    </DialogContent></Dialog>
    <Dialog open={!!deleteTarget} onOpenChange={value => { if (!value && !busy) setDeleteTarget(null); }}><DialogContent><DialogHeader><DialogTitle>Excluir frete?</DialogTitle></DialogHeader>
      {deleteTarget && <><p>Tem certeza que deseja excluir o frete de <strong>{deleteTarget.customerName}</strong> ({currency(deleteTarget.amountCents)})?</p><p className="text-sm text-muted-foreground">Esta operação não pode ser desfeita e ele deixará de ser somado nos totais.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setDeleteTarget(null)}>Cancelar</Button><Button variant="destructive" disabled={busy} onClick={() => void run(() => deleteAction(deleteTarget.id))}>{busy ? 'Excluindo…' : 'Excluir definitivamente'}</Button></div></>}
    </DialogContent></Dialog>
    <Dialog open={!!paymentTarget} onOpenChange={value => { if (!value && !busy) setPaymentTarget(null); }}><DialogContent><DialogHeader><DialogTitle>Editar situação do frete</DialogTitle></DialogHeader>
      {paymentTarget && <form key={paymentTarget.id} className="space-y-4" onSubmit={event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const amount = paymentChoice === 'pending' ? 0 : parseFreightAmount(String(data.get('paymentAmount')));
        if (amount === null) { setError('Informe o valor recebido neste pagamento.'); return; }
        const input: FreightPaymentInput = { status: paymentChoice, amountCents: amount, ...(paymentChoice !== 'pending' ? { method: data.get('method') as FreightPaymentInput['method'] } : {}) };
        void run(() => paymentAction(paymentTarget.id, input, paymentTarget.updatedAt));
      }}>
        <p>{paymentTarget.customerName} · Total: {currency(paymentTarget.amountCents)}</p>
        <p>Recebido: {currency(received(paymentTarget))} · Saldo: {currency(paymentTarget.amountCents - received(paymentTarget))}</p>
        {paymentTarget.paymentMethod && <p className="text-sm">Última forma de pagamento: {paymentTarget.paymentMethod}</p>}
        <div><Label htmlFor="payment-status">Situação</Label><select id="payment-status" className="h-10 w-full rounded-md border bg-background px-3" value={paymentChoice} disabled={busy} onChange={event => { setPaymentChoice(event.target.value as typeof paymentChoice); setError(''); }}><option value="pending">Pendente</option><option value="partial" disabled={received(paymentTarget) >= paymentTarget.amountCents}>Parcial</option><option value="paid" disabled={received(paymentTarget) >= paymentTarget.amountCents}>Pago total</option></select></div>
        {paymentChoice === 'pending' ? <p className="text-sm text-destructive">Ao confirmar, os pagamentos registrados serão desfeitos e todo o valor voltará a ficar pendente. O histórico de auditoria será preservado.</p> : <>
          <div><Label htmlFor="payment-amount">Valor recebido agora (R$)</Label><Input key={paymentChoice} id="payment-amount" name="paymentAmount" inputMode="decimal" required disabled={busy} onChange={handleAmountChange} defaultValue={paymentChoice === 'paid' ? ((paymentTarget.amountCents - received(paymentTarget)) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''} /></div>
          <p className="text-xs text-muted-foreground">Informe somente esta entrada ou parcela. Ela será somada ao valor já recebido.</p>
          <div><Label htmlFor="payment-method">Forma de pagamento</Label><select id="payment-method" name="method" required disabled={busy} defaultValue="" className="h-10 w-full rounded-md border bg-background px-3"><option value="" disabled>Selecione</option>{['PIX', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Outro'].map(method => <option key={method}>{method}</option>)}</select></div>
        </>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setPaymentTarget(null)}>Cancelar</Button><Button disabled={busy}>{busy ? 'Salvando…' : 'Confirmar'}</Button></div>
      </form>}
    </DialogContent></Dialog>
  </div>;
}
