# bloodhound-cli

## CLI Entry Point

The correct entry point is `bin/bloodhound.js`, not `src/cli.js` directly.

```bash
node bin/bloodhound.js <command>
```

`src/cli.js` exports `runCli()` as a library function — calling it directly with `node src/cli.js` produces no output.

## Testing

Run unit tests in a subagent to avoid polluting the main context:

```bash
npm test
```
