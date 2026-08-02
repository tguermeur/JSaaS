#!/usr/bin/env node
/**
 * Bootstrap staging : superadmin + structure démo + entreprises/missions/étudiants.
 *
 * Usage :
 *   GOOGLE_APPLICATION_CREDENTIALS=.secrets-local/staging-admin-sa.json \
 *     node scripts/bootstrap-staging.mjs
 *
 * Garde-fou : refuse tout projet autre que js-connect-staging.
 */
import { createRequire } from 'module';
import { writeFileSync, mkdirSync } from 'fs';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), '../functions/package.json'));
const admin = require('firebase-admin');

const PROJECT_ID = process.env.STAGING_PROJECT_ID || 'js-connect-staging';
if (PROJECT_ID !== 'js-connect-staging') {
  console.error(`Refus : projet cible doit être js-connect-staging (reçu ${PROJECT_ID})`);
  process.exit(1);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Définis GOOGLE_APPLICATION_CREDENTIALS (clé Admin SDK staging).');
  process.exit(1);
}

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();
const auth = admin.auth();

const SUPERADMIN_EMAIL = process.env.STAGING_SUPERADMIN_EMAIL || 'staging-superadmin@jsconnect.test';
const STRUCTURE_ADMIN_EMAIL = process.env.STAGING_STRUCTURE_ADMIN_EMAIL || 'staging-admin@jsconnect.test';
const PASSWORD =
  process.env.STAGING_BOOTSTRAP_PASSWORD ||
  `Stg-${randomBytes(9).toString('base64url')}!`;

const FAKE_COMPANIES = [
  { name: 'TechVision SAS', city: 'Paris', postalCode: '75008', nSiret: '12345678901234' },
  { name: 'Innovation Partners', city: 'Lyon', postalCode: '69001', nSiret: '23456789012345' },
  { name: 'DataFlow Consulting', city: 'Nantes', postalCode: '44000', nSiret: '34567890123456' },
  { name: 'Stratégie & Croissance', city: 'Bordeaux', postalCode: '33000', nSiret: '45678901234567' },
  { name: 'Digital Solutions France', city: 'Lille', postalCode: '59000', nSiret: '56789012345678' },
];

const FAKE_STUDENTS = [
  { firstName: 'Alexandre', lastName: 'Moreau', email: 'alexandre.moreau@ecole.test' },
  { firstName: 'Camille', lastName: 'Lefebvre', email: 'camille.lefebvre@ecole.test' },
  { firstName: 'Julien', lastName: 'Simon', email: 'julien.simon@ecole.test' },
  { firstName: 'Manon', lastName: 'Laurent', email: 'manon.laurent@ecole.test' },
  { firstName: 'Nicolas', lastName: 'Michel', email: 'nicolas.michel@ecole.test' },
  { firstName: 'Océane', lastName: 'Garcia', email: 'oceane.garcia@ecole.test' },
];

const MISSION_TITLES = [
  'Audit processus',
  'Étude de marché',
  'Conseil stratégie',
  'Support événementiel',
  'Formation équipe',
  'Diagnostic organisationnel',
];
const ETAPES = ['Négociation', 'Recrutement', 'Date de mission', 'Facturation', 'Audit'];

const PAGE_IDS = [
  'dashboard', 'organization', 'mission', 'entreprises', 'documents', 'commercial', 'audit',
  'tresorerie', 'rh', 'ambassadors', 'users', 'permissions', 'encrypted-data',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

async function upsertAuthUser(email, password, displayName) {
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, { password, displayName, emailVerified: true });
    return existing.uid;
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    const created = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: true,
    });
    return created.uid;
  }
}

