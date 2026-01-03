import { COMPLETE_TAG_LIBRARY } from '../pages/DocumentGenerator';

// Interface pour les données de remplacement
export interface ReplacementData {
  // Données de l'étude/mission
  etude?: {
    numeroMission?: string;
    title?: string;
    missionDescription?: string;
    missionStartDate?: string | Date;
    missionEndDate?: string | Date;
    location?: string;
    priceHT?: number;
    totalHT?: number;
    totalTTC?: number;
    tva?: number;
    hours?: number;
    studentCount?: number;
    hoursPerStudent?: string;
    status?: string;
    etape?: string;
    missionType?: string;
    createdAt?: string | Date;
    updatedAt?: string | Date;
  };

  // Données du chargé d'étude
  charge?: {
    chargeName?: string;
    chargeFirstName?: string;
    chargeLastName?: string;
    charge_email?: string;
    charge_phone?: string;
    chargeId?: string;
  };

  // Données de l'étudiant
  etudiant?: {
    lastName?: string;
    firstName?: string;
    displayName?: string;
    email?: string;
    phone?: string;
    ecole?: string;
    formation?: string;
    program?: string;
    graduationYear?: string;
    address?: string;
    city?: string;
    nationality?: string;
    gender?: string;
    birthDate?: string | Date;
    birthPlace?: string;
    socialSecurityNumber?: string;
    studentId?: string;
    studyLevel?: string;
    speciality?: string;
  };

  // Données de l'entreprise
  entreprise?: {
    companyName?: string;
    nSiret?: string;
    siren?: string;
    companyAddress?: string;
    companyCity?: string;
    companyPostalCode?: string;
    country?: string;
    companyPhone?: string;
    companyEmail?: string;
    website?: string;
    companyDescription?: string;
    sector?: string;
    size?: string;
  };

  // Données du contact
  contact?: {
    contact_lastName?: string;
    contact_firstName?: string;
    contact_fullName?: string;
    contact_email?: string;
    contact_phone?: string;
    contact_position?: string;
    contact_linkedin?: string;
  };

  // Données de la structure
  structure?: {
    structure_name?: string;
    structure_siret?: string;
    structure_address?: string;
    structure_city?: string;
    structure_postalCode?: string;
    structure_country?: string;
    structure_phone?: string;
    structure_email?: string;
    structure_website?: string;
    structure_tvaNumber?: string;
    structure_apeCode?: string;
  };

  // Données des frais
  frais?: {
    expenseAmount?: number;
    expenseDescription?: string;
    expenseDate?: string | Date;
    expenseStatus?: string;
    expenseType?: string;
  };

  // Données des heures
  heures?: {
    workingHoursDate?: string | Date;
    startTime?: string;
    endTime?: string;
    breaks?: string;
    totalHours?: string;
  };

  // Données des avenants
  avenant?: {
    amendmentNumber?: string;
    amendmentDate?: string | Date;
    amendmentReason?: string;
    amendmentNewEndDate?: string | Date;
    amendmentAdditionalHours?: string;
  };

  // Données de facturation
  facturation?: {
    invoiceNumber?: string;
    invoiceDate?: string | Date;
    invoiceDueDate?: string | Date;
    invoiceAmountHT?: number;
    invoiceAmountTTC?: number;
    invoiceTVA?: number;
  };
}

// Fonction utilitaire pour formater les dates
const formatDate = (date: string | Date | undefined): string => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';
  
  return dateObj.toLocaleDateString('fr-FR');
};

