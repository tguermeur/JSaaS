#!/bin/bash

# Script pour activer les APIs Google Cloud requises pour Firebase Functions
# Ce script résout l'erreur "Error generating the service identity for pubsub.googleapis.com"

echo "=== Activation des APIs Google Cloud requises ==="
echo ""

# Détecter le projet Firebase actuel
# Méthode 1: Utiliser firebase use (retourne directement le projet)
PROJECT_ID=$(firebase use 2>/dev/null | head -1 | tr -d ' \n')

# Méthode 2: Parser firebase projects:list pour trouver (current)
if [ -z "$PROJECT_ID" ]; then
    PROJECT_ID=$(firebase projects:list 2>/dev/null | grep "(current)" | awk '{print $2}')
fi

# Méthode 3: Lire depuis .firebaserc
if [ -z "$PROJECT_ID" ] && [ -f ".firebaserc" ]; then
    PROJECT_ID=$(grep -o '"default": "[^"]*"' .firebaserc | cut -d'"' -f4)
fi

if [ -z "$PROJECT_ID" ]; then
    echo "❌ Impossible de déterminer le projet Firebase"
    echo "Assurez-vous d'être dans le répertoire du projet et d'être connecté à Firebase"
    exit 1
fi

echo "Projet détecté: $PROJECT_ID"
echo ""

# Vérifier si gcloud est installé
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI n'est pas installé"
    echo ""
    echo "Veuillez installer gcloud CLI:"
    echo "https://cloud.google.com/sdk/docs/install"
    echo ""
    echo "Ou activez les APIs manuellement dans la console:"
    echo "https://console.cloud.google.com/apis/library?project=$PROJECT_ID"
    exit 1
fi

# APIs requises pour Firebase Functions v2 (qui utilise Cloud Run en arrière-plan)
APIS=(
    "pubsub.googleapis.com"
    "eventarc.googleapis.com"
    "run.googleapis.com"
    "cloudbuild.googleapis.com"
    "cloudfunctions.googleapis.com"
    "artifactregistry.googleapis.com"
    "storage.googleapis.com"
)

echo "Activation des APIs..."
echo ""

for API in "${APIS[@]}"; do
    echo -n "Activation de $API... "
    ERROR_OUTPUT=$(gcloud services enable "$API" --project="$PROJECT_ID" 2>&1)
    if echo "$ERROR_OUTPUT" | grep -q "already enabled"; then
        echo "✅ (déjà activée)"
    elif echo "$ERROR_OUTPUT" | grep -q "successfully enabled"; then
        echo "✅ (activée)"
    elif echo "$ERROR_OUTPUT" | grep -q "PERMISSION_DENIED"; then
        echo "❌ Permission refusée"
        echo "   Vous devez avoir le rôle 'Editor' ou 'Owner' sur le projet"
    elif echo "$ERROR_OUTPUT" | grep -q "There was a problem refreshing"; then
        echo "❌ Authentification requise"
        echo "   Exécutez: gcloud auth login"
    elif [ -z "$ERROR_OUTPUT" ] || echo "$ERROR_OUTPUT" | grep -q "^$"; then
        # Si pas d'erreur visible, vérifier si l'API est activée
        if gcloud services list --enabled --project="$PROJECT_ID" --filter="name:$API" --format="value(name)" 2>/dev/null | grep -q "$API"; then
            echo "✅ (activée)"
        else
            echo "⚠️  Erreur inconnue"
        fi
    else
        echo "⚠️  Erreur: $ERROR_OUTPUT"
    fi
done

echo ""
echo "=== Vérification ==="
echo ""
echo "APIs activées:"
gcloud services list --enabled --project="$PROJECT_ID" --filter="name:(pubsub.googleapis.com OR eventarc.googleapis.com OR run.googleapis.com)" --format="table(name)"

echo ""
echo "=== Prochaines étapes ==="
echo ""
echo "1. Attendez 1-2 minutes pour que les APIs soient complètement activées"
echo "2. Réessayez le déploiement:"
echo "   firebase deploy --only functions"
echo ""
echo "Si le problème persiste, vérifiez vos permissions IAM:"
echo "https://console.cloud.google.com/iam-admin/iam?project=$PROJECT_ID"
echo ""

