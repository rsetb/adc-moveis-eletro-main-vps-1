'use client';

import { useEffect, useRef } from 'react';
import { X, Truck, MapPin, Info } from 'lucide-react';
import type { DeliveryZone } from '@/lib/types';
import { WhatsAppIcon } from './WhatsAppIcon';
import { displayZoneName } from '@/lib/display-text';

interface Props {
  zones: DeliveryZone[];
  whatsappLink: string | null;
  onClose: () => void;
}

const formatFee = (fee: number) =>
  fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Aviso de taxa de entrega: modal centralizado no computador, painel inferior no celular. */
export default function DeliveryNoticeDialog({ zones, whatsappLink, onClose }: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/55 backdrop-blur-[3px] animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-notice-title"
        className="w-full sm:max-w-[440px] bg-white dark:bg-gray-900 rounded-t-[22px] sm:rounded-[20px] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300"
      >
        {/* Cabeçalho — celular */}
        <div className="sm:hidden px-5 pt-2.5">
          <span aria-hidden="true" className="block mx-auto w-11 h-[5px] rounded-full bg-gray-300 dark:bg-gray-700" />
          <div className="flex items-center gap-3.5 mt-4">
            <span className="h-[52px] w-[52px] flex-shrink-0 rounded-2xl bg-yellow-300 text-yellow-950 flex items-center justify-center">
              <Truck className="h-6 w-6" />
            </span>
            <span className="flex-1 flex flex-col">
              <span className="text-[11px] font-bold tracking-[0.08em] text-blue-700 dark:text-blue-400">AVISO IMPORTANTE</span>
              <h2 id="delivery-notice-title" className="text-xl font-extrabold text-gray-900 dark:text-white">Taxa de entrega</h2>
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-center"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>

        {/* Cabeçalho — computador */}
        <div className="hidden sm:block">
          <div className="relative bg-primary text-primary-foreground px-7 pt-7 pb-[52px] text-center flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="absolute top-3.5 right-3.5 h-9 w-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
            <span className="text-xs font-bold tracking-[0.08em] text-blue-200">AVISO IMPORTANTE</span>
            <h2 className="text-2xl font-extrabold" aria-hidden="true">Taxa de entrega</h2>
            <p className="text-sm text-blue-100">Confira antes de finalizar sua compra</p>
          </div>
          <div className="relative -mt-8 mx-auto h-16 w-16 rounded-full bg-yellow-300 border-4 border-white dark:border-gray-900 text-yellow-950 flex items-center justify-center">
            <Truck className="h-7 w-7" />
          </div>
        </div>

        <div className="px-5 sm:px-7 pt-4 pb-6 sm:pb-7 flex flex-col gap-4 overflow-y-auto">
          <ul className="flex flex-col gap-2.5">
            {zones.map((zone) => (
              <li key={zone.name} className="flex items-center gap-3 sm:gap-3.5 border border-gray-200 dark:border-gray-700 rounded-2xl p-3.5 sm:px-4">
                <span className="h-10 w-10 flex-shrink-0 rounded-xl bg-blue-50 dark:bg-blue-950 text-primary flex items-center justify-center">
                  <MapPin className="h-5 w-5" />
                </span>
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-[15px] sm:text-base font-extrabold text-gray-900 dark:text-white leading-snug break-words">
                    {displayZoneName(zone.name)}
                  </span>
                  {zone.notice && (
                    <span className="text-xs sm:text-[13px] text-gray-600 dark:text-gray-400">{zone.notice}</span>
                  )}
                </span>
                <span className="flex flex-col items-end flex-shrink-0">
                  <span className="text-[11px] text-gray-600 dark:text-gray-400">taxa</span>
                  <span className="text-xl sm:text-[22px] font-extrabold text-blue-700 dark:text-blue-400 leading-none whitespace-nowrap">
                    {formatFee(zone.fee)}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <p className="flex items-start gap-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl px-3.5 py-3 text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">
            <Info className="h-[18px] w-[18px] flex-shrink-0 mt-px text-gray-600 dark:text-gray-400" />
            <span>
              A taxa é cobrada no ato da compra.
              {whatsappLink && ' Demais regiões atendidas: consulte pelo WhatsApp.'}
            </span>
          </p>

          <button
            ref={confirmRef}
            type="button"
            onClick={onClose}
            className="h-[52px] sm:h-[50px] rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-base font-bold transition-colors"
          >
            Entendi, continuar comprando
          </button>

          {whatsappLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="self-center min-h-[44px] flex items-center gap-1.5 text-sm font-semibold text-green-700 dark:text-green-400 hover:underline"
            >
              <WhatsAppIcon className="h-[18px] w-[18px]" />
              Dúvidas? Fale no WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
