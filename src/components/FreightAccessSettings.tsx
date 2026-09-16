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
  const [responsibleIds, setResponsibleIds] = useState<string[]>([]);
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
      if (result.canConfigure) { setSettings(result); setResponsibleIds(result.responsibleIds ?? []); }
    }).catch(() => { if (active) setError('Não foi possível carregar o acesso aos fretes.'); });
    return () => { active = false; };
  }, [user?.id]);

  if (!settings) return error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null;

  return <Card id="acesso-fretes"><CardHeader><CardTitle>Acesso aos pagamentos de frete</CardTitle><CardDescription>Somente sua conta e uma pessoa escolhida terão acesso a esta página.</CardDescription></CardHeader><CardContent className="space-y-4">
    <p className="text-sm">Titular: <strong>{settings.ownerName}</strong>. {settings.configured ? 'Somente você pode trocar os responsáveis.' : 'Ao ativar, sua conta será o titular deste controle.'}</p>
    <div className="max-w-lg">
      <Label>Responsáveis pelos registros (até 4)</Label>
      <div className="mt-2 space-y-2 max-h-60 overflow-y-auto rounded-md border bg-background p-3">
        <label className="flex items-center space-x-2 text-sm cursor-pointer">
          <input type="checkbox" disabled={busy} checked={responsibleIds.length === 0} onChange={() => setResponsibleIds([])} className="h-4 w-4 rounded" />
          <span>Ninguém além de mim</span>
        </label>
        {settings.users.map(person => (
          <label key={person.id} className="flex items-center space-x-2 text-sm cursor-pointer">
            <input type="checkbox" disabled={busy || (!responsibleIds.includes(person.id) && responsibleIds.length >= 4)} checked={responsibleIds.includes(person.id)} onChange={e => {
              if (e.target.checked) setResponsibleIds(prev => prev.length < 4 ? [...prev, person.id] : prev);
              else setResponsibleIds(prev => prev.filter(id => id !== person.id));
            }} className="h-4 w-4 rounded" />
            <span>{person.name} ({person.username})</span>
          </label>
        ))}
      </div>
    </div>
    <p className="text-sm text-muted-foreground">Caso remova um responsável, o acesso dele será revogado. Cada pessoa deve usar sua própria conta.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={async () => {
      setBusy(true); setError(''); setNotice('');
      try {
        const result = await saveFreightSettingsAction(responsibleIds, settings.updatedAt);
        if (!result.success) { setError(result.error); return; }
        window.dispatchEvent(new Event('freight-access-updated'));
        const refreshed = await getFreightSettingsAction();
        if (!refreshed.success || !refreshed.canConfigure) { setError('Acesso salvo. Atualize a página para conferir.'); return; }
        setSettings(refreshed); setResponsibleIds(refreshed.responsibleIds ?? []);
        setNotice('Acesso aos fretes salvo.');
      } catch { setError('Não foi possível confirmar a configuração. Atualize a página antes de tentar novamente.'); }
      finally { setBusy(false); }
    }}>{busy ? 'Salvando…' : settings.configured ? 'Salvar responsáveis' : 'Ativar controle de fretes'}</Button>
      {settings.configured && <Button asChild variant="outline"><Link href="/admin/fretes">Abrir pagamentos de frete</Link></Button>}
    </div>
  </CardContent></Card>;
}
