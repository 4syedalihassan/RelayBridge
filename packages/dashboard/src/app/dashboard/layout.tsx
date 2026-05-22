'use client';

import { SessionProvider } from 'next-auth/react';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!session) return null;

  return <>{children}</>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthGuard>
        <div className="flex min-h-screen bg-zinc-950">
          <DashboardSidebar />
          <main className="flex-1 p-8 overflow-auto">
            {children}
          </main>
        </div>
      </AuthGuard>
    </SessionProvider>
  );
}
