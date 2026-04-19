#!/usr/bin/env bash
# Smoke test suite for the anki-cloud public REST API (Hono/Bun).
# Self-contained: starts its own API + sync server, seeds a test user,
# mints a JWT session token, and exercises all CRUD endpoints via curl.
#
# Usage:
#   ./scripts/smoke-test.sh             # builds sync server then tests
#   ./scripts/smoke-test.sh --no-build  # skip cargo build
set -euo pipefail

# ---- Config ---------------------------------------------------------------
TEST_JWT_SECRET="0000000000000000000000000000000000000000000000000000000000000000"
TEST_ENCRYPTION_KEY="0000000000000000000000000000000000000000000000000000000000000000"
SIDECAR_TOKEN="smoke-sidecar-token"
TEST_EMAIL="smoke@example.com"
TEST_API_KEY="ak_smoketestkey000000000000000000000000000000"
API_PORT=19300
SYNC_PORT=19380
INTERNAL_PORT=19381

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_ENTRY="${REPO_ROOT}/api/src/index.ts"
SYNC_BIN="${REPO_ROOT}/../anki-cloud-sync/target/debug/anki-sync-server"
MIGRATIONS_DIR="${REPO_ROOT}/db/src/migrations"
BASE_URL="http://127.0.0.1:${API_PORT}/v1"

API_PID=""
SYNC_PID=""
WORK_DIR=""
SESSION_JWT=""

# ---- Helpers ---------------------------------------------------------------
PASS_COUNT=0
FAIL_COUNT=0

pass() { echo "  ✓ $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo "  ✗ $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

assert_eq() {
    local label="$1" expected="$2" actual="$3"
    if [[ "$actual" == "$expected" ]]; then pass "$label"
    else fail "$label — expected '$expected', got '$actual'"; fi
}

assert_contains() {
    local label="$1" needle="$2" haystack="$3"
    if echo "$haystack" | grep -q "$needle"; then pass "$label"
    else fail "$label — '$needle' not in: $haystack"; fi
}

assert_http() {
    local label="$1" expected_code="$2" actual_code="$3" body="${4:-}"
    if [[ "$actual_code" == "$expected_code" ]]; then pass "$label (HTTP $actual_code)"
    else fail "$label — expected HTTP $expected_code, got $actual_code | body: $body"; fi
}

# curl wrapper for data endpoints: attaches Bearer API key
api() {
    local method="$1" path="$2"; shift 2
    local extra_args=("$@")
    curl -s -o /tmp/smoke_api_body -w "%{http_code}" \
        -X "$method" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TEST_API_KEY}" \
        ${extra_args[@]+"${extra_args[@]}"} \
        "${BASE_URL}${path}"
}

api_with_body() {
    local method="$1" path="$2" body="$3"
    api "$method" "$path" -d "$body"
}

# curl wrapper for /me/* endpoints: attaches session cookie
api_me() {
    local method="$1" path="$2"; shift 2
    local extra_args=("$@")
    curl -s -o /tmp/smoke_api_body -w "%{http_code}" \
        -X "$method" \
        -H "Content-Type: application/json" \
        -H "Cookie: session=${SESSION_JWT}" \
        ${extra_args[@]+"${extra_args[@]}"} \
        "${BASE_URL}${path}"
}

api_me_with_body() {
    local method="$1" path="$2" body="$3"
    api_me "$method" "$path" -d "$body"
}