// Fonction utilitaire pour formater les montants
const formatAmount = (amount: number | undefined): string => {
  if (amount === undefined || amount === null) return '';
  return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`;
};

// Fonction utilitaire pour obtenir les données système
const getSystemData = () => {
  const now = new Date();
  return {
    currentDate: now.toLocaleDateString('fr-FR'),
    currentTime: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    currentYear: now.getFullYear().toString(),
    currentMonth: now.toLocaleDateString('fr-FR', { month: 'long' })
  };
};

// Fonction principale pour remplacer les balises dans un texte
export const replaceTagsInText = (text: string, data: ReplacementData): string => {
  if (!text) return '';

  let result = text;
  const systemData = getSystemData();

  // Parcourir toutes les balises de la bibliothèque
  COMPLETE_TAG_LIBRARY.forEach(tagInfo => {
    const { tag, variableId, category } = tagInfo;
    
    let value = '';

    // Récupérer la valeur selon la catégorie
    switch (category) {
      case 'Étude':
        value = getEtudeValue(variableId, data.etude);
        break;
      case 'Chargé d\'étude':
        value = getChargeValue(variableId, data.charge);
        break;
      case 'Étudiant':
        value = getEtudiantValue(variableId, data.etudiant);
        break;
      case 'Entreprise':
        value = getEntrepriseValue(variableId, data.entreprise);
        break;
      case 'Contact':
        value = getContactValue(variableId, data.contact);
        break;
      case 'Structure':
        value = getStructureValue(variableId, data.structure);
        break;
      case 'Frais':
        value = getFraisValue(variableId, data.frais);
        break;
      case 'Heures':
        value = getHeuresValue(variableId, data.heures);
        break;
      case 'Avenant':
        value = getAvenantValue(variableId, data.avenant);
        break;
      case 'Facturation':
        value = getFacturationValue(variableId, data.facturation);
        break;
      case 'Système':
        value = getSystemValue(variableId, systemData);
        break;
    }

    // Remplacer toutes les occurrences de la balise
    const regex = new RegExp(escapeRegExp(tag), 'g');
    result = result.replace(regex, value);
  });

  return result;
};

// Fonctions pour récupérer les valeurs par catégorie
const getEtudeValue = (variableId: string, data?: ReplacementData['etude']): string => {
  if (!data) return '';

  switch (variableId) {
    case 'numeroMission': return data.numeroMission || '';
    case 'title': return data.title || '';
    case 'missionDescription': return data.missionDescription || '';
    case 'missionStartDate': return formatDate(data.missionStartDate);
    case 'missionEndDate': return formatDate(data.missionEndDate);
    case 'location': return data.location || '';
    case 'priceHT': return formatAmount(data.priceHT);
    case 'totalHT': return formatAmount(data.totalHT);
    case 'totalTTC': return formatAmount(data.totalTTC);
    case 'tva': return formatAmount(data.tva);
    case 'hours': return data.hours ? `${data.hours}h` : '';
    case 'studentCount': return data.studentCount?.toString() || '';
    case 'hoursPerStudent': return data.hoursPerStudent || '';
    case 'status': return data.status || '';
    case 'etape': return data.etape || '';
    case 'missionType': return data.missionType || '';
    case 'createdAt': return formatDate(data.createdAt);
    case 'updatedAt': return formatDate(data.updatedAt);
    case 'generationDate': return new Date().toLocaleDateString('fr-FR');
    default: return '';
  }
};

const getChargeValue = (variableId: string, data?: ReplacementData['charge']): string => {
  if (!data) return '';

  switch (variableId) {
    case 'chargeName': return data.chargeName || '';
    case 'chargeFirstName': return data.chargeFirstName || '';
    case 'chargeLastName': return data.chargeLastName || '';
    case 'charge_email': return data.charge_email || '';
    case 'charge_phone': return data.charge_phone || '';
    case 'chargeId': return data.chargeId || '';
    default: return '';
  }
};

const getEtudiantValue = (variableId: string, data?: ReplacementData['etudiant']): string => {
  if (!data) return '';

  switch (variableId) {
    case 'lastName': return data.lastName || '';
    case 'firstName': return data.firstName || '';
    case 'displayName': return data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim();
    case 'email': return data.email || '';
    case 'phone': return data.phone || '';
    case 'ecole': return data.ecole || '';
    case 'formation': return data.formation || '';
    case 'program': return data.program || '';
    case 'graduationYear': return data.graduationYear || '';
    case 'address': return data.address || '';
    case 'city': return data.city || '';
    case 'nationality': return data.nationality || '';
    case 'gender': return data.gender || '';
    case 'birthDate': return formatDate(data.birthDate);
    case 'birthPlace': return data.birthPlace || '';
    case 'socialSecurityNumber': return data.socialSecurityNumber || '';
    case 'studentId': return data.studentId || '';
    case 'studyLevel': return data.studyLevel || '';
    case 'speciality': return data.speciality || '';
    default: return '';
  }
};

const getEntrepriseValue = (variableId: string, data?: ReplacementData['entreprise']): string => {
  if (!data) return '';

  switch (variableId) {
    case 'companyName': return data.companyName || '';
    case 'nSiret': return data.nSiret || '';
    case 'nsiret': return data.nSiret || '';
    case 'siren': return data.siren || '';
    case 'companyAddress': return data.companyAddress || '';
    case 'companyCity': return data.companyCity || '';
    case 'companyPostalCode': return data.companyPostalCode || '';
    case 'country': return data.country || '';
    case 'companyPhone': return data.companyPhone || '';
    case 'companyEmail': return data.companyEmail || '';
    case 'website': return data.website || '';
    case 'companyDescription': return data.companyDescription || '';
    case 'sector': return data.sector || '';
    case 'size': return data.size || '';
    default: return '';
  }
};

const getContactValue = (variableId: string, data?: ReplacementData['contact']): string => {
  if (!data) return '';

  switch (variableId) {
    case 'contact_lastName': return data.contact_lastName || '';
    case 'contact_firstName': return data.contact_firstName || '';
    case 'contact_fullName': return data.contact_fullName || `${data.contact_firstName || ''} ${data.contact_lastName || ''}`.trim();
    case 'contact_email': return data.contact_email || '';
    case 'contact_phone': return data.contact_phone || '';
    case 'contact_position': return data.contact_position || '';
    case 'contact_linkedin': return data.contact_linkedin || '';
    default: return '';
  }
};

const getStructureValue = (variableId: string, data?: ReplacementData['structure']): string => {
  if (!data) return '';

  switch (variableId) {
    case 'structure_name': return data.structure_name || '';
    case 'structure_siret': return data.structure_siret || '';
    case 'structure_address': return data.structure_address || '';
    case 'structure_city': return data.structure_city || '';
    case 'structure_postalCode': return data.structure_postalCode || '';
    case 'structure_country': return data.structure_country || '';
    case 'structure_phone': return data.structure_phone || '';
    case 'structure_email': return data.structure_email || '';
    case 'structure_website': return data.structure_website || '';
    case 'structure_tvaNumber': return data.structure_tvaNumber || '';
    case 'structure_apeCode': return data.structure_apeCode || '';
    default: return '';
  }
};

const getFraisValue = (variableId: string, data?: ReplacementData['frais']): string => {
  if (!data) return '';

  switch (variableId) {
    case 'expenseAmount': return formatAmount(data.expenseAmount);
    case 'expenseDescription': return data.expenseDescription || '';
    case 'expenseDate': return formatDate(data.expenseDate);
    case 'expenseStatus': return data.expenseStatus || '';
    case 'expenseType': return data.expenseType || '';
    default: return '';
  }
};

const getHeuresValue = (variableId: string, data?: ReplacementData['heures']): string => {
  if (!data) return '';

  switch (variableId) {
    case 'workingHoursDate': return formatDate(data.workingHoursDate);
    case 'startTime': return data.startTime || '';
    case 'endTime': return data.endTime || '';
    case 'breaks': return data.breaks || '';
    case 'totalHours': return data.totalHours || '';
    default: return '';
  }
};

const getAvenantValue = (variableId: string, data?: ReplacementData['avenant']): string => {
  if (!data) return '';

  switch (variableId) {
    case 'amendmentNumber': return data.amendmentNumber || '';
    case 'amendmentDate': return formatDate(data.amendmentDate);
    case 'amendmentReason': return data.amendmentReason || '';
    case 'amendmentNewEndDate': return formatDate(data.amendmentNewEndDate);
    case 'amendmentAdditionalHours': return data.amendmentAdditionalHours || '';
    default: return '';
  }
};

const getFacturationValue = (variableId: string, data?: ReplacementData['facturation']): string => {
  if (!data) return '';

  switch (variableId) {
    case 'invoiceNumber': return data.invoiceNumber || '';
    case 'invoiceDate': return formatDate(data.invoiceDate);
    case 'invoiceDueDate': return formatDate(data.invoiceDueDate);
    case 'invoiceAmountHT': return formatAmount(data.invoiceAmountHT);
    case 'invoiceAmountTTC': return formatAmount(data.invoiceAmountTTC);
    case 'invoiceTVA': return formatAmount(data.invoiceTVA);
    default: return '';
  }
};

const getSystemValue = (variableId: string, systemData: any): string => {
  switch (variableId) {
    case 'currentDate': return systemData.currentDate;
    case 'currentTime': return systemData.currentTime;
    case 'currentYear': return systemData.currentYear;
    case 'currentMonth': return systemData.currentMonth;
    default: return '';
  }
};

// Fonction utilitaire pour échapper les caractères spéciaux dans les regex
const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Fonction pour détecter les balises dans un texte
export const detectTagsInText = (text: string): string[] => {
  const detectedTags: string[] = [];
  const tagRegex = /<[^>]+>/g;
  const matches = text.match(tagRegex);
  
  if (matches) {
    matches.forEach(match => {
      // Vérifier si la balise existe dans notre bibliothèque
      const tagExists = COMPLETE_TAG_LIBRARY.some(tag => tag.tag === match);
      if (tagExists && !detectedTags.includes(match)) {
        detectedTags.push(match);
      }
    });
  }
  
  return detectedTags;
};

// Fonction pour valider si toutes les balises d'un texte sont reconnues
export const validateTags = (text: string): { valid: boolean; unrecognizedTags: string[] } => {
  const tagRegex = /<[^>]+>/g;
  const matches = text.match(tagRegex) || [];
  const unrecognizedTags: string[] = [];
  
  matches.forEach(match => {
    const tagExists = COMPLETE_TAG_LIBRARY.some(tag => tag.tag === match);
    if (!tagExists && !unrecognizedTags.includes(match)) {
      unrecognizedTags.push(match);
    }
  });
  
  return {
    valid: unrecognizedTags.length === 0,
    unrecognizedTags
  };
};

// Fonction pour obtenir des données d'exemple pour les tests
export const getExampleData = (): ReplacementData => {
  return {
    etude: {
      numeroMission: 'E2024-001',
      title: 'Développement d\'une application mobile',
      missionDescription: 'Création d\'une application mobile innovante pour la gestion des tâches',
      missionStartDate: new Date('2024-02-01'),
      missionEndDate: new Date('2024-04-30'),
      location: 'Paris',
      priceHT: 5000,
      totalHT: 5000,
      totalTTC: 6000,
      tva: 1000,
      hours: 200,
      studentCount: 4,
      hoursPerStudent: '50h',
      status: 'En cours',
      etape: 'Développement',
      missionType: 'Développement informatique'
    },
    charge: {
      chargeName: 'Jean Dupont',
      chargeFirstName: 'Jean',
      chargeLastName: 'Dupont',
      charge_email: 'jean.dupont@structure.fr',
      charge_phone: '01 23 45 67 89',
      chargeId: 'CDM001'
    },
    etudiant: {
      lastName: 'Martin',
      firstName: 'Marie',
      displayName: 'Marie Martin',
      email: 'marie.martin@ecole.fr',
      phone: '06 12 34 56 78',
      ecole: 'École Supérieure de Commerce',
      formation: 'Master Marketing Digital',
      program: 'PGE',
      graduationYear: '2024',
      address: '123 rue de la Paix',
      city: 'Lyon',
      nationality: 'Française',
      gender: 'F',
      birthDate: new Date('2000-03-15'),
      birthPlace: 'Lyon',
      socialSecurityNumber: '2 00 03 69 123 456 78',
      studentId: 'ETU2024001'
    },
    entreprise: {
      companyName: 'TechCorp SARL',
      nSiret: '12345678901234',
      siren: '123456789',
      companyAddress: '456 Avenue des Affaires',
      companyCity: 'Paris',
      companyPostalCode: '75001',
      country: 'France',
      companyPhone: '01 23 45 67 89',
      companyEmail: 'contact@techcorp.fr',
      website: 'www.techcorp.fr',
      companyDescription: 'Société spécialisée en développement technologique'
    },
    contact: {
      contact_firstName: 'Pierre',
      contact_lastName: 'Dubois',
      contact_fullName: 'Pierre Dubois',
      contact_email: 'pierre.dubois@techcorp.fr',
      contact_phone: '01 23 45 67 90',
      contact_position: 'Directeur Technique',
      contact_linkedin: 'linkedin.com/in/pierre-dubois'
    },
    structure: {
      structure_name: 'Junior Entreprise XYZ',
      structure_siret: '98765432109876',
      structure_address: '789 Rue de l\'École',
      structure_city: 'Lyon',
      structure_postalCode: '69000',
      structure_country: 'France',
      structure_phone: '04 78 90 12 34',
      structure_email: 'contact@je-xyz.fr',
      structure_website: 'www.je-xyz.fr',
      structure_tvaNumber: 'FR12345678901',
      structure_apeCode: '7022Z'
    }
  };
};

