#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const gitDir = path.join(repoRoot, '.git');
const hooksDir = path.join(gitDir, 'hooks');
const hookPath = path.join(hooksDir, 'pre-commit');
const templatePath = path.join(repoRoot, '.githooks', 'pre-commit');

if (!fs.existsSync(gitDir)) {
    process.exit(0);
}

if (!fs.existsSync(templatePath)) {
    console.error('ERROR: Missing hook template at .githooks/pre-commit');
    process.exit(1);
}

fs.mkdirSync(hooksDir, { recursive: true });
fs.copyFileSync(templatePath, hookPath);
fs.chmodSync(hookPath, 0o755);

console.log('Installed git pre-commit hook for changeset enforcement.');
