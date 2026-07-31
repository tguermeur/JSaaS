#!/usr/bin/env bash
# Redéploie les functions liées à EmailJS (nouveaux template IDs / secrets).
set -euo pipefail
cd "$(dirname "$0")/.."

WAIT_SEC="${WAIT_SEC:-90}"
MAX_RETRIES="${MAX_RETRIES:-4}"

FUNCS=(
  inviteStructureMember
  sendWelcomeEmailCallable
  notifyUsersCallable
  onApplicationWrite
  onExpenseNoteWrite
  onMissionAssignmentWrite
  onEtudeWrite
  flushTrialEndingReminders
  sendAmbassadorInvite
  sendPasswordResetEmailToUser
  sendDemarchageEmail
  sendContactEmail
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

echo "Pause initiale ${WAIT_SEC}s (quota GCP)..."
sleep "$WAIT_SEC"

failed=()
for name in "${FUNCS[@]}"; do
  if ! deploy_one "$name"; then
    failed+=("$name")
  fi
  echo "Pause ${WAIT_SEC}s..."
  sleep "$WAIT_SEC"
done

if [ "${#failed[@]}" -gt 0 ]; then
  echo "Encore en échec:"
  printf '  - %s\n' "${failed[@]}"
  exit 1
fi
echo "Functions EmailJS redéployées."
