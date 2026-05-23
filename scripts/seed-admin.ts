import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  const existing = await db.user.findFirst({ where: { username: 'admin' } });
  if (existing) {
    console.log('Usuário admin já existe:', existing.username, '| role:', existing.role);
    return;
  }

  const hash = await bcrypt.hash('admin123', 10);
  const user = await db.user.create({
    data: {
      username: 'admin',
      name: 'Administrador',
      password: hash,
      role: 'admin',
      active: true,
      canBeAssigned: true,
    },
  });

  console.log('Usuário admin criado com sucesso!');
  console.log('  Login:  admin');
  console.log('  Senha:  admin123');
  console.log('  Role:   admin');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
