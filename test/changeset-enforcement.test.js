const test = require('node:test');
const assert = require('node:assert/strict');

const { hasValidChangesetFile } = require('../src/changeset-enforcement');

test('detects valid changeset markdown file', () => {
    assert.equal(
        hasValidChangesetFile([
            'src/cli.js',
            '.changeset/fuzzy-pants-sing.md'
        ]),
        true
    );
});

test('ignores .changeset/README.md', () => {
    assert.equal(
        hasValidChangesetFile([
            '.changeset/README.md',
            'README.md'
        ]),
        false
    );
});

test('returns false when no changeset file is staged', () => {
    assert.equal(
        hasValidChangesetFile([
            'src/cli.js',
            'package.json'
        ]),
        false
    );
});
