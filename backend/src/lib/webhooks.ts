import { createHmac, randomBytes } from 'node:crypto';
import { db } from '../firebaseAdmin';
import type { PlatformDoc } from '../types';

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString('hex')}`;
}

export function signWebhookPayload(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export type WebhookEventType = 'charge.settled' | 'card.spend_threshold';

export interface WebhookEvent {
  type: WebhookEventType;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Best-effort delivery of a webhook to a platform's configured endpoint. Fire-and-forget, no retry
 * queue or delivery log — this is a hackathon-scope notification, not a durable event system. A no-op
 * if the platform hasn't configured a webhookUrl. Never throws: a slow or unreachable developer
 * endpoint must not affect the request (a charge) that triggered the event.
 */
export async function dispatchWebhookEvent(
  platformId: string,
  type: WebhookEventType,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const platformSnap = await db.collection('platforms').doc(platformId).get();
    if (!platformSnap.exists) return;

    const { webhookUrl, webhookSecret } = platformSnap.data() as PlatformDoc;
    if (!webhookUrl || !webhookSecret) return;

    const event: WebhookEvent = { type, data, timestamp: new Date().toISOString() };
    const rawBody = JSON.stringify(event);
    const signature = signWebhookPayload(rawBody, webhookSecret);

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-XanPay-Signature': `sha256=${signature}` },
      body: rawBody,
    });
    if (!res.ok) {
      console.error(`Webhook delivery to platform ${platformId} failed with status ${res.status}`);
    }
  } catch (err) {
    console.error(`Webhook delivery to platform ${platformId} threw:`, err);
  }
}
