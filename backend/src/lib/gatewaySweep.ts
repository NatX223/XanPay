import { parseUnits } from 'viem';
import { FieldValue } from 'firebase-admin/firestore';
import { circle, getWalletBalance } from '../circle';
import { db } from '../firebaseAdmin';
import { chainConfig } from './gatewayChain';
import type { CardDoc } from '../types';

const USDC_DECIMALS = 6;

/** Below this, a wallet's USDC balance isn't worth the cost of a sweep (two on-chain txs). */
const MIN_SWEEP_USDC = Number(process.env.GATEWAY_SWEEP_MIN_USDC ?? '0.01');
/** Native-gas balance (in the chain's native unit, e.g. MATIC) below which a card wallet gets topped up before a sweep. */
const GAS_TOPUP_THRESHOLD = Number(process.env.GATEWAY_GAS_TOPUP_THRESHOLD ?? '0.01');
/** How much native gas to send on each top-up. */
// const GAS_TOPUP_AMOUNT = process.env.GATEWAY_GAS_TOPUP_AMOUNT ?? '0.1';
/** Circle wallet that sponsors card wallets' gas — see scripts/create-gas-sponsor-wallet.ts. Must be pre-funded from a faucet. */
const GAS_SPONSOR_WALLET_ID = process.env.CIRCLE_GAS_SPONSOR_WALLET_ID;

const FEE_MEDIUM = { type: 'level', config: { feeLevel: 'MEDIUM' } } as const;

let warnedNoSponsor = false;

/** Blocks until a Circle-tracked transaction reaches (or passes) CONFIRMED; throws if it fails/gets stuck instead. */
async function waitConfirmed(transactionId: string): Promise<void> {
  await circle.getTransaction({ id: transactionId, waitForState: 'CONFIRMED' });
}

/**
 * Card wallets only ever receive USDC — they hold no native gas of their own — so the two on-chain
 * calls a sweep needs (approve + deposit) would otherwise fail outright. This tops the card wallet up
 * from a XanPay-operated "gas sponsor" wallet first. No-ops (with a one-time warning) if that wallet
 * isn't configured, and if the card wallet already has enough gas.
 */
async function ensureGas(card: { circleWalletId: string; walletAddress: string }): Promise<void> {
  if (!GAS_SPONSOR_WALLET_ID) {
    if (!warnedNoSponsor) {
      warnedNoSponsor = true;
      console.warn(
        'CIRCLE_GAS_SPONSOR_WALLET_ID is not set — skipping gas top-up. Gateway sweeps will fail for card wallets with no native gas.',
      );
    }
    return;
  }

  const balances = await getWalletBalance(card.circleWalletId);
  const native = balances.find((b) => b.token?.isNative);
  const nativeAmount = native ? Number(native.amount) : 0;
  console.log(`nativeAmount:${nativeAmount}`);
  
  // if (nativeAmount >= GAS_TOPUP_THRESHOLD) return;

  // `blockchain` is intentionally omitted: when sending from a walletId (rather than a bare
  // walletAddress), Circle infers the chain from the sending wallet itself, and the SDK's types
  // reject `blockchain` alongside `walletId`. `tokenAddress: ''` is what selects the chain's native
  // asset (MATIC-AMOY here) instead of an ERC-20.

  const GAS_TOPUP_AMOUNT = parseUnits('0.1', USDC_DECIMALS).toString();
  // const topUp = await circle.createTransaction({
  //   walletId: GAS_SPONSOR_WALLET_ID,
  //   destinationAddress: card.walletAddress,
  //   tokenAddress: '',
  //   amount: [GAS_TOPUP_AMOUNT],
  //   fee: FEE_MEDIUM,
  // });

  const topUpTx = await circle.createContractExecutionTransaction({
    walletId: GAS_SPONSOR_WALLET_ID,
    contractAddress: chainConfig.usdc,
    abiFunctionSignature: 'transfer(address,uint256)',
    abiParameters: [card.walletAddress, GAS_TOPUP_AMOUNT],
    fee: FEE_MEDIUM,
  });
  await waitConfirmed(topUpTx.data!.id);
}

export interface SweepResult {
  /** USDC moved into Gateway by this call — 0 if there was nothing worth sweeping. */
  swept: number;
  /** cards/{id}.gatewayBalance after this sweep. */
  gatewayBalance: number;
}

/**
 * Moves whatever USDC is sitting in a card's on-chain wallet into Circle Gateway and credits the
 * swept amount onto `cards/{id}.gatewayBalance` — the ledger `POST /platform/charge` actually spends
 * from. This is what makes "send USDC to your card's address" eventually chargeable: depositing to
 * the wallet and being able to spend via Gateway are two different balances, and this is the bridge.
 *
 * Two on-chain calls, both made *from the card's own Circle wallet* (MPC-signed — the key never
 * leaves Circle): `approve(gatewayWallet, amount)` on the USDC contract, then `deposit(usdc, amount)`
 * on the GatewayWallet contract. Each is awaited to CONFIRMED before the next step, so a failure
 * partway through never gets recorded as a credit.
 *
 * Best-effort by design — callers decide whether a failure here should surface to the user or be
 * swallowed (see routes/cards.ts, which treats this as an implementation detail of "check balance").
 */
export async function sweepCardToGateway(
  cardId: string,
  card: Pick<CardDoc, 'circleWalletId' | 'walletAddress' | 'gatewayBalance'>
): Promise<SweepResult> {
  const currentGatewayBalance = card.gatewayBalance ?? 0;

  const balances = await getWalletBalance(card.circleWalletId);
  const usdc = balances.find((b) => b.token?.symbol?.toUpperCase() === 'USDC');
  const available = usdc ? Number(usdc.amount) : 0;
  if (!(available >= MIN_SWEEP_USDC)) {
    return { swept: 0, gatewayBalance: currentGatewayBalance };
  }

  const amountAtomic = parseUnits(usdc!.amount, USDC_DECIMALS).toString();
  console.log(`amountAtomic: ${amountAtomic}`);

  await ensureGas(card);

  // Always approves the exact swept amount rather than checking existing allowance first (which
  // would need a direct RPC read) — costs one extra approval tx on repeat sweeps but keeps this
  // free of a second network dependency and immune to stale-allowance edge cases.
  const approveTx = await circle.createContractExecutionTransaction({
    walletId: card.circleWalletId,
    contractAddress: chainConfig.usdc,
    abiFunctionSignature: 'approve(address,uint256)',
    abiParameters: [chainConfig.gatewayWallet, amountAtomic],
    fee: FEE_MEDIUM,
  });
  await waitConfirmed(approveTx.data!.id);

  const depositTx = await circle.createContractExecutionTransaction({
    walletId: card.circleWalletId,
    contractAddress: chainConfig.gatewayWallet,
    abiFunctionSignature: 'deposit(address,uint256)',
    abiParameters: [chainConfig.usdc, amountAtomic],
    fee: FEE_MEDIUM,
  });
  await waitConfirmed(depositTx.data!.id);

  const swept = Number(usdc!.amount);
  await db.collection('cards').doc(cardId).update({ gatewayBalance: FieldValue.increment(swept) });

  return { swept, gatewayBalance: currentGatewayBalance + swept };
}
