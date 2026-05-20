'use client';

import Link from 'next/link';
import { MapPin, Phone, Clock, Instagram, Facebook, ShieldCheck } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useData } from '@/context/DataContext';
import Logo from './Logo';

export default function Footer() {
  const { settings } = useSettings();
  const { categories } = useData();

  const year = new Date().getFullYear();

  return (
    <footer className="bg-primary text-primary-foreground print-hidden mt-8">
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* Coluna 1 — Logo e descrição */}
          <div className="flex flex-col gap-4">
            <div className="w-fit">
              <Logo />
            </div>
            <p className="text-primary-foreground/70 text-sm leading-relaxed">
              Sua loja de móveis e eletrodomésticos com os melhores preços e condições de pagamento.
            </p>
            <div className="flex items-center gap-2 text-primary-foreground/60 text-xs">
              <ShieldCheck className="h-4 w-4 text-accent flex-shrink-0" />
              <span>Compra segura e garantida</span>
            </div>
          </div>

          {/* Coluna 2 — Contato */}
          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-base mb-1 text-accent">Informações</h3>
            {settings.storeCity && (
              <div className="flex items-start gap-2 text-sm text-primary-foreground/80">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-accent" />
                <span>
                  {settings.storeAddress && <>{settings.storeAddress}, </>}
                  {settings.storeCity}
                </span>
              </div>
            )}
            {settings.storePhone && (
              <div className="flex items-center gap-2 text-sm text-primary-foreground/80">
                <Phone className="h-4 w-4 flex-shrink-0 text-accent" />
                <a href={`tel:${settings.storePhone.replace(/\D/g, '')}`} className="hover:text-accent transition-colors">
                  {settings.storePhone}
                </a>
              </div>
            )}
            {(settings.commercialHourStart && settings.commercialHourEnd) && (
              <div className="flex items-center gap-2 text-sm text-primary-foreground/80">
                <Clock className="h-4 w-4 flex-shrink-0 text-accent" />
                <span>Seg–Sex: {settings.commercialHourStart} às {settings.commercialHourEnd}</span>
              </div>
            )}
          </div>

          {/* Coluna 3 — Categorias */}
          {categories.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold text-base mb-1 text-accent">Categorias</h3>
              <ul className="flex flex-col gap-1.5">
                {categories.slice(0, 6).map(cat => (
                  <li key={cat.id}>
                    <Link
                      href={`/?cat=${encodeURIComponent(cat.name)}#catalog`}
                      className="text-sm text-primary-foreground/75 hover:text-accent transition-colors capitalize"
                    >
                      {cat.name}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/" className="text-sm text-primary-foreground/75 hover:text-accent transition-colors">
                    Ver todas →
                  </Link>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Barra inferior */}
      <div className="border-t border-primary-foreground/10">
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-primary-foreground/50">
          <span>© {year} {settings.storeName || 'ADC Móveis e Eletros'}. Todos os direitos reservados.</span>
          <Link href="/area-cliente/login" className="hover:text-accent transition-colors">
            Área do Cliente
          </Link>
        </div>
      </div>
    </footer>
  );
}
