import { useEffect, useState, useCallback, useMemo } from 'react';
import type { DashboardPeriodId } from './useDashboardPeriod';
import { useDashboardPeriodMetrics } from './useDashboardPeriodMetrics';
import {
  collection,
  query,
  where,
  getDocs,
  getCountFromServer,
  getDoc,
  doc,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { decryptUsersList } from '../utils/decryptUserUtils';
import type { Document, Folder } from '../types/document';

export interface DashboardMission {
  id: string;
  numeroMission: string;
  title: string;
  startDate: string;
  endDate: string;
  company: string;
  description: string;
  status?: string;
  chargeId?: string;
  chargeName?: string;
  totalTTC?: number;
  totalHT?: number;
  priceHT?: number;
  hours?: number;
  budget?: number;
  invoiceAmount?: number;
  invoiceStatus?: string;
  paidAt?: string;
  createdAt?: string;
  isArchived?: boolean;
  isEtude?: boolean;
  companyId?: string;
}

export interface DashboardStatistics {
  totalRevenue: number;
  totalMissions: number;
  activeMissions: number;
  totalStudents: number;
  totalJeh?: number;
  avgSatisfaction?: number;
  qualityAvgPercent?: number;
}

export interface DashboardCalendarEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  description?: string;
  structureId: string;
  createdBy: string;
  isCustomEvent: boolean;
  isRelanceReminder?: boolean;
}

const MISSION_LIST_LIMIT = 20;
const PAID_LIST_LIMIT = 100;
const ONGOING_LIST_LIMIT = 30;
const CALENDAR_EVENTS_LIMIT = 50;
const PROSPECTS_LIMIT = 10;
const RECENT_USERS_LIMIT = 10;
const CONNECTED_USERS_LIMIT = 20;

export type OngoingMissionItem = {
  id: string;
  numeroMission: string;
  chargeId?: string;
  chargeName: string;
  company: string;
};

export type ConnectedUserItem = {
  id: string;
  firstName: string;
  lastName: string;
  lastConnection: Date;
  isOnline: boolean;
  role: string;
  photoURL: string;
};

function toIsoDate(val: unknown): string {
  if (!val) return '';
  const v = val as { toDate?: () => Date };
  if (v.toDate && typeof v.toDate === 'function') return v.toDate().toISOString().split('T')[0];
  if (typeof val === 'string') return val.includes('T') ? val.split('T')[0] : val;
  return new Date(val as string | number).toISOString().split('T')[0];
}

function mapFirestoreToDashboardMission(
  id: string,
  data: Record<string, unknown>,
  opts: { isEtude: boolean }
): DashboardMission {
  const invoiceDoc =
    typeof data.invoiceDocument === 'object' && data.invoiceDocument
      ? (data.invoiceDocument as Record<string, unknown>)
      : undefined;
  const numero = opts.isEtude
    ? (data.numeroEtude as string) || ''
    : (data.numeroMission as string) || '';
  return {
    id,
    numeroMission: numero,
    title: (data.title as string) || (data.company as string) || (opts.isEtude ? 'Étude sans titre' : 'Mission sans titre'),
    startDate: toIsoDate(data.startDate),
    endDate: toIsoDate(data.endDate),
    company: (data.company as string) || '',
    description: (data.description as string) || '',
    status: data.status as string | undefined,
    chargeId: data.chargeId as string | undefined,
    chargeName: (data.chargeName as string) || 'Non assigné',
    totalTTC: typeof data.totalTTC === 'number' ? data.totalTTC : undefined,
    totalHT: typeof data.totalHT === 'number' ? data.totalHT : undefined,
    priceHT: typeof data.priceHT === 'number' ? data.priceHT : undefined,
    hours: typeof data.hours === 'number' ? data.hours : undefined,
    budget: typeof data.budget === 'number' ? data.budget : undefined,
    invoiceAmount:
      typeof data.invoiceAmount === 'number'
        ? data.invoiceAmount
        : typeof invoiceDoc?.invoiceAmount === 'number'
          ? invoiceDoc.invoiceAmount
          : undefined,
    invoiceStatus: data.invoiceStatus as string | undefined,
    paidAt: toIsoDate(data.paidAt) || toIsoDate(data.invoicePaidAt) || undefined,
    createdAt: toIsoDate(data.createdAt) || undefined,
    isArchived: data.isArchived as boolean | undefined,
    isEtude: opts.isEtude,
    companyId: data.companyId as string | undefined,
  };
}

function mergeMissionsById(...lists: DashboardMission[][]): DashboardMission[] {
  const map = new Map<string, DashboardMission>();
  lists.flat().forEach((m) => map.set(m.id, m));
  return Array.from(map.values());
}

