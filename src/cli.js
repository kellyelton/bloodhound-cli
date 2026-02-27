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

function parseFlags(args) {
    const options = {
        output: 'json',
        stack: false
    };
    const rest = [];

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
            throw new CliError(`Unknown option: ${token}`, 'INVALID_ARGUMENT');
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
    io.out('  config set <provider> <key> <value> [--output json|text]');
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
    io.out('  set <provider> <key> <value>');
    io.out('  get <provider> [key]');
    io.out('  delete <provider> [key]');
    io.out('  list');
    io.out('');
    io.out('Options:');
    io.out('  --output <format>  Output format: json | text (default: json)');
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

        const [command, ...restArgs] = argv;

        if (command === 'config') {
            const { options, rest } = parseFlags(restArgs);
            if (options.help) {
                printConfigHelp(io);
                return 0;
            }
            const [subcommand, providerInput, key, value] = rest;
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

            const provider = normalizeProvider(providerInput);
            if (!provider) {
                throw new CliError(
                    `Unknown provider "${providerInput}". Run "bloodhound carriers list" for valid providers.`,
                    'UNKNOWN_PROVIDER'
                );
            }

            if (subcommand === 'set') {
                if (!key || typeof value === 'undefined') {
                    throw new CliError('Usage: bloodhound config set <provider> <key> <value>', 'INVALID_ARGUMENT');
                }
                config.providers[provider] = config.providers[provider] || {};
                config.providers[provider][key] = value;
                await writeConfig(configPath, config);
                if (options.output === 'json') {
                    outputJson(io, { ok: true, provider, key, value });
                } else {
                    outputText(io, `Saved ${provider}.${key}`);
                }
                return 0;
            }

            if (subcommand === 'get') {
                const providerData = config.providers[provider] || {};
                if (key) {
                    if (!(key in providerData)) {
                        throw new CliError(`Config key not found: ${provider}.${key}`, 'NOT_FOUND');
                    }
                    if (options.output === 'json') {
                        outputJson(io, { provider, key, value: providerData[key] });
                    } else {
                        outputText(io, String(providerData[key]));
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
                    if (!(key in providerData)) {
                        throw new CliError(`Config key not found: ${provider}.${key}`, 'NOT_FOUND');
                    }
                    delete providerData[key];
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
