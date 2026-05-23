
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Carnê de Pagamento',
  description: 'Visualização e impressão de carnê de pagamento.',
};

export default function CarnetLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
