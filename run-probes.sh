#!/usr/bin/env bash
# run-probes.sh — executes every supabase/probes/*.probe.sql and reports the result.
#
# The probes are the ONLY tests of the SQL money layer: RLS, role grants,
# settlement splits, the payout and refund queues. Twenty-one of them sat in the
# tree with nothing anywhere executing them — not ship-verify, not package.json,
# and there is no CI — so a green pre-ship sweep proved nothing about any of it.
# This is the missing runner.
#
# Every probe is begin/…/rollback and writes nothing, so this is safe to run
# against a live project.
#
# TWO ways a probe fails, and the second is the one that matters:
#   - it raises  → the API returns an error carrying the PROBE FAILED message.
#   - it returns no rows → it asserted NOTHING. That is a failure here, not a
#     pass. A probe whose reporting select silently stopped emitting is exactly
#     the silence this script exists to remove.
#
# Usage:
#   ./run-probes.sh                          # against scrlpets-v2-dev
#   PROBE_PROJECT_REF=<ref> ./run-probes.sh  # against another project
set -uo pipefail
cd "$(dirname "$0")"

# Dev by default. Probes roll back, but they exercise settlement and payout paths
# against real fixture rows; dev is where that belongs.
PROJECT_REF="${PROBE_PROJECT_REF:-irpayabloogarxwtjmrf}"
API="https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query"

# Exactly one keychain item carries this service, but -a is still passed on the
# read: a bare -s lookup returns the FIRST match, so the day a second item is
# added this would silently start reading the wrong token.
TOKEN=$(security find-generic-password -s scrlpets-v2-supabase-token \
                                       -a "${PROBE_KEYCHAIN_ACCT:-dailenhuntley}" -w 2>/dev/null) \
  || TOKEN=$(security find-generic-password -s scrlpets-v2-supabase-token -w 2>/dev/null)

if [[ -z "${TOKEN:-}" ]]; then
  echo "FAIL  no Supabase token in keychain (service: scrlpets-v2-supabase-token)."
  echo "      The probes cannot run, so this refuses to report success."
  exit 1
fi

shopt -s nullglob
PROBES=(supabase/probes/*.probe.sql)
if [[ ${#PROBES[@]} -eq 0 ]]; then
  echo "FAIL  no probes found under supabase/probes/ — expected at least one."
  exit 1
fi

declare -a RESULTS=()
FAIL=0
TOTAL_ASSERTIONS=0

echo "Running ${#PROBES[@]} probes against ${PROJECT_REF}"
echo

for probe in "${PROBES[@]}"; do
  name=$(basename "$probe" .probe.sql)
  start=$SECONDS

  body=$(python3 -c 'import json,sys;print(json.dumps({"query":open(sys.argv[1]).read()}))' "$probe") || {
    RESULTS+=("FAIL  ${name} — could not encode probe")
    FAIL=1; continue
  }

  verdict=$(curl -sS --max-time 180 -X POST "$API" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$body" 2>/dev/null | python3 -c '
import json, sys
raw = sys.stdin.read()
try:
    d = json.loads(raw)
except Exception:
    print("FAIL|no parseable response from the API")
    sys.exit(0)
if isinstance(d, dict):
    msg = d.get("message") or d.get("error") or json.dumps(d)
    print("FAIL|" + " ".join(str(msg).split())[:400])
elif not isinstance(d, list) or len(d) == 0:
    print("FAIL|probe returned no rows — it asserted nothing")
else:
    print("PASS|%d" % len(d))
')

  elapsed=$((SECONDS-start))
  case "$verdict" in
    PASS\|*)
      n=${verdict#PASS|}
      TOTAL_ASSERTIONS=$((TOTAL_ASSERTIONS + n))
      RESULTS+=("PASS  ${name}  (${n} assertions, ${elapsed}s)")
      ;;
    *)
      RESULTS+=("FAIL  ${name}  (${elapsed}s) — ${verdict#FAIL|}")
      FAIL=1
      ;;
  esac
done

echo "===== PROBE SUMMARY ====="
printf '%s\n' "${RESULTS[@]}"
echo "========================="
echo "${#PROBES[@]} probes, ${TOTAL_ASSERTIONS} assertions, project ${PROJECT_REF}"
if [[ $FAIL -eq 1 ]]; then
  echo "RESULT: PROBES FAILED"
  exit 1
fi
echo "RESULT: ALL PROBES PASS"
