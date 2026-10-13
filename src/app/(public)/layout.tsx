
'use client';

import { ReactNode, useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScrollButtons from "@/components/ScrollButtons";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Truck } from "lucide-react";

const NOTICE_KEY = 'sapiranga_notice_seen';

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

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow">
                {children}
            </main>
            <Footer />
            <ScrollButtons />

            <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
                <DialogContent className="w-[calc(100%-2rem)] max-w-xs rounded-xl p-4 text-center gap-3">
                    <DialogHeader className="items-center gap-2">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 mx-auto">
                            <Truck className="h-5 w-5 text-amber-600" />
                        </div>
                        <DialogTitle className="text-base leading-tight">Aviso de Taxa de Entrega</DialogTitle>
                        <DialogDescription asChild>
                            <div className="space-y-1.5">
                                <p className="flex items-start gap-1.5 text-sm text-foreground text-left">
                                    <MapPin className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <span>
                                        Entregas no bairro{' '}
                                        <span className="font-semibold text-amber-700">Sapiranga-Coité</span>{' '}
                                        têm taxa adicional de{' '}
                                        <span className="font-bold text-amber-700">R$ 25,00</span>{' '}
                                        cobrada no ato da compra.
                                    </span>
                                </p>
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <Button size="sm" className="w-full" onClick={handleClose}>
                        Entendi
                    </Button>
                </DialogContent>
            </Dialog>
        </div>
    );
}
