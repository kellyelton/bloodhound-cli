# bloodhound-cli

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
