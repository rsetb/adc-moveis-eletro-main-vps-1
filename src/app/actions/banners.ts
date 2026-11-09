'use server';

import { db } from '@/lib/db';
import { requireManagement } from '@/lib/auth-guard';
import type { BannerLinkType, StoreBanner } from '@/lib/types';
import { DEFAULT_OFFERS_BANNER } from '@/lib/banners';

const KEY = 'storeBanners';
const MAX_BANNERS = 12;
const MAX_IMAGE_CHARS = 2_000_000; // ~1,5 MB por imagem (data URL)
const LINK_TYPES: BannerLinkType[] = ['none', 'category', 'product', 'offers', 'whatsapp', 'url'];

function withOffersBanner(list: StoreBanner[]): StoreBanner[] {
  return list.some(b => b.kind === 'offers') ? list : [...list, DEFAULT_OFFERS_BANNER];
}

function isValidImage(v: unknown): v is string {
  return typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(v) && v.length <= MAX_IMAGE_CHARS;
}

function isSafeUrl(v: string): boolean {
  if (v.startsWith('/') && !v.startsWith('//')) return true;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function sanitize(input: unknown): StoreBanner[] {
  if (!Array.isArray(input)) throw new Error('Lista de banners inválida.');
  if (input.length > MAX_BANNERS + 1) throw new Error(`Máximo de ${MAX_BANNERS} banners.`);

  const seen = new Set<string>();
  let hasOffers = false;

  return input.map((raw: any): StoreBanner => {
    const id = String(raw?.id ?? '').slice(0, 64);
    if (!id || seen.has(id)) throw new Error('Banner com identificador inválido.');
    seen.add(id);

    const kind = raw?.kind === 'offers' ? 'offers' : 'image';
    if (kind === 'offers') {
      if (hasOffers) throw new Error('Só pode existir um banner automático de ofertas.');
      hasOffers = true;
      return { ...DEFAULT_OFFERS_BANNER, id, active: !!raw.active };
    }

    if (!isValidImage(raw?.desktopImage)) {
      throw new Error('Cada banner precisa de uma imagem para computador (JPG, PNG ou WEBP, até 1,5 MB).');
    }
    const mobileImage = raw?.mobileImage ? raw.mobileImage : undefined;
    if (mobileImage !== undefined && !isValidImage(mobileImage)) {
      throw new Error('Imagem para celular inválida (JPG, PNG ou WEBP, até 1,5 MB).');
    }

    const linkType: BannerLinkType = LINK_TYPES.includes(raw?.linkType) ? raw.linkType : 'none';
    const linkValue = typeof raw?.linkValue === 'string' ? raw.linkValue.trim().slice(0, 500) : '';
    if (linkType === 'url' && (!linkValue || !isSafeUrl(linkValue))) {
      throw new Error('Link do banner inválido. Use um endereço começando com https://');
    }
    if ((linkType === 'category' || linkType === 'product') && !linkValue) {
      throw new Error('Escolha para onde o banner deve levar.');
    }

    const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

    return {
      id,
      kind: 'image',
      title: String(raw?.title ?? '').trim().slice(0, 120) || 'Banner',
      desktopImage: raw.desktopImage,
      mobileImage,
      linkType,
      linkValue: ['category', 'product', 'url'].includes(linkType) ? linkValue : undefined,
      startDate: date(raw?.startDate),
      endDate: date(raw?.endDate),
      active: !!raw?.active,
    };
  });
}

/** Público: usado pela página inicial da loja. */
export async function getBannersAction(): Promise<{ success: boolean; data: StoreBanner[]; error?: string }> {
  try {
    const result = await db.config.findUnique({ where: { key: KEY } });
    const list = Array.isArray(result?.value) ? (result!.value as unknown as StoreBanner[]) : [];
    return { success: true, data: withOffersBanner(list) };
  } catch (error: any) {
    return { success: false, data: [DEFAULT_OFFERS_BANNER], error: error.message };
  }
}

/** Restrito a admin/gerente. */
export async function updateBannersAction(banners: StoreBanner[]): Promise<{ success: boolean; error?: string }> {
  try {
    await requireManagement();
    const clean = withOffersBanner(sanitize(banners));
    await db.config.upsert({
      where: { key: KEY },
      update: { value: clean as any },
      create: { key: KEY, value: clean as any },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
