'use client';

import Link from 'next/link';
import { MapPin, Phone, Clock, ShieldCheck } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useData } from '@/context/DataContext';
import Logo from './Logo';
import { WhatsAppIcon } from './WhatsAppIcon';
import { buildWhatsAppLink } from '@/lib/whatsapp-link';

export default function Footer() {
  const { settings } = useSettings();
  const { categories } = useData();

  const year = new Date().getFullYear();
  const waLink = buildWhatsAppLink(settings.storePhone);
  const fullAddress = [settings.storeAddress, settings.storeCity].filter(Boolean).join(', ');
  const mapsLink = fullAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
    : null;

  return (
    <footer className="bg-card border-t print-hidden mt-8">
      <div className="container mx-auto px-4 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-sm text-foreground/80">
        <div className="flex flex-col gap-3">
          <div className="w-fit"><Logo /></div>
          <p className="leading-relaxed">Os melhores produtos com os melhores preços e condições de pagamento.</p>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" /> Compra segura e garantida
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          <h3 className="font-bold text-foreground">Atendimento</h3>
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-primary">
              <WhatsAppIcon className="h-4 w-4 text-green-700" /> WhatsApp {settings.storePhone}
            </a>
          )}
          {settings.storePhone && (
            <a href={`tel:${settings.storePhone.replace(/\D/g, '')}`} className="flex items-center gap-2 hover:text-primary">
              <Phone className="h-4 w-4 text-primary" /> {settings.storePhone}
            </a>
          )}
          {settings.commercialHourStart && settings.commercialHourEnd && (
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Seg–Sex: {settings.commercialHourStart} às {settings.commercialHourEnd}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2.5">
          <h3 className="font-bold text-foreground">Loja física</h3>
          {fullAddress && (
            <span className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" /> {fullAddress}
            </span>
          )}
          {mapsLink && (
            <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">
              Ver no Google Maps →
            </a>
          )}
        </div>

        {categories.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="font-bold text-foreground">Departamentos</h3>
            <ul className="flex flex-col gap-1.5">
              {categories.slice(0, 6).map(cat => (
                <li key={cat.id}>
                  <Link href={`/?cat=${encodeURIComponent(cat.name)}#catalog`} className="capitalize hover:text-primary">
                    {cat.name}
                  </Link>
                </li>
              ))}
              <li><Link href="/area-cliente/login" className="hover:text-primary">Área do Cliente</Link></li>
            </ul>
          </div>
        )}
      </div>

      <div className="bg-blue-900 text-blue-100 text-xs text-center px-4 py-3 pb-20 md:pb-3">
        © {year} {settings.storeName || 'Catálogo Pro'}. Todos os direitos reservados.
      </div>
    </footer>
  );
}
