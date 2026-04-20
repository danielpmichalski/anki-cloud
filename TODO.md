- we have e2e module and ./scripts/smoke-test.sh - not sure if we should keep both or combine them somehow
- make code more extensible following the Open-Closed principle; the below isn't extensible:
  - if (provider !== "google") {
  return c.json({error: "Provider not yet supported", code: "UNSUPPORTED_PROVIDER"}, 400);
  }
- extend REST API with note tags fetching;
