#!/bin/bash

# Script pour créer manuellement l'identité de service Eventarc
# Ce script résout l'erreur "Error generating the service identity for eventarc.googleapis.com"

echo "🔧 Création de l'identité de service Eventarc..."
echo ""

PROJECT_ID="jsaas-dd2f7"
PROJECT_NUMBER="1028151005055"

# Vérifier si gcloud est installé
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI n'est pas installé."
    echo "Installez-le via: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Vérifier l'authentification
echo "📋 Vérification de l'authentification..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Vous n'êtes pas authentifié avec gcloud."
    echo "Exécutez: gcloud auth login"
    exit 1
fi

# Configurer le projet
echo "📋 Configuration du projet: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# Créer l'identité de service Eventarc
echo ""
echo "1️⃣ Création de l'identité de service Eventarc..."
SERVICE_ACCOUNT="service-${PROJECT_NUMBER}@gcp-sa-eventarc.iam.gserviceaccount.com"

# Essayer de créer l'identité de service
if gcloud beta services identity create --service=eventarc.googleapis.com --project=$PROJECT_ID 2>&1; then
    echo "✅ Identité de service créée avec succès!"
else
    echo "⚠️  L'identité de service existe peut-être déjà, vérification..."
fi

# Vérifier que l'identité existe
echo ""
echo "2️⃣ Vérification de l'identité de service..."
if gcloud projects get-iam-policy $PROJECT_ID --flatten="bindings[].members" --filter="bindings.members:serviceAccount:${SERVICE_ACCOUNT}" --format="value(bindings.members)" 2>/dev/null | grep -q "${SERVICE_ACCOUNT}"; then
    echo "✅ L'identité de service existe: ${SERVICE_ACCOUNT}"
else
    echo "⚠️  L'identité de service n'a pas été trouvée automatiquement."
    echo "   Elle sera créée automatiquement lors du prochain déploiement Firebase."
fi

# Vérifier les rôles
echo ""
echo "3️⃣ Vérification des rôles IAM..."
gcloud projects get-iam-policy $PROJECT_ID --flatten="bindings[].members" --filter="bindings.members:*eventarc*" --format="table(bindings.role,bindings.members)" 2>/dev/null || echo "Aucun rôle Eventarc trouvé (normal si l'identité vient d'être créée)"

echo ""
echo "✅ Processus terminé!"
echo ""
echo "⏳ Attendez 1-2 minutes que l'identité soit propagée, puis réessayez:"
echo "   firebase deploy"
echo ""
