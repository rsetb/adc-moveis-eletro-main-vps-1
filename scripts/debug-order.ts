
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const orderId = 'PED-386382';
    console.log(`🔍 Buscando pedido: ${orderId}...`);

    try {
        const order = await prisma.order.findUnique({
            where: { id: orderId }
        });

        if (order) {
            console.log('✅ Pedido encontrado!');
            console.log(JSON.stringify(order, null, 2));
        } else {
            console.log('❌ Pedido NÃO encontrado no banco de dados.');

            // Tentar buscar por parte do ID ou pedidos recentes
            const recentOrders = await prisma.order.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' }
            });
            console.log('\n últimos 5 pedidos criados:');
            console.log(JSON.stringify(recentOrders.map(o => ({ id: o.id, status: o.status, date: o.date, createdAt: o.createdAt })), null, 2));
        }
    } catch (error) {
        console.error('Erro ao consultar o banco:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
