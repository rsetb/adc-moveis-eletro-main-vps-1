'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/context/PermissionsContext';
import { ALL_SECTIONS, hasAccess } from '@/lib/permissions';

export default function AdminRootPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { permissions, isLoading: permissionsLoading } = usePermissions();

  useEffect(() => {
    if (isLoading || permissionsLoading) return;
    if (!isAuthenticated || !user || !permissions) {
      router.replace('/login');
      return;
    }

    const firstAccessible = ALL_SECTIONS.find((s) => hasAccess(user.role, s.id, permissions));
    router.replace(`/admin/${firstAccessible?.id || 'pedidos'}`);
  }, [router, isLoading, permissionsLoading, isAuthenticated, user, permissions]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background gap-4">
      <p>Redirecionando para o painel...</p>
      <div className="text-xs text-muted-foreground bg-muted p-4 rounded border max-w-md overflow-auto">
        <p>Debug Info:</p>
        <p>Auth Loading: {String(isLoading)}</p>
        <p>Perm Loading: {String(permissionsLoading)}</p>
        <p>Authenticated: {String(isAuthenticated)}</p>
        <p>User: {user ? `${user.name} (${user.role})` : 'null'}</p>
        <p>Permissions: {permissions ? 'Loaded' : 'null'}</p>
      </div>
    </div>
  );
}
