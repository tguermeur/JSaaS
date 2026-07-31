#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

WAIT_SEC="${WAIT_SEC:-300}"
MAX_RETRIES="${MAX_RETRIES:-8}"

echo "Build functions..."
npm --prefix functions run build

attempt=1
while [ "$attempt" -le "$MAX_RETRIES" ]; do
  echo "=== decryptFile deploy (tentative ${attempt}/${MAX_RETRIES}) ==="
  if firebase deploy --only functions:decryptFile; then
    echo "decryptFile deploye avec succes."
    exit 0
  fi
  echo "Echec (souvent quota CPU Cloud Run). Attente ${WAIT_SEC}s..."
  sleep "$WAIT_SEC"
  attempt=$((attempt + 1))
done

echo "Echec apres ${MAX_RETRIES} tentatives."
echo "Augmentez le quota RUN CPU (us-central1) dans la console GCP, ou attendez 1h puis relancez."
exit 1
