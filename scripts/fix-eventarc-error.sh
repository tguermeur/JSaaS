#!/bin/bash

# Script pour activer l'API Eventarc et résoudre l'erreur de déploiement

echo "🔧 Correction de l'erreur Eventarc pour Firebase Functions..."
echo ""

# Vérifier si gcloud est installé
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI n'est pas installé."
    echo "Installez-le via: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

PROJECT_ID="jsaas-dd2f7"

echo "📋 Activation des APIs nécessaires pour le projet: $PROJECT_ID"
echo ""

# Activer Eventarc API
echo "1️⃣ Activation de l'API Eventarc..."
gcloud services enable eventarc.googleapis.com --project=$PROJECT_ID

# Activer Cloud Run API (requis pour Eventarc)
echo "2️⃣ Activation de l'API Cloud Run..."
gcloud services enable run.googleapis.com --project=$PROJECT_ID

# Activer Pub/Sub API (requis pour Eventarc)
echo "3️⃣ Activation de l'API Pub/Sub..."
gcloud services enable pubsub.googleapis.com --project=$PROJECT_ID

# Activer Cloud Functions API
echo "4️⃣ Activation de l'API Cloud Functions..."
gcloud services enable cloudfunctions.googleapis.com --project=$PROJECT_ID

# Activer Cloud Build API
echo "5️⃣ Activation de l'API Cloud Build..."
gcloud services enable cloudbuild.googleapis.com --project=$PROJECT_ID

# Activer Artifact Registry API
echo "6️⃣ Activation de l'API Artifact Registry..."
gcloud services enable artifactregistry.googleapis.com --project=$PROJECT_ID

echo ""
echo "✅ APIs activées avec succès!"
echo ""
echo "⏳ Attendez 1-2 minutes que les APIs se propagent, puis réessayez:"
echo "   firebase deploy --only functions"
echo ""
