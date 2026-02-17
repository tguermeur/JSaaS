/**
 * Cloud Functions pour le scoring IA des prospects et l'analyse des clients passés.
 * Utilise GEMINI_API_KEY pour analyzePastClients.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { decrypt } from './encryption';

const functionConfig = {
  memory: '128MiB' as const,
  timeoutSeconds: 120,
  region: 'us-central1' as const,
  minInstances: 0,
  maxInstances: 1,
  allowUnauthenticated: false,
  secrets: ['GEMINI_API_KEY'],
};

/** Déchiffre une valeur si elle est au format ENC:, sinon retourne la chaîne telle quelle. */
async function decryptIfEncrypted(value: unknown): Promise<string> {
  if (value == null || typeof value !== 'string') return '';
  if (!value.startsWith('ENC:')) return value;
  try {
    return await decrypt(value);
  } catch {
    return value;
  }
}

type PipelineStatus = 'non_qualifie' | 'contacte' | 'a_recontacter' | 'negociation' | 'abandon' | 'deja_client';

const STATUS_SCORE: Record<string, number> = {
  non_qualifie: 10,
  contacte: 30,
  a_recontacter: 50,
  negociation: 75,
  deja_client: 100,
  abandon: 5,
};

const DEFAULT_WEIGHTS = {
  completeness: 30,
  recency: 20,
  status: 25,
  lastActivity: 25,
};

function getScoreWeights(settings: admin.firestore.DocumentData | undefined) {
  const w = settings?.weights;
  return {
    completeness: w?.completeness ?? DEFAULT_WEIGHTS.completeness,
    recency: w?.recency ?? DEFAULT_WEIGHTS.recency,
    status: w?.status ?? DEFAULT_WEIGHTS.status,
    lastActivity: w?.lastActivity ?? DEFAULT_WEIGHTS.lastActivity,
  };
}

/** Complétude fiche (0-100) : nom, email, téléphone, entreprise, poste, notes */
function completenessScore(p: admin.firestore.DocumentData): number {
  const fields = [
    p.nom,
    p.email,
    p.telephone,
    p.entreprise,
    p.poste,
    p.notes,
  ];
  const filled = fields.filter((v) => v != null && String(v).trim() !== '').length;
  return Math.round((filled / 6) * 100);
}

/** Fraîcheur création (0-100) : plus récent = plus de points */
function recencyScore(createdAt: admin.firestore.Timestamp | null): number {
  if (!createdAt) return 0;
  const created = createdAt.toDate ? createdAt.toDate() : new Date(createdAt as any);
  const now = new Date();
  const daysSince = (now.getTime() - created.getTime()) / (24 * 60 * 60 * 1000);
  if (daysSince <= 0) return 100;
  if (daysSince <= 7) return 90;
  if (daysSince <= 30) return 70;
  if (daysSince <= 90) return 50;
  if (daysSince <= 180) return 30;
  return Math.max(10, 30 - Math.floor(daysSince / 30));
}

/** Dernière activité (0-100) : plus récent = plus de points */
function lastActivityScore(lastActivityAt: admin.firestore.Timestamp | null): number {
  if (!lastActivityAt) return 0;
  const last = lastActivityAt.toDate ? lastActivityAt.toDate() : new Date(lastActivityAt as any);
  const now = new Date();
  const daysSince = (now.getTime() - last.getTime()) / (24 * 60 * 60 * 1000);
  if (daysSince <= 1) return 100;
  if (daysSince <= 7) return 80;
  if (daysSince <= 14) return 60;
  if (daysSince <= 30) return 40;
  if (daysSince <= 60) return 25;
  return Math.max(5, 20 - Math.floor(daysSince / 30));
}

/** Statut pipeline (0-100) */
function statusScore(statut: string | undefined): number {
  const s = (statut || 'non_qualifie') as PipelineStatus;
  return STATUS_SCORE[s] ?? 15;
}

/**
 * Recalcule les scores IA de tous les prospects d'une structure et met à jour lastActivityAt.
 * À appeler après chargement des prospects ou après mise à jour des paramètres de notation.
 */
