'use client';

import { useState } from 'react';
import { approveCardLink } from '@/lib/api';
import { getErrorMessage } from '@/lib/auth';
import type { Card } from '@/lib/types/api';

interface CardSelectorProps {
  platformId: string;
  platformName: string;
  cards: Card[] | null;
  cardsError: string | null;
  onLinkApproved: (linkToken: string) => void;
  onCancel: () => void;
}

function fmtUsdc(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CardSelector({ platformId, platformName, cards, cardsError, onLinkApproved, onCancel }: CardSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    if (!selectedId || connecting) return;
    setConnecting(true);
    setError(null);
    try {
      const { linkToken } = await approveCardLink({ cardId: selectedId, platformId });
      onLinkApproved(linkToken);
    } catch (err) {
      setError(getErrorMessage(err));
      setConnecting(false);
    }
  }

  return (
    <div className="flex h-screen flex-col gap-4 bg-white p-6">
      <div>
        <h1 className="text-lg font-semibold text-xp-navy">Connect to {platformName}</h1>
        <p className="mt-1 text-sm text-gray-500">{platformName} will be able to charge your XanCard for usage.</p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {cards === null && !cardsError && <p className="text-sm text-gray-400">Loading your cards…</p>}
        {cardsError && <p className="text-sm text-red-600">{cardsError}</p>}
        {cards !== null && cards.length === 0 && (
          <p className="text-sm text-gray-500">You don&apos;t have any active XanCards yet.</p>
        )}
        {cards?.map((card) => (
          <label
            key={card.id}
            className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
              selectedId === card.id ? 'border-xp-blue bg-xp-blue/5' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div>
              <div className="font-medium text-xp-navy">{card.name}</div>
              <div className="text-xs text-gray-400">•••• {card.last4}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">${fmtUsdc(card.gatewayBalance ?? 0)} USDC</span>
              <input
                type="radio"
                name="card"
                checked={selectedId === card.id}
                onChange={() => setSelectedId(card.id)}
                className="h-4 w-4 accent-[#2775CA]"
              />
            </div>
          </label>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={connecting}
          className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConnect}
          disabled={!selectedId || connecting}
          className="flex-1 rounded-xl bg-xp-blue px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-50"
        >
          {connecting ? 'Connecting…' : 'Connect Card'}
        </button>
      </div>
    </div>
  );
}
