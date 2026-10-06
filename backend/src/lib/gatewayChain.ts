import { CHAIN_CONFIGS, type SupportedChainName } from '@circle-fin/x402-batching/client';

/** Maps Circle's own blockchain enum (used elsewhere in this codebase) to the chain names Circle Gateway's SDK expects. Hyphenated Circle values are always the testnet counterpart. */
const CHAIN_NAME_BY_CIRCLE_BLOCKCHAIN: Record<string, SupportedChainName> = {
  ETH: 'ethereum',
  'ETH-SEPOLIA': 'sepolia',
  MATIC: 'polygon',
  'MATIC-AMOY': 'polygonAmoy',
  AVAX: 'avalanche',
  'AVAX-FUJI': 'avalancheFuji',
  ARC: 'arc',
  'ARC-TESTNET': 'arcTestnet',
};

export const circleBlockchain = process.env.CIRCLE_BLOCKCHAIN ?? 'MATIC-AMOY';

const gatewayChainName = CHAIN_NAME_BY_CIRCLE_BLOCKCHAIN[circleBlockchain];
if (!gatewayChainName) {
  throw new Error(
    `CIRCLE_BLOCKCHAIN=${circleBlockchain} has no Circle Gateway mapping. Supported: ${Object.keys(CHAIN_NAME_BY_CIRCLE_BLOCKCHAIN).join(', ')}`,
  );
}

/** Contract addresses (USDC, GatewayWallet) and viem chain metadata for the chain this deployment runs on. */
export const chainConfig = CHAIN_CONFIGS[gatewayChainName];

/** Hyphenated Circle blockchain values (e.g. `MATIC-AMOY`) are always the testnet counterpart. */
export const isTestnetChain = circleBlockchain.includes('-');

/** Arc mainnet needs an extra header on Gateway API calls (see gatewayApiHeaders in @circle-fin/x402-batching). */
export const isArcMainnet = circleBlockchain === 'ARC';

/** Base URL for Circle's Gateway REST API (balances, transfer/withdraw, transfer lookups). */
export const GATEWAY_API_BASE_URL = isTestnetChain
  ? 'https://gateway-api-testnet.circle.com/v1'
  : 'https://gateway-api.circle.com/v1';