export const computeProspectScores = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }
  const { structureId } = request.data as { structureId?: string };
  if (!structureId) {
    throw new Error('structureId requis');
  }

  const uid = request.auth.uid;
  const userDoc = await admin.firestore().collection('users').doc(uid).get();
  const userData = userDoc.data();
  const userStructureId = userData?.structureId;
  if (userStructureId !== structureId && userData?.status !== 'superadmin') {
    throw new Error('Accès refusé à cette structure');
  }

  const db = admin.firestore();
  const prospectsSnap = await db.collection('prospects').where('structureId', '==', structureId).get();
  const settingsSnap = await db.collection('scoringSettings').where('structureId', '==', structureId).limit(1).get();
  const settings = settingsSnap.docs[0]?.data();
  const weights = getScoreWeights(settings);

  const batch = db.batch();
  let updated = 0;

  for (const docSnap of prospectsSnap.docs) {
    const p = docSnap.data();
    const prospectId = docSnap.id;

    // Dernière activité
    const activitiesSnap = await db
      .collection('prospects')
      .doc(prospectId)
      .collection('activities')
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    const lastActivityTs = activitiesSnap.docs[0]?.data()?.timestamp ?? null;

    const createdAt = p.createdAt ?? null;
    const comp = completenessScore(p);
    const rec = recencyScore(createdAt);
    const stat = statusScore(p.statut);
    const last = lastActivityScore(lastActivityTs);

    const totalWeight = weights.completeness + weights.recency + weights.status + weights.lastActivity;
    const aiScore = Math.round(
      (comp * weights.completeness + rec * weights.recency + stat * weights.status + last * weights.lastActivity) /
        totalWeight
    );
    const clampedScore = Math.min(100, Math.max(0, aiScore));

    batch.update(docSnap.ref, {
      aiScore: clampedScore,
      aiScoreUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastActivityAt: lastActivityTs || admin.firestore.FieldValue.delete(),
    });
    updated++;
  }

  await batch.commit();
  return { success: true, updated };
});

/**
 * Retourne les prospects à relancer : dateRecontact dépassée ou pas de contact depuis X jours.
 */
export const getRelanceSuggestions = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }
  const { structureId, maxResults = 20 } = request.data as { structureId?: string; maxResults?: number };
  if (!structureId) {
    throw new Error('structureId requis');
  }

  const uid = request.auth.uid;
  const userDoc = await admin.firestore().collection('users').doc(uid).get();
  const userData = userDoc.data();
  if (userData?.structureId !== structureId && userData?.status !== 'superadmin') {
    throw new Error('Accès refusé à cette structure');
  }

  const db = admin.firestore();
  const prospectsSnap = await db.collection('prospects').where('structureId', '==', structureId).get();
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const relanceStatuses: PipelineStatus[] = ['contacte', 'a_recontacter', 'negociation'];
  const DAYS_NO_CONTACT = 14;

  const suggestions: Array<{
    id: string;
    nom: string;
    entreprise?: string;
    statut: string;
    dateRecontact?: string;
    lastActivityAt?: string | null;
    daysSinceContact: number | null;
    reason: string;
  }> = [];

  for (const docSnap of prospectsSnap.docs) {
    const p = docSnap.data();
    const statut = (p.statut || 'non_qualifie') as PipelineStatus;
    if (!relanceStatuses.includes(statut) || statut === 'abandon' || statut === 'deja_client') continue;

    const dateRecontact = p.dateRecontact ? (typeof p.dateRecontact === 'string' ? p.dateRecontact : null) : null;
    const activitiesSnap = await db
      .collection('prospects')
      .doc(docSnap.id)
      .collection('activities')
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    const lastTs = activitiesSnap.docs[0]?.data()?.timestamp;
    const lastActivityAt = lastTs?.toDate ? lastTs.toDate().toISOString().split('T')[0] : null;
    const lastActivityDate = lastTs?.toDate ? lastTs.toDate() : null;
    const daysSinceContact = lastActivityDate
      ? Math.floor((now.getTime() - lastActivityDate.getTime()) / (24 * 60 * 60 * 1000))
      : null;

    let reason = '';
    if (dateRecontact && dateRecontact <= today) {
      reason = 'Date de relance dépassée';
    } else if (daysSinceContact !== null && daysSinceContact >= DAYS_NO_CONTACT) {
      reason = `Aucun contact depuis ${daysSinceContact} jours`;
    } else continue;

    suggestions.push({
      id: docSnap.id,
      nom: p.nom || '',
      entreprise: p.entreprise,
      statut,
      dateRecontact: dateRecontact || undefined,
      lastActivityAt: lastActivityAt || undefined,
      daysSinceContact,
      reason,
    });
  }

  // Trier par priorité : date relance dépassée d'abord, puis jours sans contact
  suggestions.sort((a, b) => {
    const aPast = a.dateRecontact && a.dateRecontact <= today ? 1 : 0;
    const bPast = b.dateRecontact && b.dateRecontact <= today ? 1 : 0;
    if (bPast !== aPast) return bPast - aPast;
    return (b.daysSinceContact ?? 0) - (a.daysSinceContact ?? 0);
  });

  return { success: true, suggestions: suggestions.slice(0, maxResults) };
});

