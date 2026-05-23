
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Acesso ao painel administrativo.',
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
