#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const { hasValidChangesetFile } = require('../src/changeset-enforcement');

function getStagedFiles() {
    const output = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
        encoding: 'utf8'
    });

    return output
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}

function main() {
    if (process.env.SKIP_CHANGESET_HOOK === '1') {
        process.exit(0);
    }

    let stagedFiles;
    try {
        stagedFiles = getStagedFiles();
    } catch (err) {
        console.error('ERROR: Unable to read staged files.');
        console.error(err.message);
        process.exit(1);
    }

    if (!stagedFiles.length) {
        process.exit(0);
    }

    if (!hasValidChangesetFile(stagedFiles)) {
        console.error('ERROR: Commit blocked because no changeset file is staged.');
        console.error('Run: npm run changeset');
        console.error('This repository requires a .changeset/*.md file (excluding .changeset/README.md) in every commit.');
        process.exit(1);
    }
}

main();
