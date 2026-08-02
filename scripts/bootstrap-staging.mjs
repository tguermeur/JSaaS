#!/usr/bin/env node
/**
 * Bootstrap COMPLET staging — purge puis recrée :
 * structure, permissions, superadmin, admin, membres, étudiants (Auth),
 * entreprises, contacts, missions, candidatures, notes, historique,
 * templates + assignations.
 *
 * Usage :
 *   GOOGLE_APPLICATION_CREDENTIALS=.secrets-local/staging-admin-sa.json \
 *     node scripts/bootstrap-staging.mjs
 */
import { createRequire } from 'module';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const require = createRequire(join(root, 'functions/package.json'));
const admin = require('firebase-admin');

const PROJECT_ID = process.env.STAGING_PROJECT_ID || 'js-connect-staging';
if (PROJECT_ID !== 'js-connect-staging') {
  console.error(`Refus : projet cible doit être js-connect-staging (reçu ${PROJECT_ID})`);
  process.exit(1);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Définis GOOGLE_APPLICATION_CREDENTIALS.');
  process.exit(1);
}

admin.initializeApp({
  projectId: PROJECT_ID,
  storageBucket: `${PROJECT_ID}.firebasestorage.app`,
});
const db = admin.firestore();
const auth = admin.auth();
const bucket = admin.storage().bucket();

const SUPERADMIN_EMAIL = process.env.STAGING_SUPERADMIN_EMAIL || 'staging-superadmin@jsconnect.test';
const STRUCTURE_ADMIN_EMAIL = process.env.STAGING_STRUCTURE_ADMIN_EMAIL || 'staging-admin@jsconnect.test';
const MEMBER_EMAILS = [
  'staging-membre1@jsconnect.test',
  'staging-membre2@jsconnect.test',
];

