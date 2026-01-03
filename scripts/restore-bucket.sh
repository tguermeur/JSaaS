#!/bin/bash

# Script pour restaurer un bucket Firebase Storage supprimé
# Usage: ./scripts/restore-bucket.sh <bucket-name> [generation]

BUCKET_NAME=$1
GENERATION=$2

if [ -z "$BUCKET_NAME" ]; then
  echo "❌ Erreur: Nom du bucket requis"
  echo ""
  echo "Usage: ./scripts/restore-bucket.sh <bucket-name> [generation]"
  echo ""
  echo "Exemple:"
  echo "  ./scripts/restore-bucket.sh jsaas-dd2f7.firebasestorage.app"
  echo "  ./scripts/restore-bucket.sh jsaas-dd2f7.firebasestorage.app 1234567890"
  exit 1
fi

# Vérifier que gcloud est installé
if ! command -v gcloud &> /dev/null; then
  echo "❌ Erreur: gcloud CLI n'est pas installé"
  echo "   Installez-le depuis: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

# Vérifier l'authentification
echo "🔐 Vérification de l'authentification..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
  echo "❌ Erreur: Vous n'êtes pas authentifié"
  echo "   Connectez-vous avec: gcloud auth login"
  exit 1
fi

# Si la génération n'est pas fournie, essayer de la trouver
if [ -z "$GENERATION" ]; then
  echo "📋 Recherche de la génération du bucket supprimé..."
  
  # Lister les buckets supprimés
  DELETED_BUCKETS=$(gcloud storage buckets list --filter="lifecycleState:DELETE_REQUESTED" --format="json" 2>/dev/null)
  
  if [ -z "$DELETED_BUCKETS" ]; then
    echo "⚠️  Impossible de lister les buckets supprimés"
    echo "   Veuillez fournir la génération manuellement"
    echo "   Vous pouvez la trouver dans la console Google Cloud"
    exit 1
  fi
  
  # Extraire la génération pour le bucket spécifié
  GENERATION=$(echo "$DELETED_BUCKETS" | jq -r ".[] | select(.name == \"$BUCKET_NAME\") | .metadata.generation" 2>/dev/null)
  
  if [ -z "$GENERATION" ] || [ "$GENERATION" == "null" ]; then
    echo "❌ Génération non trouvée pour le bucket $BUCKET_NAME"
    echo "   Le bucket peut être définitivement supprimé (après 7 jours)"
    echo "   Ou il n'existe pas avec ce nom"
    echo ""
    echo "💡 Essayez de fournir la génération manuellement:"
    echo "   ./scripts/restore-bucket.sh $BUCKET_NAME <generation>"
    exit 1
  fi
  
  echo "✅ Génération trouvée: $GENERATION"
fi

# Restaurer le bucket
echo ""
echo "🔄 Restauration du bucket: $BUCKET_NAME"
echo "   Génération: $GENERATION"
echo ""

# Utiliser l'API REST via curl
ACCESS_TOKEN=$(gcloud auth print-access-token)
URL="https://storage.googleapis.com/storage/v1/b/$BUCKET_NAME/restore?generation=$GENERATION"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  "$URL")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  echo "✅ Bucket restauré avec succès!"
  echo ""
  echo "📦 Informations du bucket restauré:"
  echo "$BODY" | jq -r '. | "   Nom: \(.name)\n   Location: \(.location)\n   Storage Class: \(.storageClass)"'
else
  echo "❌ Erreur HTTP $HTTP_CODE"
  echo "$BODY" | jq -r '.error.message // .' 2>/dev/null || echo "$BODY"
  
  if [ "$HTTP_CODE" == "404" ]; then
    echo ""
    echo "💡 Suggestions:"
    echo "   - Vérifiez que le bucket existe et est en état de suppression"
    echo "   - Vérifiez que la génération est correcte"
    echo "   - Les buckets sont définitivement supprimés après 7 jours"
  elif [ "$HTTP_CODE" == "403" ]; then
    echo ""
    echo "💡 Suggestions:"
    echo "   - Vérifiez vos permissions: storage.buckets.restore"
    echo "   - Assurez-vous d'être connecté avec le bon compte"
  fi
  
  exit 1
fi






