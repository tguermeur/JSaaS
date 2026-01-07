/**
 * Service d'extraction IA avec Gemini Vision API
 */

import { getGeminiApiKey } from '../config.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

/**
 * Prompt optimisé pour l'extraction de données LinkedIn
 */
const EXTRACTION_PROMPT = `Analyse cette capture d'écran d'un profil LinkedIn et extrais les informations suivantes au format JSON strict :

{
  "name": "Nom complet de la personne",
  "title": "Titre/Poste actuel",
  "company": "Nom de l'entreprise actuelle (seulement le nom, pas le type de contrat)",
  "location": "Localisation (ville, pays)",
  "email": "Email si visible",
  "phone": "Téléphone si visible",
  "linkedinUrl": "URL du profil LinkedIn",
  "photoUrl": "URL de la photo de profil si visible",
  "about": "Section À propos si visible (résumé)",
  "experience": [
    {
      "title": "Titre du poste",
      "company": "Nom de l'entreprise",
      "duration": "Période (ex: jan 2020 - présent)"
    }
  ]
}

Règles importantes :
- Si une information n'est pas visible, utilise une chaîne vide ""
- Pour "company", extrais SEULEMENT le nom de l'entreprise (ex: "Génération Do It Yourself", pas "Hôte du Podcast GDIY")
- Pour "company", prends l'entreprise de la première expérience dans la section "Expérience"
- Le JSON doit être valide et parsable
- Ne retourne QUE le JSON, sans texte avant ou après
- Si tu vois plusieurs entreprises, prends celle de la première expérience la plus récente`;

/**
 * Extrait les données d'un profil LinkedIn depuis une image
 * @param {string} imageBase64 - Image en base64 (sans préfixe data:image)
 * @param {string} linkedinUrl - URL du profil pour validation
 * @returns {Promise<Object>} Données extraites
 */
export async function extractProfileWithAI(imageBase64, linkedinUrl) {
  try {
    const GEMINI_API_KEY = getGeminiApiKey();
    if (!GEMINI_API_KEY) {
      throw new Error('Clé API Gemini non configurée. Veuillez la configurer dans les paramètres de l\'extension.');
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: EXTRACTION_PROMPT
              },
              {
                inline_data: {
                  mime_type: 'image/png',
                  data: imageBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1, // Faible température pour plus de cohérence
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Erreur API Gemini: ${response.status} - ${errorData.error?.message || response.statusText}`
      );
    }

    const data = await response.json();

    // Extraire le texte de la réponse
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Aucune réponse de l\'API Gemini');
    }

    // Nettoyer le texte (enlever markdown si présent)
    let cleanedText = text.trim();
    
    // Enlever les blocs de code markdown si présents
    cleanedText = cleanedText.replace(/```json\n?/g, '');
    cleanedText = cleanedText.replace(/```\n?/g, '');
    cleanedText = cleanedText.trim();

    // Parser le JSON
    let extractedData;
    try {
      extractedData = JSON.parse(cleanedText);
    } catch (parseError) {
      // Essayer d'extraire le JSON même s'il y a du texte autour
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error(`Impossible de parser le JSON: ${parseError.message}`);
      }
    }

    // Valider et normaliser les données
    const normalizedData = {
      name: extractedData.name || '',
      title: extractedData.title || '',
      company: extractedData.company || '',
      location: extractedData.location || '',
      email: extractedData.email || '',
      phone: extractedData.phone || '',
      linkedinUrl: linkedinUrl || extractedData.linkedinUrl || '',
      photoUrl: extractedData.photoUrl || '',
      about: extractedData.about || '',
      experience: extractedData.experience || [],
      source: 'linkedin',
      statut: 'nouveau',
      extractionMethod: 'ai' // Indiquer que c'est une extraction IA
    };

    // Nettoyer le nom de l'entreprise (supprimer les doublons, etc.)
    if (normalizedData.company) {
      normalizedData.company = cleanCompanyName(normalizedData.company);
    }

    return normalizedData;
  } catch (error) {
    console.error('Erreur lors de l\'extraction IA:', error);
    throw error;
  }
}

/**
 * Nettoie le nom de l'entreprise
 * @param {string} companyName - Nom de l'entreprise
 * @returns {string} Nom nettoyé
 */
function cleanCompanyName(companyName) {
  if (!companyName) return '';

  let cleaned = companyName.trim();

  // Supprimer les doublons
  const words = cleaned.split(/\s+/);
  if (words.length >= 4) {
    const halfLength = Math.floor(words.length / 2);
    const firstHalf = words.slice(0, halfLength).join(' ');
    const secondHalf = words.slice(halfLength).join(' ');
    if (firstHalf === secondHalf) {
      cleaned = firstHalf;
    }
  }

  // Supprimer les suffixes indésirables
  cleaned = cleaned
    .replace(/,\s*visuel\.?$/i, '')
    .replace(/,\s*logo\.?$/i, '')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/\s*-\s*[^-]*$/, '')
    .trim();

  return cleaned;
}

/**
 * Extrait les données avec retry en cas d'échec
 * @param {string} imageBase64 - Image en base64
 * @param {string} linkedinUrl - URL du profil
 * @param {number} maxRetries - Nombre maximum de tentatives (défaut: 2)
 * @returns {Promise<Object>} Données extraites
 */
export async function extractProfileWithAIRetry(imageBase64, linkedinUrl, maxRetries = 2) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await extractProfileWithAI(imageBase64, linkedinUrl);
    } catch (error) {
      lastError = error;
      console.warn(`Tentative ${attempt + 1}/${maxRetries + 1} échouée:`, error);
      
      // Attendre avant de réessayer (backoff exponentiel)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }
  
  throw lastError;
}