/**
 * Analyse les entreprises avec lesquelles la structure a déjà travaillé (missions) et en déduit un profil type via Gemini.
 * Sauvegarde le résultat dans scoringSettings.
 */
export const analyzePastClients = onCall(
  {
    ...functionConfig,
    timeoutSeconds: 180,
    secrets: ['GEMINI_API_KEY'],
  },
  async (request) => {
    if (!request.auth) {
      throw new Error('Non autorisé');
    }
    const { structureId } = request.data as { structureId?: string };
    if (!structureId) {
      throw new Error('structureId requis');
    }

    const uid = request.auth.uid;
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    const userData = userDoc.data();
    if (userData?.structureId !== structureId && userData?.status !== 'superadmin') {
      throw new Error('Accès refusé à cette structure');
    }

    const db = admin.firestore();
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY non configurée');
    }

    // Missions terminées / facturées (etape Facturation ou Archivé, ou missions avec companyId)
    const missionsSnap = await db
      .collection('missions')
      .where('structureId', '==', structureId)
      .get();

    const companyIds = new Set<string>();
    const missionTitles: string[] = [];
    missionsSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.companyId) companyIds.add(data.companyId);
      if (data.title) missionTitles.push(data.title);
      if (data.description) missionTitles.push((data.description as string).substring(0, 200));
    });

    // Types de missions (missionTypes)
    const missionTypesSnap = await db
      .collection('missionTypes')
      .where('structureId', '==', structureId)
      .get();
    const missionTypeTitles: string[] = [];
    missionTypesSnap.docs.forEach((d) => {
      const t = d.data().title;
      if (t) missionTypeTitles.push(t);
    });

    // Noms d'entreprises (sans déchiffrement pour simplifier : on lit le champ name si non chiffré)
    const companyNames: string[] = [];
    for (const cid of companyIds) {
      const companyDoc = await db.collection('companies').doc(cid).get();
      const c = companyDoc.data();
      if (!c) continue;
      const name = c.name ?? c.raisonSociale ?? c.nom;
      if (name && typeof name === 'string' && !name.startsWith('ENC:')) {
        companyNames.push(name);
      } else {
        companyNames.push('Entreprise cliente');
      }
    }

    const contextParts: string[] = [];
    if (companyNames.length) {
      contextParts.push(`Entreprises clientes (${companyNames.length}): ${companyNames.slice(0, 50).join(', ')}`);
    }
    if (missionTypeTitles.length) {
      contextParts.push(`Types de missions proposés: ${missionTypeTitles.join(', ')}`);
    }
    if (missionTitles.length) {
      contextParts.push(`Exemples de missions: ${missionTitles.slice(0, 20).join('; ')}`);
    }
    const context = contextParts.length ? contextParts.join('\n') : 'Aucune donnée de missions ou entreprises.';

    const prompt = `Tu es un analyste pour une Junior-Entreprise. À partir des données suivantes sur leurs clients et missions, déduis un profil type de client idéal.

Données:
${context}

Réponds UNIQUEMENT avec un JSON valide, sans texte avant ou après, de la forme:
{
  "sectors": ["secteur1", "secteur2"],
  "companySizes": ["taille1", "taille2"],
  "missionTypes": ["type1", "type2"],
  "summary": "Une phrase de résumé du profil type."
}

- sectors: secteurs d'activité pertinents (ex: Conseil, Tech, Retail, Santé).
- companySizes: tailles d'entreprise (ex: PME, ETI, Startup, Grand compte).
- missionTypes: types de missions qui marchent bien (ex: Étude de marché, Audit).
- summary: une seule phrase en français.`;

    const modelUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    let extracted: { sectors?: string[]; companySizes?: string[]; missionTypes?: string[]; summary?: string };
    try {
      const geminiResp = await axios.post(
        modelUrl,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
          },
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 60000 }
      );

      const text: string | undefined = geminiResp.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new HttpsError('internal', 'Réponse Gemini vide. Réessayez ou vérifiez la clé API.');
      }

      let cleaned = text.trim().replace(/```json\s*/gi, '').replace(/```\s*/gi, '');
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleaned = jsonMatch[0];
      extracted = JSON.parse(cleaned) as typeof extracted;
    } catch (err: any) {
      if (err instanceof HttpsError) throw err;
      const status = err?.response?.status;
      const msg = err?.response?.data?.error?.message || err?.message || '';
      const isRateLimit = status === 429 || /resource exhausted|429|quota|rate limit/i.test(String(msg));
      if (isRateLimit) {
        throw new HttpsError(
          'resource-exhausted',
          'Limite d\'utilisation de l\'API IA atteinte. Réessayez dans quelques minutes.'
        );
      }
      throw new HttpsError('internal', `Analyse clients passés : ${msg || 'Erreur Gemini ou parsing JSON'}`);
    }

    const analyzedClientProfile = {
      sectors: Array.isArray(extracted.sectors) ? extracted.sectors : [],
      companySizes: Array.isArray(extracted.companySizes) ? extracted.companySizes : [],
      missionTypes: Array.isArray(extracted.missionTypes) ? extracted.missionTypes : [],
      summary: typeof extracted.summary === 'string' ? extracted.summary : undefined,
    };

    const settingsRef = db.collection('scoringSettings').where('structureId', '==', structureId).limit(1);
    const existing = await settingsRef.get();
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (existing.docs.length > 0) {
      await existing.docs[0].ref.update({
        analyzedClientProfile,
        analyzedAt: now,
        updatedAt: now,
      });
    } else {
      await db.collection('scoringSettings').add({
        structureId,
        specializations: [],
        weights: {
          completeness: 30,
          recency: 20,
          status: 25,
          lastActivity: 25,
          fitSpecialization: 0,
          fitPastClients: 0,
        },
        analyzedClientProfile,
        analyzedAt: now,
        updatedAt: now,
      });
    }

    return { success: true, analyzedClientProfile };
  }
);

