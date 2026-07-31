import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import type { SignatureEventType } from './constants';

export async function appendSignatureEvent(
  requestId: string,
  event: {
    type: SignatureEventType;
    actor?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    meta?: Record<string, unknown>;
  }
): Promise<void> {
  await admin
    .firestore()
    .collection('signatureRequests')
    .doc(requestId)
    .collection('events')
    .add({
      type: event.type,
      actor: event.actor || null,
      ip: event.ip || null,
      userAgent: event.userAgent || null,
      meta: event.meta || {},
      at: FieldValue.serverTimestamp(),
    });
}

export function extractRequestContext(rawRequest: {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}): { ip: string | null; userAgent: string | null } {
  const forwarded = rawRequest.headers?.['x-forwarded-for'];
  let ip: string | null = null;
  if (typeof forwarded === 'string' && forwarded.trim()) {
    ip = forwarded.split(',')[0].trim();
  } else if (typeof rawRequest.ip === 'string') {
    ip = rawRequest.ip;
  }
  const ua = rawRequest.headers?.['user-agent'];
  const userAgent = typeof ua === 'string' ? ua.slice(0, 512) : null;
  return { ip, userAgent };
}

export async function assertSignatureRateLimit(
  key: string,
  max = 20,
  windowMs = 60_000
): Promise<void> {
  const ref = admin.firestore().collection('signatureRateLimits').doc(key.slice(0, 180));
  const now = Date.now();
  await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const windowStart = (data?.windowStart as number) ?? now;
    let count = (data?.count as number) ?? 0;
    if (now - windowStart > windowMs) {
      tx.set(ref, {
        windowStart: now,
        count: 1,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }
    if (count >= max) {
      throw new HttpsError(
        'resource-exhausted',
        'Trop de tentatives. Réessayez dans une minute.'
      );
    }
    tx.set(ref, {
      windowStart,
      count: count + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}
