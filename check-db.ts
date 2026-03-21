
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Testing database connection...');
        await prisma.$connect();
        console.log('✅ Connected to database successfully.');

        const userCount = await prisma.user.count();
        console.log(`✅ Users found: ${userCount}`);

        const customerCount = await prisma.customer.count();
        console.log(`✅ Customers found: ${customerCount}`);

        if (customerCount > 0) {
            const first = await prisma.customer.findFirst();
            console.log('Sample Customer Name:', first?.name);
        }

        const orderCount = await prisma.order.count();
        console.log(`✅ Orders found: ${orderCount}`);

    } catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
