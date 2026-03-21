
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const count = await prisma.customer.count();
        console.log(`\n✅ Total Customers in DB: ${count}`);

        if (count > 0) {
            const sample = await prisma.customer.findFirst();
            console.log('\n🔍 Sample Customer:', sample);
        } else {
            console.log('\n❌ No customers found in the database.');
        }
    } catch (error) {
        console.error('Error checking customers:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
