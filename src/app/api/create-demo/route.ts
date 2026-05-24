import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const existing = await db.user.findFirst({ where: { username: 'demo' } });
    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Usuário demo já existe.',
        login: 'demo',
        senha: 'demo123',
      });
    }

    const hash = await bcrypt.hash('demo123', 10);
    await db.user.create({
      data: {
        username: 'demo',
        name: 'Usuário Demo',
        password: hash,
        role: 'vendedor',
        active: true,
        canBeAssigned: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Acesso demo criado!',
      login: 'demo',
      senha: 'demo123',
      role: 'vendedor',
      aviso: 'Acesso somente leitura. Não pode excluir dados.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
