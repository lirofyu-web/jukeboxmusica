'use client';

import React, { createContext, useContext, useEffect } from 'react';
import { useMachineId } from '@/hooks/use-machine-id';
import { useRemoteMusicListener } from '@/hooks/use-remote-music-listener';
import { useFirestore } from '@/firebase/provider';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface MachineContextType {
  machineId: string | null;
}

const MachineContext = createContext<MachineContextType>({ machineId: null });

export function MachineProvider({ children }: { children: React.ReactNode }) {
  const machineId = useMachineId();
  const firestore = useFirestore();

  useRemoteMusicListener(machineId);

  useEffect(() => {
    if (!machineId || !firestore) return;

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
    return () => clearInterval(interval);
  }, [machineId, firestore]);

  return (
    <MachineContext.Provider value={{ machineId }}>
      {children}
    </MachineContext.Provider>
  );
}

export const useMachine = () => useContext(MachineContext);
