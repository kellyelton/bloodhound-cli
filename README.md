# bloodhound-cli

Agent-friendly CLI wrapper for `@stores.com/bloodhound` to guess carriers, track shipments, and manage provider credentials.

## Install

```bash
npm install -g bloodhound-cli
```

Run it with:

```bash
bloodhound --help
```

## Command Model

```bash
bloodhound <command> [subcommand] [args] [options]
```

Core commands:

- `track <tracking-number>`: track package and return normalized data
- `guess <tracking-number>`: infer carrier from tracking number
- `carriers list`: show supported carriers/providers
- `config requirements <provider>`: show required credential fields for a provider
- `config set/get/delete/list`: CRUD provider credential settings

## Output and Error Modes

- Default output is JSON (`--output json`)
- Human-readable output is available with `--output text`
- Errors are always explicit and include:
  - human-readable message
  - stable error code
  - optional stack trace with `--stack`

Examples:

```bash
# Configure UPS credentials
bloodhound config set ups --client-id "$UPS_CLIENT_ID" --client-secret "$UPS_CLIENT_SECRET"

# Show required fields for a provider
bloodhound config requirements usps

# Configure USPS credentials
bloodhound config set usps --consumer-key "$USPS_CONSUMER_KEY" --consumer-secret "$USPS_CONSUMER_SECRET"

# Track with automatic carrier detection
bloodhound track 1Z999AA10123456784

# Track with explicit carrier and text output
bloodhound track 1Z999AA10123456784 --carrier UPS --output text

# Guess carrier
bloodhound guess 9400110200881234567890
```

## Configuration

Configuration is stored in:

- All platforms: `~/.config/bloodhound/bloodhound.json`

Override path with:

```bash
export BLOODHOUND_CLI_CONFIG=/path/to/config.json
```

## Development

```bash
npm test
```

## Versioning (Changesets)

This repo uses Changesets for release versioning.

```bash
# create a changeset for your commit
npm run changeset

# apply pending version bumps locally
npm run version-packages
```

A git `pre-commit` hook is installed automatically (`npm install`) and blocks commits unless a `.changeset/*.md` file is staged.
