'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRemoteMusicListener } from '@/hooks/use-remote-music-listener';
import { useFirestore, useAuth } from '@/firebase/provider';
import { doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';

interface MachineContextType {
  machineId: string | null;
}

const MachineContext = createContext<MachineContextType>({ machineId: null });

export const useMachine = () => useContext(MachineContext);

export function MachineProvider({ children }: { children: React.ReactNode }) {
  const [machineId, setMachineId] = useState<string | null>(null);
  const firestore = useFirestore();
  const auth = useAuth();

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setMachineId(user.uid);
      } else {
        setMachineId(null);
      }
    });
    return () => unsub();
  }, [auth]);

  useRemoteMusicListener(machineId);

  useEffect(() => {
    if (!machineId || !firestore || !auth) return;

    let isFirstSnapshot = true;

    // Listener para detectar se a máquina foi excluída no painel ADM
    const unsubDoc = onSnapshot(doc(firestore, 'machines', machineId), (snap) => {
      if (!snap.exists()) {
        // Se não existir no primeiro snapshot, não deslogamos ainda 
        // (pode ser uma máquina nova sendo criada agora pelo pingMachine)
        if (isFirstSnapshot) {
          isFirstSnapshot = false;
          return;
        }
        
        console.log("Máquina excluída pelo administrador. Encerrando sessão...");
        signOut(auth).catch(err => console.error("Erro ao deslogar após exclusão:", err));
      } else {
        isFirstSnapshot = false;
      }
    });

    const pingMachine = async () => {
      try {
        const machineRef = doc(firestore, 'machines', machineId);
        await setDoc(machineRef, {
          lastPing: serverTimestamp(),
          status: 'online',
        }, { merge: true });
      } catch (err) {
        console.error('Failed to ping machine status:', err);
      }
    };

    pingMachine();
    const interval = setInterval(pingMachine, 30000);
    return () => {
      unsubDoc();
      clearInterval(interval);
    };
  }, [machineId, firestore, auth]);

  return (
    <MachineContext.Provider value={{ machineId }}>
      {children}
    </MachineContext.Provider>
  );
}
