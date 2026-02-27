const { defaultConfigPath, readConfig, writeConfig } = require('./config-store');

const CARRIER_ALIASES = {
    amazon: 'amazon',
    dhl: 'dhl',
    fedex: 'fedEx',
    gofo: 'gofo',
    ontrac: 'onTrac',
    'pitney-bowes': 'pitneyBowes',
    pitneybowes: 'pitneyBowes',
    ups: 'ups',
    usps: 'usps',
    xpo: 'xpo',
    geocoder: 'geocoder',
    pettycache: 'pettyCache',
    dhl_ecommerce_solutions: 'dhlEcommerceSolutions'
};

const PROVIDER_CONFIG_SPECS = {
    amazon: {
        fields: [],
        required: []
    },
    dhl: {
        fields: [
            { flag: 'api-key', key: 'apiKey', label: 'API Key' }
        ],
        required: ['api-key']
    },
    fedEx: {
        fields: [
            { flag: 'api-key', key: 'api_key', label: 'API Key' },
            { flag: 'secret-key', key: 'secret_key', label: 'Secret Key' }
        ],
        required: ['api-key', 'secret-key']
    },
    gofo: {
        fields: [],
        required: []
    },
    onTrac: {
        fields: [],
        required: []
    },
    pitneyBowes: {
        fields: [],
        required: []
    },
    ups: {
        fields: [
            { flag: 'client-id', key: 'client_id', label: 'Client ID' },
            { flag: 'client-secret', key: 'client_secret', label: 'Client Secret' }
        ],
        required: ['client-id', 'client-secret']
    },
    usps: {
        fields: [
            { flag: 'consumer-key', key: 'consumer_key', label: 'Consumer Key' },
            { flag: 'consumer-secret', key: 'consumer_secret', label: 'Consumer Secret' }
        ],
        required: ['consumer-key', 'consumer-secret']
    },
    xpo: {
        fields: [
            { flag: 'api-key', key: 'api_key', label: 'API Key' },
            { flag: 'username', key: 'username', label: 'Username' },
            { flag: 'password', key: 'password', label: 'Password' }
        ],
        required: ['api-key', 'username', 'password']
    },
    geocoder: {
        fields: [
            { flag: 'api-key', key: 'apiKey', label: 'API Key' },
            { flag: 'provider', key: 'provider', label: 'Provider' },
            { flag: 'language', key: 'language', label: 'Language' },
            { flag: 'region', key: 'region', label: 'Region' }
        ],
        required: []
    },
    pettyCache: {
        fields: [
            { flag: 'host', key: 'host', label: 'Host' },
            { flag: 'port', key: 'port', label: 'Port' },
            { flag: 'auth-pass', key: 'options.auth_pass', label: 'Auth Pass' }
        ],
        required: []
    },
    dhlEcommerceSolutions: {
        fields: [],
        required: []
    }
};

class CliError extends Error {
    constructor(message, code, details) {
        super(message);
        this.name = 'CliError';
        this.code = code;
        this.details = details;
    }
}

function normalizeProvider(input) {
    if (!input) {
        return undefined;
    }

    const key = input.toLowerCase().replace(/\s+/g, '').replace(/_/g, '_');
    return CARRIER_ALIASES[key];
}

function normalizeFieldToken(input) {
    return String(input || '')
        .trim()
        .toLowerCase()
        .replace(/^--/, '')
        .replace(/_/g, '-');
}

function getProviderSpec(provider) {
    return PROVIDER_CONFIG_SPECS[provider] || { fields: [], required: [] };
}

function resolveFieldSpec(provider, fieldInput) {
    const normalized = normalizeFieldToken(fieldInput);
    const spec = getProviderSpec(provider);

    return spec.fields.find((field) => {
        const flagMatch = normalizeFieldToken(field.flag) === normalized;
        const keyMatch = normalizeFieldToken(field.key) === normalized;
        return flagMatch || keyMatch;
    });
}

function setByPath(target, pathKey, value) {
    const parts = pathKey.split('.');
    let cursor = target;

    for (let i = 0; i < parts.length - 1; i += 1) {
        const part = parts[i];
        cursor[part] = cursor[part] || {};
        cursor = cursor[part];
    }

    cursor[parts[parts.length - 1]] = value;
}

function getByPath(target, pathKey) {
    const parts = pathKey.split('.');
    let cursor = target;

    for (const part of parts) {
        if (!cursor || typeof cursor !== 'object' || !(part in cursor)) {
            return undefined;
        }
        cursor = cursor[part];
    }

    return cursor;
}

