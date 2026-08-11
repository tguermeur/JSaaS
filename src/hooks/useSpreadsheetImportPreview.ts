import { useCallback, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getSafeDisplayName } from '../utils/decryptUserUtils';
import type {
  DuplicateHint,
  ImportType,
  ImportValidationError,
} from '../components/missions/ImportMissionsEtudesDialog';

const MISSION_ETAPES = ['Négociation', 'Recrutement', 'Date de mission', 'Facturation', 'Audit', 'Archivé'] as const;

export function levenshteinSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0 || lenB === 0) return 0;
  let prevRow = Array(lenB + 1)
    .fill(0)
    .map((_, i) => i);
  for (let i = 1; i <= lenA; i++) {
    const currRow = [i];
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(prevRow[j] + 1, currRow[j - 1] + 1, prevRow[j - 1] + cost);
    }
    prevRow = currRow;
  }
  const distance = prevRow[lenB];
  return 1 - distance / Math.max(lenA, lenB);
}

export function findBestMatch(
  input: string,
  candidates: any[],
  keys: string[],
  threshold = 0.55
): any | null {
  if (!input || !input.trim()) return null;
  const normalizedInput = input
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  let bestMatch = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    for (const key of keys) {
      const value = candidate[key];
      if (typeof value === 'string') {
        const normalizedValue = value
          .toLowerCase()
          .trim()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');

        if (normalizedValue === normalizedInput) return candidate;

        if (normalizedValue.includes(normalizedInput) || normalizedInput.includes(normalizedValue)) {
          const score =
            Math.min(normalizedInput.length, normalizedValue.length) /
            Math.max(normalizedInput.length, normalizedValue.length);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = candidate;
          }
        }

        const sim = levenshteinSimilarity(normalizedInput, normalizedValue);
        if (sim > bestScore && sim >= threshold) {
          bestScore = sim;
          bestMatch = candidate;
        }
      }
    }

    if (candidate.firstName && candidate.lastName) {
      const fullName = `${candidate.firstName} ${candidate.lastName}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const reverseName = `${candidate.lastName} ${candidate.firstName}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      if (fullName === normalizedInput || reverseName === normalizedInput) return candidate;
      if (fullName.includes(normalizedInput) || normalizedInput.includes(fullName)) {
        if (0.9 > bestScore) {
          bestScore = 0.9;
          bestMatch = candidate;
        }
      }
      const simFull = levenshteinSimilarity(normalizedInput, fullName);
      const simRev = levenshteinSimilarity(normalizedInput, reverseName);
      if (Math.max(simFull, simRev) > bestScore && Math.max(simFull, simRev) >= threshold) {
        bestScore = Math.max(simFull, simRev);
        bestMatch = candidate;
      }
    }
  }

  return bestScore >= threshold ? bestMatch : null;
}

export function computeDuplicateHints(
  rows: Record<string, unknown>[],
  type: ImportType
): DuplicateHint[] {
  const hints: DuplicateHint[] = [];
  const key = (r: Record<string, unknown>) => {
    if (type === 'etude') {
      return `${String(r.numeroEtude ?? '').trim()}|${String(r.company ?? '').trim()}|${String(r.startDate ?? '').slice(0, 10)}`;
    }
    return `${String(r.company ?? '').trim()}|${String(r.title ?? '').trim()}|${String(r.startDate ?? '').slice(0, 10)}`;
  };
  const seen = new Map<string, number>();
  rows.forEach((r, i) => {
    const k = key(r);
    if (!k || k === '||') return;
    if (seen.has(k)) hints.push({ rowIndex: i, suggestedDuplicateOf: seen.get(k)! });
    else seen.set(k, i);
  });
  return hints;
}

export function normalizeEtape(v: string): string {
  const s = (v || '').toString().trim().toLowerCase();
  const map: Record<string, string> = {
    négociation: 'Négociation',
    negociation: 'Négociation',
    négoc: 'Négociation',
    recrutement: 'Recrutement',
    recrut: 'Recrutement',
    'date de mission': 'Date de mission',
    'date mission': 'Date de mission',
    mission: 'Date de mission',
    facturation: 'Facturation',
    facturé: 'Facturation',
    facture: 'Facturation',
    audit: 'Audit',
    archivé: 'Archivé',
    archive: 'Archivé',
    clôturé: 'Archivé',
    cloture: 'Archivé',
    termine: 'Archivé',
    terminé: 'Archivé',
  };
  if (map[s]) return map[s];
  const canonical = MISSION_ETAPES.find((e) => e.toLowerCase() === s);
  return canonical || 'Négociation';
}

