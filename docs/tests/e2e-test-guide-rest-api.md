# E2E Test Guide — REST API (Issue #15)

Auth uses an httpOnly `session` cookie (JWT signed with JWT_SECRET via HS256).
The `sub` claim must match a real `users.id` row in SQLite.

---

## Option A: Docker Compose (full stack)

```bash
cd ~/Projects/anki-cloud
cp .env.example .env          # fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET, TOKEN_ENCRYPTION_KEY, SIDECAR_TOKEN
docker compose up
```

Open http://localhost:5173 → sign in with Google → DevTools → Application → Cookies → copy `session` value.

```bash
SESSION=<paste-cookie-value>
```

---

## Option B: Local binaries (faster iteration)

### 1. Build sync server (one-time, ~2 min)

```bash
cd ~/Projects/anki-cloud-sync
cargo build --bin anki-sync-server
```

### 2. Start sync server

```bash
cd ~/Projects/anki-cloud-sync
SYNC_USER1=test@example.com:testpassword \
SYNC_INTERNAL_PORT=8081 \
SYNC_INTERNAL_TOKEN=test-token \
./target/debug/anki-sync-server
# :8080 → Anki sync protocol   :8081 → sidecar
```

### 3. Run DB migrations

```bash
cd ~/Projects/anki-cloud
bun run db:migrate           # creates /tmp/test.db with schema (adjust DB path in .env)
```

### 4. Insert test user + mint session cookie

```bash
cd ~/Projects/anki-cloud

# insert test user into SQLite
sqlite3 "$(grep DATABASE_URL .env | cut -d= -f2- | sed 's/file://')" \
  "INSERT OR IGNORE INTO users (id, google_sub, email, name) VALUES ('test-user-1', 'gsub-test', 'test@example.com', 'Test');"

# mint JWT (sub must match the id above)
SESSION=$(bun --env-file .env -e "
const { SignJWT } = await import('jose');
const secret = new Uint8Array(Buffer.from(process.env.JWT_SECRET, 'hex'));
const token = await new SignJWT({ sub: 'test-user-1', email: 'test@example.com' })
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('1d')
  .sign(secret);
process.stdout.write(token);
")
echo "SESSION=$SESSION"
```

### 5. Start REST API

```bash
cd ~/Projects/anki-cloud/api
SIDECAR_URL=http://localhost:8081 SIDECAR_TOKEN=test-token bun run dev
```

---

## Curl test suite

Set `SESSION` via Option A or B above, then:

```bash
BASE=http://localhost:3000/v1
C="-b session=$SESSION -H 'Content-Type: application/json'"

# ── Decks ────────────────────────────────────────────────────────────────

# List decks (with pagination)
curl $C "$BASE/decks"
curl $C "$BASE/decks?limit=5"

# Create deck
DECK=$(curl -s $C -X POST "$BASE/decks" -d '{"name":"Test Deck"}')
echo $DECK
DECK_ID=$(echo $DECK | bun -e "const d=await Bun.stdin.json();process.stdout.write(d.id)")

# Get deck
curl $C "$BASE/decks/$DECK_ID"

# ── Notes ─────────────────────────────────────────────────────────────────

# Add note
NOTE=$(curl -s $C -X POST "$BASE/decks/$DECK_ID/notes" \
  -d '{"fields":{"Front":"What is 2+2?","Back":"4"},"tags":["math"]}')
echo $NOTE
NOTE_ID=$(echo $NOTE | bun -e "const d=await Bun.stdin.json();process.stdout.write(d.id)")

# List notes in deck (with pagination)
curl $C "$BASE/decks/$DECK_ID/notes"
curl $C "$BASE/decks/$DECK_ID/notes?limit=5"

# Get note
curl $C "$BASE/notes/$NOTE_ID"

# Update note
curl $C -X PUT "$BASE/notes/$NOTE_ID" \
  -d '{"fields":{"Front":"What is 2+2?","Back":"4 (updated)"},"tags":["math","updated"]}'

# Search notes
curl $C "$BASE/notes/search?q=deck:Test+Deck"
curl $C "$BASE/notes/search?q=tag:math&limit=10"

# ── Cards (backed by notes) ────────────────────────────────────────────────

# Search cards (same as notes search, Anki syntax identical)
curl $C "$BASE/cards/search?q=deck:Test+Deck"
curl $C "$BASE/cards/search?q=Front:*2+2*"

# Bulk create notes
curl $C -X POST "$BASE/cards/bulk" \
  -H "Idempotency-Key: bulk-test-001" \
  -d '{
    "deckId": "'"$DECK_ID"'",
    "notes": [
      {"fields": {"Front": "Capital of France?", "Back": "Paris"}},
      {"fields": {"Front": "Capital of Japan?",  "Back": "Tokyo"}, "tags": ["geography"]}
    ]
  }'

# ── Cleanup ────────────────────────────────────────────────────────────────

# Delete note
curl $C -X DELETE "$BASE/notes/$NOTE_ID"

# Delete deck (also deletes child notes)
curl $C -X DELETE "$BASE/decks/$DECK_ID"

# ── Error cases ────────────────────────────────────────────────────────────

# 404 from sidecar → should return {"error":"not found","code":"NOT_FOUND"}
curl $C "$BASE/decks/999999999999"

# Missing auth → 401
curl "$BASE/decks"
```

---

## Expected acceptance criteria

- [x] All endpoints return correct HTTP status codes (200/201 for success, 401/404/409/502 for errors)
- [x] `GET /v1/decks`, `GET /v1/decks/:id/notes`, `GET /v1/notes/search`, `GET /v1/cards/search` accept `limit` + `cursor` query params
- [x] `nextCursor` in list responses (null until sidecar implements pagination)
- [x] `POST /v1/decks`, `POST /v1/decks/:id/notes`, `POST /v1/cards/bulk` accept `Idempotency-Key` header
- [x] All routes covered by OpenAPI spec (check http://localhost:3000/doc)

## After sidecar sync (Anki Desktop)

1. Open Anki Desktop → Preferences → Sync → set server URL to http://localhost:8080
2. Sync
3. Verify deck "Test Deck" and notes created above appear in Anki
