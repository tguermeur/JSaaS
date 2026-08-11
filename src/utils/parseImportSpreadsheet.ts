/**
 * Parse un fichier CSV (Papa Parse) ou Excel .xlsx (SheetJS) en lignes objet.
 * Utilisable par l’import settings existant et le futur wizard onboarding.
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export type ParsedImportRow = Record<string, unknown>;

function isXlsxFile(file: File): boolean {
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();
  return (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    type.includes('spreadsheetml') ||
    type === 'application/vnd.ms-excel'
  );
}

function filterNonEmptyRows(rows: ParsedImportRow[]): ParsedImportRow[] {
  return rows.filter((row) =>
    Object.keys(row).some((k) => row[k] != null && String(row[k]).trim() !== '')
  );
}

function parseCsvFile(file: File): Promise<ParsedImportRow[]> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(filterNonEmptyRows((results.data as ParsedImportRow[]) || []));
      },
      error: () => {
        resolve([]);
      },
    });
  });
}

async function parseXlsxFile(file: File): Promise<ParsedImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<ParsedImportRow>(sheet, { defval: '' });
  return filterNonEmptyRows(rows);
}

/** Détecte CSV vs Excel et retourne des lignes { header: value }. */
export async function parseImportSpreadsheet(file: File): Promise<ParsedImportRow[]> {
  if (isXlsxFile(file)) {
    return parseXlsxFile(file);
  }
  return parseCsvFile(file);
}

export const IMPORT_SPREADSHEET_ACCEPT = {
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
} as const;
