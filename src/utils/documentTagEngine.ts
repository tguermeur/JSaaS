/**
 * Moteur de balises PDF mission — construction + revue + détection.
 * Pure (pas de Firestore) : le contexte doit être déjà hydraté / déchiffré.
 */
import {
  defaultValueForTag,
  getTemplateTagMeta,
  isDocumentPlaceholderValue,
  isEmptyForDetection,
  isNumericDocTag,
  VARIABLE_TAGS,
} from './variableTags';

export type WorkingHoursSlot = {
  date?: string;
  startTime?: string;
  endTime?: string;
  breaks?: Array<{ start?: string; end?: string; startTime?: string; endTime?: string }>;
};

export type TagReplacementContext = {
  mission: Record<string, unknown>;
  documentType?: string;
  application?: {
    userDisplayName?: string;
    userEmail?: string;
    userPhone?: string;
    userStudentId?: string;
    createdAt?: string | Date;
    updatedAt?: string | Date;
    documentTagOverrides?: Record<string, string>;
    workingHours?: WorkingHoursSlot[];
    gratificationBrute?: number;
    gratificationNet?: number;
  } | null;
  userData?: Record<string, unknown> | null;
  chargeData?: Record<string, unknown> | null;
  contactData?: Record<string, unknown> | null;
  companyData?: Record<string, unknown> | null;
  structureData?: Record<string, unknown> | null;
  missionTypeData?: Record<string, unknown> | null;
  presidentFullName?: string | null;
  workingHoursSlots?: WorkingHoursSlot[];
  workingHoursCreatedAt?: string;
  workingHoursUpdatedAt?: string;
  /** Overrides saisis (modale manquantes / avenant). */
  tempDataOverride?: Record<string, string>;
};

export type TemplateTagReviewItem = {
  tag: string;
  label: string;
  category: string;
  value: string;
  isMissing: boolean;
};

export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function calculateWorkingHoursHours(
  startTime: string,
  endTime: string,
  breaks: Array<{ start: string; end: string }> = []
): number {
  const start = new Date(`1970-01-01T${startTime}`);
  const end = new Date(`1970-01-01T${endTime}`);
  let totalMinutes = (end.getTime() - start.getTime()) / 1000 / 60;
  breaks.forEach((breakTime) => {
    const breakStart = new Date(`1970-01-01T${breakTime.start}`);
    const breakEnd = new Date(`1970-01-01T${breakTime.end}`);
    totalMinutes -= (breakEnd.getTime() - breakStart.getTime()) / 1000 / 60;
  });
  return totalMinutes / 60;
}

