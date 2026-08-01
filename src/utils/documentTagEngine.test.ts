import { describe, expect, it } from 'vitest';
import {
  applyTagReplacements,
  buildTagReplacements,
  detectMissingTags,
  getCatalogUniqueTags,
  getEngineCoveredTags,
  reviewTemplateTags,
  resolveTagValue,
} from './documentTagEngine';
import {
  isEmptyForDetection,
  resolveTagFromVariableId,
  tagNeedsChargeData,
  tagNeedsMissionTypeData,
} from './variableTags';

describe('resolveTagFromVariableId', () => {
  it('résout missionDescription / missionDetailsDescription vers description fiche', () => {
    expect(resolveTagFromVariableId('missionDescription')).toBe('<mission_description>');
    expect(resolveTagFromVariableId('missionDetailsDescription')).toBe('<mission_description>');
    expect(resolveTagFromVariableId('description', 'missions')).toBe('<mission_description>');
  });

  it('désambiguïse description entreprise via dataSource', () => {
    expect(resolveTagFromVariableId('description', 'companies')).toBe('<entreprise_description>');
  });

  it('désambiguïse email / address via dataSource', () => {
    expect(resolveTagFromVariableId('email', 'users')).toBe('<user_email>');
    expect(resolveTagFromVariableId('email', 'companies')).toBe('<entreprise_email>');
    expect(resolveTagFromVariableId('address', 'users')).toBe('<user_adresse>');
    expect(resolveTagFromVariableId('address', 'companies')).toBe('<entreprise_adresse>');
  });

  it('mappe priceHT selon dataSource missions', () => {
    expect(resolveTagFromVariableId('priceHT', 'missions')).toMatch(/^<mission_prix/);
  });

  it('alias avenant heures', () => {
    expect(resolveTagFromVariableId('amendmentNewHours')).toBe('<amendment_new_hours>');
    expect(resolveTagFromVariableId('actualHours')).toBe('<amendment_actual_hours>');
    expect(resolveTagFromVariableId('amendment_actual_hours')).toBe('<amendment_actual_hours>');
  });

  it('charge_email → mission_cdm_email', () => {
    expect(resolveTagFromVariableId('charge_email')).toBe('<mission_cdm_email>');
    expect(resolveTagFromVariableId('charge_phone')).toBe('<mission_cdm_telephone>');
  });
});

describe('buildTagReplacements + revue multiligne', () => {
  it('mappe la description fiche (y compris multiligne) sans casser les autres tags', () => {
    const replacements = buildTagReplacements({
      mission: {
        numeroMission: 'M-1',
        description: 'Ligne 1\nLigne 2\nLigne 3',
        title: 'Titre',
      },
    });

    expect(replacements['<mission_description>']).toBe('Ligne 1 Ligne 2 Ligne 3');
    expect(replacements['<missionDescription>']).toBe('Ligne 1 Ligne 2 Ligne 3');
    expect(replacements['<mission_numero>']).toBe('M-1');

    const review = reviewTemplateTags(
      ['mission_numero', 'mission_description', 'mission_titre'],
      replacements
    );
    expect(review.find((r) => r.tag === 'mission_description')?.value).toBe(
      'Ligne 1 Ligne 2 Ligne 3'
    );
    expect(review.find((r) => r.tag === 'mission_description')?.isMissing).toBe(false);
    expect(review.find((r) => r.tag === 'mission_numero')?.isMissing).toBe(false);
  });

  it('ne marque pas les numériques à 0 comme manquants', () => {
    const replacements = buildTagReplacements({
      mission: { priceHT: 0, hours: 0, studentCount: 0 },
    });
    const review = reviewTemplateTags(
      ['mission_prix', 'mission_heures', 'mission_nb_etudiants', 'mission_titre'],
      replacements
    );
    const missing = detectMissingTags(review).map((m) => m.tag);
    expect(missing).not.toContain('mission_prix');
    expect(missing).not.toContain('mission_heures');
    expect(missing).toContain('mission_titre');
  });

  it('alias avenant heures partagent la même valeur compteur', () => {
    const replacements = buildTagReplacements({
      mission: { hours: 40, hoursPerStudent: '40' },
      documentType: 'avenant',
      workingHoursSlots: [
        { date: '2024-01-01', startTime: '09:00', endTime: '17:00', breaks: [] },
      ],
    });
    expect(replacements['<amendment_new_hours>']).toBe(replacements['<amendment_actual_hours>']);
    expect(replacements['<amendment_new_hours>']).toMatch(/8/);
  });
});

describe('sanitize / placeholders', () => {
  it('n’émet jamais [non disponible] dans le PDF', () => {
    const replacements = buildTagReplacements({ mission: {} });
    const text = applyTagReplacements(
      '<mission_titre> <mission_prix> <balise_inconnue>',
      replacements,
      { mission: {} }
    );
    expect(text).not.toMatch(/non disponible/i);
    expect(text).not.toMatch(/\[/);
    expect(text).toContain('0'); // prix
  });

  it('resolveTagValue ignore les placeholders', () => {
    const fake: Record<string, string> = {
      '<mission_titre>': '[Titre non disponible]',
    };
    expect(resolveTagValue('mission_titre', fake)).toBe('');
  });
});

describe('isEmptyForDetection', () => {
  it('texte vide = manquant ; numérique 0 = ok', () => {
    expect(isEmptyForDetection('mission_titre', '')).toBe(true);
    expect(isEmptyForDetection('mission_prix', '0')).toBe(false);
    expect(isEmptyForDetection('workingHoursTotal', '0 h')).toBe(false);
  });
});

describe('cache helpers', () => {
  it('tagNeedsChargeData couvre mission_cdm_*', () => {
    expect(tagNeedsChargeData('mission_cdm_email')).toBe(true);
    expect(tagNeedsChargeData('charge_email')).toBe(true);
    expect(tagNeedsChargeData('mission_numero')).toBe(false);
  });

  it('tagNeedsMissionTypeData couvre snake_case', () => {
    expect(tagNeedsMissionTypeData('mission_type')).toBe(true);
    expect(tagNeedsMissionTypeData('student_profile')).toBe(true);
    expect(tagNeedsMissionTypeData('course_application')).toBe(true);
  });
});

describe('exhaustivité catalogue vs moteur', () => {
  it('chaque tag VARIABLE_TAGS (hors étude/BV hors scope mission) a une résolution ou est JE', () => {
    const covered = new Set(getEngineCoveredTags());
    const catalog = getCatalogUniqueTags();
    const outOfMissionScope = (tag: string) =>
      tag.startsWith('<etude_') ||
      tag.startsWith('<bv_') ||
      tag.startsWith('<avenant_') ||
      tag === '<phase_liste>' ||
      tag === '<phase_statut>' ||
      tag === '<consultant_liste>' ||
      tag.startsWith('<note_frais_');

    const missing = catalog.filter((tag) => !covered.has(tag) && !outOfMissionScope(tag));
    expect(missing).toEqual([]);
  });
});
