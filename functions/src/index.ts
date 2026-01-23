// Helper pour les logs de debug (sécurisé pour Cloud Run)
// SÉCURITÉ: Désactivé en production pour éviter l'exposition d'informations sensibles
function debugLog(location: string, message: string, data: any, hypothesisId: string) {
  // Ne pas logger en production ou si l'émulateur n'est pas actif
  // Vérifier explicitement que l'émulateur est actif
  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true' || 
                      process.env.FIREBASE_FUNCTIONS_EMULATOR === 'true' ||
                      process.env.GCLOUD_PROJECT?.includes('demo');
  
  // Ne rien faire si on n'est pas dans l'émulateur
  if (!isEmulator || process.env.NODE_ENV === 'production') {
    return;
  }
  
  // Ne rien faire si fetch n'est pas disponible (Cloud Run)
  if (typeof fetch === 'undefined') {
    return;
  }
  
  // Ne rien faire si window est défini (navigateur)
  if (typeof window !== 'undefined') {
    return;
  }
  
  // Seulement en développement local avec émulateur actif
  try {
    fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location, message, data, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId })
    }).catch(() => {
      // Ignorer silencieusement les erreurs de connexion
    });
  } catch (e) {
    // Ignorer toutes les erreurs de fetch dans Cloud Run
  }
}

// #region agent log
debugLog('index.ts:1', 'Module loading started', {}, 'D');
// #endregion
import { onCall, onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
// #region agent log
debugLog('index.ts:4', 'Before importing stripe module', {}, 'D');
// #endregion
import { createCheckoutSession, cancelSubscription, createSubscription, handleStripeWebhook, getStripeProducts, getStripeCustomers, cancelStripeSubscription, fetchPaymentHistory, createCotisationSession, getStructureCotisations, handleCotisationWebhook } from './stripe';
// #region agent log
debugLog('index.ts:6', 'After importing stripe module', {}, 'D');
// #endregion
import * as cors from 'cors';
import * as express from 'express';
import * as dotenv from 'dotenv';
import * as path from 'path';
import axios from 'axios'; // Assurez-vous d'avoir axios installé: npm install axios dans functions/

// #region agent log
debugLog('index.ts:11', 'Before dotenv.config', { __dirname }, 'C');
// #endregion
// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// #region agent log
debugLog('index.ts:14', 'After dotenv.config', { STRIPE_MODE: process.env.STRIPE_MODE }, 'C');
// #endregion

console.log('Mode Stripe:', process.env.STRIPE_MODE);
console.log('Chemin du fichier .env:', path.resolve(__dirname, '../.env'));

// #region agent log
debugLog('index.ts:18', 'Before admin.initializeApp', { appsLength: admin.apps.length }, 'B');
// #endregion
// Initialiser Firebase Admin (seulement si pas déjà initialisé)
if (!admin.apps.length) {
  admin.initializeApp();
}
// #region agent log
debugLog('index.ts:22', 'After admin.initializeApp', { appsLength: admin.apps.length }, 'B');
// #endregion

// Configuration CORS sécurisée - uniquement les domaines autorisés
// Liste des origines autorisées (ajoutez vos domaines de production ici)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3011',
  'https://jsaas-dd2f7.firebaseapp.com',
  'https://jsaas-dd2f7.web.app',
  'http://js-connect.fr',
  'https://js-connect.fr',
  // Ajoutez vos autres domaines de production ici
];

// SÉCURITÉ: Liste blanche des IDs d'extensions Chrome autorisées
// Remplacez 'VOTRE_EXTENSION_ID' par l'ID réel de votre extension Chrome
// Pour trouver l'ID: chrome://extensions/ -> Mode développeur -> ID de l'extension
const allowedExtensionIds: string[] = [
  // Exemple: 'abcdefghijklmnopqrstuvwxyz123456',
  // Ajoutez les IDs de vos extensions autorisées ici
  // Pour le développement local, vous pouvez temporairement commenter cette vérification
];

