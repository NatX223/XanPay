import "dotenv/config";
import { circle } from "../src/circle";

/**
 * Registers this backend's /webhooks/circle endpoint with Circle so it fires notifications
 * (including inbound-transaction events, which drive the proactive Gateway sweep — see
 * src/routes/webhooks.ts) whenever a card's on-chain wallet receives activity.
 *
 * Circle requires the endpoint to already be publicly reachable over HTTPS and to respond 2xx —
 * deploy first, or tunnel local dev (e.g. `ngrok http 8080`) and pass the https URL it gives you.
 */
async function main() {
  const endpoint = process.argv[2];
  if (!endpoint) {
    throw new Error(
      "Usage: npm run create-webhook-subscription -- https://<your-host>/webhooks/circle",
    );
  }
  if (!endpoint.startsWith("https://")) {
    throw new Error("Circle requires an HTTPS endpoint.");
  }

  const response = await circle.createSubscription({ endpoint });
  console.log("Webhook subscription created:", response.data);
  console.log("Circle sends a ping notification to confirm — check your server logs for it.");
}

main();