function loadOrCreatePassword() {
  const envPath = join(root, '.secrets-local/staging-bootstrap.env');
  if (existsSync(envPath)) {
    const m = readFileSync(envPath, 'utf8').match(/^PASSWORD=(.+)$/m);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return process.env.STAGING_BOOTSTRAP_PASSWORD || `Stg-${randomBytes(9).toString('base64url')}!`;
}
const PASSWORD = loadOrCreatePassword();

const PAGE_IDS = [
  'dashboard', 'organization', 'mission', 'entreprises', 'documents', 'commercial', 'audit',
  'tresorerie', 'rh', 'ambassadors', 'users', 'permissions', 'encrypted-data',
];

const FAKE_COMPANIES = [
  { name: 'TechVision SAS', city: 'Paris', postalCode: '75008', nSiret: '12345678901234', address: '12 rue de la Paix' },
  { name: 'Innovation Partners', city: 'Lyon', postalCode: '69001', nSiret: '23456789012345', address: '5 place Bellecour' },
  { name: 'DataFlow Consulting', city: 'Nantes', postalCode: '44000', nSiret: '34567890123456', address: '8 cours des 50 Otages' },
  { name: 'Stratégie & Croissance', city: 'Bordeaux', postalCode: '33000', nSiret: '45678901234567', address: '22 cours de l\'Intendance' },
  { name: 'Digital Solutions France', city: 'Lille', postalCode: '59000', nSiret: '56789012345678', address: '3 rue Faidherbe' },
  { name: 'Conseil Pro RH', city: 'Marseille', postalCode: '13001', nSiret: '67890123456789', address: '15 la Canebière' },
  { name: 'Agile Corp', city: 'Toulouse', postalCode: '31000', nSiret: '78901234567890', address: '9 place du Capitole' },
];

const FAKE_STUDENTS = [
  { firstName: 'Alexandre', lastName: 'Moreau', email: 'alexandre.moreau@ecole.test', program: 'Master Management', campus: 'Paris' },
  { firstName: 'Camille', lastName: 'Lefebvre', email: 'camille.lefebvre@ecole.test', program: 'Master Finance', campus: 'Paris' },
  { firstName: 'Julien', lastName: 'Simon', email: 'julien.simon@ecole.test', program: 'Master Marketing', campus: 'Lyon' },
  { firstName: 'Manon', lastName: 'Laurent', email: 'manon.laurent@ecole.test', program: 'Master RH', campus: 'Lyon' },
  { firstName: 'Nicolas', lastName: 'Michel', email: 'nicolas.michel@ecole.test', program: 'Master Data', campus: 'Nantes' },
  { firstName: 'Océane', lastName: 'Garcia', email: 'oceane.garcia@ecole.test', program: 'Master Strategy', campus: 'Bordeaux' },
  { firstName: 'Pierre', lastName: 'Roux', email: 'pierre.roux@ecole.test', program: 'Master Digital', campus: 'Lille' },
  { firstName: 'Quentin', lastName: 'Fournier', email: 'quentin.fournier@ecole.test', program: 'Master Consulting', campus: 'Marseille' },
  { firstName: 'Romane', lastName: 'Mercier', email: 'romane.mercier@ecole.test', program: 'Master Audit', campus: 'Toulouse' },
  { firstName: 'Sarah', lastName: 'Blanc', email: 'sarah.blanc@ecole.test', program: 'Master Innovation', campus: 'Paris' },
  { firstName: 'Théo', lastName: 'Girard', email: 'theo.girard@ecole.test', program: 'Master Ops', campus: 'Lyon' },
  { firstName: 'Inès', lastName: 'Bonnet', email: 'ines.bonnet@ecole.test', program: 'Master Supply', campus: 'Nantes' },
];

const MEMBERS = [
  { email: MEMBER_EMAILS[0], firstName: 'Léa', lastName: 'Dupont', displayName: 'Léa Dupont' },
  { email: MEMBER_EMAILS[1], firstName: 'Hugo', lastName: 'Bernard', displayName: 'Hugo Bernard' },
];

const CONTACT_FIRST = ['Marie', 'Thomas', 'Sophie', 'Lucas', 'Emma', 'Hugo', 'Léa'];
const CONTACT_LAST = ['Martin', 'Bernard', 'Dubois', 'Petit', 'Robert', 'Richard', 'Durand'];
const CONTACT_POS = ['Directrice achats', 'DRH', 'Responsable projet', 'Chef de projet', 'Responsable innovation', 'Directeur général', 'Responsable RH'];
const MISSION_TITLES = ['Audit processus', 'Étude de marché', 'Conseil stratégie', 'Support événementiel', 'Formation équipe', 'Diagnostic organisationnel', 'Accompagnement digital', 'Recrutement ciblé'];
const ETAPES = ['Négociation', 'Recrutement', 'Date de mission', 'Facturation', 'Audit', 'Archivé'];
const NOTE_CONTENTS = [
  "Point d'avancement : premier échange avec le client effectué.",
  'Relance client pour signature de la convention.',
  'Équipe constituée, démarrage prévu lundi.',
  'Facture envoyée, paiement attendu sous 15 jours.',
  'Mission livrée, bilan prévu avec le client.',
];

const DOCUMENT_TYPES_FOR_ASSIGN = [
  'proposition_commerciale',
  'lettre_mission',
  'facture',
  'convention_entreprise',
  'convention_etudiant',
  'avenant',
  'note_de_frais',
  'recapitulatif_mission',
];

const COLLECTIONS_BY_STRUCTURE = [
  'companies', 'contacts', 'missions', 'etudes', 'templates', 'templateAssignments',
  'applications', 'notes', 'history', 'workingHours', 'prospects', 'expenseNotes',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

async function deleteQuery(query, label) {
  let total = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await query.limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
  }
  if (total) console.log(`  purged ${label}: ${total}`);
  return total;
}

async function upsertAuthUser(email, password, displayName) {
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, { password, displayName, emailVerified: true });
    return existing.uid;
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    const created = await auth.createUser({ email, password, displayName, emailVerified: true });
    return created.uid;
  }
}

async function createDefaultPermissions(structureId) {
  const batch = db.batch();
  const rolesWrite = ['admin_structure', 'admin'];
  const rolesRead = ['admin_structure', 'admin', 'membre'];
  for (const pageId of PAGE_IDS) {
    const base = db.collection('structures').doc(structureId).collection('permissions');
    batch.set(base.doc(pageId), { allowedRoles: rolesWrite, allowedPoles: [], allowedMembers: [] });
    batch.set(base.doc(`${pageId}_read`), { allowedRoles: rolesRead, allowedPoles: [], allowedMembers: [] });
  }
  await batch.commit();
}

