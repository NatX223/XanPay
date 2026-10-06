import "dotenv/config";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { createCircleWallet } from "../src/circle";

/**
 * Card wallets only ever hold USDC — sweeping that USDC into Circle Gateway (see
 * src/lib/gatewaySweep.ts) requires on-chain gas the card wallet doesn't have. This creates the one
 * wallet that sponsors that gas for every card. Run once per environment.
 */
async function main() {
  const existingEnv: string = existsSync(".env") ? readFileSync(".env", "utf8") : "";
  if (/^CIRCLE_GAS_SPONSOR_WALLET_ID=/m.test(existingEnv)) {
    throw new Error("CIRCLE_GAS_SPONSOR_WALLET_ID already exists in .env. Refusing to overwrite it.");
  }

  const wallet = await createCircleWallet("gas-sponsor", "XanPay — gas sponsor");

  appendFileSync(".env", `\nCIRCLE_GAS_SPONSOR_WALLET_ID=${wallet.walletId}\n`);
  console.log(`Gas sponsor wallet created: ${wallet.walletId}`);
  console.log(`Address: ${wallet.address}`);
  console.log("CIRCLE_GAS_SPONSOR_WALLET_ID added to .env");
  console.log("Fund this address with native testnet gas (e.g. https://faucet.circle.com) before sweeping any card balances.");
}

main();
