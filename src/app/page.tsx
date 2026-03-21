"use client";

import React, { useEffect, useState } from 'react';
import { JukeboxContainer } from '@/components/jukebox/jukebox-container';
import { LoginView } from '@/components/jukebox/login-view';
import { useAuth } from '@/firebase/provider';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, [auth]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em]">Inicializando Sistema...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <main>
      <JukeboxContainer />
    </main>
  );
}
