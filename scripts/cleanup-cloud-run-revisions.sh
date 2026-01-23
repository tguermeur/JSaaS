#!/bin/bash

# Script pour nettoyer les anciennes révisions Cloud Run
# Cela libère du quota CPU en supprimant les anciennes versions non utilisées

set -e

PROJECT_ID="jsaas-dd2f7"
REGION="us-central1"

echo "🧹 Nettoyage des anciennes révisions Cloud Run..."
echo "Projet: $PROJECT_ID"
echo "Région: $REGION"
echo ""

# Lister toutes les révisions
echo "📋 Liste des révisions Cloud Run:"
gcloud run revisions list \
  --region=$REGION \
  --platform=managed \
  --project=$PROJECT_ID \
  --format="table(metadata.name,status.conditions[0].type,status.conditions[0].status)"

echo ""
echo "⚠️  ATTENTION: Ce script va supprimer les révisions non actives"
read -p "Continuer? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Annulé"
    exit 1
fi

# Supprimer les anciennes révisions (sauf celles actives)
echo ""
echo "🗑️  Suppression des anciennes révisions..."

# Pour chaque service, garder seulement la dernière révision active
SERVICES=$(gcloud run services list \
  --region=$REGION \
  --platform=managed \
  --project=$PROJECT_ID \
  --format="value(metadata.name)")

for SERVICE in $SERVICES; do
    echo "  Traitement du service: $SERVICE"
    
    # Obtenir toutes les révisions sauf la dernière
    REVISIONS=$(gcloud run revisions list \
      --service=$SERVICE \
      --region=$REGION \
      --platform=managed \
      --project=$PROJECT_ID \
      --sort-by="~metadata.creationTimestamp" \
      --format="value(metadata.name)" | tail -n +2)
    
    for REVISION in $REVISIONS; do
        echo "    Suppression de la révision: $REVISION"
        gcloud run revisions delete $REVISION \
          --region=$REGION \
          --platform=managed \
          --project=$PROJECT_ID \
          --quiet || echo "    ⚠️  Impossible de supprimer $REVISION (peut-être déjà supprimée)"
    done
done

echo ""
echo "✅ Nettoyage terminé !"
echo ""
echo "💡 Le quota CPU devrait maintenant être libéré."
echo "   Vous pouvez redéployer avec: firebase deploy --only functions"
