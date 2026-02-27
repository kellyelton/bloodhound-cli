const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

function defaultConfigPath(env = process.env) {
    if (env.BLOODHOUND_CLI_CONFIG && env.BLOODHOUND_CLI_CONFIG.trim()) {
        return env.BLOODHOUND_CLI_CONFIG;
    }

    if (process.platform === 'win32') {
        const appData = env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        return path.join(appData, 'bloodhound-cli', 'config.json');
    }

    return path.join(os.homedir(), '.config', 'bloodhound-cli', 'config.json');
}

async function readConfig(configPath) {
    try {
        const raw = await fs.readFile(configPath, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            providers: parsed.providers || {}
        };
    } catch (err) {
        if (err.code === 'ENOENT') {
            return { providers: {} };
        }

        throw err;
    }
}

async function writeConfig(configPath, data) {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(data, null, 2));
}

module.exports = {
    defaultConfigPath,
    readConfig,
    writeConfig
};
