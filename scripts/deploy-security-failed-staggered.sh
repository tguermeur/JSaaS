#!/usr/bin/env bash
# Déploie les functions en échec une par une (évite 429 mutation + pic CPU Cloud Run).
# Usage:
#   ./scripts/deploy-security-failed-staggered.sh
#   WAIT_SEC=120 ./scripts/deploy-security-failed-staggered.sh
set -euo pipefail
cd "$(dirname "$0")/.."

WAIT_SEC="${WAIT_SEC:-90}"
MAX_RETRIES="${MAX_RETRIES:-5}"

# Functions en échec du dernier deploy full (quota CPU / mutation 429)
FAILED=(
  decryptContactData
  decryptContactDataForStructure
  disableTwoFactor
  isFileEncrypted
  removeAmbassadorFromUser
  removeSecureDevice
  syncUserClaims
)

deploy_one() {
  local name="$1"
  local attempt=1
  while [ "$attempt" -le "$MAX_RETRIES" ]; do
    echo "=== Deploy $name (tentative $attempt/$MAX_RETRIES) ==="
    if firebase deploy --only "functions:${name}"; then
      echo "✔ $name OK"
      return 0
    fi
    echo "✗ $name échoué, attente ${WAIT_SEC}s..."
    sleep "$WAIT_SEC"
    attempt=$((attempt + 1))
  done
  echo "Échec définitif pour $name"
  return 1
}

echo "Build functions..."
npm --prefix functions run build

echo "Attente initiale ${WAIT_SEC}s pour laisser retomber le quota GCP..."
sleep "$WAIT_SEC"

failed_names=()
for name in "${FAILED[@]}"; do
  if ! deploy_one "$name"; then
    failed_names+=("$name")
  fi
  echo "Pause ${WAIT_SEC}s avant la function suivante..."
  sleep "$WAIT_SEC"
done

if [ "${#failed_names[@]}" -gt 0 ]; then
  echo ""
  echo "Encore en échec (${#failed_names[@]}) :"
  printf '  - %s\n' "${failed_names[@]}"
  exit 1
fi

echo "Toutes les functions en échec ont été redéployées."