// Fonction pour extraire l'ID d'extension depuis une origine chrome-extension://
function getExtensionId(origin: string): string | null {
  const match = origin.match(/^chrome-extension:\/\/([a-z]{32})/);
  return match ? match[1] : null;
}

// Fonction pour vérifier si l'origine est autorisée
const corsOptionsDelegate = (req: any, callback: any) => {
  const origin = req.headers.origin;
  
  // Vérifier les requêtes depuis les extensions Chrome avec whitelist
  if (origin && origin.startsWith('chrome-extension://')) {
    const extensionId = getExtensionId(origin);
    
    // SÉCURITÉ: Autoriser uniquement les extensions dans la whitelist
    // En développement, si la liste est vide, autoriser toutes les extensions (à désactiver en production)
    if (allowedExtensionIds.length === 0 && process.env.NODE_ENV !== 'production') {
      // Mode développement: avertissement mais autorisation temporaire
      console.warn('⚠️  SÉCURITÉ: Aucune extension Chrome whitelistée. Toutes les extensions sont autorisées en développement.');
      callback(null, { 
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        maxAge: 86400
      });
      return;
    }
    
    if (extensionId && allowedExtensionIds.includes(extensionId)) {
      callback(null, { 
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        maxAge: 86400
      });
      return;
    } else {
      // Rejeter les extensions non autorisées
      console.warn(`⚠️  SÉCURITÉ: Extension Chrome non autorisée tentant d'accéder: ${extensionId || origin}`);
      callback(new Error('Chrome extension not allowed by CORS policy'));
      return;
    }
  }
  
  // En production, refuser les requêtes sans origine (sauf pour les extensions)
  if (!origin) {
    callback(null, { origin: false, credentials: false });
    return;
  }
  
  // Vérifier si l'origine est dans la liste autorisée
  if (allowedOrigins.includes(origin)) {
    callback(null, { 
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400
    });
  } else {
    // Rejeter les origines non autorisées
    callback(new Error('Not allowed by CORS'));
  }
};

const corsHandler = cors(corsOptionsDelegate);

// Configuration des fonctions avec authentification requise
// Ressources minimales pour respecter le quota CPU
const functionConfig = {
  memory: '256MiB' as const,
  timeoutSeconds: 300,
  cors: true,
  region: 'us-central1',
  minInstances: 0,
  maxInstances: 1, // Réduit au minimum pour respecter le quota CPU
  concurrency: 20, // Réduit au minimum
  allowUnauthenticated: false, // SÉCURITÉ: Forcer l'authentification sur toutes les fonctions
  secrets: [
    'GEMINI_API_KEY',
    'EMAILJS_SERVICE_ID',
    'EMAILJS_TEMPLATE_ID',
    'EMAILJS_USER_ID',
    'EMAILJS_PRIVATE_KEY'
    // Note: FRONTEND_URL n'est pas un secret (URL publique) - ne doit PAS être dans secrets
    //       Elle doit être définie comme variable d'environnement normale dans la console Firebase
    //       ou via .env pour le développement local
    // Note: STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET sont utilisés dans stripe.ts
    // qui utilise des fonctions v1 (functions.https.onRequest) et gère ses propres secrets
  ]
};

// Configuration avec moins d'instances pour les fonctions qui dépassent le quota CPU
const lowResourceConfig = {
  ...functionConfig,
  maxInstances: 1, // Minimum pour économiser le quota CPU
  concurrency: 20, // Réduit encore plus
};

// Créer l'application Express
const app = express();

// Middleware CORS
app.use(corsHandler);

// Middleware pour gérer les requêtes OPTIONS (preflight)
app.options('*', corsHandler);

// Route de test
app.get('/', (req, res) => {
  res.json({ message: "Les fonctions Cloud sont accessibles!" });
});

// Body parser (important pour recevoir les images base64)
// Note: Pour les webhooks Stripe, on a besoin du body brut, donc on configure
// express.raw() pour les routes webhook, et express.json() pour les autres
app.use(express.json({ limit: '20mb' }));
// Ajouter support pour body brut (nécessaire pour les webhooks Stripe)
app.use(express.raw({ type: 'application/json', limit: '10mb' }));

