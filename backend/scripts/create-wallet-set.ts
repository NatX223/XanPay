import "dotenv/config";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

async function main() {
  const apiKey: string | undefined = process.env.CIRCLE_API_KEY;
  const entitySecret: string | undefined = process.env.CIRCLE_ENTITY_SECRET;
  if (!apiKey || !entitySecret) {
    throw new Error("CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET are required. Set them in .env first.");
  }

  const existingEnv: string = existsSync(".env") ? readFileSync(".env", "utf8") : "";
  if (/^CIRCLE_WALLET_SET_ID=/m.test(existingEnv)) {
    throw new Error("CIRCLE_WALLET_SET_ID already exists in .env. Refusing to overwrite it.");
  }

  const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
  const response = await client.createWalletSet({ name: "XanPay" });
  const walletSetId = response.data?.walletSet?.id;
  if (!walletSetId) {
    throw new Error("Circle did not return a wallet set id");
  }

  appendFileSync(".env", `\nCIRCLE_WALLET_SET_ID=${walletSetId}\n`);
  console.log(`Wallet set created: ${walletSetId}`);
  console.log("CIRCLE_WALLET_SET_ID added to .env");
}

main();
