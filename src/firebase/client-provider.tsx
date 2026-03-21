'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';

export const FirebaseClientProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const firebaseData = useMemo(() => initializeFirebase(), []);

  if (!isMounted) {
    return <div className="bg-background min-h-screen" suppressHydrationWarning />;
  }

  return (
    <FirebaseProvider 
      firebaseApp={firebaseData.firebaseApp as any} 
      firestore={firebaseData.firestore as any} 
      auth={firebaseData.auth as any}
    >
      <div suppressHydrationWarning className="min-h-screen bg-background">
        {children}
      </div>
    </FirebaseProvider>
  );
};
