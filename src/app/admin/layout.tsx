import type { Metadata } from 'next';
import AdminLayoutClient from './AdminLayoutClient';

export const metadata: Metadata = {
  title: 'ADC Admin',
  manifest: '/manifest-admin.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ADC Admin',
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
