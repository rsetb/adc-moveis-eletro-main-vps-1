'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface BlockCustomerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (reason: string) => Promise<void>;
    customerName?: string;
}

export function BlockCustomerDialog({ open, onOpenChange, onConfirm, customerName }: BlockCustomerDialogProps) {
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset reason when dialog opens
    useEffect(() => {
        if (open) {
            setReason('');
            setIsSubmitting(false);
        }
    }, [open]);

    const handleConfirm = async () => {
        if (!reason.trim()) return;

        setIsSubmitting(true);
        try {
            await onConfirm(reason);
            // Dialog close is handled by parent usually, but we can double check
            onOpenChange(false);
        } catch (error) {
            console.error("Error confirming block:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Bloquear Cliente</DialogTitle>
                    <DialogDescription>
                        {customerName
                            ? `Informe o motivo do bloqueio para ${customerName}. O cliente não poderá realizar novos pedidos.`
                            : "Informe o motivo do bloqueio para confirmar. O cliente não poderá realizar novos pedidos."
                        }
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="quickBlockReason" className="mb-2 block">Motivo do Bloqueio</Label>
                    <Textarea
                        id="quickBlockReason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Ex: Pagamento pendente, cadastro incompleto..."
                        autoFocus
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
                    <Button variant="destructive" onClick={handleConfirm} disabled={!reason.trim() || isSubmitting}>
                        {isSubmitting ? 'Bloqueando...' : 'Bloquear Cliente'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
