#!/usr/bin/env bash
# Local end-to-end test on Arc testnet, run before anything ships:
#   1. production build of the current commit in a clean worktree
#   2. facilitator + app started on 127.0.0.1 (in-memory history, no database)
#   3. health 200, paywall 402, network reported as testnet
#   4. one real testnet purchase that must settle on chain
# Needs CIRCLE_API_KEY (a TEST_ key with Wallets write), CIRCLE_ENTITY_SECRET,
# CIRCLE_FACILITATOR_WALLET_ID and BUYER_WALLET_ID in the environment. The two secrets
# can instead be given as CIRCLE_API_KEY_FILE / CIRCLE_ENTITY_SECRET_FILE paths.
# Mainnet keys are refused: local testing is testnet only.
set -euo pipefail
root=$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)
for v in CIRCLE_API_KEY CIRCLE_ENTITY_SECRET; do
  f="${v}_FILE"
  if [[ -z "${!v:-}" && -n "${!f:-}" ]]; then export "$v=$(tr -d '[:space:]' < "${!f}")"; fi
done
for v in CIRCLE_API_KEY CIRCLE_ENTITY_SECRET CIRCLE_FACILITATOR_WALLET_ID BUYER_WALLET_ID; do
  [[ -n "${!v:-}" ]] || { echo "❌ $v is not set" >&2; exit 1; }
done
[[ $CIRCLE_API_KEY == TEST_API_KEY:* ]] || { echo "❌ local tests run on testnet only: CIRCLE_API_KEY must be a TEST_ key" >&2; exit 1; }
[[ -z "$(git -C "$root" status --porcelain)" ]] || { echo "❌ uncommitted changes: commit first, the test runs on HEAD" >&2; exit 1; }
unset DATABASE_URL ARC_NETWORK PUBLIC_BASE_URL
app_port=${E2E_APP_PORT:-3105}; fac_port=${E2E_FAC_PORT:-4105}
sha=$(git -C "$root" rev-parse HEAD)
wt=$(mktemp -d "$(dirname "$root")/.arc-merchant-e2e.XXXXXX"); pids=()  # same filesystem, so node_modules can be hard-linked
cleanup() {
  for p in "${pids[@]}"; do kill "$p" 2>/dev/null || true; done
  wait 2>/dev/null || true
  git -C "$root" worktree remove --force "$wt" >/dev/null 2>&1 || true; rm -rf "$wt"
}
trap cleanup EXIT
git -C "$root" worktree add --detach --quiet "$wt" "$sha"
cp -al "$root/node_modules" "$wt/node_modules"
cd "$wt"
echo "→ testing $(git log -1 --format='%h %s')"

NEXT_TELEMETRY_DISABLED=1 npx --no-install next build > build.log 2>&1 || { tail -40 build.log >&2; echo "❌ build failed" >&2; exit 1; }
echo "  ✓ build"

FACILITATOR_HOST=127.0.0.1 PORT=$fac_port npx --no-install tsx src/servers/facilitator.ts > fac.log 2>&1 & pids+=($!)
FACILITATOR_URL=http://127.0.0.1:$fac_port ENABLE_BUYER_AGENT=false NEXT_TELEMETRY_DISABLED=1 \
  npx --no-install next start -H 127.0.0.1 -p "$app_port" > app.log 2>&1 & pids+=($!)
base=http://127.0.0.1:$app_port
code() { curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$1"; }
for _ in $(seq 60); do [[ $(code "$base/api/health") == 200 ]] && break; sleep 2; done

fail=0
ok()  { echo "  ✓ $*"; }
bad() { echo "  ✗ $*"; fail=1; }
[[ $(code "$base/api/health") == 200 ]] && ok "/api/health 200" || { bad "/api/health not 200"; tail -20 fac.log app.log >&2; }
[[ $(code "$base/api/article/arc-blockchain-guide") == 402 ]] && ok "paywalled article returns 402" || bad "paywalled article did not return 402"
curl -s --max-time 10 "$base/api/stats" | grep -q '"testnet":true' && ok "network is testnet" || bad "stats do not report testnet"
if (( ! fail )); then
  out=$(npx --no-install tsx scripts/test-purchase.ts "$base/api/article/arc-blockchain-guide" 2>&1) && ok "testnet purchase settled: $out" || bad "testnet purchase failed: $out"
fi
(( fail )) && { echo "❌ local e2e failed for $sha" >&2; exit 1; }
echo "✓ local e2e passed for $sha"
