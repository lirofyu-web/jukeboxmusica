'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig } from './config';

export function initializeFirebase() {
  if (typeof window === 'undefined') return { firebaseApp: null, firestore: null, auth: null };
  
  const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const firestore = getFirestore(firebaseApp);
  let auth = null;
  try {
    auth = getAuth(firebaseApp);
  } catch (err) {
    console.warn("Firebase Auth bypassed (missing API Key)");
  }
  return { firebaseApp, firestore, auth };
}

export * from './provider';
export * from './client-provider';
export * from './auth/use-user';
export * from './firestore/use-doc';
export * from './firestore/use-collection';
export * from './errors';
export * from './error-emitter';
