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

  const [isHardLockPresent, setIsHardLockPresent] = useState<boolean>(false);
  const [checkingHardLock, setCheckingHardLock] = useState(true);

  useEffect(() => {
    const checkKey = async () => {
      if (typeof window !== 'undefined' && (window as any).jukeboxAPI) {
        try {
          const status = await (window as any).jukeboxAPI.checkHardLock();
          setIsHardLockPresent(status.hardLockPresent);
        } catch (e) {}
      }
      setCheckingHardLock(false);
    };

    checkKey();
    const interval = setInterval(checkKey, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, [auth]);

  if (loading || checkingHardLock) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em]">Inicializando Sistema...</p>
      </div>
    );
  }

  // Se o Hard Lock estiver presente, mostramos o Jukebox (o MachineProvider lidará com o link se necessário)
  // Ou se tiver um usuário logado (Admin Panel ou Modo Web)
  if (!isHardLockPresent && !user) {
    return <LoginView />;
  }

  return (
    <main>
      <JukeboxContainer />
    </main>
  );
}
