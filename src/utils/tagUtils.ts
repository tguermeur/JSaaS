import { VARIABLE_TAGS } from '../types/templates';

// Fonction pour échapper les caractères spéciaux dans les expressions régulières
export const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Fonction pour obtenir la balise à partir de l'ID de la variable
export const getTagFromVariableId = (variableId: string): string => {
  const tagMapping = VARIABLE_TAGS.find(mapping => mapping.variableId === variableId);
  return tagMapping ? tagMapping.tag : '';
};

// Fonction pour remplacer les balises par leurs valeurs
export const replaceTags = async (text: string, missionData?: any, userData?: any, companyData?: any): Promise<string> => {
  if (!text) return '';
  
  try {
    let result = text;
    for (const { tag, variableId } of VARIABLE_TAGS) {
      let value = '';
      
      // Chercher d'abord dans les données de mission
      if (missionData && variableId in missionData) {
        value = missionData[variableId]?.toString() || '';
      }
      // Puis dans les données utilisateur
      else if (userData && variableId in userData) {
        value = userData[variableId]?.toString() || '';
      }
      // Enfin dans les données de l'entreprise
      else if (companyData && variableId in companyData) {
        value = companyData[variableId]?.toString() || '';
      }

      // Remplacer la balise par la valeur
      result = result.replace(new RegExp(escapeRegExp(tag), 'g'), value);
    }
    return result;
  } catch (error) {
    console.error('Erreur lors du remplacement des balises:', error);
    return text;
  }
}; 