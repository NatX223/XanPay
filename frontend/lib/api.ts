import { getIdToken } from '@/lib/auth';
import type {
  ApiKeyCreated,
  ApiKeySummary,
  Card,
  CardBalance,
  CardRules,
  ChargeLogEntry,
  CircleTransaction,
  Group,
  Platform,
  PlatformRegistration,
  PlatformStats,
  PublicPlatform,
  RouteSummary,
  User,
  WithdrawResult,
} from '@/lib/types/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getIdToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.error ?? `Request failed with ${res.status}`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Users
export function createUserProfile(data: { name: string; email: string }): Promise<User> {
  return apiFetch('/users', { method: 'POST', body: JSON.stringify(data) });
}
export function getMyProfile(): Promise<User> {
  return apiFetch('/users/me');
}
export function getMyActivity(): Promise<{ transactions: CircleTransaction[] }> {
  return apiFetch('/users/me/activity');
}

// Groups
export function createGroup(data: { name: string; accent?: string; glyph?: string }): Promise<Group> {
  return apiFetch('/groups', { method: 'POST', body: JSON.stringify(data) });
}
export function listGroups(): Promise<Group[]> {
  return apiFetch('/groups');
}
export function updateGroup(id: string, data: Partial<Pick<Group, 'name' | 'accent' | 'glyph'>>): Promise<Group> {
  return apiFetch(`/groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}
export function deleteGroup(id: string): Promise<void> {
  return apiFetch(`/groups/${id}`, { method: 'DELETE' });
}
export function getGroupActivity(id: string): Promise<{ transactions: CircleTransaction[] }> {
  return apiFetch(`/groups/${id}/activity`);
}

// Cards
export function createCard(data: { name: string; groupId: string; monthly?: number }): Promise<Card> {
  return apiFetch('/cards', { method: 'POST', body: JSON.stringify(data) });
}
export function listCards(): Promise<Card[]> {
  return apiFetch('/cards');
}
export function getCard(id: string): Promise<Card> {
  return apiFetch(`/cards/${id}`);
}
export function getCardBalance(id: string): Promise<CardBalance> {
  return apiFetch(`/cards/${id}/balance`);
}
/** Pulls `amount` USDC back out of Circle Gateway to the card's own on-chain wallet. */
export function withdrawCardBalance(id: string, amount: number): Promise<WithdrawResult> {
  return apiFetch(`/cards/${id}/withdraw`, { method: 'POST', body: JSON.stringify({ amount }) });
}
export function getCardActivity(id: string): Promise<{ transactions: CircleTransaction[] }> {
  return apiFetch(`/cards/${id}/activity`);
}
export function updateCardRules(id: string, rules: Partial<CardRules>): Promise<Card> {
  return apiFetch(`/cards/${id}/rules`, { method: 'PATCH', body: JSON.stringify(rules) });
}
export function setCardActive(id: string, active: boolean): Promise<Card> {
  return apiFetch(`/cards/${id}/active`, { method: 'PATCH', body: JSON.stringify({ active }) });
}
export function deleteCard(id: string): Promise<void> {
  return apiFetch(`/cards/${id}`, { method: 'DELETE' });
}

// Platforms (developer onboarding)
export function registerPlatform(data: { name: string }): Promise<PlatformRegistration> {
  return apiFetch('/platform/register', { method: 'POST', body: JSON.stringify(data) });
}
/** Null if this account hasn't registered a platform yet — not an error. */
export async function getMyPlatform(): Promise<Platform | null> {
  try {
    return await apiFetch<Platform>('/platform/me');
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

// API keys
export function listApiKeys(): Promise<{ keys: ApiKeySummary[] }> {
  return apiFetch('/platform/keys');
}
export function createApiKey(data: { name: string }): Promise<ApiKeyCreated> {
  return apiFetch('/platform/keys', { method: 'POST', body: JSON.stringify(data) });
}
export function revokeApiKey(id: string): Promise<void> {
  return apiFetch(`/platform/keys/${id}`, { method: 'DELETE' });
}
export function rollApiKey(id: string): Promise<ApiKeyCreated> {
  return apiFetch(`/platform/keys/${id}/roll`, { method: 'POST' });
}

// Routes (pricing catalog)
export function listRoutes(): Promise<{ routes: RouteSummary[] }> {
  return apiFetch('/platform/routes');
}
export function createRoute(data: { path: string; method: string; price: number }): Promise<RouteSummary> {
  return apiFetch('/platform/routes', { method: 'POST', body: JSON.stringify(data) });
}
export function updateRoute(id: string, data: Partial<Pick<RouteSummary, 'price' | 'status'>>): Promise<RouteSummary> {
  return apiFetch(`/platform/routes/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}
export function deleteRoute(id: string): Promise<void> {
  return apiFetch(`/platform/routes/${id}`, { method: 'DELETE' });
}

// Card-to-platform linking (connect-modal)
/** Null if platformId doesn't match a registered platform — not an error. */
export async function getPublicPlatform(platformId: string): Promise<PublicPlatform | null> {
  try {
    return await apiFetch<PublicPlatform>(`/platform/public/${platformId}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
export function approveCardLink(data: { cardId: string; platformId: string }): Promise<{ linkToken: string }> {
  return apiFetch('/platform/link/approve', { method: 'POST', body: JSON.stringify(data) });
}

// Stats + request log
export function getPlatformStats(range: '7d' | '30d' | '90d'): Promise<PlatformStats> {
  return apiFetch(`/platform/stats?range=${range}`);
}
export function listPlatformCharges(limit = 50): Promise<{ charges: ChargeLogEntry[] }> {
  return apiFetch(`/platform/charges?limit=${limit}`);
}