/**
 * Génère un message de contact personnalisé pour un prospect via Gemini,
 * en s'appuyant sur le template défini dans scoringSettings (contactMessageTemplate).
 */
export const generateContactMessage = onCall(
  {
    ...functionConfig,
    timeoutSeconds: 60,
    secrets: ['GEMINI_API_KEY', 'ENCRYPTION_KEY'],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Non autorisé');
    }
    const { prospectId, structureId, currentMessage, modificationRequest } = request.data as {
      prospectId?: string;
      structureId?: string;
      currentMessage?: string;
      modificationRequest?: string;
    };
    if (!prospectId || !structureId) {
      throw new HttpsError('invalid-argument', 'prospectId et structureId requis');
    }

    const isRefine = Boolean(currentMessage?.trim() && modificationRequest?.trim());

    const uid = request.auth.uid;
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    const userData = userDoc.data();
    if (userData?.structureId !== structureId && userData?.status !== 'superadmin') {
      throw new HttpsError('permission-denied', 'Accès refusé à cette structure');
    }

    const db = admin.firestore();
    const structureSnap = await db.collection('structures').doc(structureId).get();
    const structureData = structureSnap.data();
    const structureName = (structureData?.nom ?? structureData?.name ?? structureData?.ecole ?? 'Notre Junior-Entreprise') as string;

    const userDisplayNameDec = await decryptIfEncrypted(userData?.displayName);
    const userFirstNameDec = await decryptIfEncrypted(userData?.firstName);
    const userLastNameDec = await decryptIfEncrypted(userData?.lastName);
    const userName =
      (userDisplayNameDec?.trim() ||
        [userFirstNameDec, userLastNameDec].filter(Boolean).join(' ').trim() ||
        (userData?.email as string)?.split('@')[0] ||
        "L'équipe commerciale") as string;
    const userPoste = (userData?.poste ?? userData?.role ?? (userData?.status === 'admin' || userData?.status === 'admin_structure' ? 'Président' : userData?.status === 'member' || userData?.status === 'membre' ? 'Chargé de mission' : 'Commercial')) as string;

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      throw new HttpsError('failed-precondition', 'GEMINI_API_KEY non configurée');
    }

    let prompt: string;
    if (isRefine) {
      prompt = `Tu es un assistant qui améliore des messages de contact professionnels pour une Junior-Entreprise.

Message actuel:
---
${currentMessage!.trim()}
---

Demande de modification de l'utilisateur: "${modificationRequest!.trim()}"

Applique la modification demandée. Conserve le ton professionnel et la structure (objet, corps, signature). Ne pas ajouter de placeholders entre crochets: utilise le nom de la structure et le nom de la personne qui signe s'ils sont déjà dans le message. Réponds UNIQUEMENT avec le message modifié, sans préambule.`;
    } else {
      const prospectSnap = await db.collection('prospects').doc(prospectId).get();
      if (!prospectSnap.exists) {
        throw new HttpsError('not-found', 'Prospect non trouvé');
      }
      const prospect = prospectSnap.data()!;
      if (prospect.structureId !== structureId) {
        throw new HttpsError('permission-denied', 'Prospect ne correspond pas à la structure');
      }
      const settingsSnap = await db
        .collection('scoringSettings')
        .where('structureId', '==', structureId)
        .limit(1)
        .get();
      const template = settingsSnap.docs[0]?.data()?.contactMessageTemplate as string | undefined;

      const nomDec = await decryptIfEncrypted(prospect.nom ?? prospect.name);
      const prenomDec = await decryptIfEncrypted(prospect.prenom ?? prospect.firstName);
      const lastNameDec = await decryptIfEncrypted(prospect.lastName);
      const nom =
        (nomDec && nomDec.trim()) ||
        ([prenomDec, lastNameDec].filter(Boolean).join(' ').trim()) ||
        ([prenomDec, nomDec].filter(Boolean).join(' ').trim()) ||
        (nomDec || prenomDec || lastNameDec || 'Le contact');
      const entreprise =
        (await decryptIfEncrypted(prospect.entreprise ?? prospect.company)).trim() || 'votre entreprise';
      const secteur = (await decryptIfEncrypted(prospect.secteur)).trim() || 'son secteur';
      const notesRaw = prospect.notes ? (await decryptIfEncrypted(prospect.notes)).trim() : '';
      const prospectContext = `Prospect: ${nom}, entreprise: ${entreprise}, secteur: ${secteur}.${notesRaw ? ` Notes: ${String(notesRaw).slice(0, 500)}` : ''}`;

      const structureInstruction = `Le nom exact de la Junior-Entreprise à utiliser dans le message est: "${structureName}". Le nom de la personne qui signe est: "${userName}". Son poste est: "${userPoste}". Tu dois utiliser ces valeurs telles quelles dans le message. Ne jamais écrire de placeholder entre crochets comme [Votre Nom], [Votre Poste], [Votre Poste - XXX] ou [Nom de la junior entreprise] : signe avec le vrai nom et le vrai poste.`;

      prompt = template?.trim()
        ? `Tu es un commercial pour une Junior-Entreprise. Rédige un message de contact personnalisé (email ou LinkedIn) pour ce prospect.

${structureInstruction}

Template à respecter (structure et ton, à personnaliser avec les infos du prospect). Remplace {{nom}}, {{entreprise}}, {{secteur}} par les vraies valeurs; pour le nom de la structure utilise "${structureName}":
---
${template}
---

Contexte du prospect:
${prospectContext}

Réponds UNIQUEMENT avec le message rédigé, sans préambule ni explication. Utilise les infos du prospect pour personnaliser le template.`
        : `Tu es un commercial pour une Junior-Entreprise. Rédige un message de contact personnalisé (email ou LinkedIn) pour ce prospect.

${structureInstruction}

Contexte du prospect:
${prospectContext}

Le message doit être professionnel, court (quelques phrases), personnalisé (nom, entreprise, secteur) et inviter à un échange. Réponds UNIQUEMENT avec le message rédigé, sans préambule.`;
    }

    const modelUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    try {
      const geminiResp = await axios.post(
        modelUrl,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: isRefine ? 0.3 : 0.7,
            maxOutputTokens: 1024,
          },
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 45000 }
      );
      let text: string | undefined = geminiResp.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new HttpsError('internal', 'Réponse Gemini vide');
      }
      text = text.trim();
      const placeholders = [
        /\[Nom de la junior entreprise\]/gi,
        /Nom de la junior entreprise/gi,
        /\{\{structure_nom\}\}/gi,
        /\{\{nom_structure\}\}/gi,
        /<structure_nom>/gi,
      ];
      for (const re of placeholders) {
        text = text.replace(re, structureName);
      }
      text = text.replace(/\[Votre Nom\]/gi, userName);
      text = text.replace(/\[Votre Poste\s*-\s*[^\]]*\]/gi, `${userPoste} - ${structureName}`);
      text = text.replace(/\[Votre Poste\]/gi, userPoste);
      return { success: true, message: text };
    } catch (err: any) {
      if (err instanceof HttpsError) throw err;
      const msg = err?.response?.data?.error?.message || err?.message || 'Erreur Gemini';
      throw new HttpsError('internal', `Génération du message : ${msg}`);
    }
  }
);
