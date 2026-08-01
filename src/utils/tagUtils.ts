import { VARIABLE_TAGS, resolveTagFromVariableId } from './variableTags';
import { applyTagReplacements, buildTagReplacements, escapeRegExp } from './documentTagEngine';

export { escapeRegExp };

/** Résout la balise PDF à partir d'un variableId. */
export const getTagFromVariableId = (variableId: string, dataSource?: string | null): string => {
  return resolveTagFromVariableId(variableId, dataSource);
};

/**
 * Remplacement simple (mission / user / company) — pour usages légers.
 * Préférer buildTagReplacements + applyTagReplacements pour le PDF mission.
 */
export const replaceTags = async (
  text: string,
  missionData?: Record<string, unknown>,
  userData?: Record<string, unknown>,
  companyData?: Record<string, unknown>
): Promise<string> => {
  if (!text) return '';

  try {
    if (missionData) {
      const replacements = buildTagReplacements({
        mission: missionData,
        userData: userData ?? null,
        companyData: companyData ?? null,
      });
      return applyTagReplacements(text, replacements, { mission: missionData });
    }

    let result = text;
    for (const { tag, variableId } of VARIABLE_TAGS) {
      let value = '';
      if (missionData && variableId in missionData) {
        value = missionData[variableId]?.toString() || '';
      } else if (userData && variableId in userData) {
        value = userData[variableId]?.toString() || '';
      } else if (companyData && variableId in companyData) {
        value = companyData[variableId]?.toString() || '';
      }
      result = result.replace(new RegExp(escapeRegExp(tag), 'g'), value);
    }
    return result;
  } catch (error) {
    console.error('Erreur lors du remplacement des balises:', error);
    return text;
  }
};