# ---- Lifecycle -------------------------------------------------------------
cleanup() {
    if [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
        kill "$API_PID" 2>/dev/null; wait "$API_PID" 2>/dev/null || true
    fi
    if [[ -n "$SYNC_PID" ]] && kill -0 "$SYNC_PID" 2>/dev/null; then
        kill "$SYNC_PID" 2>/dev/null; wait "$SYNC_PID" 2>/dev/null || true
    fi
    [[ -n "$WORK_DIR" ]] && rm -rf "$WORK_DIR"
}
trap cleanup EXIT

wait_for_http() {
    local url="$1" max_ms="${2:-15000}"
    local i=0 max=$(( max_ms / 200 ))
    while [[ $i -lt $max ]]; do
        code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
        [[ "$code" =~ ^2 ]] && return 0
        sleep 0.2
        i=$((i + 1))
    done
    echo "ERROR: timed out waiting for $url" >&2
    exit 1
}

# ---- Validate prereqs -------------------------------------------------------
[[ -f "$SYNC_BIN" ]] || { echo "ERROR: sync binary not found: $SYNC_BIN"; echo "Run without --no-build or build it first."; exit 1; }
[[ -d "$MIGRATIONS_DIR" ]] || { echo "ERROR: migrations dir not found: $MIGRATIONS_DIR"; exit 1; }
command -v bun  >/dev/null || { echo "ERROR: bun not found"; exit 1; }
command -v python3 >/dev/null || { echo "ERROR: python3 not found"; exit 1; }

# ---- Build -----------------------------------------------------------------
if [[ "${1:-}" != "--no-build" ]]; then
    echo "==> Building sync server..."
    (cd "$(dirname "$SYNC_BIN")/../.." && cargo build --bin anki-sync-server 2>&1 | tail -3)
fi

# ---- Setup -----------------------------------------------------------------
echo ""
echo "==> Setting up test environment..."
WORK_DIR="$(mktemp -d /tmp/anki-cloud-smoke-XXXXXX)"
DB_PATH="${WORK_DIR}/test.db"
SYNC_BASE="${WORK_DIR}/sync"
mkdir -p "$SYNC_BASE"

# Apply migrations, seed user + local storage connection + API key, mint JWT — all via Python
SESSION_JWT=$(python3 - <<PYEOF
import sqlite3, hmac, hashlib, base64, json, time, os, re, uuid

db_path   = "${DB_PATH}"
mig_dir   = "${MIGRATIONS_DIR}"
secret    = "${TEST_JWT_SECRET}"
email     = "${TEST_EMAIL}"
api_key   = "${TEST_API_KEY}"
user_id   = str(uuid.uuid4())

# -- Apply migrations -------------------------------------------------------
conn = sqlite3.connect(db_path)
conn.execute("PRAGMA foreign_keys = ON")
conn.execute("PRAGMA journal_mode = WAL")
for fname in sorted(f for f in os.listdir(mig_dir) if f.endswith('.sql')):
    raw = open(os.path.join(mig_dir, fname)).read()
    for stmt in re.split(r'--> statement-breakpoint', raw):
        stmt = stmt.strip()
        if stmt:
            conn.execute(stmt)
conn.commit()

# -- Seed user --------------------------------------------------------------
now_ms = int(time.time() * 1000)
conn.execute(
    "INSERT INTO users (id, google_sub, email, name, created_at) VALUES (?, ?, ?, ?, ?)",
    (user_id, "google-sub-smoke", email, "Smoke Test User", now_ms)
)
# provider='local' → no-op Rust backend; no real GDrive creds needed
conn.execute(
    "INSERT INTO storage_connections "
    "(id, user_id, provider, oauth_token, oauth_refresh_token, folder_path, connected_at) "
    "VALUES (?, ?, ?, ?, ?, ?, ?)",
    (str(uuid.uuid4()), user_id, "local", "", "", "/AnkiSync", now_ms)
)

# -- Seed API key (SHA-256 of test key) -------------------------------------
key_hash = hashlib.sha256(api_key.encode()).hexdigest()
conn.execute(
    "INSERT INTO users_api_keys (id, user_id, key_hash, label, created_at) VALUES (?, ?, ?, ?, ?)",
    (str(uuid.uuid4()), user_id, key_hash, "smoke-test", now_ms)
)
conn.commit()
conn.close()

# -- Mint HS256 JWT { sub: user_id } ----------------------------------------
def b64url(data):
    if isinstance(data, str): data = data.encode()
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

hdr = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(',', ':')))
now = int(time.time())
pay = b64url(json.dumps({"sub": user_id, "iat": now, "exp": now + 3600}, separators=(',', ':')))
msg = f"{hdr}.{pay}"
sig = hmac.new(bytes.fromhex(secret), msg.encode(), hashlib.sha256).digest()
print(f"{msg}.{b64url(sig)}")
PYEOF
)

echo "    DB:  $DB_PATH"
echo "    JWT: ${SESSION_JWT:0:40}..."
echo "    API key: ${TEST_API_KEY:0:20}..."

# ---- Start servers ---------------------------------------------------------
echo ""
echo "==> Starting sync server (sync :${SYNC_PORT}, internal :${INTERNAL_PORT})..."
SYNC_USER1="${TEST_EMAIL}:testpass" \
SYNC_BASE="$SYNC_BASE" \
SYNC_PORT="$SYNC_PORT" \
SYNC_INTERNAL_PORT="$INTERNAL_PORT" \
SYNC_INTERNAL_TOKEN="$SIDECAR_TOKEN" \
    "$SYNC_BIN" &>/tmp/smoke_sync.log &
