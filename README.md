# ioBroker.victronadapter

Adapter for Victron GX and Cerbo GX systems via Modbus TCP.

## Required repository name

The ioBroker checker expects this repository name:

```text
FreeProgrammer1/ioBroker.victronadapter
```

The technical ioBroker adapter name remains lowercase:

```text
victronadapter
```

The npm package name is:

```text
iobroker.victronadapter
```

## GitHub upload note

This GitHub-ready package is already cleaned for the repository checker. Upload the extracted contents of this folder to GitHub, not the generated `.tgz` installation package. The repository root should directly contain `package.json`, `io-package.json`, `main.js`, `admin/`, `lib/`, `lovelace/`, `test/` and `.github/`.

## Features

- Reads Victron GX and Cerbo GX systems via Modbus TCP.
- Provides dashboard states for grid, PV, battery, AC loads and essential loads.
- Supports controls for selected Victron settings.
- Supports automatic discovery with a comma-separated Modbus Unit-ID list.
- Continues scanning when one Unit-ID does not answer or returns an exception.
- Stops running scans and polls cleanly on adapter unload/terminate.
- Provides a clean Lovelace card with normal and circular energy-flow examples.

## Requirements

- Node.js 22 or newer.
- ioBroker js-controller 6.0.11 or newer.
- ioBroker Admin 7.6.20 or newer.
- Victron GX, Cerbo GX or Venus OS device with Modbus TCP enabled.
- Network access from ioBroker to the GX device.

## Configuration

Configure the adapter instance in ioBroker Admin.

Important settings:

- GX IP address or hostname.
- Modbus TCP port, normally `502`.
- System Unit-ID, normally `100`.
- Poll interval.
- Automatic discovery.
- Comma-separated Unit-IDs for discovery.

Default discovery list:

```text
100,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,247
```

The configured system Unit-ID and control Unit-ID are always included automatically.

## Lovelace

The adapter can install these files into the configured Lovelace instance:

```text
victronadapter-card.js
victronadapter-flow.yaml
victronadapter-flow-circle.yaml
```

Normal card type:

```yaml
type: custom:victronadapter-flow
```

Circle card type:

```yaml
type: custom:victronadapter-flow-circle
```

The card uses the existing `dashboard.*` adapter states.

## Development

Run local checks:

```bash
npm test
npm run lint
npm run adapter-check
```

The `adapter-check` script checks npm and the official ioBroker repositories. It can still report that the adapter is not published on npm or not listed in the ioBroker latest repository until the adapter is officially released.

## Changelog

### 0.6.13

- Fixed GitHub workflow metadata so the adapter-tests job explicitly covers Node.js 20 and 22.
- Kept runtime metadata on Node.js 22 while making the workflow tolerant of npm engine warnings during the required Node.js 20 check.
- Added a checker-compatible old changelog file and link without publishing it to npm.

### 0.6.12

- Set package engine back to Node.js `>=22` to satisfy the current ioBroker checker recommendation.
- Updated GitHub Actions so the `adapter-tests` job uses a matrix with Node.js 20 and 22.
- Moved the maintained changelog fully into `README.md` and removed standalone changelog files from the package.
- Added complete `common.news` translations for the current release.
- Kept the robust Unit-ID scan, timeout handling and clean unload behavior.

### 0.6.11

- Validated `package.json` and `io-package.json` metadata.
- Kept robust Unit-ID scan, timeout handling and clean unload behavior.

### 0.6.10

- Removed the premature release-script setup because the repository is not using the full release-script workflow yet.
- Removed invalid root-level responsive attributes from `admin/jsonConfig.json`.

### 0.6.9

- Added responsive Admin configuration sizing.
- Added README changelog entries for checker compatibility.

### 0.6.8

- Added debug logging per checked Unit-ID.
- Added per Unit-ID timeout/error handling so scanning continues when a Unit-ID does not answer.
- Added clean cancellation of running scans and polls during unload/terminate.

### 0.6.7

- Fixed the Modbus TCP connect crash under Node.js 22 by correcting timer cleanup in the Modbus client.

## License

MIT License

Copyright (c) 2026 FreeProgrammer1

Older changelog entries: [CHANGELOG_OLD.md](CHANGELOG_OLD.md).
