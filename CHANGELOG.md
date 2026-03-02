# bloodhound-cli

## 1.1.3

### Patch Changes

- 6650905: Use git dependency for @stores.com/bloodhound instead of local submodule so transitive dependencies install correctly.

## 1.1.2

### Patch Changes

- ef9b8c7: Fix test command for Node 20 compatibility.
- e5901fe: Fix USPS tracking by mapping consumer_key/consumer_secret to the library's expected client_id/client_secret. Use bloodhound fork with geocoding and timezone improvements as git submodule.
- 7fb49a2: Scope test runner to test/ directory to prevent running submodule tests in CI.

## 1.1.1

### Patch Changes

- 996a75c: Trigger a follow-up release after normalizing repository version state to 1.1.0.

## 1.1.0

### Minor Changes

- 56e5d3d: Improve provider configuration UX by requiring provider-specific named flags (for example `--consumer-key`, `--consumer-secret`) and add `config requirements <provider>` for discovery.

### Patch Changes

- c0a1a83: Add intuitive top-level config aliases (for example `bloodhound set ups`) and return provider-specific required fields when credentials are missing.
- 79ca23f: Add Changesets-based versioning and release flow, and enforce staged changesets with a committed pre-commit hook.
- 817dd6e: Fix publish workflow version extraction step quoting so GitHub Actions can write `steps.pkg.outputs.version` without bash syntax errors.
- af58720: Fix release automation so the CI versioning commit bypasses the local changeset pre-commit hook after changeset files are consumed.