SYNC_PID=$!

echo "==> Starting API (port :${API_PORT})..."
DATABASE_URL="file:${DB_PATH}" \
JWT_SECRET="$TEST_JWT_SECRET" \
TOKEN_ENCRYPTION_KEY="$TEST_ENCRYPTION_KEY" \
SIDECAR_URL="http://127.0.0.1:${INTERNAL_PORT}" \
SIDECAR_TOKEN="$SIDECAR_TOKEN" \
GOOGLE_CLIENT_ID="test-client-id" \
GOOGLE_CLIENT_SECRET="test-client-secret" \
PORT="$API_PORT" \
    bun run "$API_ENTRY" &>/tmp/smoke_api.log &
API_PID=$!

wait_for_http "http://127.0.0.1:${SYNC_PORT}/health"
wait_for_http "http://127.0.0.1:${API_PORT}/health"
echo "    sync PID $SYNC_PID, api PID $API_PID — ready"
echo ""

# ==========================================================================
# Section 1: Health
# ==========================================================================
echo "-- Health --"

code=$(curl -s -o /tmp/smoke_api_body -w "%{http_code}" "http://127.0.0.1:${API_PORT}/health")
assert_http "GET /health → 200" "200" "$code" "$(cat /tmp/smoke_api_body)"

# ==========================================================================
# Section 2: Auth guards
# ==========================================================================
echo ""
echo "-- Auth --"

code=$(curl -s -o /tmp/smoke_api_body -w "%{http_code}" "${BASE_URL}/decks")
assert_http "no bearer → 401" "401" "$code" "$(cat /tmp/smoke_api_body)"

code=$(curl -s -o /tmp/smoke_api_body -w "%{http_code}" \
    -H "Authorization: Bearer not-an-ak-key" "${BASE_URL}/decks")
assert_http "bad bearer (no ak_ prefix) → 401" "401" "$code" "$(cat /tmp/smoke_api_body)"

code=$(curl -s -o /tmp/smoke_api_body -w "%{http_code}" \
    -H "Authorization: Bearer ak_totallyinvalidkey0000000000000000000000000" "${BASE_URL}/decks")
assert_http "unknown ak_ key → 401" "401" "$code" "$(cat /tmp/smoke_api_body)"

# ==========================================================================
# Section 3: Decks — list
# ==========================================================================
echo ""
echo "-- Decks: list --"

code=$(api GET /decks)
body=$(cat /tmp/smoke_api_body)
assert_http "list decks → 200" "200" "$code" "$body"
assert_contains "response has 'decks' key" '"decks"' "$body"
assert_contains "nextCursor key present" '"nextCursor"' "$body"

