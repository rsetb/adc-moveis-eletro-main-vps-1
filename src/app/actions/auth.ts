'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { createSession, deleteSession, getSession } from '@/lib/session';
import bcrypt from 'bcryptjs';
import type { User } from '@/lib/types';

const USER_SELECT = {
  id: true,
  username: true,
  name: true,
  role: true,
  active: true,
  canBeAssigned: true,
} as const;

type SafeUser = Omit<User, 'password'>;

function mapUser(u: any): SafeUser {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    active: u.active,
    canBeAssigned: u.canBeAssigned,
  };
}

async function requireAdmin(): Promise<ReturnType<typeof getSession> extends Promise<infer T> ? NonNullable<T> : never> {
  const session = await getSession();
  if (!session || (session.role !== 'admin' && session.role !== 'gerente')) {
    throw new Error('Sem permissão.');
  }
  return session as any;
}

async function checkPassword(stored: string, input: string): Promise<boolean> {
  if (stored.startsWith('$2')) {
    return bcrypt.compare(input, stored);
  }
  return stored === input;
}

// ─── Login / Logout / Session ────────────────────────────────────────────────

export async function loginAction(username: string, password: string) {
  try {
    const user = await db.user.findFirst({
      where: { username },
    });
    if (!user) return { success: false, error: 'Usuário não encontrado.' };
    if (user.active === false) return { success: false, error: 'Conta inativada. Entre em contato com o administrador.' };
    if (!user.password) return { success: false, error: 'Usuário sem senha cadastrada.' };

    const valid = await checkPassword(user.password, password);
    if (!valid) return { success: false, error: 'Senha inválida.' };

    await createSession({ userId: user.id, role: user.role, name: user.name, username: user.username });
    return { success: true, user: mapUser(user) };
  } catch {
    return { success: false, error: 'Erro ao realizar login.' };
  }
}

export async function logoutAction(): Promise<void> {
  await deleteSession();
}

export async function getSessionAction() {
  const session = await getSession();
  if (!session) return { success: false, user: null };
  try {
    const user = await db.user.findUnique({ where: { id: session.userId }, select: USER_SELECT });
    if (!user || user.active === false) {
      await deleteSession();
      return { success: false, user: null };
    }
    return { success: true, user: mapUser(user) };
  } catch {
    return { success: false, user: null };
  }
}

// ─── User Management ─────────────────────────────────────────────────────────

export async function getUsersAction() {
  const session = await getSession();
  if (!session) return { success: false, error: 'Não autenticado.', data: [] as SafeUser[] };
  try {
    const users = await db.user.findMany({ select: USER_SELECT });
    return { success: true, data: users.map(mapUser) };
  } catch {
    return { success: false, error: 'Erro ao buscar usuários.', data: [] as SafeUser[] };
  }
}

export async function createUserAction(data: Omit<User, 'id'>) {
  try {
    await requireAdmin();
    const hashed = data.password ? await bcrypt.hash(data.password, 10) : undefined;
    const newUser = await db.user.create({
      data: {
        ...data,
        password: hashed,
        canBeAssigned: data.canBeAssigned ?? true,
        active: data.active ?? true,
      } as any,
      select: USER_SELECT,
    });
    revalidatePath('/admin');
    revalidatePath('/admin/configuracao');
    return { success: true, data: mapUser(newUser) };
  } catch (error: any) {
    if (error.message === 'Sem permissão.') return { success: false, error: 'Sem permissão.' };
    if (error.code === 'P2002') return { success: false, error: 'Este nome de usuário já está em uso.' };
    return { success: false, error: 'Erro ao criar usuário.' };
  }
}

export async function updateUserAction(userId: string, data: Partial<Omit<User, 'id'>>) {
  try {
    await requireAdmin();
    const updateData: any = { ...data };
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    } else {
      delete updateData.password;
    }
    await db.user.update({ where: { id: userId }, data: updateData });
    revalidatePath('/admin');
    revalidatePath('/admin/configuracao');
    return { success: true };
  } catch (error: any) {
    if (error.message === 'Sem permissão.') return { success: false, error: 'Sem permissão.' };
    if (error.code === 'P2002') return { success: false, error: 'Este nome de usuário já está em uso.' };
    return { success: false, error: 'Erro ao atualizar usuário.' };
  }
}

export async function deleteUserAction(userId: string) {
  try {
    await requireAdmin();
    await db.user.delete({ where: { id: userId } });
    revalidatePath('/admin');
    revalidatePath('/admin/configuracao');
    return { success: true };
  } catch (error: any) {
    if (error.message === 'Sem permissão.') return { success: false, error: 'Sem permissão.' };
    return { success: false, error: 'Erro ao excluir usuário.' };
  }
}

export async function restoreUsersAction(usersToRestore: User[]) {
  try {
    await requireAdmin();
    await db.$transaction(
      usersToRestore.map(u =>
        db.user.upsert({
          where: { id: u.id },
          update: { username: u.username, name: u.name, role: u.role, active: u.active, canBeAssigned: u.canBeAssigned } as any,
          create: u as any,
        })
      )
    );
    revalidatePath('/admin');
    return { success: true };
  } catch (error: any) {
    if (error.message === 'Sem permissão.') return { success: false, error: 'Sem permissão.' };
    return { success: false, error: 'Erro ao restaurar usuários.' };
  }
}

export async function changeMyPasswordAction(currentPassword: string, newPassword: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Não autenticado.' };

  try {
    const user = await db.user.findUnique({ where: { id: session.userId } });
    if (!user?.password) return { success: false, error: 'Usuário sem senha.' };

    const valid = await checkPassword(user.password, currentPassword);
    if (!valid) return { success: false, error: 'A senha atual está incorreta.' };

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.user.update({ where: { id: session.userId }, data: { password: hashed } });
    return { success: true };
  } catch {
    return { success: false, error: 'Erro ao alterar senha.' };
  }
}