/**
 * Extraction LinkedIn via Gemini côté serveur (clé API secrète)
 * Endpoint: POST /gemini/extract-profile
 *
 * Body:
 * { linkedinUrl: string, images: string[] (base64 png) }
 *
 * Auth:
 * Authorization: Bearer <Firebase ID token>
 */
app.post('/gemini/extract-profile', async (req, res) => {
  try {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
    if (!token) {
      res.status(401).json({ success: false, error: 'Missing Authorization bearer token' });
      return;
    }

    // Vérifier le token Firebase
    const decoded = await admin.auth().verifyIdToken(token);
    if (!decoded?.uid) {
      res.status(401).json({ success: false, error: 'Invalid token' });
      return;
    }

    const { linkedinUrl, images } = req.body || {};
    if (!linkedinUrl || !Array.isArray(images) || images.length === 0) {
      res.status(400).json({ success: false, error: 'Missing linkedinUrl or images[]' });
      return;
    }

    // Accéder au secret via process.env (Firebase Functions v2 injecte automatiquement les secrets)
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      console.error('GEMINI_API_KEY non disponible dans process.env');
      res.status(500).json({ success: false, error: 'Server misconfigured: GEMINI_API_KEY missing' });
      return;
    }

    const prompt = `Tu reçois 2 captures d'écran d'un même profil LinkedIn:\n` +
      `- Image 1: haut de profil (contient la photo de profil, le nom, le titre affiché)\n` +
      `- Image 2: section Expérience (la plus importante pour déterminer l'entreprise actuelle)\n\n` +
      `Extrais les informations et renvoie un JSON STRICT (sans texte autour):\n\n` +
      `{\n` +
      `  "name": "",\n` +
      `  "title": "",        // TITRE DE POSTE uniquement (ex: "Fondateur", "CEO", "Directeur")\n` +
      `  "company": "",      // NOM EXACT ET COMPLET DE L'ENTREPRISE ACTUELLE (ex: "L'Oréal", "Campus Consulting", "Emma")\n` +
      `  "companySector": "", // SECTEUR D'ACTIVITÉ de l'entreprise actuelle (ex: "Cosmétiques", "Conseil", "Technologie", "E-commerce", "Finance")\n` +
      `  "location": "",\n` +
      `  "linkedinUrl": "",\n` +
      `  "about": "",\n` +
      `  "experience": [ { "title": "", "company": "", "duration": "" } ]\n` +
      `}\n\n` +
      `RÈGLES ABSOLUES:\n` +
      `1. company DOIT être le NOM EXACT ET COMPLET de l'ENTREPRISE ACTUELLE. Regarde ATTENTIVEMENT la section Expérience (image 2).\n` +
      `   - Cherche l'expérience avec "aujourd'hui" ou sans date de fin dans la durée.\n` +
      `   - Si aucune n'a "aujourd'hui", prends la PREMIÈRE expérience listée en haut de la section.\n` +
      `   - Copie le nom de l'entreprise EXACTEMENT tel qu'il apparaît (ex: "Emma", pas "AI Startup").\n` +
      `   - Si le titre indique "Building X" ou "Founder of X", X est probablement l'entreprise actuelle.\n` +
      `2. companySector: Identifie le secteur d'activité de l'entreprise actuelle. Sois PRÉCIS (ex: "Cosmétiques et produits de beauté", "Conseil en stratégie", "SaaS B2B", "Fintech", "E-commerce", "Éducation").\n` +
      `   - Si tu ne peux pas déterminer le secteur avec certitude, utilise un secteur générique mais pertinent (ex: "Technologie", "Services", "Commerce").\n` +
      `3. emlyon business school (ou toute école/université) n'est PAS une entreprise actuelle.\n` +
      `4. title = poste/fonction, company = entreprise (ne pas inverser).\n` +
      `5. NE PAS inclure photoUrl dans le JSON (ce champ sera rempli séparément).\n` +
      `6. Si un champ est absent ou non visible, mets "".\n` +
      `7. IMPORTANT: Le JSON doit être complet et valide. Ne tronque pas les chaînes.\n`;

    const modelUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiKey}`;
    const parts: any[] = [{ text: prompt }];
    for (const img of images) {
      parts.push({
        inline_data: { mime_type: 'image/png', data: img }
      });
    }

    const geminiResp = await axios.post(modelUrl, {
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048
      }
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    });

    const text: string | undefined = geminiResp.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'functions/src/index.ts:176',message:'Gemini raw response received',data:{textLength:text?.length||0,textPreview:text?.substring(0,200)||'',hasText:!!text},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    if (!text) {
      // Vérifier si c'est un problème de safety/blocage
      const candidate = geminiResp.data?.candidates?.[0];
      const finishReason = candidate?.finishReason;
      const safetyRatings = candidate?.safetyRatings;
      console.error('Gemini empty response. finishReason:', finishReason, 'safetyRatings:', safetyRatings);
      res.status(502).json({ success: false, error: `Gemini returned empty response (finishReason: ${finishReason || 'unknown'})` });
      return;
    }

    let cleaned = String(text).trim();
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'functions/src/index.ts:192',message:'Before cleaning',data:{cleanedLength:cleaned.length,firstChar:cleaned[0],lastChar:cleaned[cleaned.length-1],hasOpenBrace:cleaned.includes('{'),hasCloseBrace:cleaned.includes('}')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // Nettoyer les balises markdown et autres artefacts (plus robuste)
    cleaned = cleaned.replace(/```json\s*/gi, '');
    cleaned = cleaned.replace(/```\s*/gi, '');
    
    // Extraire le JSON au lieu de supprimer (plus sûr)
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    } else {
      // Si pas de JSON trouvé, essayer de trouver le premier { et dernier }
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }
      // Si toujours rien, garder le texte original (on essaiera de parser quand même)
    }
    
    cleaned = cleaned.trim();
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'functions/src/index.ts:210',message:'After cleaning',data:{cleanedLength:cleaned.length,cleanedPreview:cleaned.substring(0,200),isEmpty:cleaned.length===0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    /**
     * Répare un JSON tronqué en fermant les chaînes/objets manquants
     */
    function repairTruncatedJSON(jsonStr: string): string {
      let repaired = jsonStr;
      
      // Trouver si on est dans une chaîne à la fin
      let inString = false;
      let escapeNext = false;
      
      for (let i = 0; i < repaired.length; i++) {
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (repaired[i] === '\\') {
          escapeNext = true;
          continue;
        }
        if (repaired[i] === '"') {
          inString = !inString;
        }
      }
      
      // Si on est dans une chaîne à la fin, la fermer
      if (inString) {
        // Trouver le début de la dernière chaîne ouverte
        let lastQuote = repaired.lastIndexOf('"');
        if (lastQuote >= 0) {
          // Fermer la chaîne
          repaired = repaired.substring(0, lastQuote + 1) + '"';
        }
      }
      
      // Fermer les objets/tableaux ouverts
      let openBraces = (repaired.match(/\{/g) || []).length;
      let closeBraces = (repaired.match(/\}/g) || []).length;
      let openBrackets = (repaired.match(/\[/g) || []).length;
      let closeBrackets = (repaired.match(/\]/g) || []).length;
      
      // Fermer les tableaux ouverts
      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        repaired += ']';
      }
      
      // Fermer les objets ouverts
      for (let i = 0; i < openBraces - closeBraces; i++) {
        repaired += '}';
      }
      
      return repaired;
    }
    
    let extracted: any = null;
    let parseError: any = null;
    
    // Tentative 1: Parse direct
    try {
      extracted = JSON.parse(cleaned);
    } catch (e1: any) {
      parseError = e1;
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'functions/src/index.ts:260',message:'JSON parse attempt 1 failed',data:{error:e1.message,cleanedLength:cleaned.length,lastChars:cleaned.substring(Math.max(0,cleaned.length-100))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      // Tentative 2: Réparer le JSON tronqué
      try {
        const repaired = repairTruncatedJSON(cleaned);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'functions/src/index.ts:268',message:'Attempting JSON repair',data:{originalLength:cleaned.length,repairedLength:repaired.length,lastChars:repaired.substring(Math.max(0,repaired.length-100))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        extracted = JSON.parse(repaired);
      } catch (e2) {
        // Tentative 3: Extraire le JSON avec regex et réparer
        try {
          const jsonMatch = cleaned.match(/\{[\s\S]*/);
          if (jsonMatch) {
            const partial = jsonMatch[0];
            const repaired = repairTruncatedJSON(partial);
            extracted = JSON.parse(repaired);
          }
        } catch (e3) {
          // Tentative 4: Réparer les guillemets et virgules
          try {
            let repaired = cleaned.replace(/'/g, '"');
            repaired = repaired.replace(/,\s*}/g, '}');
            repaired = repaired.replace(/,\s*]/g, ']');
            repaired = repairTruncatedJSON(repaired);
            extracted = JSON.parse(repaired);
          } catch (e4) {
            console.error('All JSON parse attempts failed:', { e1, e2, e3, e4 });
            console.error('Cleaned text:', cleaned.substring(0, 1000));
          }
        }
      }
    }

    if (!extracted) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'functions/src/index.ts:240',message:'JSON parse failed',data:{rawLength:text.length,cleanedLength:cleaned.length,parseError:parseError?.message,cleanedSample:cleaned.substring(0,500),rawSample:text.substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      console.error('Unable to parse Gemini JSON. Raw text:', text.substring(0, 1000));
      res.status(502).json({ 
        success: false, 
        error: 'Unable to parse Gemini JSON',
        debug: {
          rawLength: text.length,
          cleanedLength: cleaned.length,
          parseError: parseError?.message,
          sample: cleaned.substring(0, 200) || text.substring(0, 200)
        }
      });
      return;
    }
    
    console.log('Successfully parsed Gemini response:', Object.keys(extracted));

    // Normalisation + garde-fous
    const normalizeUrl = (u: string) => {
      const m = String(u || '').match(/linkedin\.com\/in\/([^\/\?]+)/);
      return m ? `https://www.linkedin.com/in/${m[1]}/` : String(u || '');
    };

    const schoolKeywords = ['school', 'université', 'university', 'école', 'ecole', 'business school', 'institut', 'institute'];
    const isSchool = (s: string) => {
      const v = String(s || '').toLowerCase();
      return schoolKeywords.some(k => v.includes(k));
    };

    let data: any = {
      name: extracted.name || '',
      title: extracted.title || '',
      company: extracted.company || '',
      companySector: extracted.companySector || '', // Secteur d'activité de l'entreprise
      location: extracted.location || '',
      linkedinUrl: normalizeUrl(linkedinUrl || extracted.linkedinUrl || ''),
      photoUrl: '', // Toujours vide côté serveur - la photo sera extraite du DOM côté client (l'IA hallucine les URLs)
      about: extracted.about || '',
      experience: Array.isArray(extracted.experience) ? extracted.experience : [],
      source: 'linkedin',
      statut: 'nouveau',
      extractionMethod: 'ai_server'
    };

    /**
     * Trouve l'entreprise actuelle depuis les expériences (celle avec "aujourd'hui" ou sans date de fin)
     */
    function findCurrentCompany(experiences: any[]): { company: string; title: string } | null {
      if (!Array.isArray(experiences) || experiences.length === 0) return null;
      
      // Chercher l'expérience avec "aujourd'hui", "today", ou sans date de fin
      const currentKeywords = ['aujourd\'hui', 'today', 'present', 'actuel', 'en cours'];
      
      for (const exp of experiences) {
        const duration = String(exp.duration || '').toLowerCase();
        const hasCurrentKeyword = currentKeywords.some(kw => duration.includes(kw));
        // Ou pas de "–" dans la durée (signe qu'il n'y a pas de date de fin)
        const hasNoEndDate = duration && !duration.includes('–') && !duration.includes('-');
        
        if (hasCurrentKeyword || hasNoEndDate) {
          return {
            company: exp.company || '',
            title: exp.title || ''
          };
        }
      }
      
      // Si aucune expérience actuelle trouvée, prendre la première
      if (experiences[0]) {
        return {
          company: experiences[0].company || '',
          title: experiences[0].title || ''
        };
      }
      
      return null;
    }

    /**
     * Extrait l'entreprise depuis le titre (ex: "Building Emma" -> "Emma", "Founder of X" -> "X")
     */
    function extractCompanyFromTitle(title: string): string | null {
      if (!title) return null;
      
      // Patterns: "Building X", "Founder of X", "Building X | Y", etc.
      const buildingMatch = title.match(/building\s+([^|•]+)/i);
      if (buildingMatch) {
        return buildingMatch[1].trim();
      }
      
      const founderMatch = title.match(/founder\s+of\s+([^|•]+)/i);
      if (founderMatch) {
        return founderMatch[1].trim();
      }
      
      // Si le titre contient une entreprise évidente (pas un titre de poste)
      const titleLower = title.toLowerCase();
      const jobTitleKeywords = ['entrepreneur', 'founder', 'ceo', 'directeur', 'manager', 'consultant'];
      const isJobTitle = jobTitleKeywords.some(kw => titleLower.includes(kw));
      
      if (!isJobTitle && title.split(' ').length <= 3) {
        // Le titre pourrait être juste un nom d'entreprise
        return title.trim();
      }
      
      return null;
    }

    // CORRECTION 1: Si company est vide ou est une école, chercher l'entreprise actuelle dans les expériences
    if (!data.company || isSchool(data.company)) {
      const current = findCurrentCompany(data.experience);
      if (current && current.company && !isSchool(current.company)) {
        data.company = current.company;
        if (current.title && !data.title) {
          data.title = current.title;
        }
      }
    }

    // CORRECTION 2: Extraire l'entreprise depuis le titre si elle contient "Building X" ou "Founder of X"
    const titleCompany = extractCompanyFromTitle(data.title);
    if (titleCompany && (!data.company || isSchool(data.company) || data.company.toLowerCase() === 'ai startup')) {
      // Si le titre contient une entreprise et que company est vide, incorrecte, ou est "AI Startup" (trop générique)
      data.company = titleCompany;
      // Garder le titre mais nettoyer (enlever "Building" ou "Founder of")
      const cleanedTitle = data.title.replace(/building\s+/i, '').replace(/founder\s+of\s+/i, '').trim();
      if (cleanedTitle && cleanedTitle !== titleCompany) {
        data.title = cleanedTitle.split('|')[0].trim(); // Prendre la première partie si séparée par |
      }
    }

    // CORRECTION 3: Vérifier que l'entreprise actuelle n'est pas dans les expériences passées
    // Si l'entreprise extraite est dans une expérience avec une date de fin, chercher une meilleure correspondance
    if (data.company && data.experience?.length > 0) {
      const current = findCurrentCompany(data.experience);
      if (current && current.company && current.company.toLowerCase() !== data.company.toLowerCase()) {
        // L'expérience actuelle a une entreprise différente, l'utiliser
        data.company = current.company;
        if (current.title) {
          data.title = current.title;
        }
      }
    }

    // Si title ressemble à une entreprise et company ressemble à une école, corriger
    if (isSchool(data.company) && data.title && !isSchool(data.title)) {
      // très souvent: title="Campus Consulting", company="emlyon..."
      data.company = data.title;
      // essayer de trouver un vrai titre dans experience[0].title
      if (data.experience?.[0]?.title && !isSchool(data.experience[0].title)) {
        data.title = data.experience[0].title;
      } else {
        data.title = data.title.toLowerCase().includes('fondateur') ? data.title : 'Fondateur';
      }
    }

    // Enrichissement: recherche entreprise publique (best-effort)
    try {
      if (data.company) {
        const q = encodeURIComponent(String(data.company));
        const r = await axios.get(`https://recherche-entreprises.api.gouv.fr/search?q=${q}&page=1&per_page=5`, { timeout: 15000 });
        const first = r.data?.results?.[0];
        if (first) {
          const siege = first.siege || {};
          const addr = [siege.numero_voie, siege.type_voie, siege.libelle_voie, siege.code_postal, siege.libelle_commune]
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          // Le SIRET peut être dans plusieurs champs selon l'API
          // Priorité: siege.siret > matching_etablissements[0].siret > siren + NIC
          let siret = '';
          if (siege.siret) {
            siret = String(siege.siret).replace(/\s/g, '');
          } else if (first.matching_etablissements?.[0]?.siret) {
            siret = String(first.matching_etablissements[0].siret).replace(/\s/g, '');
          } else if (first.siren && siege.nic) {
            siret = String(first.siren + siege.nic).replace(/\s/g, '');
          } else if (first.siren) {
            // Fallback: juste le SIREN (9 chiffres)
            siret = String(first.siren).replace(/\s/g, '');
          }
          
          // Récupérer le secteur d'activité depuis l'API si disponible (code NAF)
          let secteur = '';
          if (first.activite_principale) {
            // L'API renvoie parfois le libellé de l'activité principale
            secteur = first.activite_principale_libelle || first.activite_principale || '';
          }
          
          data.companyData = {
            raisonSociale: first.nom_complet || first.nom_raison_sociale || '',
            siret: siret,
            siren: first.siren || '',
            siegeSocial: addr || siege.adresse || '',
            secteur: secteur // Secteur depuis l'API entreprises.gouv.fr si disponible
          };
          
          // Si on a un secteur depuis l'API et que l'IA n'en a pas trouvé, l'utiliser
          if (secteur && !data.companySector) {
            data.companySector = secteur;
          }
        }
      }
    } catch (e) {
      console.error('Erreur enrichissement entreprise:', e);
      // ignore - ne pas bloquer l'extraction si l'enrichissement échoue
    }

    res.json({ success: true, data });
  } catch (error: any) {
    console.error('gemini/extract-profile error:', error?.response?.data || error?.message || error);
    res.status(500).json({ success: false, error: error?.message || 'Server error' });
  }
});

