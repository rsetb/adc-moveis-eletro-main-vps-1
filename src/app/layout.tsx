import './globals.css';
import type { Metadata, Viewport } from 'next';
import { cn } from '@/lib/utils';
import { Inter } from 'next/font/google';
import Providers from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const viewport: Viewport = {
  themeColor: '#000000',
};

export const metadata: Metadata = {
  title: 'ADC MÓVEIS E ELETROS',
  description: 'ADC MÓVEIS E ELETROS - Sua loja de móveis e eletrodomésticos.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ADC',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={cn(inter.variable)}>
      <body className="font-body antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
