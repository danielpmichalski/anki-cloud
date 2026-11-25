// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.

/** Security headers for the upload pages. The page is fully static: nothing from the request is echoed into it. */
export const UPLOAD_PAGE_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "content-security-policy":
    "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
} as const;

const SHELL = (body: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Upload to your Anki collection</title>
<style>
  body { font: 16px/1.5 system-ui, sans-serif; max-width: 32rem; margin: 3rem auto; padding: 0 1rem; color: #1a1a1a; }
  h1 { font-size: 1.4rem; }
  #drop { border: 2px dashed #888; border-radius: 12px; padding: 2rem 1rem; text-align: center; }
  #drop.over { border-color: #2563eb; background: #eff6ff; }
  button { font: inherit; padding: .5rem 1.2rem; border-radius: 8px; border: 0; background: #2563eb; color: #fff; cursor: pointer; }
  button:disabled { opacity: .5; cursor: default; }
  #msg { margin-top: 1rem; }
  .err { color: #b91c1c; } .ok { color: #166534; }
  small { color: #555; }
  @media (prefers-color-scheme: dark) { body { background: #111; color: #eee; } #drop.over { background: #1e293b; } small { color: #aaa; } .err { color: #f87171; } .ok { color: #4ade80; } }
</style>
</head>
<body>
${body}
</body>
</html>`;

export const uploadPageHtml = SHELL(`<h1>Upload to your Anki collection</h1>
<p>Pick one image or audio file. It is added to your collection and reaches your devices on their next sync.</p>
<div id="drop">
  <input id="file" type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,audio/mpeg,audio/ogg,audio/wav,audio/mp4,audio/3gpp,audio/amr,.mp3,.ogg,.wav,.m4a,.3gp,.amr">
  <p><small>PNG, JPEG, GIF, WebP, SVG up to 5 MB (SVG 200 KB); MP3, OGG, WAV, M4A, 3GP, AMR up to 10 MB.<br>This link works once and expires 5 minutes after it was created.</small></p>
  <button id="go" disabled>Upload</button>
</div>
<div id="msg" role="status"></div>
<script>
(function () {
  var file = document.getElementById("file"), go = document.getElementById("go"), msg = document.getElementById("msg"), drop = document.getElementById("drop");
  function show(text, cls) { msg.textContent = text; msg.className = cls || ""; }
  file.addEventListener("change", function () { go.disabled = !file.files.length; });
  ["dragover", "dragenter"].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.className = "over"; }); });
  ["dragleave", "drop"].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.className = ""; }); });
  drop.addEventListener("drop", function (ev) { if (ev.dataTransfer.files.length) { file.files = ev.dataTransfer.files; go.disabled = false; } });
  go.addEventListener("click", function () {
    if (!file.files.length) return;
    var fd = new FormData(); fd.append("file", file.files[0]);
    go.disabled = true; show("Uploading…");
    fetch(location.pathname, { method: "POST", body: fd, credentials: "omit" })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok, status: r.status, b: b }; }); })
      .then(function (r) {
        if (r.ok) { file.disabled = true; show("Uploaded as " + r.b.name + ". You can close this page.", "ok"); }
        else if (r.status === 410) { file.disabled = true; show("This link has expired or was already used. Ask your assistant for a new one.", "err"); }
        else { go.disabled = false; show((r.b && r.b.error) || "Upload failed", "err"); }
      })
      .catch(function () { go.disabled = false; show("Network error, try again", "err"); });
  });
})();
</script>`);

export const expiredPageHtml = SHELL(`<h1>Link expired</h1>
<p>This upload link has expired or was already used. Ask your assistant for a new one.</p>`);
