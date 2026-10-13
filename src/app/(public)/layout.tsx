
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
                <DialogContent className="max-w-sm text-center">
                    <DialogHeader className="items-center">
                        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 mb-2 mx-auto">
                            <Truck className="h-7 w-7 text-amber-600" />
                        </div>
                        <DialogTitle className="text-lg">Aviso de Taxa de Entrega</DialogTitle>
                        <DialogDescription asChild>
                            <div className="space-y-3 pt-1">
                                <p className="flex items-start gap-2 text-sm text-foreground justify-center">
                                    <MapPin className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <span>
                                        Pedidos com entrega no bairro{' '}
                                        <span className="font-semibold text-amber-700">Sapiranga-Coité</span>{' '}
                                        terão uma taxa de entrega adicional de{' '}
                                        <span className="font-bold text-amber-700">R$ 25,00</span>.
                                    </span>
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    O valor será cobrado no ato do fechamento da compra.
                                </p>
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <Button className="w-full mt-2" onClick={handleClose}>
                        Entendi
                    </Button>
                </DialogContent>
            </Dialog>
        </div>
    );
}