/** PDF minimal valide pour Storage / listing templates. */
function minimalPdfBuffer(title) {
  const content = `BT /F1 24 Tf 50 750 Td (${title.replace(/[()\\]/g, '')}) Tj ET`;
  const objects = [];
  objects.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');
  objects.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n');
  objects.push(
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n'
  );
  objects.push(`4 0 obj<< /Length ${content.length} >>stream\n${content}\nendstream\nendobj\n`);
  objects.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n');
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefPos = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

async function uploadTemplatePdf(structureId, fileName, title) {
  const path = `templates/${structureId}/${fileName}`;
  const file = bucket.file(path);
  await file.save(minimalPdfBuffer(title), {
    contentType: 'application/pdf',
    metadata: { cacheControl: 'public,max-age=3600' },
  });
  await file.makePublic().catch(() => {});
  // Signed URL fallback if makePublic fails
  try {
    const [url] = await file.getSignedUrl({ action: 'read', expires: '2030-01-01' });
    return { pdfUrl: url, fileName: path };
  } catch {
    return {
      pdfUrl: `https://storage.googleapis.com/${bucket.name}/${path}`,
      fileName: path,
    };
  }
}

async function purgeAll() {
  console.log('=== PURGE staging ===');
  const structures = await db.collection('structures').get();
  for (const s of structures.docs) {
    const sid = s.id;
    console.log(`Structure ${sid}`);
    const perms = await db.collection('structures').doc(sid).collection('permissions').get();
    if (!perms.empty) {
      const batch = db.batch();
      perms.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    await s.ref.delete();
  }

  for (const col of COLLECTIONS_BY_STRUCTURE) {
    await deleteQuery(db.collection(col), col);
  }
  // users firestore (keep nothing — recreate)
  await deleteQuery(db.collection('users'), 'users');

  // Auth users with @jsconnect.test / @ecole.test
  let nextPageToken;
  do {
    const list = await auth.listUsers(1000, nextPageToken);
    for (const u of list.users) {
      const email = u.email || '';
      if (email.endsWith('@jsconnect.test') || email.endsWith('@ecole.test')) {
        await auth.deleteUser(u.uid);
        console.log(`  deleted auth ${email}`);
      }
    }
    nextPageToken = list.pageToken;
  } while (nextPageToken);
}

async function main() {
  console.log(`=== Bootstrap COMPLET ${PROJECT_ID} ===`);
  await purgeAll();

  console.log('\n=== CREATE ===');

  // Superadmin
  const superUid = await upsertAuthUser(SUPERADMIN_EMAIL, PASSWORD, 'Staging Superadmin');
  await db.collection('users').doc(superUid).set({
    email: SUPERADMIN_EMAIL,
    displayName: 'Staging Superadmin',
    firstName: 'Staging',
    lastName: 'Superadmin',
    status: 'superadmin',
    role: 'superadmin',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await auth.setCustomUserClaims(superUid, {
    status: 'superadmin',
    role: 'superadmin',
    superadmin: true,
    structureId: null,
    updatedAt: Date.now(),
  });
  console.log(`✓ Superadmin ${SUPERADMIN_EMAIL}`);

  // Structure
  const structureRef = db.collection('structures').doc();
  const structureId = structureRef.id;
  const structureName = 'JS Staging Demo';
  await structureRef.set({
    id: structureId,
    name: structureName,
    nom: structureName,
    ecole: 'École Staging JS Connect',
    description: 'Structure de démonstration pour les tests staging.',
    address: '10 rue du Staging',
    city: 'Paris',
    country: 'France',
    postalCode: '75001',
    phone: '+33 1 23 45 67 89',
    email: STRUCTURE_ADMIN_EMAIL,
    website: 'https://js-connect-staging.web.app',
    emailDomains: ['@jsconnect.test', '@ecole.test'],
    domaines: ['@jsconnect.test', '@ecole.test'],
    structureType: 'jobservice',
    paymentTermsDays: 30,
    cotisationsEnabled: false,
    cotisationAmount: 0,
    defaultGratificationNet: 4.35,
    defaultGratificationBrute: 4.35,
    subscriptionStatus: 'active',
    hasActiveTrial: true,
    hasActiveSubscription: true,
    trialStartDate: new Date().toISOString(),
    trialEndDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await createDefaultPermissions(structureId);
  console.log(`✓ Structure ${structureName} (${structureId})`);

  // Admin structure
  const adminUid = await upsertAuthUser(STRUCTURE_ADMIN_EMAIL, PASSWORD, 'Admin Staging Demo');
  await db.collection('users').doc(adminUid).set({
    email: STRUCTURE_ADMIN_EMAIL,
    displayName: 'Admin Staging Demo',
    firstName: 'Admin',
    lastName: 'Staging',
    phone: '+33 6 11 22 33 44',
    status: 'admin_structure',
    role: 'admin_structure',
    structureId,
    ecole: 'École Staging JS Connect',
    city: 'Paris',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await auth.setCustomUserClaims(adminUid, {
    status: 'admin_structure',
    role: 'admin_structure',
    structureId,
    updatedAt: Date.now(),
  });
  await structureRef.update({ createdBy: adminUid });
  console.log(`✓ Admin structure ${STRUCTURE_ADMIN_EMAIL}`);

  // Membres (chargés de mission)
  const memberUids = [];
  for (const m of MEMBERS) {
    const uid = await upsertAuthUser(m.email, PASSWORD, m.displayName);
    await db.collection('users').doc(uid).set({
      email: m.email,
      displayName: m.displayName,
      firstName: m.firstName,
      lastName: m.lastName,
      status: 'membre',
      role: 'membre',
      structureId,
      ecole: 'École Staging JS Connect',
      phone: `+33 6 ${randInt(10, 99)} ${randInt(10, 99)} ${randInt(10, 99)} ${randInt(10, 99)}`,
      city: 'Paris',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await auth.setCustomUserClaims(uid, {
      status: 'membre',
      role: 'membre',
      structureId,
      updatedAt: Date.now(),
    });
    memberUids.push(uid);
    console.log(`✓ Membre ${m.email}`);
  }
  const chargeId = memberUids[0] || adminUid;
  const chargeName = MEMBERS[0]?.displayName || 'Admin Staging Demo';

  // Étudiants avec Auth
  const studentIds = [];
  for (const s of FAKE_STUDENTS) {
    const displayName = `${s.firstName} ${s.lastName}`;
    const uid = await upsertAuthUser(s.email, PASSWORD, displayName);
    await db.collection('users').doc(uid).set({
      email: s.email,
      displayName,
      firstName: s.firstName,
      lastName: s.lastName,
      status: 'etudiant',
      structureId,
      ecole: 'École Staging JS Connect',
      program: s.program,
      campus: s.campus,
      city: s.campus,
      graduationYear: String(new Date().getFullYear() + 1),
      phone: `+33 6 ${randInt(10, 99)} ${randInt(10, 99)} ${randInt(10, 99)} ${randInt(10, 99)}`,
      address: `${randInt(1, 50)} rue Étudiante`,
      postalCode: '75000',
      nationality: 'Française',
      gender: Math.random() > 0.5 ? 'F' : 'M',
      profileCompletion: 70,
      acceptsElectronicDocuments: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await auth.setCustomUserClaims(uid, {
      status: 'etudiant',
      structureId,
      updatedAt: Date.now(),
    });
    studentIds.push(uid);
  }
  console.log(`✓ ${studentIds.length} étudiants (Auth + Firestore)`);

  // Entreprises + contacts
  const companyIds = [];
  const contactIdsByCompany = {};
  const batch1 = db.batch();
  for (let i = 0; i < FAKE_COMPANIES.length; i++) {
    const c = FAKE_COMPANIES[i];
    const ref = db.collection('companies').doc();
    batch1.set(ref, {
      name: c.name,
      city: c.city,
      postalCode: c.postalCode,
      address: c.address,
      nSiret: c.nSiret,
      country: 'France',
      structureId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      missionsCount: 0,
      totalRevenue: 0,
    });
    companyIds.push({ id: ref.id, name: c.name, city: c.city });
    contactIdsByCompany[ref.id] = [];
  }
  await batch1.commit();

  const batch2 = db.batch();
  let contactCount = 0;
  for (let i = 0; i < companyIds.length; i++) {
    const companyId = companyIds[i].id;
    for (let j = 0; j < 2; j++) {
      const first = CONTACT_FIRST[(i + j) % CONTACT_FIRST.length];
      const last = CONTACT_LAST[(i + j) % CONTACT_LAST.length];
      const ref = db.collection('contacts').doc();
      batch2.set(ref, {
        companyId,
        structureId,
        firstName: first,
        lastName: last,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@entreprise-${i + 1}.test`,
        phone: `+33 1 ${randInt(10, 99)} ${randInt(10, 99)} ${randInt(10, 99)} ${randInt(10, 99)}`,
        position: CONTACT_POS[(i + j) % CONTACT_POS.length],
        isDefault: j === 0,
        createdBy: adminUid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      contactIdsByCompany[companyId].push(ref.id);
      contactCount++;
    }
  }
  await batch2.commit();
  console.log(`✓ ${companyIds.length} entreprises, ${contactCount} contacts`);

  // Missions
  const now = new Date();
  const currentMandat = `${now.getFullYear() - 1}-${now.getFullYear()}`;
  const pastMandat = `${now.getFullYear() - 2}-${now.getFullYear() - 1}`;
  const missionIds = [];
  const numMissions = 15;

  for (let i = 0; i < numMissions; i++) {
    const companyIndex = i % companyIds.length;
    const company = companyIds[companyIndex];
    const contacts = contactIdsByCompany[company.id] || [];
    const studentCount = 1 + (i % 3);
    const hours = studentCount * (8 + (i % 5) * 4);
    const priceHT = Math.round(hours * (14 + (i % 5)) * 100) / 100;
    const tva = Math.round(priceHT * 0.2 * 100) / 100;
    const isArchived = i >= numMissions - 3;
    const etape = isArchived ? 'Archivé' : ETAPES[i % (ETAPES.length - 1)];
    const ref = db.collection('missions').doc();
    missionIds.push(ref.id);
    await ref.set({
      numeroMission: `M-${String(now.getFullYear()).slice(-2)}-${String(i + 1).padStart(3, '0')}`,
      structureId,
      companyId: company.id,
      company: company.name,
      contactId: contacts[0] || null,
      location: company.city,
      startDate: daysAgo(90 - i * 4),
      endDate: daysAgo(Math.max(0, 40 - i * 2)),
      description: `Mission de test staging : ${MISSION_TITLES[i % MISSION_TITLES.length]} pour ${company.name}.`,
      title: MISSION_TITLES[i % MISSION_TITLES.length],
      studentCount,
      hours,
      hoursPerStudent: String(Math.round(hours / studentCount)),
      chargeId,
      chargeName,
      priceHT,
      totalHT: priceHT,
      tva,
      totalTTC: Math.round((priceHT + tva) * 100) / 100,
      salary: '10',
      requiresCV: true,
      requiresMotivation: true,
      isPublished: true,
      isPublic: true,
      status: 'En cours',
      etape,
      isArchived,
      mandat: isArchived ? pastMandat : currentMandat,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: adminUid,
      permissions: { viewers: [], editors: [adminUid, chargeId] },
      invoiceStatus: ['Facturation', 'Audit', 'Archivé'].includes(etape) ? 'paid' : 'pending',
    });
  }
  console.log(`✓ ${missionIds.length} missions`);

  // Applications + working hours + notes
  let apps = 0;
  let notes = 0;
  for (let m = 0; m < missionIds.length; m++) {
    const missionSnap = await db.collection('missions').doc(missionIds[m]).get();
    const mission = missionSnap.data();
    if (!mission || mission.isArchived) continue;

    const needed = mission.studentCount || 1;
    const shuffled = [...studentIds].sort(() => Math.random() - 0.5).slice(0, needed + 2);
    for (let a = 0; a < shuffled.length; a++) {
      const userId = shuffled[a];
      const u = (await db.collection('users').doc(userId).get()).data();
      const status = a < needed ? 'Acceptée' : pick(['En attente', 'Refusée']);
      const appRef = await db.collection('applications').add({
        missionId: missionIds[m],
        structureId,
        userId,
        userEmail: u?.email || '',
        userDisplayName: u?.displayName || '',
        status,
        submittedAt: new Date(Date.now() - randInt(1, 20) * 86400000),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      apps++;
      if (status === 'Acceptée') {
        for (let w = 0; w < randInt(2, 4); w++) {
          const d = new Date(mission.startDate);
          d.setDate(d.getDate() + w * 2);
          await db.collection('workingHours').add({
            applicationId: appRef.id,
            missionId: missionIds[m],
            structureId,
            userId,
            date: d.toISOString().split('T')[0],
            startTime: '09:00',
            endTime: '17:00',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
    }

    for (let n = 0; n < randInt(2, 3); n++) {
      await db.collection('notes').add({
        missionId: missionIds[m],
        missionNumber: mission.numeroMission,
        structureId,
        content: pick(NOTE_CONTENTS),
        createdBy: chargeId,
        createdByName: chargeName,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      notes++;
    }
  }
  console.log(`✓ ${apps} candidatures, ${notes} notes`);

  // Historique entreprises
  let hist = 0;
  for (const company of companyIds) {
    for (let h = 0; h < randInt(3, 5); h++) {
      await db.collection('history').add({
        companyId: company.id,
        structureId,
        type: pick(['creation', 'modification', 'mission', 'contact', 'note']),
        description: `Événement staging #${h + 1} pour ${company.name}`,
        createdBy: adminUid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      hist++;
    }
  }
  console.log(`✓ ${hist} entrées historique`);

  // Stats companies
  for (const company of companyIds) {
    const ms = await db.collection('missions').where('companyId', '==', company.id).get();
    const totalTTC = ms.docs.reduce((sum, d) => sum + (d.get('totalTTC') || 0), 0);
    await db.collection('companies').doc(company.id).update({
      missionsCount: ms.size,
      totalRevenue: totalTTC,
    });
  }

  // Templates + assignments
  const templateIdsByType = {};
  for (const docType of DOCUMENT_TYPES_FOR_ASSIGN) {
    const label = docType.replace(/_/g, ' ');
    const fileName = `${Date.now()}_${docType}.pdf`;
    const { pdfUrl, fileName: storedPath } = await uploadTemplatePdf(structureId, fileName, `Template ${label}`);
    const tRef = await db.collection('templates').add({
      name: `Template ${label} (staging)`,
      description: `Template de démonstration pour ${label}`,
      pdfUrl,
      fileName: storedPath,
      variables: [
        {
          id: 'var-mission-title',
          name: 'Titre mission',
          description: 'Titre de la mission',
          type: 'text',
          variableId: 'title',
          dataSource: 'missions',
          position: { x: 50, y: 100, page: 1 },
          fontSize: 12,
          width: 200,
          height: 20,
          textAlign: 'left',
          verticalAlign: 'top',
        },
      ],
      structureId,
      createdBy: adminUid,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    templateIdsByType[docType] = tRef.id;
    await db.collection('templateAssignments').doc(`${structureId}_${docType}`).set({
      structureId,
      documentType: docType,
      templateId: tRef.id,
      generationType: 'template',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  console.log(`✓ ${DOCUMENT_TYPES_FOR_ASSIGN.length} templates + assignations`);

  // Credentials
  const outDir = join(root, '.secrets-local');
  mkdirSync(outDir, { recursive: true });
  const credsPath = join(outDir, 'staging-bootstrap.env');
  writeFileSync(
    credsPath,
    [
      '# Comptes bootstrap staging — NE PAS COMMITTER',
      'STAGING_URL=https://js-connect-staging.web.app',
      `SUPERADMIN_EMAIL=${SUPERADMIN_EMAIL}`,
      `STRUCTURE_ADMIN_EMAIL=${STRUCTURE_ADMIN_EMAIL}`,
      `MEMBER1_EMAIL=${MEMBER_EMAILS[0]}`,
      `MEMBER2_EMAIL=${MEMBER_EMAILS[1]}`,
      `STUDENT_EMAIL_EXAMPLE=${FAKE_STUDENTS[0].email}`,
      `PASSWORD=${PASSWORD}`,
      `STRUCTURE_ID=${structureId}`,
      `SUPERADMIN_UID=${superUid}`,
      `STRUCTURE_ADMIN_UID=${adminUid}`,
      '',
    ].join('\n'),
    { mode: 0o600 }
  );

  console.log('\n=== RÉSUMÉ ===');
  console.log(`URL             : https://js-connect-staging.web.app`);
  console.log(`Structure       : ${structureName} (${structureId})`);
  console.log(`Superadmin      : ${SUPERADMIN_EMAIL}`);
  console.log(`Admin structure : ${STRUCTURE_ADMIN_EMAIL}`);
  console.log(`Membres         : ${MEMBER_EMAILS.join(', ')}`);
  console.log(`Étudiants       : ${FAKE_STUDENTS.length} (ex. ${FAKE_STUDENTS[0].email})`);
  console.log(`Mot de passe    : ${PASSWORD}  (tous les comptes)`);
  console.log(`Entreprises     : ${companyIds.length}`);
  console.log(`Missions        : ${missionIds.length}`);
  console.log(`Templates       : ${DOCUMENT_TYPES_FOR_ASSIGN.length}`);
  console.log(`Fichier         : ${credsPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
