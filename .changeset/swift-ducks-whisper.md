---
"bloodhound-cli": patch
---

Fix publish workflow version extraction step quoting so GitHub Actions can write `steps.pkg.outputs.version` without bash syntax errors.
