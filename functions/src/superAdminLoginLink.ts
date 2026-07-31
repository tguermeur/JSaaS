import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { onCall } from 'firebase-functions/v2/https';
import { assertSuperAdmin } from './authHelpers';
import { decryptSensitiveFields, SENSITIVE_FIELDS } from './encryption';

const AUDIT_COLLECTION = 'superadminLoginLinkAudit';
const SEARCH_MIN_LENGTH = 2;
const SEARCH_MAX_RESULTS = 25;

type SearchUserResult = {
  id: string;
  email: string;
  displayName: string;
  structureName: string;
  status: string;
};

function isEncrypted(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('ENC:');
}

async function buildSearchUserResult(
  uid: string,
  structureNames: Map<string, string>
): Promise<SearchUserResult | null> {
  const fs = admin.firestore();
  const userDoc = await fs.collection('users').doc(uid).get();
  if (!userDoc.exists) return null;

  const data = userDoc.data()!;
  if (data.status === 'superadmin' || data.role === 'superadmin') return null;

  let displayName = (data.displayName as string) || '';
  let email = (data.email as string) || '';

  const needsDecrypt =
    isEncrypted(data.displayName) ||
    isEncrypted(data.firstName) ||
    isEncrypted(data.lastName) ||
    isEncrypted(data.email);

  if (needsDecrypt) {
    try {
      const dec = await decryptSensitiveFields(data, SENSITIVE_FIELDS.USER);
      displayName =
        (dec.displayName as string) ||
        `${dec.firstName || ''} ${dec.lastName || ''}`.trim() ||
        displayName;
      email = (dec.email as string) || email;
    } catch {
      // conserver les valeurs brutes
    }
  }

  const authRecord = await admin.auth().getUser(uid).catch(() => null);
  const authEmail = authRecord?.email?.trim() || email;

  const structureId = data.structureId as string | undefined;
  return {
    id: uid,
    email: authEmail,
    displayName: displayName || authEmail || 'N/A',
    structureName: (structureId && structureNames.get(structureId)) || 'Non assigné',
    status: (data.status || data.role || '') as string,
  };
}

/**
 * Recherche d'utilisateurs pour le diagnostic superadmin (email, préfixe email, UID).
 */