// Exporter l'application Express
export const api = onRequest(functionConfig, app);

// Types pour les données des fonctions
interface CreateUserData {
  email: string;
  password: string;
  displayName: string;
}

interface UpdateUserProfileData {
  displayName: string;
  photoURL?: string;
}

// Interface pour les données de contact
interface ContactEmailData {
  company: string;
  email: string;
  message: string;
}

// Fonction pour créer un nouvel utilisateur
// Utilise lowResourceConfig pour éviter le quota CPU
export const createUser = onCall(lowResourceConfig, async (request) => {
  try {
    // Vérifier l'authentification
    if (!request.auth) {
      throw new Error('Vous devez être connecté pour accéder à cette fonction.');
    }

    const { email, password, displayName } = request.data as CreateUserData;

    // Créer l'utilisateur dans Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
    });

    // Créer le document utilisateur dans Firestore
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      email,
      displayName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { uid: userRecord.uid };
  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur:', error);
    throw new Error('Une erreur est survenue lors de la création de l\'utilisateur.');
  }
});

// Fonction pour mettre à jour le profil utilisateur
export const updateUserProfile = onCall(functionConfig, async (request) => {
  try {
    // Vérifier l'authentification
    if (!request.auth) {
      throw new Error('Vous devez être connecté pour accéder à cette fonction.');
    }

    const { displayName, photoURL } = request.data as UpdateUserProfileData;
    const uid = request.auth.uid;

    // Mettre à jour le profil dans Firebase Auth
    await admin.auth().updateUser(uid, {
      displayName,
      photoURL,
    });

    // Mettre à jour le document dans Firestore
    await admin.firestore().collection('users').doc(uid).update({
      displayName,
      photoURL,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la mise à jour du profil:', error);
    throw new Error('Une erreur est survenue lors de la mise à jour du profil.');
  }
});

/**
 * Fonction sécurisée pour envoyer des emails de contact.
 * Remplace l'appel direct au SDK client EmailJS pour protéger les clés.
 * Nécessite les variables d'environnement :
 * - EMAILJS_SERVICE_ID
 * - EMAILJS_TEMPLATE_ID
 * - EMAILJS_USER_ID (Public Key)
 * - EMAILJS_PRIVATE_KEY (Private Key)
 */
// Utilise lowResourceConfig pour éviter le quota CPU
export const sendContactEmail = onCall(lowResourceConfig, async (request) => {
  try {
    // Validation des données
    const { company, email, message } = request.data as ContactEmailData;

    if (!company || !email || !message) {
      throw new Error('Tous les champs (société, email, message) sont requis.');
    }

    // Récupération des secrets depuis process.env (Firebase Functions v2 injecte automatiquement les secrets)
    // SÉCURITÉ: Aucun fallback - les secrets DOIVENT être définis
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    const userId = process.env.EMAILJS_USER_ID;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;

    // Validation stricte - échec si les variables manquent
    if (!serviceId) {
      throw new Error('EMAILJS_SERVICE_ID n\'est pas configuré. Définissez-la dans les variables d\'environnement Firebase.');
    }
    if (!templateId) {
      throw new Error('EMAILJS_TEMPLATE_ID n\'est pas configuré. Définissez-la dans les variables d\'environnement Firebase.');
    }
    if (!userId) {
      throw new Error('EMAILJS_USER_ID n\'est pas configuré. Définissez-la dans les variables d\'environnement Firebase.');
    }
    if (!privateKey) {
      throw new Error('EMAILJS_PRIVATE_KEY n\'est pas configuré. Définissez-la dans les variables d\'environnement Firebase.');
    }
    
    const emailData = {
      service_id: serviceId,
      template_id: templateId,
      user_id: userId,
      accessToken: privateKey, // Optionnel si configuré sans, mais recommandé
      template_params: {
        from_company: company,
        from_email: email,
        message: message,
        to_email: 'teo.guermeur@gmail.com'
      }
    };

    // Appel à l'API REST EmailJS
    await axios.post('https://api.emailjs.com/api/v1.0/email/send', emailData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return { success: true, message: 'Email envoyé avec succès' };

  } catch (error: any) {
    console.error('Erreur lors de l\'envoi de l\'email:', error?.response?.data || error.message);
    throw new Error('Impossible d\'envoyer l\'email pour le moment.');
  }
});

// Exporter les autres fonctions
export { 
  getStripeProducts,
  createCheckoutSession,
  cancelSubscription,
  createSubscription,
  handleStripeWebhook,
  getStripeCustomers,
  cancelStripeSubscription,
  fetchPaymentHistory,
  createCotisationSession,
  getStructureCotisations,
  handleCotisationWebhook
};

// Exporter les fonctions 2FA
export {
  generateTwoFactorSecret,
  verifyAndEnableTwoFactor,
  verifyTwoFactorCode,
  disableTwoFactor,
  getSecureDevices,
  removeSecureDevice,
  logoutOtherDevices
} from './twoFactor';

// Exporter les fonctions de chiffrement
export {
  encryptUserData,
  decryptUserData,
  decryptOwnUserData,
  encryptCompanyData,
  decryptCompanyData,
  encryptContactData,
  decryptContactData,
  encryptText,
  decryptText
} from './encryptionFunctions';

export {
  encryptFile,
  decryptFile,
  isFileEncrypted
} from './fileEncryption';

// Exporter les fonctions de migration
export {
  migrateAllEncryption,
  checkMigrationStatus
} from './migrateEncryption';

// Exporter les fonctions de logging des accès
export {
  getEncryptedDataAccessLogsFunction
} from './accessLogging';
