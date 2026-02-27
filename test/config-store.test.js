const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { defaultConfigPath } = require('../src/config-store');

test('default config path is ~/.config/bloodhound/bloodhound.json', () => {
    const fakeHome = path.join(path.sep, 'tmp', 'test-home');
    const env = { HOME: fakeHome };
    const result = defaultConfigPath(env, { homedir: () => fakeHome });

    assert.equal(result, path.join(fakeHome, '.config', 'bloodhound', 'bloodhound.json'));
});

test('BLOODHOUND_CLI_CONFIG overrides default config path', () => {
    const override = path.join(path.sep, 'custom', 'bloodhound.json');
    const env = {
        BLOODHOUND_CLI_CONFIG: override,
        HOME: path.join(path.sep, 'tmp', 'ignored')
    };
    const result = defaultConfigPath(env, { homedir: () => path.join(path.sep, 'tmp', 'ignored') });

    assert.equal(result, override);
});
