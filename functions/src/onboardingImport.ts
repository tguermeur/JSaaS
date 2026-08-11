/**
 * Bulk-import onboarding (lot A) — callable Admin SDK.
 * Réserve une tentative quota AVANT tout traitement métier.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  FieldValue,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type WriteBatch,
} from 'firebase-admin/firestore';
import { assertCanManageStructure } from './authHelpers';
import { reserveOnboardingImportAttempt } from './quotaHelpers';
import { runInviteStructureMember } from './notifications/structureInvite';
import { EMAILJS_GENERIC_SECRETS } from './notifications/sendEmail';
import {
  FIRESTORE_BATCH_LIMIT,
  findBestMatch,
  getSafeDisplayName,
  normalizeCompanyName,
} from './onboardingImportHelpers';

const callConfig = {
  memory: '512MiB' as const,
  timeoutSeconds: 300,
  region: 'us-central1' as const,
  maxInstances: 5,
  secrets: [...EMAILJS_GENERIC_SECRETS],
};

export type OnboardingTeamMemberRow = {
  email?: string;
  role?: string;
};

export type OnboardingCompanyRow = {
  name?: string;
  [key: string]: unknown;
};

export type OnboardingMissionRow = {
  company?: string;
  companyId?: string;
  chargeName?: string;
  title?: string;
  [key: string]: unknown;
};

export type OnboardingEtudeRow = {
  company?: string;
  companyId?: string;
  chargeName?: string;
  numeroEtude?: string;
  [key: string]: unknown;
};

export type OnboardingBulkImportInput = {
  structureId?: string;
  teamMembers?: OnboardingTeamMemberRow[];
  companies?: OnboardingCompanyRow[];
  missions?: OnboardingMissionRow[];
  etudes?: OnboardingEtudeRow[];
};

export type OnboardingBulkImportError = {
  row: number;
  entity: 'teamMember' | 'company' | 'mission' | 'etude';
  message: string;
};

export type OnboardingBulkImportReport = {
  teamInvited: number;
  companiesCreated: number;
  companiesMatched: number;
  missionsCreated: number;
  etudesCreated: number;
  errors: OnboardingBulkImportError[];
};

type MemberCandidate = {
  id: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

type CompanyCandidate = {
  id: string;
  name: string;
  normalized: string;
};

async function loadStructureMembers(
  db: Firestore,
  structureId: string
): Promise<MemberCandidate[]> {
  const snap = await db.collection('users').where('structureId', '==', structureId).get();
  return snap.docs.map((d) => {
    const data = d.data() || {};
    return {
      id: d.id,
      displayName: data.displayName as string | undefined,
      firstName: data.firstName as string | undefined,
      lastName: data.lastName as string | undefined,
      email: data.email as string | undefined,
    };
  });
}

async function loadStructureCompanies(
  db: Firestore,
  structureId: string
): Promise<CompanyCandidate[]> {
  const snap = await db.collection('companies').where('structureId', '==', structureId).get();
  return snap.docs.map((d) => {
    const name = String(d.data()?.name || d.data()?.nom || '').trim();
    return {
      id: d.id,
      name,
      normalized: normalizeCompanyName(name),
    };
  });
}

function resolveCompanyId(
  companies: CompanyCandidate[],
  companyId: string | undefined,
  companyName: string | undefined
): { id: string; matched: boolean } | null {
  const cid = (companyId || '').trim();
  if (cid && companies.some((c) => c.id === cid)) {
    return { id: cid, matched: true };
  }
  const name = (companyName || '').trim();
  if (!name) return null;
  const normalized = normalizeCompanyName(name);
  const found = companies.find((c) => c.normalized === normalized && c.normalized !== '');
  if (found) return { id: found.id, matched: true };
  return null;
}

class BatchWriter {
  private db: Firestore;
  private batch: WriteBatch;
  private count = 0;

  constructor(db: Firestore) {
    this.db = db;
    this.batch = db.batch();
  }

  set(ref: DocumentReference, data: DocumentData): void {
    this.batch.set(ref, data);
    this.count += 1;
  }

  async flushIfNeeded(force = false): Promise<void> {
    if (this.count === 0) return;
    if (!force && this.count < FIRESTORE_BATCH_LIMIT) return;
    await this.batch.commit();
    this.batch = this.db.batch();
    this.count = 0;
  }

  async flush(): Promise<void> {
    await this.flushIfNeeded(true);
  }
}

/**
 * Core logic (exported for unit tests).
 */
