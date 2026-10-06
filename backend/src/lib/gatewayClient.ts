import { BatchEvmScheme } from '@circle-fin/x402-batching/client';
import { BatchFacilitatorClient } from '@circle-fin/x402-batching/server';
import type { Address, Hex } from 'viem';
import { chainConfig, isTestnetChain } from './gatewayChain';
import { signTypedDataWithCircleWallet } from './circleSigner';

const facilitator = new BatchFacilitatorClient({
  url: isTestnetChain ? 'https://gateway-api-testnet.circle.com' : 'https://gateway-api.circle.com',
});

interface GatewayEvmSigner {
  address: Address;
  signTypedData: (params: {
    domain: Record<string, unknown>;
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  }) => Promise<Hex>;
}

/** Wraps Circle's MPC `signTypedData` API as a Gateway-compatible EIP-712 signer — the card's private key never leaves Circle. */
function createCardSigner(circleWalletId: string, walletAddress: string): GatewayEvmSigner {
  return {
    address: walletAddress as Address,
    signTypedData: (params) => signTypedDataWithCircleWallet(circleWalletId, params),
  };
}

/**
 * Signs an EIP-3009 TransferWithAuthorization from a card's wallet to a platform's
 * merchant wallet via Circle's MPC signing, then settles it through Circle Gateway's
 * batched x402 facilitator (gas-free — Gateway aggregates signed authorizations and
 * settles them on-chain itself). Returns the Gateway settlement transaction id.
 */
export async function submitGatewayCharge(
  card: { circleWalletId: string; walletAddress: string },
  merchantWalletAddress: string,
  amountUsdc: number,
): Promise<{ txId: string }> {
  const requirements = {
    scheme: 'exact',
    network: `eip155:${chainConfig.chain.id}`,
    asset: chainConfig.usdc,
    amount: String(Math.round(amountUsdc * 1e6)),
    payTo: merchantWalletAddress,
    maxTimeoutSeconds: 60,
    extra: {
      name: 'GatewayWalletBatched',
      version: '1',
      verifyingContract: chainConfig.gatewayWallet,
    },
  };

  const signer = createCardSigner(card.circleWalletId, card.walletAddress);
  const paymentPayload = await new BatchEvmScheme(signer).createPaymentPayload(1, requirements);
  // The client and server packages each declare their own narrower `PaymentPayload.payload`
  // type (`BatchPayload` vs. a generic record) even though they're the same shape at runtime.
  const settleResponse = await facilitator.settle(
    { x402Version: paymentPayload.x402Version, payload: paymentPayload.payload as unknown as Record<string, unknown> },
    requirements,
  );

  if (!settleResponse.success) {
    throw new Error(settleResponse.errorReason ?? 'Circle Gateway settlement failed');
  }
  return { txId: settleResponse.transaction };
}
