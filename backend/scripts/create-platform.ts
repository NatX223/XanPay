import "dotenv/config";
import { createPlatform, issueApiKey } from "../src/lib/apiKeys";

async function main() {
  const [name, merchantWalletAddress] = process.argv.slice(2);
  if (!name || !merchantWalletAddress) {
    throw new Error("Usage: npm run create-platform -- <name> <merchantWalletAddress>");
  }

  const { platformId } = await createPlatform({ name, merchantWalletAddress });
  const key = await issueApiKey(platformId, { name: "Default key" });

  console.log(`Platform "${name}" created (id: ${platformId}).`);
  console.log("API key (save this now — it is hashed in Firestore and cannot be recovered):");
  console.log(key.apiKey);
}

main();
