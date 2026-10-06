'use client';

interface NoAccountScreenProps {
  email: string;
  onBack: () => void;
}

export default function NoAccountScreen({ email, onBack }: NoAccountScreenProps) {
  // Opens in a new tab (never redirects the modal itself) so the user can come back and finish linking
  // once their XanCard exists. This app's real signup route is /onboarding — there is no separate
  // xanpay.com/signup here.
  const signupUrl = typeof window !== 'undefined' ? `${window.location.origin}/onboarding` : '/onboarding';

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-white p-6 text-center">
      <div className="text-3xl" aria-hidden="true">⚠️</div>
      <div>
        <p className="text-sm font-medium text-xp-navy">No XanPay account found for {email || 'that account'}</p>
        <p className="mt-1 text-sm text-gray-500">You need a XanCard to pay on this platform.</p>
      </div>

      <a
        href={signupUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full rounded-xl bg-xp-blue px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
      >
        Create a XanCard →
      </a>

      <button
        type="button"
        onClick={onBack}
        className="text-sm text-gray-500 underline underline-offset-2 hover:text-xp-navy"
      >
        ← Try a different account
      </button>
    </div>
  );
}