async function fetchPaidItems(
  collectionName: 'missions' | 'etudes',
  structureId: string,
  isEtude: boolean
): Promise<DashboardMission[]> {
  const ref = collection(db, collectionName);
  const statuses = isEtude ? (['payee', 'paid'] as const) : (['paid', 'payee'] as const);
  try {
    const snap = await getDocs(
      query(ref, where('structureId', '==', structureId), where('invoiceStatus', 'in', [...statuses]), limit(PAID_LIST_LIMIT))
    );
    return snap.docs.map((d) => mapFirestoreToDashboardMission(d.id, d.data() as Record<string, unknown>, { isEtude }));
  } catch {
    // Index composite manquant : fallback scan + filtre client
    try {
      const snap = await getDocs(query(ref, where('structureId', '==', structureId), limit(PAID_LIST_LIMIT)));
      return snap.docs
        .filter((d) => {
          const s = String(d.data().invoiceStatus || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          return s === 'paid' || s === 'payee' || s === 'paye';
        })
        .map((d) => mapFirestoreToDashboardMission(d.id, d.data() as Record<string, unknown>, { isEtude }));
    } catch {
      return [];
    }
  }
}

function scheduleIdle(cb: () => void): void {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => cb(), { timeout: 2000 });
  } else {
    setTimeout(cb, 100);
  }
}

