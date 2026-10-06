'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getErrorMessage, signInWithEmail, signInWithGoogle, signOutUser, useAuthUser } from '@/lib/auth';
import { ApiError, getMyProfile, getPublicPlatform, listCards } from '@/lib/api';
import type { Card } from '@/lib/types/api';
import LoginScreen from './components/LoginScreen';
import NoAccountScreen from './components/NoAccountScreen';
import CardSelector from './components/CardSelector';

type Screen = 'loading' | 'login' | 'no-account' | 'cards';

/** Posts an event to the embedding platform page — only ever to the origin it told us it was on. */
function postToParent(origin: string, message: { type: string; linkToken?: string }) {
  window.parent.postMessage(message, origin);
}

export default function ConnectModalClient() {
  const searchParams = useSearchParams();
  const platformId = searchParams.get('platformId') ?? '';
  const rawOrigin = searchParams.get('origin') ?? '';

  // Browser-enforced targetOrigin matching (not our own string comparison) is what actually stops the
  // linkToken from being delivered to the wrong listener — this just rejects a malformed/missing origin
  // up front rather than silently passing garbage to postMessage.
  const targetOrigin = useMemo(() => {
    try {
      return new URL(rawOrigin).origin;
    } catch {
      return null;
    }
  }, [rawOrigin]);

  const { user, loading } = useAuthUser();
  const initialCheckDone = useRef(false);

  const [screen, setScreen] = useState<Screen>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [noAccountEmail, setNoAccountEmail] = useState('');
  const [platformName, setPlatformName] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [cardsError, setCardsError] = useState<string | null>(null);

  // Display name is fetched unauthenticated so it's ready before the user has signed in.
  useEffect(() => {
    if (!platformId) return;
    getPublicPlatform(platformId)
      .then((p) => setPlatformName(p?.name ?? null))
      .catch(() => setPlatformName(null));
  }, [platformId]);

  // Decides only the *first* screen once Firebase Auth resolves. Explicit actions (below) drive every
  // transition after that, so a returning already-authenticated session goes straight to CardSelector,
  // while an in-flight Google login can still detour through NoAccountScreen without this effect
  // stepping on it.
  useEffect(() => {
    if (loading || initialCheckDone.current) return;
    initialCheckDone.current = true;
    setScreen(user ? 'cards' : 'login');
  }, [loading, user]);

  useEffect(() => {
    if (screen !== 'cards') return;
    let cancelled = false;
    listCards()
      .then((all) => {
        if (!cancelled) setCards(all.filter((card) => card.active));
      })
      .catch((err) => {
        if (!cancelled) setCardsError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [screen]);

  async function handleGoogle() {
    if (submitting) return;
    setSubmitting(true);
    setAuthError(null);
    try {
      const signedInUser = await signInWithGoogle();
      try {
        await getMyProfile();
        setScreen('cards');
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setNoAccountEmail(signedInUser.email ?? '');
          setScreen('no-account');
        } else {
          throw err;
        }
      }
    } catch (err) {
      setAuthError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEmailSignIn(email: string, password: string) {
    if (submitting) return;
    setSubmitting(true);
    setAuthError(null);
    try {
      await signInWithEmail(email, password);
      setScreen('cards');
    } catch (err) {
      setAuthError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTryDifferentAccount() {
    await signOutUser().catch(() => {});
    setAuthError(null);
    setScreen('login');
  }

  function handleCancel() {
    if (targetOrigin) postToParent(targetOrigin, { type: 'XANPAY_LINK_CANCEL' });
  }

  function handleLinkApproved(linkToken: string) {
    if (targetOrigin) postToParent(targetOrigin, { type: 'XANPAY_LINK_SUCCESS', linkToken });
  }

  if (!platformId || !targetOrigin) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 bg-white p-6 text-center">
        <p className="text-sm font-medium text-red-600">This connect link is missing or invalid.</p>
        <p className="text-xs text-gray-400">Please return to the platform and try again.</p>
      </div>
    );
  }

  if (screen === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-xp-blue border-t-transparent" />
      </div>
    );
  }

  if (screen === 'no-account') {
    return <NoAccountScreen email={noAccountEmail} onBack={handleTryDifferentAccount} />;
  }

  if (screen === 'cards') {
    return (
      <CardSelector
        platformId={platformId}
        platformName={platformName ?? 'this platform'}
        cards={cards}
        cardsError={cardsError}
        onLinkApproved={handleLinkApproved}
        onCancel={handleCancel}
      />
    );
  }

  return <LoginScreen submitting={submitting} error={authError} onGoogle={handleGoogle} onEmailSignIn={handleEmailSignIn} />;
}
