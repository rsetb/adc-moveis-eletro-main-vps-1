'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Pencil, Plus, Trash2, Tag } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useData } from '@/context/DataContext';
import { getBannersAction, updateBannersAction } from '@/app/actions/banners';
import { BANNER_DESKTOP_SIZE, BANNER_MOBILE_SIZE, newBannerId } from '@/lib/banners';
import type { BannerLinkType, StoreBanner } from '@/lib/types';
import { cn } from '@/lib/utils';

type ImageCheck = { dataUrl: string; width: number; height: number; ratioOk: boolean };

const LINK_OPTIONS: { value: BannerLinkType; label: string }[] = [
  { value: 'none', label: 'Não fazer nada' },
  { value: 'category', label: 'Abrir uma categoria' },
  { value: 'product', label: 'Abrir um produto' },
  { value: 'offers', label: 'Abrir Ofertas' },
  { value: 'whatsapp', label: 'Abrir o WhatsApp da loja' },
  { value: 'url', label: 'Abrir um link' },
];

const selectCls = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

/** Lê a imagem, reduz para o tamanho alvo (sem cortar) e converte para JPG. */
function processImage(file: File, target: { width: number; height: number }): Promise<ImageCheck> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      reject(new Error('Use uma imagem JPG, PNG ou WEBP.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('Imagem inválida.'));
      img.onload = () => {
        const { naturalWidth: w, naturalHeight: h } = img;
        const scale = Math.min(1, target.width / w);
        const cw = Math.round(w * scale);
        const ch = Math.round(h * scale);
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
        const ratio = w / h;
        const targetRatio = target.width / target.height;
        resolve({ dataUrl, width: w, height: h, ratioOk: Math.abs(ratio - targetRatio) / targetRatio < 0.08 });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const emptyBanner = (): StoreBanner => ({
  id: newBannerId(),
  kind: 'image',
  title: '',
  linkType: 'none',
  active: true,
});

export default function BannerSettingsCard() {
  const { toast } = useToast();
  const { products, categories } = useData();
  const [banners, setBanners] = useState<StoreBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<StoreBanner | null>(null);
  const [checks, setChecks] = useState<{ desktop?: ImageCheck; mobile?: ImageCheck }>({});

  useEffect(() => {
    getBannersAction().then(res => {
      setBanners(res.data);
      setLoading(false);
    });
  }, []);

  const productOptions = useMemo(
    () => products.filter(p => !p.isHidden).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [products]
  );

  const persist = async (next: StoreBanner[], successMsg: string) => {
    setSaving(true);
    const res = await updateBannersAction(next);
    setSaving(false);
    if (!res.success) {
      toast({ title: 'Não foi possível salvar', description: res.error, variant: 'destructive' });
      return false;
    }
    setBanners(next);
    toast({ title: successMsg });
    return true;
  };

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= banners.length) return;
    const next = [...banners];
    [next[index], next[j]] = [next[j], next[index]];
    persist(next, 'Ordem atualizada');
  };

  const toggle = (id: string, active: boolean) =>
    persist(banners.map(b => (b.id === id ? { ...b, active } : b)), active ? 'Banner ativado' : 'Banner desativado');

  const remove = (id: string) => {
    if (!window.confirm('Excluir este banner?')) return;
    persist(banners.filter(b => b.id !== id), 'Banner excluído');
  };

  const startEdit = (b?: StoreBanner) => {
    setEditing(b ? { ...b } : emptyBanner());
    setChecks({});
  };

  const onPickImage = async (which: 'desktop' | 'mobile', file?: File) => {
    if (!file || !editing) return;
    try {
      const target = which === 'desktop' ? BANNER_DESKTOP_SIZE : BANNER_MOBILE_SIZE;
      const result = await processImage(file, target);
      setChecks(prev => ({ ...prev, [which]: result }));
      setEditing(prev => prev && ({ ...prev, [which === 'desktop' ? 'desktopImage' : 'mobileImage']: result.dataUrl }));
    } catch (e: any) {
      toast({ title: 'Imagem não aceita', description: e.message, variant: 'destructive' });
    }
  };

  const saveEditing = async () => {
    if (!editing) return;
    if (!editing.desktopImage) {
      toast({ title: 'Falta a imagem para computador', variant: 'destructive' });
      return;
    }
    const exists = banners.some(b => b.id === editing.id);
    const next = exists
      ? banners.map(b => (b.id === editing.id ? editing : b))
      : [editing, ...banners];
    if (await persist(next, exists ? 'Banner atualizado' : 'Banner criado')) setEditing(null);
  };

  const describeLink = (b: StoreBanner) => {
    switch (b.linkType) {
      case 'category': return <>abre a categoria <strong className="capitalize">{b.linkValue}</strong></>;
      case 'product': return <>abre o produto <strong>{products.find(p => p.id === b.linkValue)?.name ?? b.linkValue}</strong></>;
      case 'offers': return <>abre <strong>Ofertas</strong></>;
      case 'whatsapp': return <>abre o <strong>WhatsApp</strong></>;
      case 'url': return <>abre <strong className="break-all">{b.linkValue}</strong></>;
      default: return <>sem link</>;
    }
  };

  const fmtDate = (d?: string) => (d ? d.split('-').reverse().join('/') : '');

  const sizeHint = (which: 'desktop' | 'mobile') => {
    const c = checks[which];
    const t = which === 'desktop' ? BANNER_DESKTOP_SIZE : BANNER_MOBILE_SIZE;
    if (!c) return null;
    return c.ratioOk ? (
      <span className="text-xs text-green-700">✓ Tamanho certo ({c.width} × {c.height})</span>
    ) : (
      <span className="text-xs text-amber-700">
        Atenção: a imagem tem {c.width} × {c.height}. O ideal é {t.width} × {t.height}, senão as bordas podem ser cortadas.
      </span>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-4 space-y-0">
        <div className="flex-1">
          <CardTitle className="flex items-center gap-2">
            <ImagePlus className="h-6 w-6" />
            Banners da loja
          </CardTitle>
          <CardDescription>
            Aparecem no topo da página inicial, na ordem abaixo, e passam sozinhos a cada 6 segundos.
            Medidas: computador {BANNER_DESKTOP_SIZE.width} × {BANNER_DESKTOP_SIZE.height} px · celular {BANNER_MOBILE_SIZE.width} × {BANNER_MOBILE_SIZE.height} px.
          </CardDescription>
        </div>
        {!editing && (
          <Button type="button" onClick={() => startEdit()} disabled={loading || saving}>
            <Plus className="h-4 w-4 mr-1" /> Novo banner
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando banners...</div>
        ) : (
          <ul className="space-y-2.5">
            {banners.map((b, i) => (
              <li key={b.id} className={cn('flex flex-wrap items-center gap-3 sm:gap-4 border rounded-lg p-3', editing?.id === b.id && 'border-primary bg-primary/5')}>
                <span className="flex flex-col gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-7 w-8" aria-label="Subir" disabled={i === 0 || saving} onClick={() => move(i, -1)}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="outline" size="icon" className="h-7 w-8" aria-label="Descer" disabled={i === banners.length - 1 || saving} onClick={() => move(i, 1)}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </span>

                {b.kind === 'offers' ? (
                  <span className="w-[200px] sm:w-[240px] aspect-[4/1] rounded-md bg-blue-900 text-white text-xs font-bold flex items-center justify-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" /> Banner automático de ofertas
                  </span>
                ) : (
                  <span className="flex gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.desktopImage} alt="" className="w-[200px] sm:w-[240px] aspect-[4/1] object-cover rounded-md border" />
                    {b.mobileImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.mobileImage} alt="" className="hidden sm:block h-[60px] aspect-[3/2] object-cover rounded-md border" />
                    )}
                  </span>
                )}

                <span className="flex-1 min-w-[180px] flex flex-col gap-0.5">
                  <span className="font-semibold">{b.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {b.kind === 'offers'
                      ? 'Mostra os produtos em promoção. Não precisa de imagem.'
                      : <>Ao clicar: {describeLink(b)}{b.startDate && <> · a partir de {fmtDate(b.startDate)}</>}{b.endDate && <> · até {fmtDate(b.endDate)}</>}</>}
                  </span>
                </span>

                <label className="flex items-center gap-2 text-sm font-medium">
                  <Switch checked={b.active} disabled={saving} onCheckedChange={(v) => toggle(b.id, v)} />
                  {b.active ? 'Ativo' : 'Desligado'}
                </label>

                {b.kind === 'image' && (
                  <span className="flex gap-1.5">
                    <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => startEdit(b)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 text-destructive" aria-label="Excluir banner" disabled={saving} onClick={() => remove(b.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {editing && (
          <div className="border rounded-lg p-4 sm:p-5 space-y-5 bg-muted/30">
            <h3 className="font-semibold text-lg">{banners.some(b => b.id === editing.id) ? 'Editar banner' : 'Novo banner'}</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1.5 text-sm font-medium">
                Nome (só aparece no admin)
                <Input value={editing.title} maxLength={120} placeholder="Ex.: Em breve — Móveis infantis"
                  onChange={e => setEditing({ ...editing, title: e.target.value })} />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Ao clicar no banner
                <select className={selectCls} value={editing.linkType}
                  onChange={e => setEditing({ ...editing, linkType: e.target.value as BannerLinkType, linkValue: '' })}>
                  {LINK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>

              {editing.linkType === 'category' && (
                <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
                  Categoria
                  <select className={selectCls} value={editing.linkValue ?? ''} onChange={e => setEditing({ ...editing, linkValue: e.target.value })}>
                    <option value="">Escolha...</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </label>
              )}
              {editing.linkType === 'product' && (
                <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
                  Produto
                  <select className={selectCls} value={editing.linkValue ?? ''} onChange={e => setEditing({ ...editing, linkValue: e.target.value })}>
                    <option value="">Escolha...</option>
                    {productOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
              )}
              {editing.linkType === 'url' && (
                <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
                  Link
                  <Input value={editing.linkValue ?? ''} placeholder="https://..." onChange={e => setEditing({ ...editing, linkValue: e.target.value })} />
                </label>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
              {(['desktop', 'mobile'] as const).map(which => {
                const src = which === 'desktop' ? editing.desktopImage : editing.mobileImage;
                const size = which === 'desktop' ? BANNER_DESKTOP_SIZE : BANNER_MOBILE_SIZE;
                return (
                  <div key={which} className="space-y-1.5">
                    <span className="text-sm font-medium">
                      Imagem para {which === 'desktop' ? 'computador' : 'celular'}{' '}
                      <span className="font-normal text-muted-foreground">· {size.width} × {size.height} px{which === 'mobile' && ' (opcional)'}</span>
                    </span>
                    <div className={cn('rounded-md border bg-background overflow-hidden flex items-center justify-center text-sm text-muted-foreground', which === 'desktop' ? 'aspect-[4/1]' : 'aspect-[3/2]')}>
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt={`Prévia da imagem para ${which === 'desktop' ? 'computador' : 'celular'}`} className="w-full h-full object-cover" />
                      ) : (
                        which === 'desktop' ? 'Nenhuma imagem' : 'Sem imagem: usa a do computador'
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex">
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
                          onChange={e => { onPickImage(which, e.target.files?.[0]); e.target.value = ''; }} />
                        <span className="h-9 px-3 rounded-md border bg-background text-sm font-medium inline-flex items-center cursor-pointer hover:bg-muted">
                          {src ? 'Trocar imagem' : 'Escolher imagem'}
                        </span>
                      </label>
                      {which === 'mobile' && src && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing({ ...editing, mobileImage: undefined })}>Remover</Button>
                      )}
                      {sizeHint(which)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <label className="space-y-1.5 text-sm font-medium">
                Mostrar a partir de (opcional)
                <Input type="date" value={editing.startDate ?? ''} onChange={e => setEditing({ ...editing, startDate: e.target.value || undefined })} />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Esconder depois de (opcional)
                <Input type="date" value={editing.endDate ?? ''} onChange={e => setEditing({ ...editing, endDate: e.target.value || undefined })} />
              </label>
              <label className="flex items-center gap-2 h-10 text-sm font-medium">
                <Switch checked={editing.active} onCheckedChange={v => setEditing({ ...editing, active: v })} />
                Banner ativo
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
              <Button type="button" onClick={saveEditing} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar banner
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
