const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');

const { runCli } = require('../src/cli');

function ioCapture() {
    let stdout = '';
    let stderr = '';

    return {
        io: {
            out: (line) => {
                stdout += `${line}\n`;
            },
            err: (line) => {
                stderr += `${line}\n`;
            }
        },
        getStdout: () => stdout.trimEnd(),
        getStderr: () => stderr.trimEnd()
    };
}

async function withTempConfig(testBody) {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bloodhound-cli-'));
    const configPath = path.join(tmpDir, 'config.json');
    await testBody(configPath);
    await fs.rm(tmpDir, { recursive: true, force: true });
}

test('config set/get/delete/list CRUDs provider keys via provider-specific flags', async () => {
    await withTempConfig(async (configPath) => {
        const capture = ioCapture();
        let code = await runCli(['config', 'set', 'ups', '--client-id', 'abc123', '--client-secret', 'shh'], {
            io: capture.io,
            configPath,
            createBloodhound: () => {
                throw new Error('should not instantiate bloodhound for config commands');
            }
        });
        assert.equal(code, 0);

        code = await runCli(['config', 'get', 'ups', 'client-id'], {
            io: capture.io,
            configPath,
            createBloodhound: () => {
                throw new Error('should not instantiate bloodhound for config commands');
            }
        });
        assert.equal(code, 0);
        assert.match(capture.getStdout(), /abc123/);

        code = await runCli(['config', 'list'], {
            io: capture.io,
            configPath,
            createBloodhound: () => {
                throw new Error('should not instantiate bloodhound for config commands');
            }
        });
        assert.equal(code, 0);
        assert.match(capture.getStdout(), /ups/);

        code = await runCli(['config', 'delete', 'ups', 'client-id'], {
            io: capture.io,
            configPath,
            createBloodhound: () => {
                throw new Error('should not instantiate bloodhound for config commands');
            }
        });
        assert.equal(code, 0);
    });
});

test('config set validates required provider-specific fields', async () => {
    await withTempConfig(async (configPath) => {
        const capture = ioCapture();
        const code = await runCli(['config', 'set', 'usps', '--consumer-key', 'abc-only'], {
            io: capture.io,
            configPath,
            createBloodhound: () => {
                throw new Error('should not instantiate bloodhound for config commands');
            }
        });

        assert.equal(code, 1);
        assert.match(capture.getStderr(), /consumer-secret/i);
    });
});

test('config requirements shows provider-required fields', async () => {
    const capture = ioCapture();
    const code = await runCli(['config', 'requirements', 'fedex', '--output', 'json'], {
        io: capture.io,
        createBloodhound: () => {
            throw new Error('should not instantiate bloodhound for config commands');
        }
    });

    assert.equal(code, 0);
    const parsed = JSON.parse(capture.getStdout());
    assert.equal(parsed.provider, 'fedEx');
    assert.deepEqual(parsed.requiredFlags, ['--api-key', '--secret-key']);
});

test('guess prints JSON by default', async () => {
    const capture = ioCapture();
    const code = await runCli(['guess', '1Z999AA10123456784'], {
        io: capture.io,
        createBloodhound: () => ({
            guessCarrier: () => 'UPS',
            track: async () => {
                throw new Error('not used');
            }
        })
    });

    assert.equal(code, 0);
    assert.equal(capture.getStderr(), '');
    assert.deepEqual(JSON.parse(capture.getStdout()), {
        carrier: 'UPS',
        trackingNumber: '1Z999AA10123456784'
    });
});

test('track supports text output format', async () => {
    const capture = ioCapture();
    const code = await runCli(['track', '123', '--carrier', 'UPS', '--output', 'text'], {
        io: capture.io,
        createBloodhound: () => ({
            guessCarrier: () => 'UPS',
            track: async () => ({
                shippedAt: '2026-01-01T00:00:00.000Z',
                deliveredAt: '2026-01-03T00:00:00.000Z',
                events: [
                    {
                        description: 'Delivered',
                        date: '2026-01-03T00:00:00.000Z',
                        address: { city: 'Austin', state: 'TX' }
                    }
                ]
            })
        })
    });

    assert.equal(code, 0);
    assert.equal(capture.getStderr(), '');
    assert.match(capture.getStdout(), /Delivered/);
    assert.match(capture.getStdout(), /tracking number: 123/i);
});

test('errors are human-readable in text mode', async () => {
    const capture = ioCapture();
    const code = await runCli(['track', '123', '--output', 'text'], {
        io: capture.io,
        createBloodhound: () => ({
            guessCarrier: () => 'UPS',
            track: async () => {
                const err = new Error('Invalid API key');
                err.code = 'AUTH_FAILED';
                throw err;
            }
        })
    });

    assert.equal(code, 1);
    assert.match(capture.getStderr(), /ERROR: Invalid API key/);
    assert.match(capture.getStderr(), /AUTH_FAILED/);
});

test('errors are structured in json mode and include stack when requested', async () => {
    const capture = ioCapture();
    const code = await runCli(['track', '123', '--output', 'json', '--stack'], {
        io: capture.io,
        createBloodhound: () => ({
            guessCarrier: () => 'UPS',
            track: async () => {
                const err = new Error('Unknown carrier');
                err.code = 'UNKNOWN_CARRIER';
                throw err;
            }
        })
    });

    assert.equal(code, 1);
    const body = JSON.parse(capture.getStderr());
    assert.equal(body.error.code, 'UNKNOWN_CARRIER');
    assert.equal(body.error.message, 'Unknown carrier');
    assert.ok(body.error.stack);
});

test('track --help returns command-specific usage for progressive discovery', async () => {
    const capture = ioCapture();
    const code = await runCli(['track', '--help'], {
        io: capture.io,
        createBloodhound: () => ({
            guessCarrier: () => 'UPS',
            track: async () => ({})
        })
    });

    assert.equal(code, 0);
    assert.match(capture.getStdout(), /bloodhound track <tracking-number>/i);
});