function hasByPath(target, pathKey) {
    return typeof getByPath(target, pathKey) !== 'undefined';
}

function deleteByPath(target, pathKey) {
    const parts = pathKey.split('.');
    let cursor = target;

    for (let i = 0; i < parts.length - 1; i += 1) {
        const part = parts[i];
        if (!cursor || typeof cursor !== 'object' || !(part in cursor)) {
            return false;
        }
        cursor = cursor[part];
    }

    const leaf = parts[parts.length - 1];
    if (!cursor || typeof cursor !== 'object' || !(leaf in cursor)) {
        return false;
    }

    delete cursor[leaf];
    return true;
}

function parseFlags(args, settings = {}) {
    const options = {
        output: 'json',
        stack: false,
        dynamicFlags: {}
    };
    const rest = [];
    const allowUnknown = settings.allowUnknown === true;

    for (let i = 0; i < args.length; i += 1) {
        const token = args[i];
        if (token === '--stack') {
            options.stack = true;
        } else if (token === '--output') {
            const next = args[i + 1];
            if (!next) {
                throw new CliError('Missing value for --output.', 'INVALID_ARGUMENT');
            }
            i += 1;
            options.output = next.toLowerCase();
        } else if (token === '--carrier') {
            const next = args[i + 1];
            if (!next) {
                throw new CliError('Missing value for --carrier.', 'INVALID_ARGUMENT');
            }
            i += 1;
            options.carrier = next;
        } else if (token === '--help' || token === '-h') {
            options.help = true;
        } else if (token.startsWith('--')) {
            if (!allowUnknown) {
                throw new CliError(`Unknown option: ${token}`, 'INVALID_ARGUMENT');
            }
            const next = args[i + 1];
            if (!next || next.startsWith('--')) {
                throw new CliError(`Missing value for ${token}.`, 'INVALID_ARGUMENT');
            }
            i += 1;
            options.dynamicFlags[token.slice(2).toLowerCase()] = next;
        } else {
            rest.push(token);
        }
    }

    if (!['json', 'text'].includes(options.output)) {
        throw new CliError('Invalid --output value. Use "json" or "text".', 'INVALID_ARGUMENT');
    }

    return { options, rest };
}

function outputJson(io, data) {
    io.out(JSON.stringify(data, null, 2));
}

function outputText(io, data) {
    io.out(data);
}

function formatTrackText(trackingNumber, carrier, data) {
    const lines = [
        `Tracking number: ${trackingNumber}`,
        `Carrier: ${carrier || 'auto-detect'}`
    ];

    if (data.shippedAt) {
        lines.push(`Shipped at: ${data.shippedAt}`);
    }
    if (data.deliveredAt) {
        lines.push(`Delivered at: ${data.deliveredAt}`);
    }
    if (data.estimatedDeliveryDate) {
        lines.push(
            `Estimated delivery: ${data.estimatedDeliveryDate.earliest || ''} -> ${data.estimatedDeliveryDate.latest || ''}`
        );
    }

    const events = Array.isArray(data.events) ? data.events : [];
    lines.push(`Events (${events.length}):`);

    for (const event of events) {
        const city = event.address && event.address.city ? event.address.city : '';
        const state = event.address && event.address.state ? event.address.state : '';
        const location = [city, state].filter(Boolean).join(', ');
        lines.push(`- ${event.date || 'n/a'} | ${event.description || 'n/a'}${location ? ` | ${location}` : ''}`);
    }

    return lines.join('\n');
}

function formatError(err, stack) {
    return {
        error: {
            message: err.message || 'Unknown error',
            code: err.code || 'UNKNOWN_ERROR',
            ...(err.details ? { details: err.details } : {}),
            ...(stack && err.stack ? { stack: err.stack } : {})
        }
    };
}

function printRootHelp(io) {
    io.out('bloodhound <command> [options]');
    io.out('');
    io.out('Commands:');
    io.out('  track <tracking-number> [--carrier <name>] [--output json|text] [--stack]');
    io.out('  guess <tracking-number> [--output json|text]');
    io.out('  carriers list [--output json|text]');
    io.out('  config set <provider> --<field> <value> [--<field> <value> ...] [--output json|text]');
    io.out('  config requirements <provider> [--output json|text]');
    io.out('  config get <provider> [key] [--output json|text]');
    io.out('  config delete <provider> [key] [--output json|text]');
    io.out('  config list [--output json|text]');
    io.out('');
    io.out('Use "bloodhound <command> --help" for command-specific details.');
}

