#!/bin/sh
# Runtime configuration for the static web UI. SYNC_SERVER_URL is the address users type into Anki.
# When unset, the UI falls back to http://<current hostname>:8080.
set -eu

if [ -n "${SYNC_SERVER_URL:-}" ]; then
  escaped=$(printf '%s' "$SYNC_SERVER_URL" | sed 's/\\/\\\\/g; s/"/\\"/g')
  printf 'window.__CONFIG__ = { syncServerUrl: "%s" };\n' "$escaped" > /usr/share/nginx/html/config.js
else
  printf 'window.__CONFIG__ = {};\n' > /usr/share/nginx/html/config.js
fi
