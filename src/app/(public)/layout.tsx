
'use client';

import { ReactNode, useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScrollButtons from "@/components/ScrollButtons";
import { X } from "lucide-react";

const NOTICE_KEY = 'sapiranga_notice_v3';

export default function PublicPageLayout({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        try {
            if (!sessionStorage.getItem(NOTICE_KEY)) {
                setOpen(true);
            }
        } catch {
            // sessionStorage indisponível
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
                    className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full flex flex-col gap-2.5 sm:gap-4 p-3.5 sm:p-5"
                    style={{ maxWidth: 340 }}
                >
                    {/* Close */}
                    <button
                        onClick={handleClose}
                        className="absolute top-2 right-2 sm:top-3 sm:right-3 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        aria-label="Fechar"
                    >
                        <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>

                    {/* Icon */}
                    <div className="flex items-center justify-center w-10 h-10 sm:w-13 sm:h-13 rounded-full bg-amber-100 mx-auto text-xl sm:text-2xl select-none">
                        🚚
                    </div>

                    {/* Title */}
                    <h2 className="text-center text-sm sm:text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">
                        Aviso de Taxa de Entrega
                    </h2>

                    {/* Body */}
                    <div className="flex items-start gap-2 sm:gap-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5 sm:p-3.5">
                        <span className="text-xs sm:text-base flex-shrink-0 mt-0.5">📍</span>
                        <p className="text-xs sm:text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                            Bairro <span className="font-bold text-amber-700 dark:text-amber-400">Sapiranga-Coité</span>: taxa adicional de <span className="font-bold text-amber-700 dark:text-amber-400">R$ 20,00</span> no ato da compra.
                        </p>
                    </div>

                    {/* Button */}
                    <button
                        onClick={handleClose}
                        className="w-full py-2 sm:py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm transition-colors"
                    >
                        Entendi
                    </button>
                </div>
            </div>
        </div>
    );
}
