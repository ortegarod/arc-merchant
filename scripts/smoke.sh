#!/usr/bin/env bash
# Post-deploy smoke test: both services active, listening only on FACILITATOR_HOST,
# facilitator healthy, paywalled article returns 402, stats endpoint responds.
set -uo pipefail
cd "$(dirname "$0")/.."
HOST="${SMOKE_HOST:-$(grep -E '^FACILITATOR_HOST=' .env.local 2>/dev/null | cut -d= -f2)}"
HOST="${HOST:-127.0.0.1}"
fail=0
ok()  { echo "  ✓ $*"; }
bad() { echo "  ✗ $*"; fail=1; }

for u in arc-merchant-dev arc-merchant-facilitator; do
  [[ $(systemctl is-active "$u") == active ]] && ok "$u active" || bad "$u not active"
done
for p in 3004 4022; do
  binds=$(ss -ltnH "sport = :$p" | awk '{print $4}' | sort -u | tr '\n' ' ')
  if [[ -z "$binds" ]]; then bad ":$p not listening"
  elif [[ "$binds" == "$HOST:$p " ]]; then ok ":$p bound to $HOST only"
  else bad ":$p bound to: $binds(expected $HOST only)"; fi
done
code() { curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$1"; }
[[ $(code "http://$HOST:4022/health") == 200 ]] && ok "facilitator /health 200" || bad "facilitator /health not 200"
[[ $(code "http://$HOST:3004/api/article/arc-blockchain-guide") == 402 ]] && ok "paywalled article returns 402" || bad "paywalled article did not return 402"
[[ $(code "http://$HOST:3004/api/stats") == 200 ]] && ok "/api/stats 200" || bad "/api/stats not 200"

(( fail )) && { echo "❌ smoke failed"; exit 1; } || echo "✓ smoke passed"
