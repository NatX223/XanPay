import { randomBytes } from 'node:crypto';
import { maxUint256, pad, parseUnits, zeroAddress, type Address, type Hex } from 'viem';
import { arcPrivateMainnetHeaders } from '@circle-fin/x402-batching/client';
import { FieldValue } from 'firebase-admin/firestore';
import { circle } from '../circle';
import { db } from '../firebaseAdmin';
import { chainConfig, GATEWAY_API_BASE_URL, isArcMainnet } from './gatewayChain';
import { signTypedDataWithCircleWallet } from './circleSigner';
import type { CardDoc } from '../types';

const USDC_DECIMALS = 6;

/** Max fee (in USDC) the withdrawal authorizes Circle to charge for processing it. Circle rejects the transfer if its actual fee exceeds this. */
const WITHDRAW_MAX_FEE = process.env.GATEWAY_WITHDRAW_MAX_FEE ?? '0.05';

/** Same wallet that sponsors sweep-to-Gateway gas (see gatewaySweep.ts) — relays the mint call here too. */
const GAS_SPONSOR_WALLET_ID = process.env.CIRCLE_GAS_SPONSOR_WALLET_ID;

const FEE_MEDIUM = { type: 'level', config: { feeLevel: 'MEDIUM' } } as const;

/** Circle Gateway's BurnIntent EIP-712 types — mirrors what @circle-fin/x402-batching's GatewayClient.withdraw() signs, replicated here because that client signs with a raw private key and XanPay's card wallets are Circle MPC wallets instead. */
const BURN_INTENT_TYPES = {
  TransferSpec: [
    { name: 'version', type: 'uint32' },
    { name: 'sourceDomain', type: 'uint32' },
    { name: 'destinationDomain', type: 'uint32' },
    { name: 'sourceContract', type: 'bytes32' },
    { name: 'destinationContract', type: 'bytes32' },
    { name: 'sourceToken', type: 'bytes32' },
    { name: 'destinationToken', type: 'bytes32' },
    { name: 'sourceDepositor', type: 'bytes32' },
    { name: 'destinationRecipient', type: 'bytes32' },
    { name: 'sourceSigner', type: 'bytes32' },
    { name: 'destinationCaller', type: 'bytes32' },
    { name: 'value', type: 'uint256' },
    { name: 'salt', type: 'bytes32' },
    { name: 'hookData', type: 'bytes' },
  ],
  BurnIntent: [
    { name: 'maxBlockHeight', type: 'uint256' },
    { name: 'maxFee', type: 'uint256' },
    { name: 'spec', type: 'TransferSpec' },
  ],
};

function addressToBytes32(address: Address): Hex {
  return pad(address.toLowerCase() as Address, { size: 32 });
}

/** Blocks until a Circle-tracked transaction reaches (or passes) CONFIRMED; throws if it fails/gets stuck instead. */
async function waitConfirmed(transactionId: string): Promise<void> {
  await circle.getTransaction({ id: transactionId, waitForState: 'CONFIRMED' });
}

export class WithdrawError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface WithdrawResult {
  withdrawn: number;
  gatewayBalance: number;
  mintTransactionId: string;
}

/**
 * Withdraws USDC from Circle Gateway back to a card's own on-chain wallet — same chain only (XanPay
 * runs a single configured chain; see CIRCLE_BLOCKCHAIN). This is the inverse of gatewaySweep.ts, but
 * isn't a simple reverse of `deposit`: Gateway balance can't be pulled out with a plain contract call
 * you sign yourself. It's a burn/mint attestation flow:
 *
 * 1. The card's own wallet signs a BurnIntent (EIP-712) authorizing Circle to burn `amount` from its
 *    Gateway balance and mint it back to its own address — MPC-signed, the card's key never leaves
 *    Circle.
 * 2. The signed intent is posted to Circle's Gateway `/transfer` API, which attests it and returns a
 *    mint payload.
 * 3. The gas-sponsor wallet (not the card wallet) relays `gatewayMint(attestation, signature)`
 *    on-chain. This call is unrestricted (`destinationCaller` is the zero address in the intent), so
 *    it doesn't need to come from the card wallet — meaning withdrawals need no card-wallet gas
 *    top-up at all, unlike deposits.
 *
 * `cards/{id}.gatewayBalance` is decremented up front, inside a transaction (so a concurrent
 * withdraw/charge can't overdraw it), and refunded if anything after that fails.
 */
