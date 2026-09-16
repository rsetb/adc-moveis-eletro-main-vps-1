'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getFreightSettingsAction, saveFreightSettingsAction } from '@/app/actions/admin/freight';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Settings = Extract<Awaited<ReturnType<typeof getFreightSettingsAction>>, { canConfigure: true }>;

export default function FreightAccessSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [responsibleId, setResponsibleId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    setSettings(null);
    if (!user) return;
    getFreightSettingsAction().then(result => {
      if (!active) return;
      if (!result.success) { setError(result.error); return; }
      if (result.canConfigure) { setSettings(result); setResponsibleId(result.responsibleId ?? ''); }
    }).catch(() => { if (active) setError('Não foi possível carregar o acesso aos fretes.'); });
    return () => { active = false; };
  }, [user?.id]);

  if (!settings) return error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null;

  return <Card id="acesso-fretes"><CardHeader><CardTitle>Acesso aos pagamentos de frete</CardTitle><CardDescription>Somente sua conta e uma pessoa escolhida terão acesso a esta página.</CardDescription></CardHeader><CardContent className="space-y-4">
    <p className="text-sm">Titular: <strong>{settings.ownerName}</strong>. {settings.configured ? 'Somente você pode trocar o responsável.' : 'Ao ativar, sua conta será o titular deste controle.'}</p>
    <div className="max-w-lg"><Label htmlFor="freight-responsible">Responsável pelos registros</Label><select id="freight-responsible" disabled={busy} className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={responsibleId} onChange={event => setResponsibleId(event.target.value)}>
      <option value="">Definir depois — somente minha conta</option>
      {settings.users.map(person => <option key={person.id} value={person.id}>{person.name} ({person.username})</option>)}
    </select></div>
    <p className="text-sm text-muted-foreground">Ao trocar o responsável, o anterior perde o acesso. Cada pessoa deve usar sua própria conta, em qualquer computador.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={async () => {
      setBusy(true); setError(''); setNotice('');
      try {
        const result = await saveFreightSettingsAction(responsibleId || null, settings.updatedAt);
        if (!result.success) { setError(result.error); return; }
        window.dispatchEvent(new Event('freight-access-updated'));
        const refreshed = await getFreightSettingsAction();
        if (!refreshed.success || !refreshed.canConfigure) { setError('Acesso salvo. Atualize a página para conferir.'); return; }
        setSettings(refreshed); setResponsibleId(refreshed.responsibleId ?? '');
        setNotice('Acesso aos fretes salvo.');
      } catch { setError('Não foi possível confirmar a configuração. Atualize a página antes de tentar novamente.'); }
      finally { setBusy(false); }
    }}>{busy ? 'Salvando…' : settings.configured ? 'Salvar responsável' : 'Ativar controle de fretes'}</Button>
      {settings.configured && <Button asChild variant="outline"><Link href="/admin/fretes">Abrir pagamentos de frete</Link></Button>}
    </div>
  </CardContent></Card>;
}
