- implement comprehensive unit tests for api module
- we have e2e module and ./scripts/smoke-test.sh - not sure if we should keep both or combine them somehow
  (note: smoke-test.sh still expects a sync binary at ../anki-cloud-sync/target/debug/anki-sync-server)
- make code more extensible following the Open-Closed principle; the below isn't extensible
  (api/src/routes/storage.ts):
  - if (provider !== "google") {
  return c.json({error: "Provider not yet supported", code: "UNSUPPORTED_PROVIDER"}, 400);
  }
- extend REST API with note tags fetching;
- README mentions docker-compose.dev.yml (removed in 15842e4) - update or drop that section
- supersede ADR-0005 (Google as sole OAuth provider) now that GitHub is supported
