
'use client';

import { useEffect, useState } from 'react';

// Actually, I should use a Server Action to fetch the data
import { getOrderByIdAction } from '@/app/actions/order';
import { getAdminOrdersAction } from '@/app/actions/admin/orders';

export default function DebugDbPage() {
    const [specificOrder, setSpecificOrder] = useState<any>(null);
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const orderId = 'PED-386382';
                const res1 = await getOrderByIdAction(orderId);
                if (res1.success) {
                    setSpecificOrder(res1.data);
                } else {
                    console.error("Error fetching specific order:", res1.error);
                }

                const res2 = await getAdminOrdersAction();
                if (res2.success && res2.data) {
                    const list = (res2.data as any).orders || [];
                    setRecentOrders(list.slice(0, 10));
                } else {
                    setError(res2.error || "Failed to fetch recent orders");
                }
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    if (loading) return <div className="p-8">Carregando dados de depuração...</div>;
    if (error) return <div className="p-8 text-red-500">Erro: {error}</div>;

    return (
        <div className="p-8 font-mono text-sm">
            <h1 className="text-2xl font-bold mb-4">Depuração de Banco de Dados</h1>

            <section className="mb-8">
                <h2 className="text-xl font-semibold mb-2">Busca por Pedido: PED-386382</h2>
                {specificOrder ? (
                    <pre className="bg-muted p-4 rounded overflow-auto max-h-96 border border-green-500">
                        {JSON.stringify(specificOrder, null, 2)}
                    </pre>
                ) : (
                    <p className="text-yellow-600 font-bold">⚠️ Pedido PED-386382 NÃO encontrado no banco de dados.</p>
                )}
            </section>

            <section>
                <h2 className="text-xl font-semibold mb-2">Últimos 10 Pedidos (Qualquer Status/Vendedor)</h2>
                <div className="space-y-4">
                    {recentOrders.map(order => (
                        <div key={order.id} className="border p-4 rounded bg-muted/50">
                            <p><strong>ID:</strong> {order.id}</p>
                            <p><strong>Data:</strong> {order.date}</p>
                            <p><strong>Status:</strong> {order.status}</p>
                            <p><strong>Cliente:</strong> {order.customer?.name}</p>
                            <p><strong>Vendedor:</strong> {order.sellerName || 'N/A'}</p>
                            <details className="mt-2 text-xs">
                                <summary>Ver JSON completo</summary>
                                <pre className="mt-2 p-2 bg-black text-white rounded overflow-auto">
                                    {JSON.stringify(order, null, 2)}
                                </pre>
                            </details>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