export function normalizeStatus(v: string): string {
  const s = (v || '').toString().trim().toLowerCase();
  if (/en attente|attente|pending/i.test(s)) return 'En attente';
  if (/en cours|cours|en_cours|in progress/i.test(s)) return 'En cours';
  if (/terminé|termine|done|completed/i.test(s)) return 'Terminé';
  if (/annulé|annule|canceled/i.test(s)) return 'Annulé';
  return v || 'En attente';
}

export function normalizeStatusEtude(v: string): string {
  const s = (v || '').toString().trim().toLowerCase();
  if (/en attente|attente|pending/i.test(s)) return 'En attente';
  if (/en cours|cours|en_cours|in progress/i.test(s)) return 'En cours';
  if (/terminé|termine|done|completed/i.test(s)) return 'Terminé';
  return 'En attente';
}

export function parseDateToDbFormat(dateStr: string): string {
  if (!dateStr || !String(dateStr).trim()) return '';
  const raw = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}(T|\s|$)/.test(raw)) {
    const isoDate = raw.slice(0, 10);
    const date = new Date(isoDate);
    if (!isNaN(date.getTime())) return date.toISOString();
  }
  const parts = raw.split(/[/\-.]/).map((p) => p.trim());
  if (parts.length === 3) {
    const [a, b, c] = parts;
    const y = c.length === 4 ? c : a.length === 4 ? a : null;
    const iso =
      y === c
        ? `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`
        : y === a
          ? `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`
          : `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
    const date = new Date(iso);
    if (!isNaN(date.getTime())) return date.toISOString();
  }
  const date = new Date(raw);
  if (!isNaN(date.getTime())) return date.toISOString();
  return '';
}

export function getFallbackMapping(headers: string[], type: ImportType): Record<string, string> {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  const etude: Record<string, string> = {
    'n° étude': 'numeroEtude',
    'no étude': 'numeroEtude',
    'numero etude': 'numeroEtude',
    'n° etude': 'numeroEtude',
    'client / entreprise': 'company',
    client: 'company',
    entreprise: 'company',
    'client/entreprise': 'company',
    ville: 'location',
    lieu: 'location',
    début: 'startDate',
    'date début': 'startDate',
    'date de début': 'startDate',
    date: 'startDate',
    fin: 'endDate',
    'date fin': 'endDate',
    'date de fin': 'endDate',
    'nb consultants': 'consultantCount',
    consultants: 'consultantCount',
    'nb consultant': 'consultantCount',
    heures: 'hours',
    "chargé d'études": 'chargeName',
    'charge etudes': 'chargeName',
    "chargé d'etudes": 'chargeName',
    chargé: 'chargeName',
    charge: 'chargeName',
    'chargé detudes': 'chargeName',
    'charge detudes': 'chargeName',
    "chargé d'étude": 'chargeName',
    'charge étude': 'chargeName',
    'montant facture': 'montantFacture',
    statut: 'status',
  };
  const mission: Record<string, string> = {
    'n° mission': 'numeroMission',
    'no mission': 'numeroMission',
    'numero mission': 'numeroMission',
    entreprise: 'company',
    client: 'company',
    titre: 'title',
    intitulé: 'title',
    lieu: 'location',
    ville: 'location',
    'date début': 'startDate',
    début: 'startDate',
    'date de début': 'startDate',
    'date fin': 'endDate',
    fin: 'endDate',
    'date de fin': 'endDate',
    étudiants: 'studentCount',
    etudiants: 'studentCount',
    'nb étudiants': 'studentCount',
    heures: 'hours',
    chargé: 'chargeName',
    charge: 'chargeName',
    'chargé de mission': 'chargeName',
    'charge de mission': 'chargeName',
    'prix ht': 'priceHT',
    prixht: 'priceHT',
    'total ttc': 'totalTTC',
    totalttc: 'totalTTC',
    'montant facture': 'totalTTC',
    'facture ttc': 'totalTTC',
    'montant ttc': 'totalTTC',
    facture: 'totalTTC',
    statut: 'status',
    étape: 'etape',
    etape: 'etape',
    salary: 'salary',
    rémunération: 'salary',
    remuneration: 'salary',
    mandat: 'mandat',
    type: 'type',
  };
  const map = type === 'etude' ? etude : mission;
  const out: Record<string, string> = {};
  headers.forEach((h) => {
    const n = normalize(h);
    if (map[n]) out[h] = map[n];
    else if (type === 'etude' && (n === 'numeroetude' || n === 'n etude' || n === 'n° etude'))
      out[h] = 'numeroEtude';
    else if (type === 'mission' && (n === 'numero mission' || n === 'n mission')) out[h] = 'numeroMission';
  });
  return out;
}

export function applyMapping(
  rows: Record<string, unknown>[],
  mapping: Record<string, string>
): Record<string, unknown>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [csvH, internalKey] of Object.entries(mapping)) {
      if (row[csvH] !== undefined) out[internalKey] = row[csvH];
    }
    return out;
  });
}

export type SpreadsheetImportMatchContext = {
  users: any[];
  companies: any[];
  contacts: any[];
  missionTypes: any[];
};

export type UseSpreadsheetImportPreviewOptions = {
  structureId: string | null;
  structureType: 'junior' | 'jobservice';
  matchContext: SpreadsheetImportMatchContext;
  currentUserId?: string | null;
  fallbackChargeUser?: { displayName?: string; firstName?: string; lastName?: string } | null;
  onError?: (message: string) => void;
};

function buildImportedDataFromRows(
  rows: Record<string, unknown>[],
  opts: {
    structureId: string | null;
    structureType: 'junior' | 'jobservice';
    users: any[];
    companies: any[];
    contacts: any[];
    missionTypes: any[];
    currentUserId?: string | null;
    fallbackChargeUser?: { displayName?: string; firstName?: string; lastName?: string } | null;
  }
): Record<string, unknown>[] {
  const {
    structureId,
    structureType,
    users,
    companies,
    contacts,
    missionTypes,
    currentUserId,
    fallbackChargeUser,
  } = opts;

  if (structureType === 'junior') {
    return rows.map((row: any) => {
      const rawChargeName = (row.chargeName || row.charge_etudes || row.charge_name || '')
        .toString()
        .trim();
      const matchedCharge = rawChargeName
        ? findBestMatch(rawChargeName, users, ['displayName', 'firstName', 'lastName'])
        : null;
      const startDateRaw = (row.startDate || row.start_date || row.dateDebut || row.debut || '')
        .toString()
        .trim();
      const endDateRaw = (row.endDate || row.end_date || row.dateFin || row.fin || '')
        .toString()
        .trim();
      const parsedStart = parseDateToDbFormat(startDateRaw);
      const parsedEnd = parseDateToDbFormat(endDateRaw);
      return {
        numeroEtude: row.numeroEtude || '',
        company: row.company || '',
        location: row.location || '',
        startDate: parsedStart || parsedEnd,
        endDate: parsedEnd,
        consultantCount: parseInt(row.consultantCount) || 0,
        hours: parseInt(row.hours) || 0,
        status: normalizeStatusEtude((row.status || 'En attente').toString()),
        structureId: structureId || '',
        chargeId: matchedCharge ? matchedCharge.id : currentUserId || '',
        chargeName: matchedCharge
          ? getSafeDisplayName(matchedCharge)
          : rawChargeName || getSafeDisplayName(fallbackChargeUser),
        isPublic: true,
        etape: 'Négociation' as const,
      };
    });
  }

  return rows.map((row: any) => {
    const studentCountVal =
      row.studentCount != null && row.studentCount !== ''
        ? parseInt(String(row.studentCount), 10)
        : 0;
    const hoursVal =
      row.hours != null && row.hours !== '' ? parseInt(String(row.hours), 10) : 0;
    const priceHTVal =
      row.priceHT != null && row.priceHT !== ''
        ? parseFloat(String(row.priceHT).replace(',', '.'))
        : undefined;
    const prixHTVal =
      row.prixHT != null && row.prixHT !== ''
        ? parseFloat(String(row.prixHT).replace(',', '.'))
        : priceHTVal;

    const rawChargeName = (row.chargeName || row.charge_name || '').toString().trim();
    const matchedCharge = findBestMatch(rawChargeName, users, [
      'displayName',
      'firstName',
      'lastName',
    ]);
    const rawCompanyName = (row.company || row.entreprise || '').toString().trim();
    const matchedCompany = findBestMatch(rawCompanyName, companies, ['name']);
    const rawContactName = (row.contact || row.contactName || '').toString().trim();
    const potentialContacts = matchedCompany
      ? contacts.filter((c) => c.companyId === matchedCompany.id)
      : contacts;
    const matchedContact = findBestMatch(rawContactName, potentialContacts, [
      'firstName',
      'lastName',
      'email',
    ]);
    const rawTypeName = (row.type || row.typeMission || '').toString().trim();
    const matchedType = findBestMatch(rawTypeName, missionTypes, ['name']);

    const rawStudents = (row.students || row.etudiants || '').toString().trim();
    const assignedStudents: { userId: string; name: string; hours: number }[] = [];
    if (rawStudents) {
      const studentEntries = rawStudents.split(';');
      for (const entry of studentEntries) {
        const [name, hours] = entry.split(':');
        const matchedStudent = findBestMatch(name?.trim(), users, [
          'displayName',
          'firstName',
          'lastName',
        ]);
        if (matchedStudent) {
          assignedStudents.push({
            userId: matchedStudent.id,
            name: getSafeDisplayName(matchedStudent),
            hours: hours ? parseFloat(String(hours).replace(',', '.')) : 0,
          });
        }
      }
    }

    const contactEmail = (
      row.contactEmail ||
      row.contact_email ||
      matchedContact?.email ||
      ''
    )
      .toString()
      .trim();
    const contactFirstName = (
      row.contactFirstName ||
      row.contact_firstName ||
      row.contactPrenom ||
      matchedContact?.firstName ||
      ''
    )
      .toString()
      .trim();
    const contactLastName = (
      row.contactLastName ||
      row.contact_lastName ||
      row.contactNom ||
      matchedContact?.lastName ||
      ''
    )
      .toString()
      .trim();
    const contactPhone = (
      row.contactPhone ||
      row.contact_phone ||
      row.contactTelephone ||
      matchedContact?.phone ||
      ''
    )
      .toString()
      .trim();
    const contactPosition = (
      row.contactPosition ||
      row.contact_position ||
      row.contactPoste ||
      matchedContact?.position ||
      ''
    )
      .toString()
      .trim();
    const contact =
      contactEmail || contactFirstName || contactLastName || contactPhone || contactPosition
        ? {
            email: contactEmail || undefined,
            firstName: contactFirstName || undefined,
            lastName: contactLastName || undefined,
            phone: contactPhone || undefined,
            position: contactPosition || undefined,
          }
        : undefined;

    const totalTTCVal =
      row.totalTTC != null && row.totalTTC !== ''
        ? parseFloat(String(row.totalTTC).replace(/\s/g, '').replace(',', '.'))
        : row.montantFacture != null && row.montantFacture !== ''
          ? parseFloat(String(row.montantFacture).replace(/\s/g, '').replace(',', '.'))
          : undefined;

    return {
      numeroMission: (row.numeroMission || row.numero_mission || '').toString().trim(),
      company: matchedCompany ? matchedCompany.name : rawCompanyName,
      companyId: matchedCompany ? matchedCompany.id : undefined,
      location: (row.location || row.lieu || '').toString().trim(),
      startDate: parseDateToDbFormat((row.startDate || row.start_date || row.dateDebut || '').toString()),
      endDate: parseDateToDbFormat((row.endDate || row.end_date || row.dateFin || '').toString()),
      studentCount: isNaN(studentCountVal) ? 0 : studentCountVal,
      hours: isNaN(hoursVal) ? 0 : hoursVal,
      status: normalizeStatus((row.status || row.statut || 'En attente').toString()),
      structureId: structureId || '',
      chargeId: matchedCharge ? matchedCharge.id : currentUserId || '',
      chargeName: matchedCharge
        ? getSafeDisplayName(matchedCharge)
        : rawChargeName || getSafeDisplayName(fallbackChargeUser),
      title: (row.title || row.titre || row.description || '').toString().trim(),
      description: (row.description || '').toString().trim(),
      priceHT: prixHTVal ?? priceHTVal,
      prixHT: prixHTVal ?? priceHTVal,
      totalTTC: totalTTCVal,
      missionTypeId: matchedType ? matchedType.id : undefined,
      type: matchedType ? matchedType.name : 'standard',
      salary: (row.salary || row.remuneration || '').toString().trim(),
      mandat: (row.mandat || '').toString().trim(),
      etape: normalizeEtape((row.etape || 'Négociation').toString()),
      isPublic: row.isPublic !== 'false' && row.isPublic !== '0',
      contactId: matchedContact ? matchedContact.id : undefined,
      contact,
      expenses: (row.expenses || row.depenses || '').toString(),
      expenseReportsAmount: row.expenseReports
        ? parseFloat(String(row.expenseReports).replace(',', '.'))
        : 0,
      assignedStudents,
      isImported: true,
      source: 'import_csv',
    };
  });
}

export function useSpreadsheetImportPreview(options: UseSpreadsheetImportPreviewOptions) {
  const {
    structureId,
    structureType,
    matchContext,
    currentUserId,
    fallbackChargeUser,
    onError,
  } = options;

  const importType: ImportType = structureType === 'junior' ? 'etude' : 'mission';
  const [importedData, setImportedData] = useState<Record<string, unknown>[]>([]);
  const [processingAI, setProcessingAI] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ImportValidationError[]>([]);
  const [duplicateHints, setDuplicateHints] = useState<DuplicateHint[]>([]);

  const resetPreview = useCallback(() => {
    setImportedData([]);
    setValidationErrors([]);
    setDuplicateHints([]);
    setProcessingAI(false);
  }, []);

  const processRawRows = useCallback(
    async (rawRows: Record<string, unknown>[]) => {
      if (!structureId) {
        onError?.('Structure non chargée');
        return;
      }
      if (!rawRows.length) {
        setImportedData([]);
        setValidationErrors([]);
        setDuplicateHints([]);
        return;
      }
      setProcessingAI(true);
      setValidationErrors([]);
      setDuplicateHints([]);
      try {
        const type: ImportType = structureType === 'junior' ? 'etude' : 'mission';
        const expectedKeys =
          type === 'etude'
            ? [
                'numeroEtude',
                'company',
                'location',
                'startDate',
                'endDate',
                'consultantCount',
                'hours',
                'chargeName',
                'montantFacture',
                'status',
              ]
            : [
                'numeroMission',
                'company',
                'title',
                'location',
                'startDate',
                'endDate',
                'studentCount',
                'hours',
                'chargeName',
                'priceHT',
                'totalTTC',
                'salary',
                'mandat',
                'status',
                'etape',
              ];
        const headers = (Object.keys(rawRows[0] as Record<string, unknown>) as string[]).filter(
          (h) => String(h ?? '').trim() !== ''
        );
        const needMapping =
          headers.length > 0 && !headers.every((h: string) => expectedKeys.includes(h));

        let rowsWithInternalKeys: Record<string, unknown>[] = rawRows;
        if (needMapping) {
          let mapping: Record<string, string> = {};
          try {
            if (headers.length > 0) {
              const functions = getFunctions();
              const getMapping = httpsCallable<
                { type: ImportType; headers: string[]; structureId: string },
                { mapping: Record<string, string> }
              >(functions, 'getImportColumnMapping');
              const res = await getMapping({ type, headers, structureId });
              const data = res.data as { mapping?: Record<string, string> };
              mapping = data?.mapping ?? {};
            }
          } catch {
            mapping = headers.length > 0 ? getFallbackMapping(headers, type) : {};
          }
          if (Object.keys(mapping).length > 0) {
            rowsWithInternalKeys = applyMapping(rawRows, mapping);
          }
        }

        let normalized = rowsWithInternalKeys;
        let nextValidationErrors: ImportValidationError[] = [];
        try {
          const serializedRows = rowsWithInternalKeys.map((row) => {
            const o: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(row)) {
              if (v !== undefined && v !== null) o[k] = v;
            }
            return o;
          });
          const functions = getFunctions();
          const normalize = httpsCallable<
            { type: ImportType; rows: Record<string, unknown>[]; structureId: string },
            { normalizedRows: Record<string, unknown>[]; validationErrors: ImportValidationError[] }
          >(functions, 'normalizeAndValidateImportRows');
          const res = await normalize({ type, rows: serializedRows, structureId });
          const data = res.data as {
            normalizedRows?: Record<string, unknown>[];
            validationErrors?: ImportValidationError[];
          };
          normalized = Array.isArray(data?.normalizedRows) ? data.normalizedRows : rowsWithInternalKeys;
          nextValidationErrors = Array.isArray(data?.validationErrors) ? data.validationErrors : [];
        } catch {
          // Garder les lignes sans normalisation IA en cas d'erreur
        }

        const nextDuplicateHints = computeDuplicateHints(normalized, type);
        const built = buildImportedDataFromRows(normalized, {
          structureId,
          structureType,
          users: matchContext.users,
          companies: matchContext.companies,
          contacts: matchContext.contacts,
          missionTypes: matchContext.missionTypes,
          currentUserId,
          fallbackChargeUser,
        });
        setImportedData(built);
        setValidationErrors(nextValidationErrors);
        setDuplicateHints(nextDuplicateHints);
      } catch (err) {
        console.error('Erreur traitement import IA:', err);
        onError?.(
          'Erreur lors du traitement des données (mapping ou IA). Vous pouvez utiliser le modèle CSV.'
        );
        setImportedData([]);
      } finally {
        setProcessingAI(false);
      }
    },
    [
      structureId,
      structureType,
      matchContext.users,
      matchContext.companies,
      matchContext.contacts,
      matchContext.missionTypes,
      currentUserId,
      fallbackChargeUser,
      onError,
    ]
  );

  return {
    importType,
    importedData,
    processingAI,
    validationErrors,
    duplicateHints,
    processRawRows,
    resetPreview,
    setImportedData,
  };
}
