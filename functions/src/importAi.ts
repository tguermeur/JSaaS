/**
 * Cloud Functions pour l'import CSV études/missions avec IA :
 * - Suggestion du mapping des colonnes CSV vers les champs internes
 * - Normalisation des valeurs (statut, étape) et validation des lignes
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import axios from 'axios';
import * as admin from 'firebase-admin';
import { assertCanManageStructure } from './authHelpers';
import { recordAiCreditUsageSafe } from './aiCreditsHelpers';

const GEMINI_MODEL = 'gemini-2.0-flash';
const MAX_ROWS_NORMALIZE = 80;

const MISSION_INTERNAL_KEYS = [
  'numeroMission', 'company', 'title', 'description', 'location', 'startDate', 'endDate',
  'studentCount', 'hours', 'chargeName', 'priceHT', 'prixHT', 'totalTTC', 'salary', 'mandat',
  'status', 'etape', 'type', 'contact', 'contactEmail', 'contactFirstName', 'contactLastName',
  'contactPhone', 'contactPosition', 'students', 'expenses', 'expenseReports'
];

const ETUDE_INTERNAL_KEYS = [
  'numeroEtude', 'company', 'location', 'startDate', 'endDate', 'consultantCount', 'hours',
  'chargeName', 'charge_etudes', 'charge_name', 'montantFacture', 'status'
];

function getModelUrl(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new HttpsError('failed-precondition', 'GEMINI_API_KEY non configurée');
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
}

/**
 * Suggère un mapping des en-têtes CSV vers les clés internes (mission ou etude).
 */
export const getImportColumnMapping = onCall(
  { region: 'us-central1', timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentification requise');

    const { type, headers, structureId } = request.data as {
      type: 'mission' | 'etude';
      headers: string[];
      structureId?: string;
    };
    if (!type || !Array.isArray(headers) || headers.length === 0 || !structureId) {
      throw new HttpsError('invalid-argument', 'type, structureId et headers (tableau) requis');
    }
    await assertCanManageStructure(request.auth.uid, structureId);

    const internalKeys = type === 'mission' ? MISSION_INTERNAL_KEYS : ETUDE_INTERNAL_KEYS;
    const prompt = `Tu es un assistant qui mappe des en-têtes de fichier CSV vers des champs internes.

Type d'import: ${type === 'mission' ? 'missions' : 'études'}.
Clés internes attendues (en anglais): ${internalKeys.join(', ')}.

En-têtes du CSV fourni par l'utilisateur: ${headers.map((h: string) => `"${String(h).trim()}"`).join(', ')}.

Règles:
- Associe chaque en-tête CSV à UNE SEULE clé interne la plus adaptée (ex: "Entreprise" -> company, "Date début" -> startDate, "Prix HT" -> priceHT).
- Variantes à reconnaître: Numéro/No/Numero -> numeroMission ou numeroEtude, Entreprise/Client/Société -> company, Titre/Intitulé -> title, Lieu/Adresse -> location, Début/Date début/Date de début -> startDate, Fin/Date fin/Date de fin -> endDate, Étudiants/Nb étudiants -> studentCount, Heures -> hours, Chargé/Responsable/Chargé d'études -> chargeName (missions et études), Statut -> status, Étape -> etape, Type -> type, Contact -> contact, Montant facture -> montantFacture (études), etc.
- Si un en-tête ne correspond à aucun champ, ne l'inclus pas dans le mapping.
- Réponds UNIQUEMENT par un JSON valide, sans markdown, de la forme: { "mapping": { "En-tête CSV exact": "cleInterne", ... } }
- Utilise les noms d'en-têtes EXACTEMENT comme fournis (avec espaces/casse).`;

    try {
      const resp = await axios.post(
        getModelUrl(),
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
      );

      const text = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new HttpsError('internal', 'Réponse Gemini vide');

      let cleaned = text.trim().replace(/```json\s*/gi, '').replace(/```\s*/gi, '');
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleaned = jsonMatch[0];
      const parsed = JSON.parse(cleaned) as { mapping?: Record<string, string> };
      const mapping = parsed?.mapping && typeof parsed.mapping === 'object' ? parsed.mapping : {};

      // Ne garder que les clés internes valides
      const allowed = new Set(internalKeys);
      const filtered: Record<string, string> = {};
      for (const [csvHeader, internalKey] of Object.entries(mapping)) {
        if (allowed.has(internalKey)) filtered[csvHeader] = internalKey;
      }
      await recordAiCreditUsageSafe(admin.firestore(), structureId, 'import_mapping');
      return { mapping: filtered };
    } catch (err: unknown) {
      if (err instanceof HttpsError) throw err;
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as any).message) : 'Erreur Gemini';
      const is429 = msg.includes('429') || /quota|rate limit|resource exhausted/i.test(msg);
      if (is429) throw new HttpsError('resource-exhausted', 'Limite API IA atteinte. Réessayez plus tard.');
      throw new HttpsError('internal', `Mapping des colonnes: ${msg}`);
    }
  }
);

