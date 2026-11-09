
'use client';

import { ReactNode, useCallback, useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScrollButtons from "@/components/ScrollButtons";
import StoreFloatingNav from "@/components/StoreFloatingNav";
import DeliveryNoticeDialog from "@/components/DeliveryNoticeDialog";
import { useSettings } from "@/context/SettingsContext";
import { buildWhatsAppLink } from "@/lib/whatsapp-link";

const NOTICE_KEY = 'sapiranga_notice_v5';

export default function PublicPageLayout({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const { settings } = useSettings();

    const zones = (settings?.deliveryZones ?? []).filter(z => z.fee > 0 && (z.showInNotice ?? true));

    useEffect(() => {
        try {
            if (zones.length > 0 && !sessionStorage.getItem(NOTICE_KEY)) {
                setOpen(true);
            }
        } catch {
            // sessionStorage indisponível
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zones.length]);

    const handleClose = useCallback(() => {
        try { sessionStorage.setItem(NOTICE_KEY, '1'); } catch { /* ignore */ }
        setOpen(false);
    }, []);

    const whatsappLink = buildWhatsAppLink(
        settings?.storePhone,
        'Olá! Tenho uma dúvida sobre a taxa de entrega.'
    );

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow bg-muted/40">{children}</main>
            <Footer />
            <ScrollButtons />
            <StoreFloatingNav />
            {open && (
                <DeliveryNoticeDialog zones={zones} whatsappLink={whatsappLink} onClose={handleClose} />
            )}
        </div>
    );
}
