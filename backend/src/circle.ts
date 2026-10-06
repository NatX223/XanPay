import { initiateDeveloperControlledWalletsClient, type Blockchain } from '@circle-fin/developer-controlled-wallets';

const apiKey = process.env.CIRCLE_API_KEY;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
const blockchain = process.env.CIRCLE_BLOCKCHAIN ?? 'MATIC-AMOY';

if (!apiKey || !entitySecret) {
  throw new Error('CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET are required in .env');
}
if (!process.env.CIRCLE_WALLET_SET_ID) {
  throw new Error(
    'CIRCLE_WALLET_SET_ID is required in .env. Run `npm run create-wallet-set` once to create one.',
  );
}
const walletSetId: string = process.env.CIRCLE_WALLET_SET_ID;

export const circle = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

/** Creates one Circle developer-controlled wallet — used for both a user's general wallet and each card. */
export async function createCircleWallet(refId: string, name?: string) {
  const response = await circle.createWallets({
    blockchains: [blockchain as Blockchain],
    count: 1,
    walletSetId,
    metadata: [{ refId, name }],
  });
  const wallet = response.data?.wallets?.[0];
  if (!wallet) throw new Error('Circle did not return a wallet');
  return { walletId: wallet.id, address: wallet.address };
}

export async function getWalletBalance(walletId: string) {
  const response = await circle.getWalletTokenBalance({ id: walletId });
  return response.data?.tokenBalances ?? [];
}

/** Transactions for one or more wallets — used for card history, group history (multiple card wallets), and user activity (all of a user's wallets). */
export async function listWalletActivity(walletIds: string[]) {
  if (walletIds.length === 0) return [];
  const response = await circle.listTransactions({ walletIds, includeAll: true });
  return response.data?.transactions ?? [];
}
