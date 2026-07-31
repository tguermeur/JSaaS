import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { assertCanManageStructure } from './authHelpers';

const functionConfig = {
  memory: '256MiB' as const,
  timeoutSeconds: 120,
  cors: true,
  region: 'us-central1',
  minInstances: 0,
  maxInstances: 1,
  concurrency: 10,
  allowUnauthenticated: false,
};

const PAID_STATUSES = new Set(['paid', 'payee', 'paye']);

function normStatus(status: unknown): string {
  return String(status || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isPaidInvoiceStatus(status: unknown): boolean {
  return PAID_STATUSES.has(normStatus(status));
}

function toPositiveNumber(val: unknown): number {
  const n = typeof val === 'number' ? val : typeof val === 'string' ? Number(val) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function extractRevenueAmount(data: Record<string, unknown>): number {
  const invoiceDoc =
    typeof data.invoiceDocument === 'object' && data.invoiceDocument
      ? (data.invoiceDocument as Record<string, unknown>)
      : undefined;
  const direct =
    toPositiveNumber(data.totalTTC) ||
    toPositiveNumber(data.total_ttc) ||
    toPositiveNumber(data.montantTTC) ||
    toPositiveNumber(data.invoiceAmount) ||
    toPositiveNumber(invoiceDoc?.invoiceAmount);
  if (direct > 0) return direct;

  const priceHT = toPositiveNumber(data.priceHT) || toPositiveNumber(data.salary);
  const hours = toPositiveNumber(data.hours) || toPositiveNumber(data.totalHours);
  const ht =
    toPositiveNumber(data.totalHT) ||
    toPositiveNumber(data.montantHT) ||
    (priceHT > 0 && hours > 0 ? priceHT * hours : 0) ||
    toPositiveNumber(data.budget) ||
    toPositiveNumber(data.prixHT);
  return ht > 0 ? ht * 1.2 : 0;
}

export async function recomputeStatsForStructure(structureId: string): Promise<void> {
  const db = admin.firestore();
  const structureSnap = await db.collection('structures').doc(structureId).get();
  if (!structureSnap.exists) return;

  const structureType = structureSnap.data()?.structureType === 'junior' ? 'junior' : 'jobservice';
  const collectionName = structureType === 'junior' ? 'etudes' : 'missions';

  const allSnap = await db.collection(collectionName).where('structureId', '==', structureId).get();

  const totalRevenue = allSnap.docs.reduce((sum, d) => {
    const data = d.data() as Record<string, unknown>;
    if (!isPaidInvoiceStatus(data.invoiceStatus)) return sum;
    return sum + extractRevenueAmount(data);
  }, 0);
  const activeMissionsCount = allSnap.docs.filter((d) => d.data().isArchived !== true).length;

  await structureSnap.ref.set(
    {
      stats: {
        totalRevenue,
        activeMissionsCount,
        totalMissionsCount: allSnap.size,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    },
    { merge: true }
  );
}

export const recomputeStructureStats = onCall(functionConfig, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentification requise.');
  }
  const { structureId } = request.data as { structureId?: string };
  if (!structureId) {
    throw new HttpsError('invalid-argument', 'structureId requis.');
  }
  await assertCanManageStructure(request.auth.uid, structureId);
  await recomputeStatsForStructure(structureId);
  return { success: true };
});

export const onMissionStatsChange = onDocumentWritten('missions/{missionId}', async (event) => {
  const after = event.data?.after?.data();
  const before = event.data?.before?.data();
  const structureId = (after?.structureId || before?.structureId) as string | undefined;
  if (!structureId) return;
  const relevant =
    after?.invoiceStatus !== before?.invoiceStatus ||
    after?.totalTTC !== before?.totalTTC ||
    after?.totalHT !== before?.totalHT ||
    after?.isArchived !== before?.isArchived;
  if (!relevant && event.data?.before?.exists) return;
  await recomputeStatsForStructure(structureId);
});

export const onEtudeStatsChange = onDocumentWritten('etudes/{etudeId}', async (event) => {
  const after = event.data?.after?.data();
  const before = event.data?.before?.data();
  const structureId = (after?.structureId || before?.structureId) as string | undefined;
  if (!structureId) return;
  const relevant =
    after?.invoiceStatus !== before?.invoiceStatus ||
    after?.totalTTC !== before?.totalTTC ||
    after?.totalHT !== before?.totalHT ||
    after?.budget !== before?.budget ||
    after?.isArchived !== before?.isArchived;
  if (!relevant && event.data?.before?.exists) return;
  await recomputeStatsForStructure(structureId);
});
