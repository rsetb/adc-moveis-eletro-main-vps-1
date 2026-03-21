
import { PrismaClient } from '@prisma/client';
import { allocateNextCustomerCode } from './src/lib/customer-code';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Checking customerCodeCounter...');
        const config = await prisma.config.findUnique({
            where: { key: 'customerCodeCounter' }
        });
        console.log('Current config:', config);

        console.log('Simulating allocation...');
        // We cannot use allocateNextCustomerCode directly because it imports 'db' from './db' which might be using a relative path that doesn't work from root script if not careful with ts-node or similar.
        // But since I'm running this with ts-node (implied by environment), I should be careful about imports.
        // Actually, src/lib/db.ts usually exports a singleton prisma instance.
        
        // Let's just replicate the logic here to test.
        const lastNumber = (config?.value as any)?.lastNumber || 0;
        console.log('Last Number:', lastNumber);
        
        const nextNumber = lastNumber + 1;
        console.log('Next Number will be:', nextNumber);
        console.log('Formatted Code:', String(nextNumber).padStart(5, '0'));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
