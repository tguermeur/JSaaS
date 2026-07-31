/**
 * Script de seed pour créer des données de test complètes (missions, entreprises, contacts, étudiants factices).
 * À appeler depuis l'app (ex: SuperAdmin ou paramètres structure) avec structureId.
 * Déployé en v2 (même région que les autres callables : us-central1).
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// Données factices
const FAKE_COMPANIES = [
  { name: 'TechVision SAS', city: 'Paris', postalCode: '75008', nSiret: '12345678901234' },
  { name: 'Innovation Partners', city: 'Lyon', postalCode: '69001', nSiret: '23456789012345' },
  { name: 'DataFlow Consulting', city: 'Nantes', postalCode: '44000', nSiret: '34567890123456' },
  { name: 'Stratégie & Croissance', city: 'Bordeaux', postalCode: '33000', nSiret: '45678901234567' },
  { name: 'Digital Solutions France', city: 'Lille', postalCode: '59000', nSiret: '56789012345678' },
  { name: 'Conseil Pro RH', city: 'Marseille', postalCode: '13001', nSiret: '67890123456789' },
  { name: 'Agile Corp', city: 'Toulouse', postalCode: '31000', nSiret: '78901234567890' },
];

const FAKE_CONTACTS_FIRST = ['Marie', 'Thomas', 'Sophie', 'Lucas', 'Emma', 'Hugo', 'Léa'];
const FAKE_CONTACTS_LAST = ['Martin', 'Bernard', 'Dubois', 'Petit', 'Robert', 'Richard', 'Durand'];
const FAKE_POSITIONS = ['Directrice achats', 'DRH', 'Responsable projet', 'Chef de projet', 'Responsable innovation', 'Directeur général', 'Responsable RH'];

const FAKE_STUDENTS = [
  { firstName: 'Alexandre', lastName: 'Moreau', email: 'alexandre.moreau@ecole.test' },
  { firstName: 'Camille', lastName: 'Lefebvre', email: 'camille.lefebvre@ecole.test' },
  { firstName: 'Julien', lastName: 'Simon', email: 'julien.simon@ecole.test' },
  { firstName: 'Manon', lastName: 'Laurent', email: 'manon.laurent@ecole.test' },
  { firstName: 'Nicolas', lastName: 'Michel', email: 'nicolas.michel@ecole.test' },
  { firstName: 'Océane', lastName: 'Garcia', email: 'oceane.garcia@ecole.test' },
  { firstName: 'Pierre', lastName: 'Roux', email: 'pierre.roux@ecole.test' },
  { firstName: 'Quentin', lastName: 'Fournier', email: 'quentin.fournier@ecole.test' },
  { firstName: 'Romane', lastName: 'Mercier', email: 'romane.mercier@ecole.test' },
  { firstName: 'Sarah', lastName: 'Blanc', email: 'sarah.blanc@ecole.test' },
  { firstName: 'Théo', lastName: 'Girard', email: 'theo.girard@ecole.test' },
  { firstName: 'Inès', lastName: 'Bonnet', email: 'ines.bonnet@ecole.test' },
];

const ETAPES = ['Négociation', 'Recrutement', 'Date de mission', 'Facturation', 'Audit', 'Archivé'] as const;
const ETAPES_ETUDE = ['Négociation', 'Recrutement', 'Facturation', 'Audit'] as const;
const MISSION_TITLES = ['Audit processus', 'Étude de marché', 'Conseil stratégie', 'Support événementiel', 'Formation équipe', 'Diagnostic organisationnel', 'Accompagnement digital', 'Recrutement ciblé'];

// Contenus de notes factices (missions / études)
const FAKE_NOTE_CONTENTS = [
  "Point d'avancement : premier échange avec le client effectué, attente de la proposition.",
  "Relance client pour signature de la convention. RDV fixé la semaine prochaine.",
  "Équipe constituée, démarrage des interventions prévu lundi.",
  "Facture envoyée, paiement attendu sous 15 jours.",
  "Mission livrée, bilan prévu avec le client le mois prochain.",
  "Réunion de cadrage bien passée, périmètre validé.",
  "En attente du retour du client sur la version 2 du livrable.",
  "Note interne : vérifier les plannings des consultants avant de confirmer les dates.",
];

// Descriptions d'historique factices (entreprises)
const FAKE_HISTORY_TYPES = ['creation', 'modification', 'mission', 'contact', 'note'] as const;
const FAKE_HISTORY_DESCRIPTIONS: Record<typeof FAKE_HISTORY_TYPES[number], string[]> = {
  creation: [
    "Création de la fiche entreprise.",
    "Entreprise ajoutée au portefeuille après prise de contact.",
  ],
  modification: [
    "Mise à jour des coordonnées et du SIRET.",
    "Modification des informations de facturation.",
    "Changement d'adresse enregistré.",
  ],
  mission: [
    "Nouvelle mission/étude associée à l'entreprise.",
    "Signature de la convention pour une nouvelle mission.",
    "Mission clôturée et facturée.",
  ],
  contact: [
    "Nouveau contact ajouté (interlocuteur principal).",
    "Mise à jour du contact : changement de poste.",
  ],
  note: [
    "Note ajoutée après échange téléphonique.",
    "Compte-rendu de réunion enregistré.",
  ],
};

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function dateInPast(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

export const seedTestData = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentification requise');
  }
  const structureId = request.data?.structureId as string | undefined;
  if (!structureId || typeof structureId !== 'string') {
    throw new HttpsError('invalid-argument', 'structureId requis');
  }
  // structureType envoyé par le frontend (prioritaire) ou lu depuis le doc structure
  const requestStructureType = request.data?.structureType as string | undefined;

  const callerUid = request.auth.uid;
  const userDoc = await db.collection('users').doc(callerUid).get();
  const userData = userDoc.data();
  const isSuperAdmin = userData?.status === 'superadmin' || userData?.role === 'superadmin';
  const isAdminStructure = userData?.status === 'admin_structure' && userData?.structureId === structureId;
  const isAdmin = userData?.status === 'admin' && userData?.structureId === structureId;
  if (!isSuperAdmin && !isAdminStructure && !isAdmin) {
    throw new HttpsError('permission-denied', 'Droits insuffisants pour lancer le seed sur cette structure');
  }

  const structureRef = db.collection('structures').doc(structureId);
  const structureSnap = await structureRef.get();
  if (!structureSnap.exists) {
    throw new HttpsError('not-found', 'Structure non trouvée');
  }
  const structureData = structureSnap.data();
  // Priorité : donnée envoyée par le frontend (ce que l'admin voit) > doc Firestore > défaut jobservice (missions)
  const structureType = (requestStructureType || (structureData?.structureType as string | undefined) || 'jobservice').toLowerCase();
  const isJunior = structureType === 'junior';

  // Récupérer un chargé de mission existant pour la structure (sinon utiliser callerUid)
  const membersSnap = await db.collection('users')
    .where('structureId', '==', structureId)
    .where('status', 'in', ['membre', 'admin', 'admin_structure'])
    .limit(1)
    .get();
  const chargeId = membersSnap.empty ? callerUid : membersSnap.docs[0].id;
  const chargeData = membersSnap.empty ? userData : membersSnap.docs[0].data();
  const chargeName = chargeData?.displayName || chargeData?.firstName && chargeData?.lastName
    ? `${chargeData.firstName} ${chargeData.lastName}`.trim()
    : 'Chargé de mission';

  const batch = db.batch();
  const companyIds: string[] = [];
  const contactIdsByCompany: Record<string, string[]> = {};
  const studentIds: string[] = [];

  // 1) Companies
  for (let i = 0; i < FAKE_COMPANIES.length; i++) {
    const c = FAKE_COMPANIES[i];
    const ref = db.collection('companies').doc();
    batch.set(ref, {
      name: c.name,
      city: c.city,
      postalCode: c.postalCode,
      nSiret: c.nSiret,
      structureId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      missionsCount: 0,
      totalRevenue: 0,
    });
    companyIds.push(ref.id);
    contactIdsByCompany[ref.id] = [];
  }

  // 2) Contacts (2 par entreprise) — garder les ref.id pour les missions
  for (let i = 0; i < companyIds.length; i++) {
    const companyId = companyIds[i];
    for (let j = 0; j < 2; j++) {
      const contactRef = db.collection('contacts').doc();
      const first = randomChoice(FAKE_CONTACTS_FIRST);
      const last = randomChoice(FAKE_CONTACTS_LAST);
      const pos = randomChoice(FAKE_POSITIONS);
      batch.set(contactRef, {
        companyId,
        structureId,
        firstName: first,
        lastName: last,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@entreprise-${i + 1}.fr`,
        position: pos,
        isDefault: j === 0,
        createdBy: callerUid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      contactIdsByCompany[companyId].push(contactRef.id);
    }
  }

  // 3) Users factices (étudiants) — documents Firestore uniquement
  for (let i = 0; i < FAKE_STUDENTS.length; i++) {
    const s = FAKE_STUDENTS[i];
    const ref = db.collection('users').doc();
    const displayName = `${s.firstName} ${s.lastName}`;
    batch.set(ref, {
      displayName,
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email,
      structureId,
      status: 'etudiant',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ecole: structureSnap.data()?.ecole || structureSnap.data()?.nom || 'École test',
    });
    studentIds.push(ref.id);
  }

  await batch.commit();

  // 4) Missions ou Études selon le type de structure (12–18 items)
  const missionIds: string[] = [];
  const etudeIds: string[] = [];
  const numItems = randomInt(12, 18);
  const now = new Date();
  const currentMandat = `${now.getFullYear() - 1}-${now.getFullYear()}`;
  const pastMandat = `${now.getFullYear() - 2}-${now.getFullYear() - 1}`;

  if (isJunior) {
    // Junior Entreprise : créer des études (collection etudes)
    for (let i = 0; i < numItems; i++) {
      const companyIndex = i % companyIds.length;
      const companyId = companyIds[companyIndex];
      const companyName = FAKE_COMPANIES[companyIndex].name;
      const contacts = contactIdsByCompany[companyId] || [];
      const contactId = contacts[0] || null;

      const consultantCount = randomInt(1, 4);
      const hours = consultantCount * randomInt(8, 40);
      const prixHT = Math.round((hours * (14 + Math.random() * 8)) * 100) / 100;
      const isArchived = i >= numItems - 4;
      const etape = isArchived ? 'Audit' : randomChoice([...ETAPES_ETUDE]);
      const startDate = dateInPast(randomInt(30, 400));
      const endDate = dateInPast(randomInt(0, 350));
      const numeroEtude = `E-${String(now.getFullYear()).slice(-2)}-${String(i + 1).padStart(3, '0')}`;
      const ref = db.collection('etudes').doc();
      etudeIds.push(ref.id);

      await ref.set({
        numeroEtude,
        structureId,
        companyId,
        company: companyName,
        contactId: contactId || undefined,
        location: FAKE_COMPANIES[companyIndex].city,
        startDate,
        endDate,
        description: `Étude de test: ${randomChoice(MISSION_TITLES)} pour ${companyName}.`,
        consultantCount,
        hours,
        chargeId,
        chargeName,
        prixHT,
        jeh: 10,
        requiresCV: true,
        requiresMotivation: true,
        isPublic: true,
        status: 'En cours',
        etape,
        isArchived,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: callerUid,
        permissions: { viewers: [], editors: [callerUid] },
      });
    }
  } else {
    // Junior Société : créer des missions (collection missions)
    for (let i = 0; i < numItems; i++) {
      const companyIndex = i % companyIds.length;
      const companyId = companyIds[companyIndex];
      const companyName = FAKE_COMPANIES[companyIndex].name;
      const contacts = contactIdsByCompany[companyId] || [];
      const contactId = contacts[0] || null;

      const studentCount = randomInt(1, 4);
      const hours = studentCount * randomInt(8, 40);
      const priceHT = Math.round((hours * (14 + Math.random() * 8)) * 100) / 100;
      const tva = Math.round(priceHT * 0.2 * 100) / 100;
      const totalTTC = Math.round((priceHT + tva) * 100) / 100;
      const totalHT = priceHT;

      const isArchived = i >= numItems - 4;
      const etape = isArchived ? 'Archivé' : randomChoice([...ETAPES].filter(e => e !== 'Archivé'));
      const startDate = dateInPast(randomInt(30, 400));
      const endDate = dateInPast(randomInt(0, 350));
      const ref = db.collection('missions').doc();
      missionIds.push(ref.id);

      await ref.set({
        numeroMission: `M-${String(now.getFullYear()).slice(-2)}-${String(i + 1).padStart(3, '0')}`,
        structureId,
        companyId,
        company: companyName,
        contactId: contactId || undefined,
        location: FAKE_COMPANIES[companyIndex].city,
        startDate,
        endDate,
        description: `Mission de test: ${randomChoice(MISSION_TITLES)} pour ${companyName}.`,
        title: randomChoice(MISSION_TITLES),
        studentCount,
        hours,
        hoursPerStudent: String(Math.round(hours / studentCount)),
        chargeId,
        chargeName,
        priceHT,
        totalHT,
        totalTTC,
        tva,
        salary: '10',
        requiresCV: true,
        requiresMotivation: true,
        isPublished: true,
        isPublic: true,
        status: 'En cours',
        etape,
        isArchived,
        mandat: isArchived && Math.random() > 0.5 ? pastMandat : currentMandat,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: callerUid,
        permissions: { viewers: [], editors: [callerUid] },
        invoiceStatus: etape === 'Facturation' || etape === 'Audit' || etape === 'Archivé' ? 'paid' : 'pending',
      });
    }
  }

  // 5) Applications (candidatures) pour une partie des missions (JS uniquement)
  const applicationsCreated: number[] = [];
  for (let m = 0; m < missionIds.length; m++) {
    const missionRef = await db.collection('missions').doc(missionIds[m]).get();
    const missionData = missionRef.data();
    if (!missionRef.exists || !missionData || missionData.isArchived) continue;

    const studentCount = (missionData.studentCount as number) || 1;
    const numCandidates = Math.min(randomInt(0, studentCount + 2), studentIds.length);
    const shuffled = [...studentIds].sort(() => Math.random() - 0.5);
    const statuses: Array<'En attente' | 'Acceptée' | 'Refusée'> = ['En attente', 'Acceptée', 'Acceptée', 'Refusée'];

    for (let a = 0; a < numCandidates; a++) {
      const userId = shuffled[a];
      const userDoc = await db.collection('users').doc(userId).get();
      const u = userDoc.data();
      const status = a < studentCount ? 'Acceptée' : randomChoice(statuses);
      const submittedAt = new Date(Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000);
      await db.collection('applications').add({
        missionId: missionIds[m],
        userId,
        userEmail: u?.email || '',
        userDisplayName: u?.displayName || '',
        status,
        submittedAt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    applicationsCreated.push(numCandidates);
  }

  // 6) workingHours pour quelques applications acceptées (JS uniquement)
  if (missionIds.length > 0) {
    const applicationsSnap = await db.collection('applications')
      .where('status', '==', 'Acceptée')
      .limit(20)
      .get();
    for (const appDoc of applicationsSnap.docs.slice(0, 10)) {
    const appId = appDoc.id;
    const missionId = appDoc.get('missionId');
    const missionDoc = await db.collection('missions').doc(missionId).get();
    const mission = missionDoc.data();
    if (!mission?.startDate) continue;
    const start = new Date(mission.startDate as string);
    for (let w = 0; w < randomInt(1, 5); w++) {
      const d = new Date(start);
      d.setDate(d.getDate() + w * 2);
      const dateStr = d.toISOString().split('T')[0];
      await db.collection('workingHours').add({
        applicationId: appId,
        date: dateStr,
        startTime: '09:00',
        endTime: '17:00',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    }
  }

  // 7) Notes et historique factices
  let notesCreated = 0;
  let historyEntriesCreated = 0;

  if (isJunior && etudeIds.length > 0) {
    // Études : notes (etudeNotes) + historique (etudeHistory) par étude
    for (let e = 0; e < etudeIds.length; e++) {
      const etudeRef = await db.collection('etudes').doc(etudeIds[e]).get();
      const etudeData = etudeRef.data();
      const numeroEtude = (etudeData?.numeroEtude as string) || `E-${e + 1}`;
      const numNotes = randomInt(2, 4);
      for (let n = 0; n < numNotes; n++) {
        await db.collection('etudeNotes').add({
          etudeId: etudeIds[e],
          etudeNumber: numeroEtude,
          content: randomChoice(FAKE_NOTE_CONTENTS),
          createdBy: callerUid,
          createdByName: chargeName,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        notesCreated++;
      }
      const numHistory = randomInt(3, 6);
      for (let h = 0; h < numHistory; h++) {
        const action = randomChoice(['Création de l\'étude', 'Modification du périmètre', 'Avancement livrable', 'Note ajoutée', 'Facture envoyée', 'Étude clôturée']);
        await db.collection('etudeHistory').add({
          etudeId: etudeIds[e],
          date: new Date(Date.now() - randomInt(0, 90) * 24 * 60 * 60 * 1000).toISOString(),
          action,
          details: `${action} – ${randomChoice(FAKE_NOTE_CONTENTS)}`,
          type: 'etude',
          userId: callerUid,
          userName: chargeName,
        });
        historyEntriesCreated++;
      }
    }
  } else if (missionIds.length > 0) {
    // Missions : notes enrichies (2–4 par mission, contenu varié)
    for (let m = 0; m < missionIds.length; m++) {
      const missionRef = await db.collection('missions').doc(missionIds[m]).get();
      const missionData = missionRef.data();
      const numeroMission = (missionData?.numeroMission as string) || `M-${m + 1}`;
      const numNotes = randomInt(2, 4);
      for (let n = 0; n < numNotes; n++) {
        await db.collection('notes').add({
          missionId: missionIds[m],
          missionNumber: numeroMission,
          content: randomChoice(FAKE_NOTE_CONTENTS),
          createdBy: callerUid,
          createdByName: chargeName,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        notesCreated++;
      }
    }
  }

  // 8) Historique factice par entreprise (history avec companyId)
  for (let c = 0; c < companyIds.length; c++) {
    const companyId = companyIds[c];
    const numHistory = randomInt(4, 8);
    for (let h = 0; h < numHistory; h++) {
      const type = randomChoice([...FAKE_HISTORY_TYPES]);
      const descriptions = FAKE_HISTORY_DESCRIPTIONS[type];
      const description = randomChoice(descriptions);
      await db.collection('history').add({
        companyId,
        type,
        description,
        createdBy: callerUid,
      });
      historyEntriesCreated++;
    }
  }

  // 9) Mise à jour missionsCount/étudesCount et totalRevenue sur companies
  for (let i = 0; i < companyIds.length; i++) {
    const companyId = companyIds[i];
    if (isJunior) {
      const etudesSnap = await db.collection('etudes').where('companyId', '==', companyId).get();
      const totalRevenue = etudesSnap.docs.reduce((sum, d) => sum + (d.get('prixHT') || 0), 0);
      await db.collection('companies').doc(companyId).update({
        missionsCount: etudesSnap.size,
        totalRevenue,
      });
    } else {
      const missionsSnap = await db.collection('missions').where('companyId', '==', companyId).get();
      const totalTTC = missionsSnap.docs.reduce((sum, d) => sum + (d.get('totalTTC') || 0), 0);
      await db.collection('companies').doc(companyId).update({
        missionsCount: missionsSnap.size,
        totalRevenue: totalTTC,
      });
    }
  }

  return {
    success: true,
    message: 'Données de test créées avec succès',
    counts: {
      companies: companyIds.length,
      contacts: companyIds.length * 2,
      students: studentIds.length,
      missions: missionIds.length,
      etudes: etudeIds.length,
      applications: applicationsCreated.reduce((a, b) => a + b, 0),
      notes: notesCreated,
      historyEntries: historyEntriesCreated,
    },
  };
});