export function useDashboardData(
  currentUserId: string | undefined,
  userStructureId: string | undefined,
  userStatus: string | undefined,
  isEntreprise: boolean,
  period: DashboardPeriodId = 'mois'
) {
  const [loading, setLoading] = useState(true);
  const [structureType, setStructureType] = useState<'junior' | 'jobservice'>('jobservice');
  const [missions, setMissions] = useState<DashboardMission[]>([]);
  const [statistics, setStatistics] = useState<DashboardStatistics>({
    totalRevenue: 0,
    totalMissions: 0,
    activeMissions: 0,
    totalStudents: 0,
  });
  const [calendarEvents, setCalendarEvents] = useState<DashboardCalendarEvent[]>([]);
  const [pinnedDocuments, setPinnedDocuments] = useState<Document[]>([]);
  const [pinnedFolders, setPinnedFolders] = useState<Folder[]>([]);
  const [recentUsers, setRecentUsers] = useState<
    Array<{ id: string; firstName: string; lastName: string; email: string; createdAt: Date; photoURL?: string }>
  >([]);
  const [deferredLoading, setDeferredLoading] = useState(false);
  const [ongoingMissions, setOngoingMissions] = useState<OngoingMissionItem[]>([]);
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUserItem[]>([]);

  const loadPrimary = useCallback(async () => {
    if (!currentUserId || !db) {
      setLoading(false);
      return;
    }

    if (isEntreprise) {
      try {
        const missionsRef = collection(db, 'missions');
        const missionsQuery = query(missionsRef, where('companyId', '==', currentUserId), limit(MISSION_LIST_LIMIT));
        const missionsSnapshot = await getDocs(missionsQuery);
        const missionsList: DashboardMission[] = missionsSnapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            numeroMission: data.numeroMission || '',
            title: data.title || data.company || '',
            startDate: toIsoDate(data.startDate),
            endDate: toIsoDate(data.endDate),
            company: data.company || '',
            description: data.description || '',
            status: data.status,
            companyId: data.companyId,
          } as DashboardMission;
        });
        setMissions(missionsList);
        setStatistics({
          totalRevenue: 0,
          totalMissions: missionsList.length,
          activeMissions: missionsList.filter((m) => m.status !== 'terminee' && m.status !== 'completed').length,
          totalStudents: 0,
        });
      } catch (e) {
        console.error('[useDashboardData] entreprise', e);
      }
      setLoading(false);
      return;
    }

    if (!userStructureId) {
      setLoading(false);
      return;
    }

    try {
      const usersQuery = query(collection(db, 'users'), where('structureId', '==', userStructureId));
      const structureSnap = await getDoc(doc(db, 'structures', userStructureId));

      const st = structureSnap.exists() && structureSnap.data()?.structureType === 'junior' ? 'junior' : 'jobservice';
      setStructureType(st);
      const isJE = st === 'junior';

      const statsFromStructure = structureSnap.data()?.stats as
        | { totalRevenue?: number; activeMissionsCount?: number; totalMissionsCount?: number }
        | undefined;

      const [totalUsersCount, ...rest] = await Promise.all([
        getCountFromServer(usersQuery).then((s) => s.data().count),
        isJE
          ? (async () => {
              const etudesRef = collection(db, 'etudes');
              const [recentSnap, countSnap, paidList] = await Promise.all([
                getDocs(
                  query(
                    etudesRef,
                    where('structureId', '==', userStructureId),
                    orderBy('createdAt', 'desc'),
                    limit(MISSION_LIST_LIMIT)
                  )
                ).catch(() =>
                  getDocs(query(etudesRef, where('structureId', '==', userStructureId), limit(MISSION_LIST_LIMIT)))
                ),
                getCountFromServer(query(etudesRef, where('structureId', '==', userStructureId))).catch(() => ({
                  data: () => ({ count: 0 }),
                })),
                fetchPaidItems('etudes', userStructureId, true),
              ]);
              const totalRevenue = statsFromStructure?.totalRevenue ?? 0;
              const activeCount =
                statsFromStructure?.activeMissionsCount ??
                recentSnap.docs.filter((d) => d.data().isArchived !== true).length;
              const recentList: DashboardMission[] = recentSnap.docs
                .filter((d) => d.data().startDate)
                .map((d) => mapFirestoreToDashboardMission(d.id, d.data() as Record<string, unknown>, { isEtude: true }));
              const missionsList = mergeMissionsById(recentList, paidList);
              return { totalRevenue, missionsList, totalMissions: countSnap.data().count, activeMissions: activeCount, isJE: true };
            })()
          : (async () => {
              const missionsRef = collection(db, 'missions');
              const [recentSnap, countSnap, paidList] = await Promise.all([
                getDocs(
                  query(
                    missionsRef,
                    where('structureId', '==', userStructureId),
                    orderBy('createdAt', 'desc'),
                    limit(MISSION_LIST_LIMIT)
                  )
                ).catch(() =>
                  getDocs(query(missionsRef, where('structureId', '==', userStructureId), limit(MISSION_LIST_LIMIT)))
                ),
                getCountFromServer(query(missionsRef, where('structureId', '==', userStructureId))),
                fetchPaidItems('missions', userStructureId, false),
              ]);
              const totalRevenue = statsFromStructure?.totalRevenue ?? 0;
              const activeMissions =
                statsFromStructure?.activeMissionsCount ??
                recentSnap.docs.filter((d) => d.data().isArchived !== true).length;
              const recentList: DashboardMission[] = recentSnap.docs
                .filter((d) => d.data().startDate)
                .map((d) => mapFirestoreToDashboardMission(d.id, d.data() as Record<string, unknown>, { isEtude: false }));
              const missionsList = mergeMissionsById(recentList, paidList);
              return {
                totalRevenue,
                missionsList,
                totalMissions: countSnap.data().count,
                activeMissions,
                isJE: false,
              };
            })(),
        getDocs(
          query(
            collection(db, 'calendarEvents'),
            where('structureId', '==', userStructureId),
            limit(CALENDAR_EVENTS_LIMIT)
          )
        ),
        getDocs(
          query(
            collection(db, 'prospects'),
            where('structureId', '==', userStructureId),
            where('statut', '==', 'a_recontacter'),
            limit(PROSPECTS_LIMIT)
          )
        ),
      ]);

      const missionResult = rest[0] as {
        totalRevenue: number;
        missionsList: DashboardMission[];
        totalMissions: number;
        activeMissions: number;
        isJE: boolean;
      };
      const eventsSnapshot = rest[1];
      const prospectsSnapshot = rest[2];

      setMissions(missionResult.missionsList);
      setStatistics({
        totalRevenue: missionResult.totalRevenue,
        totalMissions: missionResult.totalMissions,
        activeMissions: missionResult.activeMissions,
        totalStudents: totalUsersCount,
      });

      const customEvents: DashboardCalendarEvent[] = eventsSnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const startDate = toIsoDate(data.startDate);
        const endDate = data.endDate ? toIsoDate(data.endDate) : startDate;
        return {
          id: docSnap.id,
          title: data.title || '',
          startDate,
          endDate,
          description: data.description || '',
          structureId: data.structureId || '',
          createdBy: data.createdBy || '',
          isCustomEvent: true,
        };
      });

      const relanceEvents: DashboardCalendarEvent[] = prospectsSnapshot.docs
        .filter((docSnap) => docSnap.data().dateRecontact)
        .map((docSnap) => {
          const data = docSnap.data();
          const dateStr = toIsoDate(data.dateRecontact);
          return {
            id: `relance-${docSnap.id}`,
            title: `Relance: ${data.nom || data.entreprise || 'Prospect'}`,
            startDate: dateStr,
            endDate: dateStr,
            description: data.notes || '',
            structureId: userStructureId,
            createdBy: '',
            isCustomEvent: true,
            isRelanceReminder: true,
          };
        });

      setCalendarEvents([...customEvents, ...relanceEvents]);
    } catch (e) {
      console.error('[useDashboardData] primary', e);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, userStructureId, isEntreprise]);

  const loadDeferred = useCallback(async () => {
    if (!userStructureId || isEntreprise || !db) return;
    setDeferredLoading(true);
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('structureId', '==', userStructureId),
        orderBy('createdAt', 'desc'),
        limit(RECENT_USERS_LIMIT)
      );
      const usersSnap = await getDocs(usersQuery).catch(() =>
        getDocs(query(collection(db, 'users'), where('structureId', '==', userStructureId), limit(RECENT_USERS_LIMIT)))
      );

      const usersList = usersSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          photoURL: data.photoURL,
        };
      });
      const decrypted = await decryptUsersList(usersList);
      setRecentUsers(
        decrypted.map((u) => ({
          id: u.id,
          firstName: u.firstName || '',
          lastName: u.lastName || '',
          email: (u as { email?: string }).email || '',
          createdAt: usersList.find((x) => x.id === u.id)?.createdAt || new Date(),
          photoURL: u.photoURL,
        }))
      );

      const docsRef = collection(db, 'structures', userStructureId, 'documents');
      const pinnedQuery = query(docsRef, where('isPinned', '==', true), limit(10));
      const pinnedSnap = await getDocs(pinnedQuery).catch(() => ({ docs: [] }));
      setPinnedDocuments(
        pinnedSnap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt } as Document))
      );

      const structureSnap = await getDoc(doc(db, 'structures', userStructureId));
      const isJE = structureSnap.exists() && structureSnap.data()?.structureType === 'junior';
      const collectionName = isJE ? 'etudes' : 'missions';
      const collRef = collection(db, collectionName);
      const ongoingSnap = await getDocs(
        query(
          collRef,
          where('structureId', '==', userStructureId),
          where('isArchived', '==', false),
          limit(ONGOING_LIST_LIMIT)
        )
      ).catch(() =>
        getDocs(query(collRef, where('structureId', '==', userStructureId), limit(ONGOING_LIST_LIMIT)))
      );

      const { getDecryptedUserDisplayName } = await import('../utils/decryptUserUtils');
      const ongoingList: OngoingMissionItem[] = [];
      for (const docSnap of ongoingSnap.docs) {
        const data = docSnap.data();
        if (data.isArchived === true) continue;
        let chargeName = data.chargeName || 'Non assigné';
        const chargeId = data.chargeId as string | undefined;
        if (chargeId && chargeName.startsWith('ENC:')) {
          try {
            const chargeDoc = await getDoc(doc(db, 'users', chargeId));
            chargeName = await getDecryptedUserDisplayName(chargeId, chargeDoc.data() || null);
          } catch {
            /* garde chargeName brut */
          }
        }
        ongoingList.push({
          id: docSnap.id,
          numeroMission: (isJE ? data.numeroEtude : data.numeroMission) || '',
          chargeId,
          chargeName,
          company: data.company || '',
        });
      }
      setOngoingMissions(ongoingList);

      const onlineSnap = await getDocs(
        query(
          collection(db, 'users'),
          where('structureId', '==', userStructureId),
          orderBy('lastActivity', 'desc'),
          limit(CONNECTED_USERS_LIMIT)
        )
      ).catch(() =>
        getDocs(
          query(collection(db, 'users'), where('structureId', '==', userStructureId), limit(CONNECTED_USERS_LIMIT))
        )
      );

      const now = new Date();
      const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);
      const usersRaw = onlineSnap.docs.map((d) => {
        const data = d.data();
        const lastActivityTimestamp = data.lastActivity || data.lastLogin;
        const lastActivity = lastActivityTimestamp?.toDate?.()
          ? lastActivityTimestamp.toDate()
          : new Date(lastActivityTimestamp || 0);
        return {
          id: d.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          lastConnection: lastActivity,
          isOnline: lastActivity > threeMinutesAgo,
          role: data.role || 'membre',
          photoURL: data.photoURL || '',
        };
      });
      setConnectedUsers(await decryptUsersList(usersRaw));
    } catch (e) {
      console.error('[useDashboardData] deferred', e);
    } finally {
      setDeferredLoading(false);
    }
  }, [userStructureId, isEntreprise]);

  useEffect(() => {
    setLoading(true);
    loadPrimary();
  }, [loadPrimary]);

  useEffect(() => {
    if (loading || isEntreprise) return;
    scheduleIdle(() => {
      void loadDeferred();
    });
  }, [loading, isEntreprise, loadDeferred]);

  const periodMetrics = useDashboardPeriodMetrics(missions, statistics, period);
  const missionsInPeriod = useMemo(() => periodMetrics.filteredMissions, [periodMetrics.filteredMissions]);

  return {
    loading,
    deferredLoading,
    structureType,
    missions,
    setMissions,
    statistics,
    setStatistics,
    calendarEvents,
    setCalendarEvents,
    pinnedDocuments,
    setPinnedDocuments,
    pinnedFolders,
    setPinnedFolders,
    recentUsers,
    ongoingMissions,
    connectedUsers,
    periodMetrics,
    missionsInPeriod,
    refreshPrimary: loadPrimary,
    refreshDeferred: loadDeferred,
  };
}
