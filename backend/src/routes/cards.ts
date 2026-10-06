import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { createCircleWallet, getWalletBalance, listWalletActivity } from '../circle';
import { db } from '../firebaseAdmin';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { sweepCardToGateway } from '../lib/gatewaySweep';
import { withdrawCardFromGateway, WithdrawError } from '../lib/gatewayWithdraw';
import { toApiDoc, type CardDoc, type CardRules, type GroupDoc } from '../types';

const router = Router();
router.use(requireAuth);

const DEFAULT_RULES: CardRules = {
  monthly: 80,
  perCharge: '2.00',
  daily: '10.00',
  velocity: '25',
  autopause: true,
  approve: false,
  frozen: false,
  platforms: [],
};

async function getOwnedCard(uid: string, cardId: string) {
  const ref = db.collection('cards').doc(cardId);
  const snap = await ref.get();
  if (!snap.exists || (snap.data() as CardDoc).userId !== uid) return null;
  return { ref, data: snap.data() as CardDoc };
}

router.post('/', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const { name, groupId, monthly } = req.body as { name?: string; groupId?: string; monthly?: number };
  if (!name?.trim() || !groupId) {
    res.status(400).json({ error: 'name and groupId are required' });
    return;
  }

  const groupSnap = await db.collection('groups').doc(groupId).get();
  if (!groupSnap.exists || (groupSnap.data() as GroupDoc).userId !== uid) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }

  const wallet = await createCircleWallet(`${uid}:${groupId}:${Date.now()}`, name.trim());
  const last4 = wallet.address.slice(-4).toUpperCase();
  const rules: CardRules = { ...DEFAULT_RULES, monthly: monthly ?? DEFAULT_RULES.monthly };
  const data: Omit<CardDoc, 'createdAt'> = {
    userId: uid,
    groupId,
    name: name.trim(),
    last4,
    circleWalletId: wallet.walletId,
    walletAddress: wallet.address,
    active: true,
    rules,
    gatewayBalance: 0,
  };
  const ref = await db.collection('cards').add({ ...data, createdAt: FieldValue.serverTimestamp() });
  const snap = await ref.get();
  res.status(201).json(toApiDoc(ref.id, snap.data() as CardDoc));
});

router.get('/', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const snap = await db.collection('cards').where('userId', '==', uid).get();
  res.json(snap.docs.map((d) => toApiDoc(d.id, d.data() as CardDoc)));
});

router.get('/:id', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const owned = await getOwnedCard(uid, req.params.id);
  if (!owned) {
    res.status(404).json({ error: 'Card not found' });
    return;
  }
  res.json(toApiDoc(req.params.id, owned.data));
});

/**
 * Spendable balance = cards/{id}.gatewayBalance, the ledger `POST /platform/charge` actually draws
 * from — not the card's raw on-chain wallet balance. Before reading it, best-effort sweeps any USDC
 * sitting in the wallet into Circle Gateway (see lib/gatewaySweep.ts), so "send USDC to your card's
 * address" eventually becomes spendable without a separate confirmation step. A sweep failure (e.g.
 * gas sponsor not configured, Circle hiccup) never fails this request — it just means the balance
 * shown is whatever was already swept as of the last successful check.
 */
router.get('/:id/balance', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const owned = await getOwnedCard(uid, req.params.id);
  if (!owned) {
    res.status(404).json({ error: 'Card not found' });
    return;
  }

  let gatewayBalance = owned.data.gatewayBalance ?? 0;
  try {
    ({ gatewayBalance } = await sweepCardToGateway(req.params.id, owned.data));
  } catch (err) {
    console.error(`Gateway sweep failed for card ${req.params.id}:`, err);
  }

  const tokenBalances = await getWalletBalance(owned.data.circleWalletId);
  res.json({ gatewayBalance, tokenBalances });
});

/**
 * Pulls USDC back out of Circle Gateway to the card's own on-chain wallet (see
 * lib/gatewayWithdraw.ts) — the inverse of the sweep above. Unlike the balance check, a failure here
 * is reported to the caller: this moves money, so silent partial failure isn't acceptable.
 */
router.post('/:id/withdraw', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const owned = await getOwnedCard(uid, req.params.id);
  if (!owned) {
    res.status(404).json({ error: 'Card not found' });
    return;
  }

  const { amount } = req.body as { amount?: number };
  if (typeof amount !== 'number' || !(amount > 0)) {
    res.status(400).json({ error: 'amount (a positive number) is required' });
    return;
  }

  try {
    const result = await withdrawCardFromGateway(req.params.id, amount);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof WithdrawError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
});

/** Live spend/receive history from Circle for this one card. */
router.get('/:id/activity', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const owned = await getOwnedCard(uid, req.params.id);
  if (!owned) {
    res.status(404).json({ error: 'Card not found' });
    return;
  }
  const transactions = await listWalletActivity([owned.data.circleWalletId]);
  res.json({ transactions });
});

router.patch('/:id/rules', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const owned = await getOwnedCard(uid, req.params.id);
  if (!owned) {
    res.status(404).json({ error: 'Card not found' });
    return;
  }

  const patch = req.body as Partial<CardRules>;
  const updates = Object.fromEntries(Object.entries(patch).map(([key, value]) => [`rules.${key}`, value]));
  await owned.ref.update(updates);
  res.json(toApiDoc(req.params.id, { ...owned.data, rules: { ...owned.data.rules, ...patch } }));
});

router.patch('/:id/active', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const owned = await getOwnedCard(uid, req.params.id);
  if (!owned) {
    res.status(404).json({ error: 'Card not found' });
    return;
  }

  const { active } = req.body as { active?: boolean };
  if (typeof active !== 'boolean') {
    res.status(400).json({ error: 'active must be a boolean' });
    return;
  }
  await owned.ref.update({ active });
  res.json(toApiDoc(req.params.id, { ...owned.data, active }));
});

/**
 * Deleting the card doc is the only way XanPay knows how to reach its Gateway balance or on-chain wallet
 * again — GET/withdraw both look the card up by Firestore doc. Refuse to close while gatewayBalance is
 * still positive so a close doesn't silently strand spendable funds; the user has to withdraw first.
 */
router.delete('/:id', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const owned = await getOwnedCard(uid, req.params.id);
  if (!owned) {
    res.status(404).json({ error: 'Card not found' });
    return;
  }
  if ((owned.data.gatewayBalance ?? 0) > 0) {
    res.status(409).json({ error: 'Withdraw the remaining balance before closing this card' });
    return;
  }
  await owned.ref.delete();
  res.status(204).send();
});

export default router;
