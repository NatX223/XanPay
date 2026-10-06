'use client';

import { useState } from 'react';

interface LoginScreenProps {
  submitting: boolean;
  error: string | null;
  onGoogle: () => void;
  onEmailSignIn: (email: string, password: string) => void;
}

export default function LoginScreen({ submitting, error, onGoogle, onEmailSignIn }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || submitting) return;
    onEmailSignIn(email.trim(), password);
  }

  return (
    <div className="flex h-screen flex-col justify-center gap-5 bg-white p-6">
      <div>
        <h1 className="text-lg font-semibold text-xp-navy">Sign in to XanPay</h1>
        <p className="mt-1 text-sm text-gray-500">Connect your XanCard to keep going.</p>
      </div>

      <button
        type="button"
        onClick={onGoogle}
        disabled={submitting}
        className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
      >
        <GoogleIcon /> Continue with Google
      </button>

      <div className="flex items-center gap-3 text-xs text-gray-400">
        <div className="h-px flex-1 bg-gray-200" />
        or
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-xp-blue"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-xp-blue"
        />
        <button
          type="submit"
          disabled={submitting || !email.trim() || !password}
          className="rounded-xl bg-xp-blue px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.9v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.96H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.04l3.07-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.96l3.07 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
