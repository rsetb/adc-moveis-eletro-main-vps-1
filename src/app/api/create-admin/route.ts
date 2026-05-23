import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export async function GET() {
  const count = await db.user.count();
  if (count > 0) {
    return NextResponse.json({ error: 'Já existem usuários cadastrados. Rota desabilitada.' }, { status: 403 });
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

  return NextResponse.json({
    success: true,
    message: 'Admin criado! Acesse /login com as credenciais abaixo. Troque a senha depois.',
    login: 'admin',
    senha: 'admin123',
    id: user.id,
  });
}