export async function runOnboardingBulkImport(
  uid: string,
  data: OnboardingBulkImportInput
): Promise<OnboardingBulkImportReport> {
  const structureId = (data.structureId || '').trim();
  if (!structureId) {
    throw new HttpsError('invalid-argument', 'structureId requis.');
  }

  await assertCanManageStructure(uid, structureId);

  const db = admin.firestore();
  // Tentative consommée AVANT tout traitement métier
  await reserveOnboardingImportAttempt(db, structureId);

  const report: OnboardingBulkImportReport = {
    teamInvited: 0,
    companiesCreated: 0,
    companiesMatched: 0,
    missionsCreated: 0,
    etudesCreated: 0,
    errors: [],
  };

  const teamMembers = Array.isArray(data.teamMembers) ? data.teamMembers : [];
  for (let i = 0; i < teamMembers.length; i++) {
    const row = teamMembers[i] || {};
    const email = (row.email || '').trim();
    if (!email || !email.includes('@')) {
      report.errors.push({
        row: i,
        entity: 'teamMember',
        message: 'email invalide.',
      });
      continue;
    }
    try {
      await runInviteStructureMember(uid, {
        email,
        role: row.role,
        structureId,
      });
      report.teamInvited += 1;
    } catch (err: unknown) {
      const message =
        err instanceof HttpsError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Erreur invitation membre.';
      report.errors.push({ row: i, entity: 'teamMember', message });
    }
  }

  let companies = await loadStructureCompanies(db, structureId);
  const companyRows = Array.isArray(data.companies) ? data.companies : [];
  const companyWriter = new BatchWriter(db);

  for (let i = 0; i < companyRows.length; i++) {
    const row = companyRows[i] || {};
    const name = String(row.name || '').trim();
    if (!name) {
      report.errors.push({ row: i, entity: 'company', message: 'name requis.' });
      continue;
    }
    const normalized = normalizeCompanyName(name);
    const existing = companies.find((c) => c.normalized === normalized && normalized !== '');
    if (existing) {
      report.companiesMatched += 1;
      continue;
    }
    const ref = db.collection('companies').doc();
    companyWriter.set(ref, {
      name,
      structureId,
      createdAt: FieldValue.serverTimestamp(),
      importedViaOnboarding: true,
    });
    companies.push({ id: ref.id, name, normalized });
    report.companiesCreated += 1;
    await companyWriter.flushIfNeeded();
  }
  await companyWriter.flush();

  companies = await loadStructureCompanies(db, structureId);
  const members = await loadStructureMembers(db, structureId);

  const resolveCharge = (chargeName: string | undefined) => {
    const raw = (chargeName || '').trim();
    const matched = raw
      ? findBestMatch(raw, members, ['displayName', 'firstName', 'lastName'])
      : null;
    return {
      chargeId: matched?.id || uid,
      chargeName: matched ? getSafeDisplayName(matched) : raw || getSafeDisplayName({}),
    };
  };

  const missionRows = Array.isArray(data.missions) ? data.missions : [];
  const missionWriter = new BatchWriter(db);

  for (let i = 0; i < missionRows.length; i++) {
    const row = missionRows[i] || {};
    try {
      const companyName = String(row.company || '').trim();
      let companyId = String(row.companyId || '').trim();
      const resolved = resolveCompanyId(companies, companyId || undefined, companyName || undefined);
      if (resolved) {
        companyId = resolved.id;
      } else if (companyName) {
        const companyRef = db.collection('companies').doc();
        const normalized = normalizeCompanyName(companyName);
        await companyRef.set({
          name: companyName,
          structureId,
          createdAt: FieldValue.serverTimestamp(),
          importedViaOnboarding: true,
        });
        companies.push({ id: companyRef.id, name: companyName, normalized });
        companyId = companyRef.id;
        report.companiesCreated += 1;
      }

      const charge = resolveCharge(
        row.chargeName != null ? String(row.chargeName) : undefined
      );
      const ref = db.collection('missions').doc();
      const rest = { ...row };
      delete rest.company;
      delete rest.companyId;
      delete rest.chargeName;
      missionWriter.set(ref, {
        ...rest,
        structureId,
        company: companyName || undefined,
        companyId: companyId || undefined,
        chargeId: charge.chargeId,
        chargeName: charge.chargeName,
        title: row.title != null ? String(row.title) : undefined,
        importedViaOnboarding: true,
        createdAt: FieldValue.serverTimestamp(),
      });
      report.missionsCreated += 1;
      await missionWriter.flushIfNeeded();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur création mission.';
      report.errors.push({ row: i, entity: 'mission', message });
    }
  }
  await missionWriter.flush();

  const etudeRows = Array.isArray(data.etudes) ? data.etudes : [];
  const etudeWriter = new BatchWriter(db);

  for (let i = 0; i < etudeRows.length; i++) {
    const row = etudeRows[i] || {};
    try {
      const companyName = String(row.company || '').trim();
      let companyId = String(row.companyId || '').trim();
      const resolved = resolveCompanyId(companies, companyId || undefined, companyName || undefined);
      if (resolved) {
        companyId = resolved.id;
      } else if (companyName) {
        const companyRef = db.collection('companies').doc();
        const normalized = normalizeCompanyName(companyName);
        await companyRef.set({
          name: companyName,
          structureId,
          createdAt: FieldValue.serverTimestamp(),
          importedViaOnboarding: true,
        });
        companies.push({ id: companyRef.id, name: companyName, normalized });
        companyId = companyRef.id;
        report.companiesCreated += 1;
      }

      const charge = resolveCharge(
        row.chargeName != null ? String(row.chargeName) : undefined
      );
      const ref = db.collection('etudes').doc();
      const rest = { ...row };
      delete rest.company;
      delete rest.companyId;
      delete rest.chargeName;
      etudeWriter.set(ref, {
        ...rest,
        structureId,
        company: companyName || undefined,
        companyId: companyId || undefined,
        chargeId: charge.chargeId,
        chargeName: charge.chargeName,
        importedViaOnboarding: true,
        createdAt: FieldValue.serverTimestamp(),
      });
      report.etudesCreated += 1;
      await etudeWriter.flushIfNeeded();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur création étude.';
      report.errors.push({ row: i, entity: 'etude', message });
    }
  }
  await etudeWriter.flush();

  return report;
}

/** Callable — réexportée depuis index.ts sous le nom `runOnboardingBulkImport`. */
export const onboardingBulkImport = onCall(callConfig, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentification requise.');
  }
  return runOnboardingBulkImport(
    request.auth.uid,
    (request.data || {}) as OnboardingBulkImportInput
  );
});
