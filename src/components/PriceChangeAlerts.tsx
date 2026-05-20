'use client';

import { useEffect, useState } from 'react';
import { getRecentPriceChangesAction } from '@/app/actions/admin/price-changes';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, TrendingDown, TrendingUp, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from './ui/button';

interface PriceChange {
    id: string;
    productId: string;
    productName: string;
    oldPrice: number;
    newPrice: number;
    userName: string | null;
    createdAt: Date;
}

export function PriceChangeAlerts() {
    const [changes, setChanges] = useState<PriceChange[]>([]);
    const [dismissed, setDismissed] = useState<string[]>([]);

    // Carregar notificações fechadas do localStorage ao iniciar
    useEffect(() => {
        const saved = localStorage.getItem('dismissedPriceChanges');
        if (saved) {
            try {
                setDismissed(JSON.parse(saved));
            } catch (e) {
                console.error('Erro ao carregar notificações fechadas:', e);
            }
        }
    }, []);

    useEffect(() => {
        const fetchChanges = async () => {
            const res = await getRecentPriceChangesAction();
            if (res.success && Array.isArray(res.data)) {
                setChanges(res.data.map((c: any) => ({
                    ...c,
                    createdAt: new Date(c.createdAt)
                })));
            }
        };

        fetchChanges();
        // Atualizar a cada 5 minutos
        const interval = setInterval(fetchChanges, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const visibleChanges = changes.filter(c => !dismissed.includes(c.id));

    if (visibleChanges.length === 0) return null;

    const handleDismiss = (id: string) => {
        setDismissed(prev => {
            const next = [...prev, id];
            localStorage.setItem('dismissedPriceChanges', JSON.stringify(next));
            return next;
        });
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    return (
        <div className="space-y-2 mb-4">
            {visibleChanges.map((change) => {
                const isIncrease = change.newPrice > change.oldPrice;
                return (
                    <Alert key={change.id} className="relative bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                        <div className="flex items-start gap-3">
                            {isIncrease ? (
                                <TrendingUp className="h-5 w-5 text-red-500 mt-0.5" />
                            ) : (
                                <TrendingDown className="h-5 w-5 text-green-500 mt-0.5" />
                            )}
                            <div className="flex-1">
                                <AlertTitle className="text-sm font-semibold flex items-center gap-2">
                                    Alteração de Preço: {change.productName}
                                    <span className="text-xs font-normal text-muted-foreground">
                                        • {format(change.createdAt, "HH:mm", { locale: ptBR })}
                                    </span>
                                </AlertTitle>
                                <AlertDescription className="text-xs text-muted-foreground mt-1">
                                    De <span className="line-through">{formatCurrency(change.oldPrice)}</span> para <span className="font-bold text-foreground">{formatCurrency(change.newPrice)}</span>
                                    {change.userName && ` • Alterado por ${change.userName}`}
                                </AlertDescription>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 -mr-2 -mt-2 opacity-50 hover:opacity-100" 
                                onClick={() => handleDismiss(change.id)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </Alert>
                );
            })}
        </div>
    );
}