export const searchUsersForSuperAdmin = onCall(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 30,
    cors: true,
    secrets: ['ENCRYPTION_KEY'],
  },
  async (request) => {
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentification requise.');
    }
    await assertSuperAdmin(request.auth.uid);

    const { query: rawQuery, limit: rawLimit } = request.data as {
      query?: string;
      limit?: number;
    };
    const search = (rawQuery || '').trim();
    if (search.length < SEARCH_MIN_LENGTH) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Saisissez au moins ${SEARCH_MIN_LENGTH} caractères.`
      );
    }

    const maxResults = Math.min(Math.max(rawLimit ?? SEARCH_MAX_RESULTS, 1), 50);
    const fs = admin.firestore();
    const candidateIds = new Set<string>();

    if (search.includes('@')) {
      try {
        const record = await admin.auth().getUserByEmail(search.toLowerCase());
        candidateIds.add(record.uid);
      } catch {
        // pas de correspondance exacte Auth
      }
    }

    const emailPrefix = search.toLowerCase();
    const prefixSnap = await fs
      .collection('users')
      .where('email', '>=', emailPrefix)
      .where('email', '<=', emailPrefix + '\uf8ff')
      .limit(maxResults)
      .get();
    prefixSnap.docs.forEach((d) => candidateIds.add(d.id));

    if (search.length >= 20 && !search.includes(' ') && !search.includes('@')) {
      const byId = await fs.collection('users').doc(search).get();
      if (byId.exists) candidateIds.add(byId.id);
    }

    const structuresSnap = await fs.collection('structures').get();
    const structureNames = new Map(
      structuresSnap.docs.map((d) => [d.id, (d.data().nom || d.data().ecole || 'N/A') as string])
    );

    const users: SearchUserResult[] = [];
    for (const uid of candidateIds) {
      if (users.length >= maxResults) break;
      const row = await buildSearchUserResult(uid, structureNames);
      if (row) users.push(row);
    }

    users.sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr'));

    return { users };
  }
);

function getProductionUrl(): string {
  return (process.env.FRONTEND_URL || 'https://js-connect.fr').replace(/\/$/, '');
}

/**
 * Valide l'URL de redirection du magic link (prod ou localhost en dev).
 * En local : tout port http sur localhost / 127.0.0.1 est accepté (3008, 3011, 5173, etc.).
 */
function resolveAllowedBaseUrl(requested?: string): string {
  const production = getProductionUrl();
  if (!requested?.trim()) {
    return production;
  }

  let parsed: URL;
  try {
    parsed = new URL(requested.trim());
  } catch {
    throw new functions.https.HttpsError('invalid-argument', 'URL de redirection invalide.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new functions.https.HttpsError('invalid-argument', 'Protocole non autorisé.');
  }

  const origin = parsed.origin;
  const productionOrigin = new URL(production).origin;

  if (origin === productionOrigin) {
    return origin;
  }

  const isLocalHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (isLocalHost && parsed.protocol === 'http:') {
    return origin;
  }

  throw new functions.https.HttpsError(
    'permission-denied',
    'URL de redirection non autorisée. Utilisez la production ou http://localhost:<port> en dev.'
  );
}

/**
 * Génère un lien de connexion Firebase (email link) pour un utilisateur cible.
 * Réservé au superadmin — permet une authentification réelle (token + règles Firestore).
 * Prérequis Firebase Console : Authentication > Sign-in method > Email/Password > Email link (passwordless).
 */
export const generateSuperAdminLoginLink = onCall(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 30,
    cors: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentification requise.');
    }
    await assertSuperAdmin(request.auth.uid);

    const { userId, email: emailArg, baseUrl } = request.data as {
      userId?: string;
      email?: string;
      baseUrl?: string;
    };
    if (!userId && !emailArg) {
      throw new functions.https.HttpsError('invalid-argument', 'userId ou email requis.');
    }

    const fs = admin.firestore();
    let targetUid: string;
    let email: string;
    let displayName: string;

    if (userId) {
      const [userRecord, userDoc] = await Promise.all([
        admin.auth().getUser(userId),
        fs.collection('users').doc(userId).get(),
      ]);
      if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Utilisateur introuvable.');
      }
      const targetData = userDoc.data()!;
      if (targetData.status === 'superadmin' || targetData.role === 'superadmin') {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Impossible de générer un lien pour un autre superadmin.'
        );
      }
      targetUid = userId;
      email = (userRecord.email || '').trim();
      displayName = (targetData.displayName as string) || email;
    } else {
      const normalizedEmail = emailArg!.trim().toLowerCase();
      let userRecord: admin.auth.UserRecord;
      try {
        userRecord = await admin.auth().getUserByEmail(normalizedEmail);
      } catch {
        throw new functions.https.HttpsError('not-found', 'Aucun compte Firebase Auth pour cet email.');
      }
      targetUid = userRecord.uid;
      const userDoc = await fs.collection('users').doc(targetUid).get();
      const targetData = userDoc.data();
      if (targetData?.status === 'superadmin' || targetData?.role === 'superadmin') {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Impossible de générer un lien pour un autre superadmin.'
        );
      }
      email = (userRecord.email || normalizedEmail).trim();
      displayName = (targetData?.displayName as string) || email;
    }

    if (!email || !email.includes('@')) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Cet utilisateur n\'a pas d\'adresse email valide dans Firebase Auth.'
      );
    }

    const frontendUrl = resolveAllowedBaseUrl(baseUrl);
    const continueUrl = `${frontendUrl}/auth/email-link?email=${encodeURIComponent(email)}`;
    const actionCodeSettings = {
      url: continueUrl,
      handleCodeInApp: true,
    };

    const loginLink = await admin.auth().generateSignInWithEmailLink(email, actionCodeSettings);

    await fs.collection(AUDIT_COLLECTION).add({
      generatedBy: request.auth.uid,
      targetUserId: targetUid,
      targetEmail: email,
      targetOrigin: frontendUrl,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      loginLink,
      email,
      userId: targetUid,
      displayName,
      targetOrigin: frontendUrl,
      /** Durée indicative — Firebase invalide le lien après ~1 h */
      expiresInMinutes: 60,
    };
  }
);
