
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const order = await prisma.order.findFirst({
            where: {
                installmentDetails: {
                    not: null as any
                }
            }
        });

        if (order) {
            console.log('--- Installment Details Sample ---');
            console.log(JSON.stringify(order.installmentDetails, null, 2));
            console.log('--- Items Sample ---');
            console.log(JSON.stringify(order.items, null, 2));
        } else {
            console.log('No orders with installment details found.');
        }

    } catch (e: any) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
