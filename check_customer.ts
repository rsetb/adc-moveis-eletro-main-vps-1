
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.customer.count();
  console.log('Customer count:', count);
  
  const silvana = await prisma.customer.findFirst({
    where: {
      OR: [
        { name: { contains: 'Silvana' } },
        { cpf: { contains: '902' } }
      ]
    }
  });
  console.log('Silvana:', silvana);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
