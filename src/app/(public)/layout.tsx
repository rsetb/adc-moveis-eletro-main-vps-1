
'use client';

import { ReactNode, useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScrollButtons from "@/components/ScrollButtons";
import { X } from "lucide-react";

// Bumped key so all browsers show the popup again after redesign
const NOTICE_KEY = 'sapiranga_notice_v2';

export default function PublicPageLayout({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        try {
            if (!sessionStorage.getItem(NOTICE_KEY)) {
                setOpen(true);
            }
        } catch {
            // sessionStorage indisponível — não mostra
        }
    }, []);

    const handleClose = () => {
        try { sessionStorage.setItem(NOTICE_KEY, '1'); } catch { /* ignore */ }
        setOpen(false);
    };

    if (!open) return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow">{children}</main>
            <Footer />
            <ScrollButtons />
        </div>
    );

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow">{children}</main>
            <Footer />
            <ScrollButtons />

            {/* Overlay */}
            <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background: 'rgba(0,0,0,0.5)' }}
                onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
            >
                {/* Card */}
                <div
                    className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full flex flex-col gap-3"
                    style={{ maxWidth: 340, padding: '16px 16px 14px' }}
                >
                    {/* Close */}
                    <button
                        onClick={handleClose}
                        className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        aria-label="Fechar"
                    >
                        <X className="h-4 w-4" />
                    </button>

                    {/* Icon */}
                    <div className="flex items-center justify-center w-11 h-11 rounded-full bg-amber-100 mx-auto text-xl select-none">
                        🚚
                    </div>

                    {/* Title */}
                    <h2 className="text-center text-base font-bold text-gray-900 dark:text-gray-100 leading-tight sm:text-lg">
                        Aviso de Taxa de Entrega
                    </h2>

                    {/* Body */}
                    <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                        <span className="text-sm flex-shrink-0 mt-0.5">📍</span>
                        <p className="text-xs leading-relaxed text-gray-800 dark:text-gray-200 sm:text-sm">
                            Entregas no bairro{' '}
                            <span className="font-bold text-amber-700 dark:text-amber-400">Sapiranga-Coité</span>{' '}
                            têm taxa adicional de{' '}
                            <span className="font-bold text-amber-700 dark:text-amber-400">R$ 25,00</span>{' '}
                            cobrada no ato da compra.
                        </p>
                    </div>

                    {/* Button */}
                    <button
                        onClick={handleClose}
                        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors"
                    >
                        Entendi
                    </button>
                </div>
            </div>
        </div>
    );
}
