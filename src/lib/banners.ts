import type { StoreBanner } from '@/lib/types';
import { buildWhatsAppLink } from '@/lib/whatsapp-link';

export const BANNER_DESKTOP_SIZE = { width: 1600, height: 400 };
export const BANNER_MOBILE_SIZE = { width: 1200, height: 800 };

export const DEFAULT_OFFERS_BANNER: StoreBanner = {
  id: 'offers-auto',
  kind: 'offers',
  title: 'Ofertas (automático)',
  linkType: 'offers',
  active: true,
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Banner ativo e dentro do período (datas inclusivas). */
export function isBannerVisible(b: StoreBanner, now = today()): boolean {
  if (!b.active) return false;
  if (b.startDate && now < b.startDate) return false;
  if (b.endDate && now > b.endDate) return false;
  if (b.kind === 'image' && !b.desktopImage) return false;
  return true;
}

/** Destino do clique no banner. */
export function bannerHref(b: StoreBanner, storePhone?: string): { href: string; external: boolean } | null {
  switch (b.linkType) {
    case 'category':
      return b.linkValue ? { href: `/?cat=${encodeURIComponent(b.linkValue)}#catalog`, external: false } : null;
    case 'product':
      return b.linkValue ? { href: `/produtos/${encodeURIComponent(b.linkValue)}`, external: false } : null;
    case 'offers':
      return { href: '/?cat=ofertas#catalog', external: false };
    case 'whatsapp': {
      const link = buildWhatsAppLink(storePhone, 'Olá! Vi o banner no site e gostaria de mais informações.');
      return link ? { href: link, external: true } : null;
    }
    case 'url':
      if (!b.linkValue) return null;
      return { href: b.linkValue, external: /^https?:\/\//.test(b.linkValue) };
    default:
      return null;
  }
}

export function newBannerId(): string {
  return `bn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
