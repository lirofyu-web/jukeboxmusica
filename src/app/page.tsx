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

  // Determina se estamos no App Nativo (Totem) ou no Navegador
  const isElectron = typeof window !== 'undefined' && !!(window as any).jukeboxAPI;
  const isBrowser = !isElectron;

  // Se estiver no Navegador e não houver operador logado, 
  // OBRIGATORIAMENTE mostra o Login em vez do Jukebox.
  if (isBrowser && !user) {
    return <LoginView />;
  }

  // Se estiver no Totem (Electron):
  // 1. Se NÃO tiver Hard Lock e NÃO tiver operador, 
  // o JukeboxContainer será exibido mas ele próprio mostrará a Splash de Bloqueio.
  // 2. Se TIVER Hard Lock, o JukeboxContainer abre normalmente.
  
  return (
    <main className="h-screen w-screen bg-black overflow-hidden">
      <JukeboxContainer />
    </main>
  );
}

