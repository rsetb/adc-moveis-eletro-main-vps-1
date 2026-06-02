export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') return;

  try {
    const { db } = await import('@/lib/db');
    const bcrypt = await import('bcryptjs');

    const count = await db.user.count();
    console.log(`[setup] Usuários no banco: ${count}`);

    if (count === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await db.user.create({
        data: {
          username: 'admin',
          name: 'Administrador',
          password: hash,
          role: 'admin',
          active: true,
          canBeAssigned: true,
        },
      });
      console.log('[setup] Admin criado com sucesso! Login: admin / Senha: admin123');
    } else {
      console.log('[setup] Banco já tem usuários, seed ignorado.');
    }
  } catch (err) {
    console.error('[setup] Erro ao verificar/criar admin:', err);
  }
}
