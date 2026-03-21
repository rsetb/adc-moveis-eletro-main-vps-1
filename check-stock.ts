
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const prisma = new PrismaClient();

async function checkStock() {
    try {
        console.log('🔍 Checking recent products stock...');
        const products = await prisma.product.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, stock: true, minStock: true }
        });
        console.table(products);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkStock();
