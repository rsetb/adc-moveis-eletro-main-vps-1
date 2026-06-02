import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('admin123', 10);

  const user = await db.user.upsert({
    where: { username: 'admin' },
    update: { password: hash, role: 'admin', active: true },
    create: {
      username: 'admin',
      password: hash,
      name: 'Administrador',
      role: 'admin',
      active: true,
      canBeAssigned: false,
    },
  });

  console.log('Usuário criado/atualizado:', user.username, '| role:', user.role);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