export function formatHoursWithUnit(value: string): string {
  const trimmed = (value || '').trim();
  if (!trimmed || /\[|non disponible/i.test(trimmed)) return trimmed;
  if (/\bh\s*$/i.test(trimmed)) return trimmed;
  return `${trimmed} h`;
}

function sanitizeDocValue(tagWithBrackets: string, value: string): string {
  const tagName = tagWithBrackets.replace(/[<>]/g, '');
  const trimmed = (value ?? '').toString().trim();
  if (!trimmed || isDocumentPlaceholderValue(trimmed) || /non disponible/i.test(trimmed)) {
    return defaultValueForTag(tagName);
  }
  return value;
}

function formatMoney(n: number | null | undefined): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function formatDetailedWorkingHours(
  mission: Record<string, unknown>,
  hours: WorkingHoursSlot[],
  options?: { allowMissionFallback?: boolean }
): string {
  const allowMissionFallback = options?.allowMissionFallback !== false;
  const startDate = mission.startDate as string | undefined;
  const endDate = mission.endDate as string | undefined;
  const missionDebut = startDate
    ? `${new Date(startDate).toLocaleDateString('fr-FR')} à ${new Date(startDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : '';
  const missionFin = endDate
    ? `${new Date(endDate).toLocaleDateString('fr-FR')} à ${new Date(endDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : '';
  if (!hours.length) {
    if (allowMissionFallback) {
      return missionDebut && missionFin ? ` De ${missionDebut} à ${missionFin}` : '';
    }
    return '';
  }
  const formatTime = (t: string) => (t ? t.replace(/:\d{2}$/, 'h') : '');
  const formatDateHour = (dateStr: string, timeStr: string) => {
    const d = dateStr ? new Date(dateStr).toLocaleDateString('fr-FR') : '';
    const t = formatTime(timeStr);
    return t ? `${d} à ${t}` : d;
  };
  if (hours.length === 1) {
    const day = hours[0];
    const debut = formatDateHour(day.date || '', day.startTime || '');
    const fin = formatDateHour(day.date || '', day.endTime || '');
    return debut && fin ? `${debut} - ${fin}` : debut || fin || '';
  }
  const parts = hours.map((day) => {
    const dateStr = day.date ? new Date(day.date).toLocaleDateString('fr-FR') : '';
    const startH = formatTime(day.startTime || '');
    const endH = formatTime(day.endTime || '');
    let s = `${dateStr} de ${startH} à ${endH}`;
    if (day.breaks?.length) {
      const breaksStr = day.breaks
        .map((b) => `${b.start ?? b.startTime ?? ''}-${b.end ?? b.endTime ?? ''}`)
        .filter(Boolean)
        .join(', ');
      if (breaksStr) s += ` (pauses: ${breaksStr})`;
    }
    return s;
  });
  return parts.join(', ');
}

/**
 * Construit la carte `<tag> → valeur` à partir d'un contexte hydraté.
 */
export function buildTagReplacements(ctx: TagReplacementContext): Record<string, string> {
  const mission = ctx.mission;
  const application = ctx.application;
  const userData = ctx.userData;
  const chargeData = ctx.chargeData;
  const contactData = ctx.contactData;
  const company = ctx.companyData;
  const structureDataResolved = ctx.structureData;
  const missionTypeData = ctx.missionTypeData;
  const presidentFullName = ctx.presidentFullName || '';
  const documentType = ctx.documentType;

  const docOverrides = application?.documentTagOverrides ?? {};
  const resolveDocTag = (...keys: string[]): string => {
    for (const k of keys) {
      const v = docOverrides[k];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  };

  const workingHoursSlots =
    ctx.workingHoursSlots?.length
      ? ctx.workingHoursSlots
      : application?.workingHours ?? [];

  const workingHoursTotal = workingHoursSlots.length
    ? workingHoursSlots
        .reduce((total, wh) => {
          return (
            total +
            calculateWorkingHoursHours(
              wh.startTime || '',
              wh.endTime || '',
              (wh.breaks || []).map((b) => ({
                start: b.start ?? b.startTime ?? '',
                end: b.end ?? b.endTime ?? '',
              }))
            )
          );
        }, 0)
        .toFixed(2)
    : '';

  const isAvenantDocument = documentType === 'avenant';
  const plannedDetailedHours = formatDetailedWorkingHours(mission, [], { allowMissionFallback: true });
  const actualDetailedHours = formatDetailedWorkingHours(mission, workingHoursSlots, {
    allowMissionFallback: false,
  });
  const detailedWorkingHours = isAvenantDocument
    ? plannedDetailedHours
    : formatDetailedWorkingHours(mission, workingHoursSlots, { allowMissionFallback: true });
  const heuresFinalementTravaillees =
    resolveDocTag('heures_finalement_travaillees') ||
    (isAvenantDocument
      ? actualDetailedHours
      : formatDetailedWorkingHours(mission, workingHoursSlots, { allowMissionFallback: true }));

  const plannedHoursTotal =
    (mission.hoursPerStudent != null ? String(mission.hoursPerStudent) : '') ||
    (mission.hours != null ? String(mission.hours) : '') ||
    '';
  const amendmentNewHours =
    resolveDocTag('amendment_new_hours', 'amendment_actual_hours', 'actualHours') ||
    workingHoursTotal;
  const resolvedWorkingHoursTotal = plannedHoursTotal || workingHoursTotal || '0';
  const amendmentNewHoursDisplay = formatHoursWithUnit(amendmentNewHours);
  const workingHoursTotalDisplay = formatHoursWithUnit(resolvedWorkingHoursTotal);
  const amendmentPlannedHours =
    resolveDocTag('amendment_planned_hours', 'plannedHours') ||
    (mission.hoursPerStudent != null ? String(mission.hoursPerStudent) : '') ||
    (mission.hours != null ? String(mission.hours) : '') ||
    '';
  const amendmentReason = resolveDocTag('amendment_reason', 'reason');

  const whFirst = workingHoursSlots[0];
  const whCreation = ctx.workingHoursCreatedAt || '';
  const whMaj = ctx.workingHoursUpdatedAt || '';

  const contactFullName = `${contactData?.firstName || ''} ${contactData?.lastName || ''}`.trim();
  const missionTypeTitle = (missionTypeData?.title as string) || '';
  const generationDateStr = new Date().toLocaleDateString('fr-FR');
  const studentProfileVal = String(missionTypeData?.studentProfile || '').trim();
  const courseApplicationVal = String(missionTypeData?.courseApplication || '').trim();
  const missionLearningVal = String(missionTypeData?.missionLearning || '').trim();
  const structureAddress = (structureDataResolved?.address as string) || '';
  const structurePhone = (structureDataResolved?.phone as string) || '';

  const gratificationBrute =
    typeof application?.gratificationBrute === 'number'
      ? application.gratificationBrute
      : typeof structureDataResolved?.defaultGratificationBrute === 'number'
        ? (structureDataResolved.defaultGratificationBrute as number)
        : typeof mission.priceHT === 'number'
          ? (mission.priceHT as number)
          : 0;
  const gratificationNette =
    typeof application?.gratificationNet === 'number'
      ? application.gratificationNet
      : typeof structureDataResolved?.defaultGratificationNet === 'number'
        ? (structureDataResolved.defaultGratificationNet as number)
        : 0;
  const hoursForTotal = Number(plannedHoursTotal || workingHoursTotal || 0) || 0;
  const totalAPayer = gratificationNette * hoursForTotal;

  const missionDesc = String(mission.description || '').replace(/[\n\r]+/g, ' ');
  const missionTypeDesc = String(missionTypeData?.missionDescription || '').replace(/[\n\r]+/g, ' ');

  const replacements: Record<string, string> = {
    '<mission_numero>': String(mission.numeroMission || ''),
    '<mission_cdm>': String(mission.chargeName || ''),
    '<mission_cdm_email>': String(chargeData?.email || ''),
    '<mission_cdm_telephone>': String(chargeData?.phone || ''),
    '<mission_date>': mission.startDate
      ? new Date(mission.startDate as string).toLocaleDateString()
      : '',
    '<mission_lieu>': String(mission.location || ''),
    '<mission_entreprise>': String(company?.name || ''),
    '<mission_prix>': typeof mission.priceHT === 'number' ? String(mission.priceHT) : '0',
    '<mission_prix_horaire_ht>':
      typeof mission.priceHT === 'number' ? (mission.priceHT as number).toFixed(2) : '0',
    '<mission_prix_total_heures_ht>':
      typeof mission.priceHT === 'number' && typeof mission.hours === 'number'
        ? ((mission.priceHT as number) * (mission.hours as number)).toFixed(2)
        : '0',
    '<mission_description>': missionDesc,
    '<mission_type_description>': missionTypeDesc,
    '<mission_titre>': String(mission.title || ''),
    '<mission_heures>': mission.hours != null ? String(mission.hours) : '0',
    '<mission_heures_par_etudiant>': String(mission.hoursPerStudent || '0'),
    '<mission_nb_etudiants>': mission.studentCount != null ? String(mission.studentCount) : '0',
    '<missionType>': missionTypeTitle,
    '<mission_type>': missionTypeTitle,
    '<generationDate>': generationDateStr,
    '<mission_date_generation>': generationDateStr,
    '<mission_date_generation_plus_1_an>': (() => {
      const today = new Date();
      const oneYearLater = new Date(today);
      oneYearLater.setDate(today.getDate() + 365);
      return oneYearLater.toLocaleDateString('fr-FR');
    })(),
    '<totalHT>': typeof mission.totalHT === 'number' ? String(mission.totalHT) : '0',
    '<total_ht>': typeof mission.totalHT === 'number' ? String(mission.totalHT) : '0',
    '<totalTTC>': typeof mission.totalTTC === 'number' ? String(mission.totalTTC) : '0',
    '<total_ttc>': typeof mission.totalTTC === 'number' ? String(mission.totalTTC) : '0',
    '<tva>': typeof mission.tva === 'number' ? (mission.tva as number).toFixed(2) : '0',

    '<workinghours_date_debut>': whFirst?.date || '',
    '<workingHoursDateDebut>': whFirst?.date || '',
    '<workinghours_heure_debut>': whFirst?.startTime || '',
    '<workingHoursHeureDebut>': whFirst?.startTime || '',
    '<workinghours_date_fin>': whFirst?.date || '',
    '<workingHoursDateFin>': whFirst?.date || '',
    '<workinghours_heure_fin>': whFirst?.endTime || '',
    '<workingHoursHeureFin>': whFirst?.endTime || '',
    '<workinghours_pauses>':
      whFirst?.breaks?.map((b) => `${b.start ?? b.startTime}-${b.end ?? b.endTime}`).join(', ') || '',
    '<workingHoursPauses>':
      whFirst?.breaks?.map((b) => `${b.start ?? b.startTime}-${b.end ?? b.endTime}`).join(', ') || '',
    '<workinghours_total>': workingHoursTotalDisplay,
    '<workingHoursTotal>': workingHoursTotalDisplay,
    '<workinghours_creation>': whCreation,
    '<workingHoursCreation>': whCreation,
    '<workinghours_maj>': whMaj,
    '<workingHoursMaj>': whMaj,
    '<heures_detaillees>': detailedWorkingHours,
    '<heuresDetaillees>': detailedWorkingHours,

    '<contact_nom>': String(contactData?.lastName || ''),
    '<contact_lastName>': String(contactData?.lastName || ''),
    '<contact_prenom>': String(contactData?.firstName || ''),
    '<contact_firstName>': String(contactData?.firstName || ''),
    '<contact_email>': String(contactData?.email || ''),
    '<contact_telephone>': String(contactData?.phone || ''),
    '<contact_phone>': String(contactData?.phone || ''),
    '<contact_poste>': String(contactData?.position || ''),
    '<contact_position>': String(contactData?.position || ''),
    '<contact_linkedin>': String(contactData?.linkedin || ''),
    '<contact_nom_complet>': contactFullName,
    '<contact_fullName>': contactFullName,

    '<user_nom>':
      String(userData?.lastName || '') ||
      application?.userDisplayName?.split(' ').slice(-1)[0] ||
      '',
    '<user_prenom>':
      String(userData?.firstName || '') || application?.userDisplayName?.split(' ')[0] || '',
    '<user_email>': String(userData?.email || '') || application?.userEmail || '',
    '<user_ecole>':
      String(userData?.ecole || '') ||
      application?.userEmail?.split('@')[1]?.split('.')[0] ||
      '',
    '<user_nom_complet>': String(userData?.displayName || '') || application?.userDisplayName || '',
    '<user_telephone>': String(userData?.phone || '') || application?.userPhone || '',
    '<user_numero_etudiant>': String(userData?.studentId || '') || application?.userStudentId || '',
    '<user_formation>': String(userData?.formation || ''),
    '<user_specialite>': String(userData?.speciality || ''),
    '<user_niveau_etude>': String(userData?.studyLevel || ''),
    '<user_adresse>': String(userData?.address || ''),
    '<user_ville>': String(userData?.city || ''),
    '<user_code_postal>': String(userData?.postalCode || ''),
    '<user_programme>': String(userData?.program || ''),
    '<user_campus>': String(userData?.campus || ''),
    '<user_annee_diplome>': String(userData?.graduationYear || ''),
    '<user_nationalite>': String(userData?.nationality || ''),
    '<user_genre>': String(userData?.gender || ''),
    '<user_lieu_naissance>': String(userData?.birthPlace || ''),
    '<user_code_postal_naissance>': String(userData?.birthPostalCode || ''),
    '<user_date_naissance>': userData?.birthDate
      ? new Date(userData.birthDate as string).toLocaleDateString('fr-FR')
      : '',
    '<user_numero_securite_sociale>': String(userData?.socialSecurityNumber || ''),
    '<graduationYear>': String(userData?.graduationYear || ''),
    '<gender>': String(userData?.gender || ''),
    '<birthPlace>': String(userData?.birthPlace || ''),
    '<birthDate>': userData?.birthDate
      ? new Date(userData.birthDate as string).toLocaleDateString('fr-FR')
      : '',
    '<address>': String(userData?.address || ''),
    '<nationality>': String(userData?.nationality || ''),
    '<socialSecurityNumber>': String(userData?.socialSecurityNumber || ''),
    '<phone>': String(userData?.phone || ''),
    '<siren>': company?.nSiret ? String(company.nSiret).substring(0, 9) : '',
    '<companyName>': String(company?.name || ''),
    '<missionDescription>': missionDesc,
    '<missionDetailsDescription>': missionDesc,
    '<missionStartDate>': mission.startDate
      ? new Date(mission.startDate as string).toLocaleDateString()
      : '',
    '<mission_date_debut>': mission.startDate
      ? new Date(mission.startDate as string).toLocaleDateString('fr-FR')
      : '',
    '<mission_date_heure_debut>': mission.startDate
      ? `${new Date(mission.startDate as string).toLocaleDateString('fr-FR')} à ${new Date(mission.startDate as string).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
      : '',
    '<mission_date_fin>': mission.endDate
      ? new Date(mission.endDate as string).toLocaleDateString('fr-FR')
      : '',
    '<mission_date_heure_fin>': mission.endDate
      ? `${new Date(mission.endDate as string).toLocaleDateString('fr-FR')} à ${new Date(mission.endDate as string).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
      : '',
    '<charge_email>': String(chargeData?.email || ''),
    '<charge_phone>': String(chargeData?.phone || ''),

    '<structure_nom>': String(structureDataResolved?.nom || ''),
    '<structure_ecole>': String(structureDataResolved?.ecole || ''),
    '<structure_address>': structureAddress,
    '<structure_adresse>': structureAddress,
    '<structure_phone>': structurePhone,
    '<structure_telephone>': structurePhone,
    '<structure_email>': String(structureDataResolved?.email || ''),
    '<structure_siret>': String(structureDataResolved?.siret || ''),
    '<structure_ville>': String(structureDataResolved?.city || ''),
    '<structure_code_postal>': String(structureDataResolved?.postalCode || ''),
    '<structure_pays>': String(structureDataResolved?.country || ''),
    '<structure_site_web>': String(structureDataResolved?.website || ''),
    '<structure_tvaNumber>': String(structureDataResolved?.tvaNumber || ''),
    '<structure_apeCode>': String(structureDataResolved?.apeCode || ''),
    '<structure_president_nom_complet>': presidentFullName,

    '<entreprise_nom>': String(company?.name || ''),
    '<entreprise_siren>': company?.nSiret ? String(company.nSiret).substring(0, 9) : '',
    '<entreprise_nsiret>': String(company?.nSiret || ''),
    '<nSiret>': String(company?.nSiret || ''),
    '<entreprise_adresse>': String(company?.address || ''),
    '<entreprise_ville>': String(company?.city || ''),
    '<entreprise_pays>': String(company?.country || ''),
    '<entreprise_telephone>': String(company?.phone || ''),
    '<entreprise_email>': String(company?.email || ''),
    '<entreprise_site_web>': String(company?.website || ''),
    '<entreprise_description>': String(company?.description || ''),
    '<studentProfile>': studentProfileVal,
    '<student_profile>': studentProfileVal,
    '<courseApplication>': courseApplicationVal,
    '<course_application>': courseApplicationVal,
    '<missionLearning>': missionLearningVal,
    '<mission_learning>': missionLearningVal,
    '<endDate>': mission.endDate
      ? new Date(mission.endDate as string).toLocaleDateString('fr-FR')
      : '',
    '<program>': String(userData?.program || ''),
    '<mission_gratificationhorraire>': formatMoney(
      typeof mission.priceHT === 'number' ? (mission.priceHT as number) : gratificationBrute
    ),
    '<gratification_brute>': formatMoney(gratificationBrute),
    '<gratification_nette>': formatMoney(gratificationNette),
    '<total_a_payer>': formatMoney(totalAPayer),

    '<amendment_new_hours>': amendmentNewHoursDisplay,
    '<amendmentNewHours>': amendmentNewHoursDisplay,
    '<amendment_actual_hours>': amendmentNewHoursDisplay,
    '<actualHours>': amendmentNewHoursDisplay,
    '<heures_finalement_travaillees>': heuresFinalementTravaillees,
    '<amendment_planned_hours>': amendmentPlannedHours,
    '<plannedHours>': amendmentPlannedHours,
    '<amendment_reason>': amendmentReason,
    '<reason>': amendmentReason,
    '<amendment_planned_start_date>': mission.startDate
      ? new Date(mission.startDate as string).toLocaleDateString('fr-FR')
      : '',
    '<amendment_planned_end_date>': mission.endDate
      ? new Date(mission.endDate as string).toLocaleDateString('fr-FR')
      : '',
    '<amendment_actual_start_date>': whFirst?.date
      ? new Date(whFirst.date).toLocaleDateString('fr-FR')
      : mission.startDate
        ? new Date(mission.startDate as string).toLocaleDateString('fr-FR')
        : '',
    '<amendment_actual_end_date>': (() => {
      const last = workingHoursSlots[workingHoursSlots.length - 1];
      if (last?.date) return new Date(last.date).toLocaleDateString('fr-FR');
      return mission.endDate ? new Date(mission.endDate as string).toLocaleDateString('fr-FR') : '';
    })(),
    '<amendment_target>':
      resolveDocTag('amendment_target') ||
      `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() ||
      application?.userDisplayName ||
      contactFullName ||
      '',
    '<amendment_old_hours>':
      resolveDocTag('amendment_old_hours') || plannedHoursTotal || '0',
    '<amendment_old_price>':
      resolveDocTag('amendment_old_price') ||
      (typeof mission.priceHT === 'number' ? String(mission.priceHT) : '0'),
    '<amendment_new_price>': resolveDocTag('amendment_new_price') || '0',
    '<amendment_created_at>': generationDateStr,
    '<amendment_created_by>': resolveDocTag('amendment_created_by') || '',

    '<depense1_nom>': String(mission.nomdepense1 || ''),
    '<depense1_tva>': typeof mission.tvadepense1 === 'number' ? String(mission.tvadepense1) : '0',
    '<depense1_prix>':
      typeof mission.totaldepense1 === 'number' ? (mission.totaldepense1 as number).toFixed(2) : '0',
    '<depense2_nom>': String(mission.nomdepense2 || ''),
    '<depense2_tva>': typeof mission.tvadepense2 === 'number' ? String(mission.tvadepense2) : '0',
    '<depense2_prix>':
      typeof mission.totaldepense2 === 'number' ? (mission.totaldepense2 as number).toFixed(2) : '0',
    '<depense3_nom>': String(mission.nomdepense3 || ''),
    '<depense3_tva>': typeof mission.tvadepense3 === 'number' ? String(mission.tvadepense3) : '0',
    '<depense3_prix>':
      typeof mission.totaldepense3 === 'number' ? (mission.totaldepense3 as number).toFixed(2) : '0',
    '<depense4_nom>': String(mission.nomdepense4 || ''),
    '<depense4_tva>': typeof mission.tvadepense4 === 'number' ? String(mission.tvadepense4) : '0',
    '<depense4_prix>':
      typeof mission.totaldepense4 === 'number' ? (mission.totaldepense4 as number).toFixed(2) : '0',
  };

  for (const key of Object.keys(replacements)) {
    replacements[key] = sanitizeDocValue(key, replacements[key]);
  }

  return replacements;
}

/** Tags couverts par buildTagReplacements (pour tests d'exhaustivité). */
export function getEngineCoveredTags(): string[] {
  return Object.keys(
    buildTagReplacements({
      mission: {},
    })
  );
}

const HOUR_COUNTER_TAG_NAMES = new Set([
  'amendment_new_hours',
  'amendment_actual_hours',
  'actualHours',
  'amendmentNewHours',
  'workinghours_total',
  'workingHoursTotal',
]);

/**
 * Applique la carte de remplacements à un texte (éventuellement multiligne / multi-tags).
 */
export function applyTagReplacements(
  text: string,
  replacements: Record<string, string>,
  options?: {
    tempDataOverride?: Record<string, string>;
    mission?: Record<string, unknown>;
  }
): string {
  if (!text) return text;

  let result = text;
  const tempDataOverride = options?.tempDataOverride;
  const mission = options?.mission;

  Object.entries(replacements).forEach(([tag, value]) => {
    const regex = new RegExp(escapeRegExp(tag), 'g');
    const tagName = tag.replace(/[<>]/g, '');
    const hasTempOverride =
      tempDataOverride != null && Object.prototype.hasOwnProperty.call(tempDataOverride, tagName);
    let finalValue = hasTempOverride ? tempDataOverride![tagName] : value;
    if (HOUR_COUNTER_TAG_NAMES.has(tagName)) {
      finalValue = formatHoursWithUnit(finalValue);
    }
    result = result.replace(regex, finalValue);
  });

  // Nettoyage lignes dépenses vides
  if (mission) {
    for (let i = 1; i <= 4; i++) {
      const nomValue = mission[`nomdepense${i}`];
      const prixValue = mission[`totaldepense${i}`];
      if (!nomValue && (!prixValue || typeof prixValue !== 'number' || prixValue === 0)) {
        const lines = result.split('\n');
        const cleanedLines: string[] = [];
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (
            trimmedLine === '' ||
            /^[\s:€HT]*$/.test(trimmedLine) ||
            /^[\s:€HT]*€[\s:€HT]*HT[\s:€HT]*$/.test(trimmedLine) ||
            /^[\s:€HT]*Prix[\s:€HT]*:[\s:€HT]*€[\s:€HT]*HT[\s:€HT]*$/.test(trimmedLine)
          ) {
            if (trimmedLine === '') {
              if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] !== '') {
                cleanedLines.push('');
              }
            }
          } else {
            cleanedLines.push(line);
          }
        }
        result = cleanedLines.join('\n');
      }
    }
    result = result.replace(/\n\s*\n\s*\n+/g, '\n\n');
  }

  if (tempDataOverride) {
    for (const [tagName, tempVal] of Object.entries(tempDataOverride)) {
      if (tempVal === undefined || tempVal === null) continue;
      const tag = `<${tagName}>`;
      result = result.replace(new RegExp(escapeRegExp(tag), 'g'), tempVal);
    }
  }

  const remainingTags = result.match(/<[^>]+>/g);
  if (remainingTags) {
    remainingTags.forEach((tag) => {
      const tagName = tag.replace(/[<>]/g, '');
      const fallback = defaultValueForTag(tagName);
      result = result.replace(new RegExp(escapeRegExp(tag), 'g'), fallback);
    });
  }

  return result;
}

/** Résout une seule balise (revue sans split fragile). */
export function resolveTagValue(
  tagName: string,
  replacements: Record<string, string>,
  tempDataOverride?: Record<string, string>
): string {
  const withBrackets = tagName.startsWith('<') ? tagName : `<${tagName}>`;
  const bare = tagName.replace(/[<>]/g, '');
  if (tempDataOverride && Object.prototype.hasOwnProperty.call(tempDataOverride, bare)) {
    return String(tempDataOverride[bare] ?? '');
  }
  const raw = replacements[withBrackets];
  if (raw === undefined) return defaultValueForTag(bare);
  const unreplaced = /^<[^>]+>$/.test(raw.trim());
  if (unreplaced || isDocumentPlaceholderValue(raw)) return defaultValueForTag(bare);
  return raw;
}

/** Revue tag-par-tag (plus de join/split). */
export function reviewTemplateTags(
  tagNames: string[],
  replacements: Record<string, string>,
  tempDataOverride?: Record<string, string>
): TemplateTagReviewItem[] {
  const items: TemplateTagReviewItem[] = tagNames.map((tagName) => {
    const bare = tagName.replace(/[<>]/g, '');
    const value = resolveTagValue(bare, replacements, tempDataOverride).trim();
    const meta = getTemplateTagMeta(bare);
    const isMissing = isEmptyForDetection(bare, value);
    return {
      tag: bare,
      label: meta.label,
      category: meta.category,
      value: isMissing && isNumericDocTag(bare) ? value || '0' : value,
      isMissing,
    };
  });

  items.sort((a, b) => {
    if (a.isMissing !== b.isMissing) return a.isMissing ? -1 : 1;
    if (a.category !== b.category) return a.category.localeCompare(b.category, 'fr');
    return a.label.localeCompare(b.label, 'fr');
  });

  return items;
}

/** Filtre les items manquants pour la popup (hors dépenses optionnelles). */
export function detectMissingTags(
  review: TemplateTagReviewItem[]
): Array<{ tag: string; label: string; category: string }> {
  return review
    .filter((item) => item.isMissing)
    .filter((item) => !/^depense[1-4]_/.test(item.tag))
    .map(({ tag, label, category }) => ({ tag, label, category }));
}

/** Tags uniques du catalogue (pour tests). */
export function getCatalogUniqueTags(): string[] {
  return [...new Set(VARIABLE_TAGS.map((m) => m.tag))];
}
