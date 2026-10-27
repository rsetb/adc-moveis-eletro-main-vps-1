import { getSession, type SessionPayload } from '@/lib/session';
import type { UserRole } from '@/lib/types';

export class AuthError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code = 'UNAUTHORIZED', statusCode = 401) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export type ValidatedSession = SessionPayload & { role: UserRole };

/**
 * Valida a sessão do usuário diretamente a partir do cookie assinado httpOnly.
 * NUNCA confia em objetos de usuário enviados pelo cliente/navegador.
 *
 * @param allowedRoles Lista de papéis autorizados a executar a ação.
 * @returns Os dados validados da sessão (userId, name, role, username).
 */
export async function requireSession(allowedRoles?: UserRole[]): Promise<ValidatedSession> {
  const session = await getSession();

  if (!session || !session.userId) {
    throw new AuthError('Sessão inválida ou ausente. Faça login para continuar.', 'UNAUTHENTICATED', 401);
  }

  const role = session.role as UserRole;

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(role)) {
      throw new AuthError(
        `Permissão negada. Perfil '${role}' não tem autorização para executar esta ação.`,
        'FORBIDDEN',
        403
      );
    }
  }

  return { ...session, role };
}

/**
 * Atalho para ações executadas pela equipe da loja
 * (Admin, Gerente, Vendedor e Vendedor Cobrança).
 */
export async function requireStaff(): Promise<ValidatedSession> {
  return requireSession(['admin', 'gerente', 'vendedor', 'vendedor_cobranca']);
}

/**
 * Atalho para ações que exigem perfil de gestão (Admin ou Gerente).
 */
export async function requireManagement(): Promise<ValidatedSession> {
  return requireSession(['admin', 'gerente']);
}

/**
 * Atalho para ações que exigem estritamente perfil Admin.
 */
export async function requireAdmin(): Promise<ValidatedSession> {
  return requireSession(['admin']);
}