DEFAULT_DECK_ID=$(echo "$body" | python3 -c "
import sys, json
decks = json.load(sys.stdin)['decks']
hit = next((d for d in decks if d['name'] == 'Default'), None)
print((hit or decks[0])['id'])
" 2>/dev/null || echo "")
echo "    Default deck id: $DEFAULT_DECK_ID"

# ==========================================================================
# Section 4: Decks — create / get / delete
# ==========================================================================
echo ""
echo "-- Decks: CRUD --"

code=$(api_with_body POST /decks '{"name":"SmokeTestDeck"}')
body=$(cat /tmp/smoke_api_body)
assert_http "create deck → 201" "201" "$code" "$body"
assert_contains "response has id" '"id"' "$body"
DECK_ID=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "    created deck id: $DECK_ID"

code=$(api GET "/decks/${DECK_ID}")
body=$(cat /tmp/smoke_api_body)
assert_http "get deck → 200" "200" "$code" "$body"
assert_contains "deck name correct" "SmokeTestDeck" "$body"

code=$(api GET "/decks/9999999999")
assert_http "get unknown deck → 404" "404" "$code" "$(cat /tmp/smoke_api_body)"

# ==========================================================================
# Section 5: Notes — create single
# ==========================================================================
echo ""
echo "-- Notes: create single --"

code=$(api_with_body POST "/decks/${DECK_ID}/notes" \
    '{"fields":{"Front":"Q1","Back":"A1"},"tags":["smoke"]}')
body=$(cat /tmp/smoke_api_body)
assert_http "create note → 201" "201" "$code" "$body"
NOTE_ID=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "    created note id: $NOTE_ID"

# ==========================================================================
# Section 6: Cards — bulk create (POST /v1/cards/bulk)
# ==========================================================================
echo ""
echo "-- Cards: bulk create --"

code=$(api_with_body POST "/cards/bulk" \
    "{\"deckId\":\"${DECK_ID}\",\"notes\":[
        {\"fields\":{\"Front\":\"BQ1\",\"Back\":\"BA1\"},\"tags\":[]},
        {\"fields\":{\"Front\":\"BQ2\",\"Back\":\"BA2\"},\"tags\":[\"bulk\"]},
        {\"fields\":{\"Front\":\"BQ3\",\"Back\":\"BA3\"},\"tags\":[]}
    ]}")
body=$(cat /tmp/smoke_api_body)
assert_http "bulk create 3 notes → 201" "201" "$code" "$body"
assert_contains "ids array returned" '"ids"' "$body"
BULK_COUNT=$(echo "$body" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['ids']))")
assert_eq "ids array length = 3" "3" "$BULK_COUNT"

# ==========================================================================
# Section 7: Notes — get / update / delete
# ==========================================================================
echo ""
echo "-- Notes: get / update / delete --"

code=$(api GET "/notes/${NOTE_ID}")
body=$(cat /tmp/smoke_api_body)
assert_http "get note → 200" "200" "$code" "$body"
assert_contains "note has fields" '"fields"' "$body"

code=$(api_with_body PUT "/notes/${NOTE_ID}" \
    '{"fields":{"Front":"Q1-edited","Back":"A1"},"tags":["updated"]}')
body=$(cat /tmp/smoke_api_body)
assert_http "update note → 200" "200" "$code" "$body"

code=$(api GET "/notes/${NOTE_ID}")
body=$(cat /tmp/smoke_api_body)
assert_contains "updated field visible" "Q1-edited" "$body"

code=$(api GET "/notes/9999999999")
assert_http "get unknown note → 404" "404" "$code" "$(cat /tmp/smoke_api_body)"

# ==========================================================================
# Section 8: Search — notes and cards
# ==========================================================================
echo ""
echo "-- Search: notes + cards --"

code=$(api GET "/notes/search?q=tag%3Abulk")
body=$(cat /tmp/smoke_api_body)
assert_http "GET /notes/search?q=tag:bulk → 200" "200" "$code" "$body"
SEARCH_COUNT=$(echo "$body" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['notes']))")
assert_eq "tag:bulk finds 1 note" "1" "$SEARCH_COUNT"

code=$(api GET "/notes/search?q=tag%3Aupdated")
body=$(cat /tmp/smoke_api_body)
assert_http "GET /notes/search?q=tag:updated → 200" "200" "$code" "$body"
UPDATED_COUNT=$(echo "$body" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['notes']))")
assert_eq "tag:updated finds 1 note (tag set by update in section 7)" "1" "$UPDATED_COUNT"

code=$(api GET "/cards/search?q=deck%3ASmokeTestDeck")
body=$(cat /tmp/smoke_api_body)
assert_http "GET /cards/search?q=deck:SmokeTestDeck → 200" "200" "$code" "$body"
assert_contains "notes array present in cards search" '"notes"' "$body"
DECK_TOTAL=$(echo "$body" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['notes']))")
[[ "$DECK_TOTAL" -ge 4 ]] && pass "deck search returns ≥4 notes (got ${DECK_TOTAL})" \
                           || fail "deck search returns <4 notes (got ${DECK_TOTAL})"

# ==========================================================================
# Section 9: Pagination — notes in deck (4 total: 1 single + 3 bulk)
# ==========================================================================
echo ""
echo "-- Pagination: notes in deck (4 total) --"

code=$(api GET "/decks/${DECK_ID}/notes?limit=2")
body=$(cat /tmp/smoke_api_body)
assert_http "list notes limit=2 → 200" "200" "$code" "$body"
PAGE1_COUNT=$(echo "$body" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['notes']))")
assert_eq "page 1 has 2 notes" "2" "$PAGE1_COUNT"
NEXT_CURSOR=$(echo "$body" | python3 -c "import sys,json; v=json.load(sys.stdin)['nextCursor']; print(v if v else 'None')")
[[ "$NEXT_CURSOR" != "None" ]] \
    && pass "nextCursor set after page 1" \
    || fail "nextCursor missing after page 1"
echo "    cursor after page 1: $NEXT_CURSOR"