function printTrackHelp(io) {
    io.out('bloodhound track <tracking-number> [options]');
    io.out('');
    io.out('Options:');
    io.out('  --carrier <name>   Explicit carrier (UPS, USPS, FedEx, DHL, etc)');
    io.out('  --output <format>  Output format: json | text (default: json)');
    io.out('  --stack            Include stack trace in errors');
}

function printGuessHelp(io) {
    io.out('bloodhound guess <tracking-number> [options]');
    io.out('');
    io.out('Options:');
    io.out('  --output <format>  Output format: json | text (default: json)');
}

function printConfigHelp(io) {
    io.out('bloodhound config <subcommand> [args] [options]');
    io.out('');
    io.out('Subcommands:');
    io.out('  set <provider> --<field> <value> [--<field> <value> ...]');
    io.out('  requirements <provider>');
    io.out('  get <provider> [key]');
    io.out('  delete <provider> [key]');
    io.out('  list');
    io.out('');
    io.out('Options:');
    io.out('  --output <format>  Output format: json | text (default: json)');
    io.out('');
    io.out('Examples:');
    io.out('  bloodhound config set usps --consumer-key <value> --consumer-secret <value>');
    io.out('  bloodhound config set ups --client-id <value> --client-secret <value>');
    io.out('  bloodhound config requirements fedex');
}

function printCarriersHelp(io) {
    io.out('bloodhound carriers list [options]');
    io.out('');
    io.out('Options:');
    io.out('  --output <format>  Output format: json | text (default: json)');
}

