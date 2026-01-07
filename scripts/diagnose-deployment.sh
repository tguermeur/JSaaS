#!/bin/bash

# Script de diagnostic pour les problèmes de déploiement Firebase Functions
# Ce script vérifie les APIs et permissions nécessaires

echo "=== Diagnostic des APIs Google Cloud requises ==="
echo ""

PROJECT_ID=$(firebase projects:list 2>/dev/null | grep -E '^\s+\*' | head -1 | awk '{print $2}')

if [ -z "$PROJECT_ID" ]; then
    PROJECT_ID=$(firebase use 2>/dev/null | grep -E '^\s+\*' | head -1 | awk '{print $2}' | tr -d '()')
fi

if [ -z "$PROJECT_ID" ]; then
    echo "❌ Impossible de déterminer le projet Firebase"
    exit 1
fi

echo "Projet détecté: $PROJECT_ID"
echo ""

# Vérifier si gcloud est installé
if ! command -v gcloud &> /dev/null; then
    echo "⚠️  gcloud CLI n'est pas installé. Installation recommandée pour une vérification complète."
    echo ""
    echo "Solutions possibles:"
    echo "1. Activer l'API Pub/Sub manuellement:"
    echo "   https://console.cloud.google.com/apis/library/pubsub.googleapis.com?project=$PROJECT_ID"
    echo ""
    echo "2. Vérifier les permissions IAM dans:"
    echo "   https://console.cloud.google.com/iam-admin/iam?project=$PROJECT_ID"
    echo ""
    exit 0
fi

echo "Vérification des APIs requises..."
echo ""

# APIs requises pour Firebase Functions v2
APIS=(
    "pubsub.googleapis.com"
    "eventarc.googleapis.com"
    "run.googleapis.com"
    "cloudbuild.googleapis.com"
    "cloudfunctions.googleapis.com"
    "artifactregistry.googleapis.com"
    "storage.googleapis.com"
)

for API in "${APIS[@]}"; do
    STATUS=$(gcloud services list --enabled --project="$PROJECT_ID" --filter="name:$API" --format="value(name)" 2>/dev/null)
    if [ -z "$STATUS" ]; then
        echo "❌ $API - NON ACTIVÉE"
        echo "   Activer: gcloud services enable $API --project=$PROJECT_ID"
    else
        echo "✅ $API - Activée"
    fi
done

echo ""
echo "=== Vérification des permissions ==="
echo ""
echo "Vérifiez que votre compte a les permissions suivantes:"
echo "- Service Account Admin (roles/iam.serviceAccountAdmin)"
echo "- Editor (roles/editor)"
echo "- Cloud Functions Admin (roles/cloudfunctions.admin)"
echo ""
echo "Vérifier dans: https://console.cloud.google.com/iam-admin/iam?project=$PROJECT_ID"
echo ""


