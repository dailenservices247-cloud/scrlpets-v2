#!/usr/bin/env bash
# ship-verify.sh — the standard pre-ship verification sweep for scrlpets-v2.
# Usage:
#   ./ship-verify.sh          # local gates: types, lint, unit, sql probes, e2e, prod build
#   ./ship-verify.sh --prod   # additionally smoke-check the live production deploy
# Every ship runs this; paste the SUMMARY block into the session log.
# Added 2026-07-05 per session-teardown audit C2 (deploy+verify was re-instructed
# 37+ times across sessions; this script is that instruction).

set -uo pipefail
cd "$(dirname "$0")"

PROD_URL="https://scrlpets.com"
declare -a RESULTS=()
FAIL=0

step() {
  local label="$1"; shift
  local start=$SECONDS
  # Per-step log file: a shared path meant the next step clobbered the failing
  # step's output, so a FAIL report arrived with its evidence already gone.
  local slug; slug=$(echo "$label" | tr -cd '[:alnum:]')
  local log="/tmp/ship-verify-${slug}.log"
  if "$@" >"$log" 2>&1; then
    RESULTS+=("PASS  ${label}  ($((SECONDS-start))s)")
  else
    RESULTS+=("FAIL  ${label}  ($((SECONDS-start))s) — tail below")
    echo "--- ${label} failure tail ---"
    echo "(full log: $log)"
    tail -25 "$log"
    FAIL=1
  fi
}

step "typescript (tsc --noEmit)"   npx tsc --noEmit
step "lint (eslint)"               npm run lint
step "unit (vitest run)"           npx vitest run
# The 21 SQL probes are the only tests of the money layer — RLS, role grants,
# settlement splits, the payout and refund queues. They sat unexecuted while
# this script reported ALL GATES PASS, which made a green sweep meaningless
# about the half of the system that moves money. Ahead of e2e because it is
# 20 seconds against several minutes.
step "sql probes (money layer)"    ./run-probes.sh
step "e2e (playwright)"            npx playwright test
step "prod build (next build)"     npm run build

if [[ "${1:-}" == "--prod" ]]; then
  smoke() {
    local label="$1" url="$2" expect="$3" invert="${4:-}"
    local body; body=$(curl -sS --max-time 15 "$url")
    if [[ -n "$invert" ]]; then
      if echo "$body" | grep -q "$expect"; then RESULTS+=("FAIL  ${label} (found forbidden: ${expect})"); FAIL=1
      else RESULTS+=("PASS  ${label}"); fi
    else
      if echo "$body" | grep -q "$expect"; then RESULTS+=("PASS  ${label}")
      else RESULTS+=("FAIL  ${label} (missing: ${expect})"); FAIL=1; fi
    fi
  }
  # CSP served live
  if curl -sSI --max-time 15 "$PROD_URL" | grep -qi "content-security-policy"; then
    RESULTS+=("PASS  prod CSP header")
  else
    RESULTS+=("FAIL  prod CSP header missing"); FAIL=1
  fi
  # sitemap: no profile URLs (email-localpart leak guard), no fixtures
  smoke "sitemap no /u/ leak"      "$PROD_URL/sitemap.xml" "/u/" invert
  smoke "sitemap reachable"        "$PROD_URL/sitemap.xml" "<urlset"
  # feed page renders and carries no E2E fixture markers
  smoke "home renders"             "$PROD_URL" "Scrlpets"
  smoke "feed no fixture leak"     "$PROD_URL" "E2E_FIXTURE" invert
fi

echo
echo "===== SHIP-VERIFY SUMMARY ====="
printf '%s\n' "${RESULTS[@]}"
echo "==============================="
if [[ $FAIL -eq 1 ]]; then
  echo "RESULT: FAIL — do not ship."
  exit 1
fi
echo "RESULT: ALL GATES PASS"