async function runCli(argv, deps = {}) {
    const io = deps.io || {
        out: (line) => process.stdout.write(`${line}\n`),
        err: (line) => process.stderr.write(`${line}\n`)
    };

    const configPath = deps.configPath || defaultConfigPath(deps.env);
    const createBloodhound = deps.createBloodhound || ((options) => {
        // Lazy-load for fast help/config commands and easier tests.
        // eslint-disable-next-line global-require
        const Bloodhound = require('@stores.com/bloodhound');
        return new Bloodhound(options);
    });

    try {
        if (!argv.length) {
            printRootHelp(io);
            return 0;
        }

        let [command, ...restArgs] = argv;
        const configAliasCommands = new Set(['set', 'get', 'delete', 'list', 'requirements']);
        if (configAliasCommands.has(command)) {
            restArgs = [command, ...restArgs];
            command = 'config';
        }

        if (command === 'config') {
            const { options, rest } = parseFlags(restArgs, { allowUnknown: true });
            if (options.help) {
                printConfigHelp(io);
                return 0;
            }
            const [subcommand, providerInput, key] = rest;
            const config = await readConfig(configPath);

            if (subcommand === 'list') {
                if (options.output === 'json') {
                    outputJson(io, { providers: config.providers });
                } else {
                    const providerNames = Object.keys(config.providers);
                    if (!providerNames.length) {
                        outputText(io, 'No providers configured.');
                    } else {
                        for (const name of providerNames) {
                            const keys = Object.keys(config.providers[name] || {});
                            outputText(io, `${name}: ${keys.join(', ')}`);
                        }
                    }
                }
                return 0;
            }

            if (subcommand === 'requirements') {
                const provider = normalizeProvider(providerInput);
                if (!provider) {
                    throw new CliError(
                        `Unknown provider "${providerInput}". Run "bloodhound carriers list" for valid providers.`,
                        'UNKNOWN_PROVIDER'
                    );
                }
                const spec = getProviderSpec(provider);
                const requiredFlags = spec.required.map((field) => `--${field}`);
                const optionalFlags = spec.fields
                    .map((field) => field.flag)
                    .filter((field) => !spec.required.includes(field))
                    .map((field) => `--${field}`);

                if (options.output === 'json') {
                    outputJson(io, {
                        provider,
                        requiredFlags,
                        optionalFlags
                    });
                } else {
                    if (!requiredFlags.length && !optionalFlags.length) {
                        outputText(io, `${provider} does not require additional configuration fields.`);
                    } else {
                        outputText(io, `${provider} requirements:`);
                        if (requiredFlags.length) {
                            outputText(io, `required: ${requiredFlags.join(', ')}`);
                        }
                        if (optionalFlags.length) {
                            outputText(io, `optional: ${optionalFlags.join(', ')}`);
                        }
                    }
                }
                return 0;
            }

            const provider = normalizeProvider(providerInput);
            if (!provider) {
                throw new CliError(
                    `Unknown provider "${providerInput}". Run "bloodhound carriers list" for valid providers.`,
                    'UNKNOWN_PROVIDER'
                );
            }
            const providerSpec = getProviderSpec(provider);

            if (subcommand === 'set') {
                if (key) {
                    throw new CliError(
                        'Usage: bloodhound config set <provider> --<field> <value> [--<field> <value> ...]',
                        'INVALID_ARGUMENT'
                    );
                }

                const providedFieldFlags = options.dynamicFlags;
                const providedFieldNames = Object.keys(providedFieldFlags);

                if (!providedFieldNames.length) {
                    if (providerSpec.required.length) {
                        throw new CliError(
                            `Missing required fields for ${provider}: ${providerSpec.required.map((field) => `--${field}`).join(', ')}. Run "bloodhound config requirements ${provider}" for details.`,
                            'INVALID_ARGUMENT'
                        );
                    }
                    throw new CliError(
                        'No configuration fields provided. Run "bloodhound config requirements <provider>" for fields.',
                        'INVALID_ARGUMENT'
                    );
                }

                if (!providerSpec.fields.length) {
                    throw new CliError(
                        `${provider} does not require configuration fields.`,
                        'INVALID_ARGUMENT'
                    );
                }

                const allowedFlagSet = new Set(providerSpec.fields.map((field) => normalizeFieldToken(field.flag)));
                const unknownFlags = providedFieldNames.filter((flag) => !allowedFlagSet.has(normalizeFieldToken(flag)));
                if (unknownFlags.length) {
                    const validFlags = providerSpec.fields.map((field) => `--${field.flag}`).join(', ');
                    throw new CliError(
                        `Unknown field(s) for ${provider}: ${unknownFlags.map((flag) => `--${flag}`).join(', ')}. Valid fields: ${validFlags}`,
                        'INVALID_ARGUMENT'
                    );
                }

                const existingProviderConfig = config.providers[provider] || {};
                const nextProviderConfig = { ...existingProviderConfig };

                for (const fieldSpec of providerSpec.fields) {
                    const normalizedFlag = normalizeFieldToken(fieldSpec.flag);
                    if (!(normalizedFlag in providedFieldFlags)) {
                        continue;
                    }

                    setByPath(nextProviderConfig, fieldSpec.key, providedFieldFlags[normalizedFlag]);
                }

                const missingRequired = providerSpec.required.filter((requiredFlag) => {
                    const requiredField = providerSpec.fields.find((field) => field.flag === requiredFlag);
                    if (!requiredField) {
                        return false;
                    }

                    return !hasByPath(nextProviderConfig, requiredField.key);
                });

                if (missingRequired.length) {
                    throw new CliError(
                        `Missing required fields for ${provider}: ${missingRequired.map((field) => `--${field}`).join(', ')}`,
                        'INVALID_ARGUMENT'
                    );
                }

                config.providers[provider] = nextProviderConfig;
                await writeConfig(configPath, config);
                if (options.output === 'json') {
                    outputJson(io, { ok: true, provider, configuredFlags: providedFieldNames.map((flag) => `--${flag}`) });
                } else {
                    outputText(io, `Saved ${provider} configuration (${providedFieldNames.map((flag) => `--${flag}`).join(', ')})`);
                }
                return 0;
            }

            if (subcommand === 'get') {
                const providerData = config.providers[provider] || {};
                if (key) {
                    const fieldSpec = resolveFieldSpec(provider, key);
                    const requestedKey = fieldSpec ? fieldSpec.key : key;
                    if (!hasByPath(providerData, requestedKey)) {
                        throw new CliError(`Config key not found: ${provider}.${requestedKey}`, 'NOT_FOUND');
                    }
                    if (options.output === 'json') {
                        outputJson(io, { provider, key: requestedKey, value: getByPath(providerData, requestedKey) });
                    } else {
                        outputText(io, String(getByPath(providerData, requestedKey)));
                    }
                } else if (options.output === 'json') {
                    outputJson(io, { provider, values: providerData });
                } else {
                    const keys = Object.keys(providerData);
                    if (!keys.length) {
                        outputText(io, `${provider} has no configured keys.`);
                    } else {
                        keys.forEach((k) => outputText(io, `${k}=${providerData[k]}`));
                    }
                }
                return 0;
            }

            if (subcommand === 'delete') {
                const providerData = config.providers[provider] || {};
                if (key) {
                    const fieldSpec = resolveFieldSpec(provider, key);
                    const requestedKey = fieldSpec ? fieldSpec.key : key;
                    if (!hasByPath(providerData, requestedKey)) {
                        throw new CliError(`Config key not found: ${provider}.${requestedKey}`, 'NOT_FOUND');
                    }
                    deleteByPath(providerData, requestedKey);
                    if (!Object.keys(providerData).length) {
                        delete config.providers[provider];
                    }
                } else {
                    delete config.providers[provider];
                }

                await writeConfig(configPath, config);
                if (options.output === 'json') {
                    outputJson(io, { ok: true, provider, deletedKey: key || null });
                } else {
                    outputText(io, key ? `Deleted ${provider}.${key}` : `Deleted ${provider}`);
                }
                return 0;
            }

            throw new CliError('Unknown config subcommand.', 'INVALID_ARGUMENT');
        }

        if (command === 'carriers') {
            const { options, rest } = parseFlags(restArgs);
            if (options.help) {
                printCarriersHelp(io);
                return 0;
            }
            const [subcommand] = rest;
            if (subcommand !== 'list') {
                throw new CliError('Usage: bloodhound carriers list', 'INVALID_ARGUMENT');
            }
            const carriers = ['amazon', 'dhl', 'fedEx', 'gofo', 'onTrac', 'pitneyBowes', 'ups', 'usps', 'xpo'];
            if (options.output === 'json') {
                outputJson(io, { carriers });
            } else {
                carriers.forEach((name) => io.out(name));
            }
            return 0;
        }

        if (command === 'guess') {
            const { options, rest } = parseFlags(restArgs);
            if (options.help) {
                printGuessHelp(io);
                return 0;
            }
            const [trackingNumber] = rest;
            if (!trackingNumber) {
                throw new CliError('Usage: bloodhound guess <tracking-number>', 'INVALID_ARGUMENT');
            }
            const client = createBloodhound((await readConfig(configPath)).providers);
            const carrier = client.guessCarrier(trackingNumber);
            if (!carrier) {
                throw new CliError('Unable to determine carrier from tracking number.', 'UNKNOWN_CARRIER');
            }
            const result = { trackingNumber, carrier };
            if (options.output === 'json') {
                outputJson(io, result);
            } else {
                outputText(io, `${carrier}`);
            }
            return 0;
        }

        if (command === 'track') {
            const { options, rest } = parseFlags(restArgs);
            if (options.help) {
                printTrackHelp(io);
                return 0;
            }
            const [trackingNumber] = rest;
            if (!trackingNumber) {
                throw new CliError('Usage: bloodhound track <tracking-number> [--carrier <name>]', 'INVALID_ARGUMENT');
            }
            const config = await readConfig(configPath);
            const client = createBloodhound(config.providers);
            const trackOptions = {};
            if (options.carrier) {
                trackOptions.carrier = options.carrier;
            }
            const data = await client.track(trackingNumber, trackOptions);
            const response = {
                trackingNumber,
                carrier: options.carrier || client.guessCarrier(trackingNumber) || null,
                result: data
            };
            if (options.output === 'json') {
                outputJson(io, response);
            } else {
                outputText(io, formatTrackText(trackingNumber, response.carrier, data));
            }
            return 0;
        }

        if (command === '--help' || command === '-h' || command === 'help') {
            printRootHelp(io);
            return 0;
        }

        throw new CliError(`Unknown command: ${command}`, 'INVALID_ARGUMENT');
    } catch (err) {
        const { options } = (() => {
            try {
                return parseFlags(argv);
            } catch (parseErr) {
                return { options: { output: 'text', stack: false } };
            }
        })();

        const payload = formatError(err, options.stack);
        if (options.output === 'json') {
            io.err(JSON.stringify(payload, null, 2));
        } else {
            io.err(`ERROR: ${payload.error.message}`);
            io.err(`Error Code: ${payload.error.code}`);
            if (payload.error.details) {
                io.err(`Details: ${JSON.stringify(payload.error.details)}`);
            }
            if (payload.error.stack) {
                io.err(payload.error.stack);
            }
        }
        return 1;
    }
}

module.exports = {
    runCli
};