code=$(api GET "/decks/${DECK_ID}/notes?limit=2&cursor=${NEXT_CURSOR}")
body=$(cat /tmp/smoke_api_body)
assert_http "list notes page 2 → 200" "200" "$code" "$body"
PAGE2_COUNT=$(echo "$body" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['notes']))")
assert_eq "page 2 has 2 notes" "2" "$PAGE2_COUNT"
CURSOR2=$(echo "$body" | python3 -c "import sys,json; v=json.load(sys.stdin)['nextCursor']; print(v if v else 'None')")
assert_eq "no more pages after page 2" "None" "$CURSOR2"

# ==========================================================================
# Section 10: API keys  (session cookie auth — /me/* routes)
# ==========================================================================
echo ""
echo "-- API keys --"

code=$(api_me GET "/me/api-keys")
body=$(cat /tmp/smoke_api_body)
assert_http "list api keys → 200" "200" "$code" "$body"
assert_contains "apiKeys array present" '"apiKeys"' "$body"
# Seeded key should be in the list
assert_contains "seeded key visible" '"smoke-test"' "$body"

code=$(api_me_with_body POST "/me/api-keys" '{"label":"Smoke test key"}')
body=$(cat /tmp/smoke_api_body)
assert_http "create api key → 201" "201" "$code" "$body"
assert_contains "key field present" '"key"' "$body"
KEY_ID=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
RAW_KEY=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin)['key'])")
echo "    created key id: $KEY_ID"
[[ "$RAW_KEY" == ak_* ]] && pass "key has 'ak_' prefix" || fail "key missing 'ak_' prefix: $RAW_KEY"

# newly created key should work on data endpoints
code=$(curl -s -o /tmp/smoke_api_body -w "%{http_code}" \
    -H "Authorization: Bearer ${RAW_KEY}" "${BASE_URL}/decks")
assert_http "newly created key works on data endpoint → 200" "200" "$code" "$(cat /tmp/smoke_api_body)"

code=$(api_me DELETE "/me/api-keys/${KEY_ID}")
body=$(cat /tmp/smoke_api_body)
assert_http "revoke api key → 200" "200" "$code" "$body"
assert_contains "ok:true in revoke response" '"ok"' "$body"

# revoked key should now 401
code=$(curl -s -o /tmp/smoke_api_body -w "%{http_code}" \
    -H "Authorization: Bearer ${RAW_KEY}" "${BASE_URL}/decks")
assert_http "revoked key → 401" "401" "$code" "$(cat /tmp/smoke_api_body)"

# ==========================================================================
# Section 11: Sync credentials  (session cookie auth — /me/* routes)
# ==========================================================================
echo ""
echo "-- Sync credentials --"

code=$(api_me GET "/me/sync-password")
body=$(cat /tmp/smoke_api_body)
assert_http "GET /me/sync-password (first call) → 200" "200" "$code" "$body"
assert_contains "username field present" '"username"' "$body"
SYNC_PASS=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin)['password'])")
[[ "$SYNC_PASS" != "None" && -n "$SYNC_PASS" ]] \
    && pass "password returned on first call" \
    || fail "password was null on first call"

code=$(api_me GET "/me/sync-password")
body=$(cat /tmp/smoke_api_body)
SYNC_PASS2=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin)['password'])")
assert_eq "second call returns null (password already set)" "None" "$SYNC_PASS2"

code=$(api_me POST "/me/sync-password/reset")
body=$(cat /tmp/smoke_api_body)
assert_http "POST /me/sync-password/reset → 200" "200" "$code" "$body"
SYNC_PASS3=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin)['password'])")
[[ "$SYNC_PASS3" != "None" && -n "$SYNC_PASS3" ]] \
    && pass "reset returns new password" \
    || fail "reset returned null password"

# ==========================================================================
# Section 12: Cleanup — delete note and deck
# ==========================================================================
echo ""
echo "-- Cleanup / delete --"

code=$(api DELETE "/notes/${NOTE_ID}")
body=$(cat /tmp/smoke_api_body)
assert_http "delete note → 200" "200" "$code" "$body"

code=$(api DELETE "/decks/${DECK_ID}")
body=$(cat /tmp/smoke_api_body)
assert_http "delete deck → 200" "200" "$code" "$body"

code=$(api GET "/decks/${DECK_ID}")
assert_http "get deleted deck → 404" "404" "$code" "$(cat /tmp/smoke_api_body)"

# ==========================================================================
# Summary
# ==========================================================================
echo ""
echo "================================================"
echo "Results: ${PASS_COUNT} passed, ${FAIL_COUNT} failed"
echo "================================================"
[[ $FAIL_COUNT -eq 0 ]]
