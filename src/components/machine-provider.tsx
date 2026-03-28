'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRemoteMusicListener } from '@/hooks/use-remote-music-listener';
import { useFirestore, useAuth } from '@/firebase/provider';
import { doc, setDoc, serverTimestamp, onSnapshot, getDoc, query, where, getDocs, limit, collection, deleteDoc } from 'firebase/firestore';
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
    const initMachineId = async () => {
      // 1. Tentar obter o ID Físico da Máquina (Electron)
      if (typeof window !== 'undefined' && (window as any).jukeboxAPI) {
        try {
          const hwId = await (window as any).jukeboxAPI.getMachineId();
          if (hwId) {
            setMachineId(hwId);
            return; // Usamos o ID do hardware como soberano para clonagem
          }
        } catch (e) {}
      }

      // 2. Fallback para Firebase Auth (Modo Web/Antigo)
      if (!auth) return;
      const unsub = onAuthStateChanged(auth, (user) => {
        if (user) {
          setMachineId(user.uid);
        } else {
          setMachineId(null);
        }
      });
      return unsub;
    };

    const cleanup = initMachineId();
    return () => {
      if (typeof cleanup === 'function') (cleanup as any)();
    };
  }, [auth]);

  useRemoteMusicListener(machineId);

  useEffect(() => {
    if (!machineId || !firestore || !auth) return;

    let isFirstSnapshot = true;

    const unsubDoc = onSnapshot(doc(firestore, 'machines', machineId), async (snap) => {
      if (!snap.exists()) {
        // Se a máquina não existe no ID fixo, tentamos o fluxo de link por código
        if (typeof window !== 'undefined' && (window as any).jukeboxAPI) {
          try {
            const status = await (window as any).jukeboxAPI.checkHardLock();
            if (status.linkCode) {
              console.log("Tentando vincular máquina via código:", status.linkCode);
              
              const q = query(
                collection(firestore, 'machines'), 
                where('activationCode', '==', status.linkCode),
                limit(1)
              );
              const linkSnaps = await getDocs(q);
              
              if (!linkSnaps.empty) {
                const targetDoc = linkSnaps.docs[0];
                await setDoc(doc(firestore, 'machines', machineId), {
                  ...targetDoc.data(),
                  hardwareId: machineId,
                  status: 'online',
                  lastPing: serverTimestamp(),
                  activationCode: null // Consumido
                });
                // Deletamos a "casca" vazia
                await deleteDoc(doc(firestore, 'machines', targetDoc.id));
                console.log("Vínculo concluído. Máquina adotou configurações de:", targetDoc.id);
                return;
              }
            }
          } catch (e) { console.error("Erro no link:", e); }
        }

        if (isFirstSnapshot) {
          isFirstSnapshot = false;
          return;
        }
        
        // Antes de deslogar, verificamos se o Hard Lock está presente.
        // Se estiver, permitimos uso OFFLINE mesmo sem registro no Firestore.
        let canStayOffline = false;
        if (typeof window !== 'undefined' && (window as any).jukeboxAPI) {
          try {
            const status = await (window as any).jukeboxAPI.checkHardLock();
            if (status.hardLockPresent) {
               canStayOffline = true;
               console.log("Modo OFFLINE detectado via Hard Lock. Mantendo sistema ativo.");
            }
          } catch (e) {}
        }

        if (!canStayOffline) {
          console.log("Máquina sem registro e sem Hard Lock. Encerrando sessão...");
          signOut(auth).catch(err => console.error("Erro ao deslogar:", err));
        }
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
      } catch (err) { console.error('Ping failed:', err); }
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
