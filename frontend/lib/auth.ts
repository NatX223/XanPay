import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, new GoogleAuthProvider());
  return result.user;
}

/** Signs in with an existing email/password account only — never auto-creates one. Used by the connect-modal login screen, where a typo'd email should surface as an error, not a fresh blank account. */
export async function signInWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

/** Creates an account for a new email, or signs in if that email is already registered. */
export async function signUpOrSignInWithEmail(email: string, password: string): Promise<User> {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (err) {
    if (err instanceof FirebaseError && err.code === 'auth/email-already-in-use') {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    }
    throw err;
  }
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/wrong-password': 'Incorrect password for that email.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/invalid-email': 'That email address looks invalid.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/popup-closed-by-user': 'Google sign-in was closed before completing.',
  'auth/network-request-failed': 'Network error — check your connection and try again.',
};

/** Friendly message for a Firebase Auth error, or the raw message for anything else (e.g. backend API errors). */
export function getErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    return AUTH_ERROR_MESSAGES[err.code] ?? 'Something went wrong signing you in. Please try again.';
  }
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/** ID token to send as `Authorization: Bearer <token>` on every backend API call. */
export async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  return user ? user.getIdToken() : null;
}

export function useAuthUser(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  return { user, loading };
}
