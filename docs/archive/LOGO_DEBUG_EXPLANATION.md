# Explication : Pourquoi le logo du client fonctionne mais pas celui de la structure

## 🔍 Analyse de la différence

### ✅ Logo du client (FONCTIONNE)

**Chemin de données :**
```
DB companies (champ logo)
  ↓
quoteData.clientInfo.logo (ligne 1429)
  ↓
Image src={quoteData.clientInfo.logo} (ligne 658)
```

**Code dans le PDF :**
```tsx
{showLogo && quoteData.clientInfo.logo ? (
  <Image src={quoteData.clientInfo.logo} />
) : null}
```

**Caractéristiques :**
- ✅ Utilisation **directe** de `quoteData.clientInfo.logo`
- ✅ Pas de fonction intermédiaire
- ✅ Assignation directe depuis la DB (ligne 1429)
- ✅ Simple et fiable

---

### ❌ Logo de la structure (NE FONCTIONNAIT PAS)

**Chemin de données (AVANT correction) :**
```
DB structures (champ logo)
  ↓
structure.logo (ligne 1324)
  ↓
quoteData.companyInfo.logo (ligne 1339)
  ↓
getLogoSource(logoPreview, structureLogoValue, quoteData?.companyInfo?.logo) (ligne 583)
  ↓
logoSource (peut être null)
  ↓
Image src={logoSource} (ligne 604)
```

**Code dans le PDF (AVANT) :**
```tsx
const logoSource = getLogoSource(logoPreview, structureLogoValue, quoteData?.companyInfo?.logo);

{showStructureLogo && (
  {logoSource ? (
    <Image src={logoSource} />
  ) : <Placeholder />}
)}
```

**Problèmes identifiés :**
- ❌ Utilisation d'une fonction intermédiaire `getLogoSource()`
- ❌ La fonction peut retourner `null` même si le logo existe
- ❌ Plusieurs sources de données (structure.logo, quoteData.companyInfo.logo, logoPreview)
- ❌ Complexité inutile

---

## 🔧 Correction appliquée

**Nouveau chemin de données (APRÈS correction) :**
```
DB structures (champ logo)
  ↓
structure.logo (ligne 1324)
  ↓
quoteData.companyInfo.logo (ligne 1339)
  ↓
Image src={structureLogoValue || quoteData?.companyInfo?.logo || logoPreview} (ligne 605)
```

**Code dans le PDF (APRÈS) :**
```tsx
const structureLogoValue = structure?.logo || null;

{showStructureLogo && (
  {structureLogoValue || quoteData?.companyInfo?.logo || logoPreview ? (
    <Image src={structureLogoValue || quoteData?.companyInfo?.logo || logoPreview || ''} />
  ) : <Placeholder />}
)}
```

**Avantages :**
- ✅ Même approche que le logo du client
- ✅ Utilisation directe sans fonction intermédiaire
- ✅ Priorité claire : structure.logo > quoteData.companyInfo.logo > logoPreview
- ✅ Plus simple et fiable

---

## 📊 Comparaison

| Aspect | Logo Client | Logo Structure (avant) | Logo Structure (après) |
|--------|-------------|------------------------|------------------------|
| Source DB | `companies.logo` | `structures.logo` | `structures.logo` |
| Stockage | `quoteData.clientInfo.logo` | `structure.logo` + `quoteData.companyInfo.logo` | `structure.logo` + `quoteData.companyInfo.logo` |
| Fonction intermédiaire | ❌ Non | ✅ Oui (`getLogoSource`) | ❌ Non |
| Utilisation dans PDF | Directe | Via `logoSource` | Directe |
| Complexité | Simple | Complexe | Simple |

---

## 🎯 Conclusion

Le logo de la structure ne fonctionnait pas car il passait par une fonction `getLogoSource()` qui pouvait retourner `null` même si le logo existait dans la base de données. En utilisant la même approche directe que le logo du client, le problème est résolu.