export async function withdrawCardFromGateway(cardId: string, amount: number): Promise<WithdrawResult> {
  if (!GAS_SPONSOR_WALLET_ID) {
    throw new WithdrawError(503, 'Withdrawals are not available yet — no gas sponsor wallet is configured.');
  }

  const cardRef = db.collection('cards').doc(cardId);
  const card = await db.runTransaction(async (tx) => {
    const snap = await tx.get(cardRef);
    if (!snap.exists) throw new WithdrawError(404, 'Card not found');
    const data = snap.data() as CardDoc;
    const gatewayBalance = data.gatewayBalance ?? 0;
    if (gatewayBalance < amount) throw new WithdrawError(402, 'Insufficient Gateway balance');
    tx.update(cardRef, { gatewayBalance: FieldValue.increment(-amount) });
    return data;
  });

  try {
    const withdrawAmount = parseUnits(amount.toString(), USDC_DECIMALS);
    const maxFee = parseUnits(WITHDRAW_MAX_FEE, USDC_DECIMALS);
    const salt = `0x${randomBytes(32).toString('hex')}` as Hex;
    const walletAddress = card.walletAddress as Address;

    const spec = {
      version: 1,
      sourceDomain: chainConfig.domain,
      destinationDomain: chainConfig.domain,
      sourceContract: addressToBytes32(chainConfig.gatewayWallet),
      destinationContract: addressToBytes32(chainConfig.gatewayMinter),
      sourceToken: addressToBytes32(chainConfig.usdc),
      destinationToken: addressToBytes32(chainConfig.usdc),
      sourceDepositor: addressToBytes32(walletAddress),
      destinationRecipient: addressToBytes32(walletAddress),
      sourceSigner: addressToBytes32(walletAddress),
      destinationCaller: addressToBytes32(zeroAddress),
      value: withdrawAmount,
      salt,
      hookData: '0x' as Hex,
    };
    const burnIntent = { maxBlockHeight: maxUint256, maxFee, spec };

    const signature = await signTypedDataWithCircleWallet(card.circleWalletId, {
      domain: { name: 'GatewayWallet', version: '1' },
      types: BURN_INTENT_TYPES,
      primaryType: 'BurnIntent',
      message: burnIntent,
    });

    const transferResponse = await fetch(`${GATEWAY_API_BASE_URL}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...arcPrivateMainnetHeaders(isArcMainnet) },
      body: JSON.stringify([{ burnIntent, signature }], (_key, value) => (typeof value === 'bigint' ? value.toString() : value)),
    });
    const transferResult = (await transferResponse.json()) as {
      success?: boolean;
      error?: string;
      message?: string;
      attestation?: Hex;
      signature?: Hex;
    };
    if (!transferResponse.ok || transferResult.success === false || !transferResult.attestation || !transferResult.signature) {
      throw new Error(`Gateway API error: ${transferResult.message ?? transferResult.error ?? JSON.stringify(transferResult)}`);
    }

    const mintTx = await circle.createContractExecutionTransaction({
      walletId: GAS_SPONSOR_WALLET_ID,
      contractAddress: chainConfig.gatewayMinter,
      abiFunctionSignature: 'gatewayMint(bytes,bytes)',
      abiParameters: [transferResult.attestation, transferResult.signature],
      fee: FEE_MEDIUM,
    });
    await waitConfirmed(mintTx.data!.id);

    return { withdrawn: amount, gatewayBalance: (card.gatewayBalance ?? 0) - amount, mintTransactionId: mintTx.data!.id };
  } catch (err) {
    // Reservation already happened; nothing after it landed on-chain, so give the balance back.
    await cardRef.update({ gatewayBalance: FieldValue.increment(amount) });
    if (err instanceof WithdrawError) throw err;
    throw new WithdrawError(502, err instanceof Error ? err.message : 'Withdrawal failed — your Gateway balance was not moved');
  }
}