async function createDefaultPermissions(structureId) {
  const batch = db.batch();
  for (const pageId of PAGE_IDS) {
    batch.set(db.collection('structures').doc(structureId).collection('permissions').doc(pageId), {
      allowedRoles: ['admin_structure', 'admin'],
      allowedPoles: [],
      allowedMembers: [],
    });
    batch.set(db.collection('structures').doc(structureId).collection('permissions').doc(`${pageId}_read`), {
      allowedRoles: ['admin_structure', 'admin', 'membre'],
      allowedPoles: [],
      allowedMembers: [],
    });
  }
  await batch.commit();
}

async function main() {
  console.log(`=== Bootstrap staging (${PROJECT_ID}) ===`);

  const superUid = await upsertAuthUser(SUPERADMIN_EMAIL, PASSWORD, 'Staging Superadmin');
  await db.collection('users').doc(superUid).set(
    {
      email: SUPERADMIN_EMAIL,
      displayName: 'Staging Superadmin',
      firstName: 'Staging',
      lastName: 'Superadmin',
      status: 'superadmin',
      role: 'superadmin',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  await auth.setCustomUserClaims(superUid, {
    status: 'superadmin',
    role: 'superadmin',
    superadmin: true,
    structureId: null,
    updatedAt: Date.now(),
  });
  console.log(`✓ Superadmin ${SUPERADMIN_EMAIL} (${superUid})`);

  const structureRef = db.collection('structures').doc();
  const structureId = structureRef.id;
  const structureName = 'JS Staging Demo';
  await structureRef.set({
    id: structureId,
    name: structureName,
    nom: structureName,
    ecole: 'École Staging',
    email: STRUCTURE_ADMIN_EMAIL,
    emailDomains: ['@jsconnect.test'],
    domaines: ['@jsconnect.test'],
    structureType: 'jobservice',
    subscriptionStatus: 'active',
    hasActiveTrial: true,
    trialEndDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    createdBy: null,
    createdAt: new Date().toISOString(),
  });
  await createDefaultPermissions(structureId);
  console.log(`✓ Structure ${structureName} (${structureId})`);

  const adminUid = await upsertAuthUser(STRUCTURE_ADMIN_EMAIL, PASSWORD, 'Admin Staging Demo');
  await db.collection('users').doc(adminUid).set(
    {
      email: STRUCTURE_ADMIN_EMAIL,
      displayName: 'Admin Staging Demo',
      firstName: 'Admin',
      lastName: 'Staging',
      status: 'admin_structure',
      role: 'admin_structure',
      structureId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  await auth.setCustomUserClaims(adminUid, {
    status: 'admin_structure',
    role: 'admin_structure',
    structureId,
    updatedAt: Date.now(),
  });
  await structureRef.update({ createdBy: adminUid });
  console.log(`✓ Admin structure ${STRUCTURE_ADMIN_EMAIL} (${adminUid})`);

  const companyIds = [];
  const batch1 = db.batch();
  for (const c of FAKE_COMPANIES) {
    const ref = db.collection('companies').doc();
    batch1.set(ref, {
      ...c,
      structureId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      missionsCount: 0,
      totalRevenue: 0,
    });
    companyIds.push({ id: ref.id, name: c.name, city: c.city });
  }

  const studentIds = [];
  for (const s of FAKE_STUDENTS) {
    const ref = db.collection('users').doc();
    batch1.set(ref, {
      displayName: `${s.firstName} ${s.lastName}`,
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email,
      structureId,
      status: 'etudiant',
      ecole: 'École Staging',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    studentIds.push(ref.id);
  }
  await batch1.commit();
  console.log(`✓ ${companyIds.length} entreprises, ${studentIds.length} étudiants (Firestore only)`);

  const contactFirst = ['Marie', 'Thomas', 'Sophie', 'Lucas', 'Emma'];
  const contactLast = ['Martin', 'Bernard', 'Dubois', 'Petit', 'Robert'];
  const contactPos = ['Directrice achats', 'DRH', 'Responsable projet', 'Chef de projet', 'Directeur général'];
  const batchContacts = db.batch();
  let contactCount = 0;
  for (let i = 0; i < companyIds.length; i++) {
    for (let j = 0; j < 2; j++) {
      const first = contactFirst[(i + j) % contactFirst.length];
      const last = contactLast[(i + j) % contactLast.length];
      const ref = db.collection('contacts').doc();
      batchContacts.set(ref, {
        companyId: companyIds[i].id,
        structureId,
        firstName: first,
        lastName: last,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@entreprise-${i + 1}.test`,
        position: contactPos[(i + j) % contactPos.length],
        isDefault: j === 0,
        createdBy: adminUid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      contactCount += 1;
    }
  }
  await batchContacts.commit();
  console.log(`✓ ${contactCount} contacts`);

  const now = new Date();
  const mandat = `${now.getFullYear() - 1}-${now.getFullYear()}`;
  let missionCount = 0;
  for (let i = 0; i < 10; i++) {
    const company = companyIds[i % companyIds.length];
    const hours = 20 + (i % 5) * 8;
    const priceHT = hours * 16;
    await db.collection('missions').doc().set({
      numeroMission: `M-${String(now.getFullYear()).slice(-2)}-${String(i + 1).padStart(3, '0')}`,
      structureId,
      companyId: company.id,
      company: company.name,
      location: company.city,
      startDate: daysAgo(60 - i * 3),
      endDate: daysAgo(Math.max(0, 20 - i * 2)),
      description: `Mission de test staging : ${pick(MISSION_TITLES)} pour ${company.name}.`,
      title: pick(MISSION_TITLES),
      studentCount: 1 + (i % 3),
      hours,
      hoursPerStudent: String(Math.round(hours / (1 + (i % 3)))),
      chargeId: adminUid,
      chargeName: 'Admin Staging Demo',
      priceHT,
      totalHT: priceHT,
      tva: Math.round(priceHT * 0.2 * 100) / 100,
      totalTTC: Math.round(priceHT * 1.2 * 100) / 100,
      salary: '10',
      requiresCV: true,
      requiresMotivation: true,
      isPublished: true,
      isPublic: true,
      status: 'En cours',
      etape: pick(ETAPES),
      isArchived: i >= 8,
      mandat,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: adminUid,
      permissions: { viewers: [], editors: [adminUid] },
      invoiceStatus: 'pending',
    });
    missionCount += 1;
  }
  console.log(`✓ ${missionCount} missions`);

  const outDir = join(dirname(fileURLToPath(import.meta.url)), '../.secrets-local');
  mkdirSync(outDir, { recursive: true });
  const credsPath = join(outDir, 'staging-bootstrap.env');
  writeFileSync(
    credsPath,
    [
      '# Comptes bootstrap staging — NE PAS COMMITTER',
      `STAGING_URL=https://js-connect-staging.web.app`,
      `SUPERADMIN_EMAIL=${SUPERADMIN_EMAIL}`,
      `STRUCTURE_ADMIN_EMAIL=${STRUCTURE_ADMIN_EMAIL}`,
      `PASSWORD=${PASSWORD}`,
      `STRUCTURE_ID=${structureId}`,
      `SUPERADMIN_UID=${superUid}`,
      `STRUCTURE_ADMIN_UID=${adminUid}`,
      '',
    ].join('\n'),
    { mode: 0o600 }
  );

  console.log('\n=== Connexion ===');
  console.log(`URL              : https://js-connect-staging.web.app`);
  console.log(`Superadmin       : ${SUPERADMIN_EMAIL}`);
  console.log(`Admin structure  : ${STRUCTURE_ADMIN_EMAIL}`);
  console.log(`Mot de passe     : ${PASSWORD}`);
  console.log(`Structure ID     : ${structureId}`);
  console.log(`Credentials file : ${credsPath}`);
  console.log('\nAstuce : utilise l’admin structure pour le parcours métier ; le superadmin pour l’écran SuperAdmin.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
