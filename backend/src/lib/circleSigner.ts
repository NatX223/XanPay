import type { Hex } from 'viem';
import { circle } from '../circle';

/** EIP-712 domain field types, keyed by the field names Circle Gateway's various signed documents use. */
const DOMAIN_FIELD_TYPES: Record<string, string> = {
  name: 'string',
  version: 'string',
  chainId: 'uint256',
  verifyingContract: 'address',
};

/** JSON can't carry BigInt — signTypedData's `message` may contain bigint uint256 values that need stringifying first. */
function toJsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, toJsonSafe(v)]));
  }
  return value;
}

export interface TypedDataRequest {
  domain: Record<string, unknown>;
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
}

/**
 * Signs an EIP-712 typed-data document via Circle's MPC `signTypedData` API for the given wallet —
 * the wallet's private key never leaves Circle. Shared by the charge flow (EIP-3009
 * TransferWithAuthorization, domain has chainId+verifyingContract) and the Gateway withdraw flow
 * (BurnIntent, domain has just name+version) — the `EIP712Domain` type is derived from whichever
 * fields the caller's `domain` actually has, so each caller only needs to supply the fields it uses.
 */
export async function signTypedDataWithCircleWallet(walletId: string, request: TypedDataRequest): Promise<Hex> {
  const domainType = Object.keys(request.domain).map((name) => ({ name, type: DOMAIN_FIELD_TYPES[name] ?? 'string' }));

  const response = await circle.signTypedData({
    walletId,
    data: JSON.stringify({
      types: { EIP712Domain: domainType, ...request.types },
      domain: request.domain,
      primaryType: request.primaryType,
      message: toJsonSafe(request.message),
    }),
  });
  const signature = response.data?.signature;
  if (!signature) throw new Error('Circle did not return a signature for the typed-data request');
  return signature as Hex;
}
