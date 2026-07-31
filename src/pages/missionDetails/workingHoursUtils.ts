import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';

export type WorkingHourEntry = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  breaks: Array<{ start: string; end: string }>;
};

type WorkingHourBreak = { start: string; end: string };

export function parseWorkingHoursFromFirestoreDocs(
  docs: Array<{ id: string; data: () => Record<string, unknown> }>
): WorkingHourEntry[] {
  const entries: WorkingHourEntry[] = [];

  for (const docSnap of docs) {
    const data = docSnap.data();
    if (Array.isArray(data.hours)) {
      data.hours.forEach((hour: unknown, index: number) => {
        if (!hour || typeof hour !== 'object') return;
        const h = hour as Record<string, unknown>;
        if (!h.date || !h.startTime || !h.endTime) return;
        entries.push({
          id: `${docSnap.id}_${index}`,
          date: String(h.date),
          startTime: String(h.startTime),
          endTime: String(h.endTime),
          breaks: Array.isArray(h.breaks)
            ? (h.breaks as Array<{ start: string; end: string }>)
            : [],
        });
      });
    } else if (data.date && data.startTime && data.endTime) {
      entries.push({
        id: docSnap.id,
        date: String(data.date),
        startTime: String(data.startTime),
        endTime: String(data.endTime),
        breaks: Array.isArray(data.breaks)
          ? (data.breaks as Array<{ start: string; end: string }>)
          : [],
      });
    }
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

export async function fetchWorkingHoursForApplications(applicationIds: string[]): Promise<Map<string, WorkingHourEntry[]>> {
  const result = new Map<string, WorkingHourEntry[]>();
  if (applicationIds.length === 0) return result;

  const workingHoursRef = collection(db, 'workingHours');
  const docsByApp = new Map<string, Array<{ id: string; data: () => Record<string, unknown> }>>();

  for (let i = 0; i < applicationIds.length; i += 30) {
    const chunk = applicationIds.slice(i, i + 30);
    const snapshot = await getDocs(query(workingHoursRef, where('applicationId', 'in', chunk)));
    snapshot.docs.forEach((docSnap) => {
      const applicationId = docSnap.data().applicationId as string;
      if (!applicationId) return;
      const list = docsByApp.get(applicationId) || [];
      list.push(docSnap);
      docsByApp.set(applicationId, list);
    });
  }

  docsByApp.forEach((docs, applicationId) => {
    result.set(applicationId, parseWorkingHoursFromFirestoreDocs(docs));
  });

  return result;
}

export function buildWorkingHoursDocumentData(
  docs: Array<{ id: string; data: () => Record<string, unknown> }>
): { hours: Array<{ date: string; startTime: string; endTime: string; breaks: WorkingHourBreak[] }>; createdAt?: unknown; updatedAt?: unknown } | null {
  const entries = parseWorkingHoursFromFirestoreDocs(docs);
  if (entries.length === 0) return null;

  const metaDoc = docs.find((docSnap) => Array.isArray(docSnap.data().hours)) || docs[0];
  const meta = metaDoc.data();

  return {
    hours: entries.map(({ date, startTime, endTime, breaks }) => ({
      date,
      startTime,
      endTime,
      breaks,
    })),
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  };
}
