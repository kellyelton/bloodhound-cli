# bloodhound-cli

## CLI Entry Point

The correct entry point is `bin/bloodhound.js`, not `src/cli.js` directly.

```bash
node bin/bloodhound.js <command>
```

`src/cli.js` exports `runCli()` as a library function — calling it directly with `node src/cli.js` produces no output.

## Bloodhound Submodule

`@stores.com/bloodhound` is currently linked to a local git submodule at `lib/bloodhound` (pointing to the `skip-geocoding-and-default-timezone` branch on kellyelton/bloodhound). This is temporary while PR https://github.com/stores-com/bloodhound/pull/146 is pending. Once that PR is merged, switch back to the npm package by changing `package.json` from `"file:lib/bloodhound"` to the appropriate version and removing the submodule.

## Testing

Run unit tests in a subagent to avoid polluting the main context:

```bash
npm test
```