/**
 * Normalise les valeurs (status, etape) et détecte les erreurs de validation (dates, nombres).
 * Retourne les lignes normalisées et la liste d'erreurs par index de ligne.
 */
export const normalizeAndValidateImportRows = onCall(
  { region: 'us-central1', timeoutSeconds: 90 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentification requise');

    const { type, rows, structureId } = request.data as {
      type: 'mission' | 'etude';
      rows: Record<string, unknown>[];
      structureId?: string;
    };
    if (!type || !Array.isArray(rows) || rows.length === 0 || !structureId) {
      throw new HttpsError('invalid-argument', 'type, structureId et rows (tableau) requis');
    }
    await assertCanManageStructure(request.auth.uid, structureId);

    const slice = rows.slice(0, MAX_ROWS_NORMALIZE);
    const isEtude = type === 'etude';
    const prompt = `Tu traites des lignes d'import ${isEtude ? 'études' : 'missions'} pour une app française.

Pour chaque ligne (index 0 à ${slice.length - 1}), tu dois:
1. Normaliser le champ "status" vers une valeur cohérente: "En attente", "En cours", "Terminé", "Annulé" (ou équivalents français reconnus).
2. Normaliser "etape" si présent vers: "Négociation", "En cours", "Clôturé", "Facturé" (ou équivalent).
3. ${isEtude ? 'Pour les ÉTUDES: normaliser "startDate" et "endDate" en format ISO strict YYYY-MM-DD (ex: 2025-02-22). Si la date est au format JJ/MM/AAAA ou AAAA-MM-JJ ou texte (ex: "22 février 2025"), la convertir en YYYY-MM-DD. Si vide ou invalide, laisser une chaîne vide "". Ne pas modifier les autres champs de date (start_date, dateDebut, etc.) si présents; concentre-toi sur startDate et endDate.' : 'Garder startDate et endDate tels quels si déjà cohérents.'}
4. Conserver le champ "chargeName" (ou charge_etudes, charge_name pour les études) tel quel: ne pas le remplacer par un nom par défaut; garder la valeur du CSV pour que l'app puisse faire correspondre le chargé d'étude au membre de la structure.
5. Repérer les erreurs: date de fin avant date de début, nombres invalides (heures, prix négatifs), champs obligatoires vides si critiques.

Format de réponse STRICT - JSON uniquement, sans markdown:
{
  "normalized": [ { ...ligne0 avec status, etape${isEtude ? ', startDate, endDate en YYYY-MM-DD' : ''} normalisés... }, ... ],
  "validationErrors": [ { "rowIndex": 0, "field": "startDate", "message": "Date de fin avant date de début" }, ... ]
}

Les clés des objets dans "normalized" doivent être identiques aux clés reçues. Ne modifie que status, etape${isEtude ? ', startDate, endDate (en YYYY-MM-DD)' : ''}; garde le reste inchangé (y compris chargeName / charge_etudes).
Données des lignes (JSON):
${JSON.stringify(slice)}`;

    try {
      const resp = await axios.post(
        getModelUrl(),
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 60000 }
      );

      const text = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new HttpsError('internal', 'Réponse Gemini vide');

      let cleaned = text.trim().replace(/```json\s*/gi, '').replace(/```\s*/gi, '');
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleaned = jsonMatch[0];
      const parsed = JSON.parse(cleaned) as {
        normalized?: Record<string, unknown>[];
        validationErrors?: { rowIndex: number; field: string; message: string }[];
      };

      const normalized = Array.isArray(parsed?.normalized) ? parsed.normalized : slice;
      const validationErrors = Array.isArray(parsed?.validationErrors) ? parsed.validationErrors : [];

      // Si on a tronqué les rows, les lignes au-delà ne sont pas normalisées par l'IA
      const rest = rows.length > MAX_ROWS_NORMALIZE ? rows.slice(MAX_ROWS_NORMALIZE) : [];
      const fullNormalized = [...normalized, ...rest];

      await recordAiCreditUsageSafe(admin.firestore(), structureId, 'import_normalize');
      return { normalizedRows: fullNormalized, validationErrors };
    } catch (err: unknown) {
      if (err instanceof HttpsError) throw err;
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as any).message) : 'Erreur Gemini';
      const is429 = msg.includes('429') || /quota|rate limit|resource exhausted/i.test(msg);
      if (is429) throw new HttpsError('resource-exhausted', 'Limite API IA atteinte. Réessayez plus tard.');
      throw new HttpsError('internal', `Normalisation: ${msg}`);
    }
  }
);
