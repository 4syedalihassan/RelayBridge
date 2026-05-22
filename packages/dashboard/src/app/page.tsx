'use client';

import { signIn, useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [status, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-900 to-zinc-800">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-white">Discord → Global Relay</h1>
        <p className="text-zinc-400 max-w-md">
          Archive your Discord messages to Global Relay for compliance and recordkeeping.
        </p>
        <button
          onClick={() => signIn('discord')}
          className="rounded-lg bg-[#5865F2] px-8 py-3 text-white font-semibold hover:bg-[#4752C4] transition-colors"
        >
          Sign in with Discord
        </button>
      </div>
    </div>
  );
}
