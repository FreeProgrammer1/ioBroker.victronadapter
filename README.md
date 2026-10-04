![Logo](admin/victronadapter.svg)

# ioBroker.victronadapter

[![NPM version](https://img.shields.io/npm/v/iobroker.victronadapter.svg)](https://www.npmjs.com/package/iobroker.victronadapter)
[![Downloads](https://img.shields.io/npm/dm/iobroker.victronadapter.svg)](https://www.npmjs.com/package/iobroker.victronadapter)
![Test and Release](https://github.com/FreeProgrammer1/ioBroker.victronadapter/workflows/Test%20and%20Release/badge.svg)

## Victron adapter for ioBroker

Reads Victron Energy GX devices (Cerbo GX, Ekrano GX, Color Control, Venus OS on Raspberry Pi) via **Modbus TCP**
and provides all values as ioBroker states. Writable Victron registers (ESS, relays, VE.Bus mode, …) are created as
writable states. An optional energy flow card for the ioBroker Lovelace adapter is included.

### Why a dedicated adapter instead of the generic Modbus adapter?

The generic `modbus` adapter needs every register to be configured by hand. This adapter already knows the Victron
register map (system, ESS settings, VE.Bus, battery, solar charger, grid meter, PV inverter, AC load, EV charger,
Multi RS, AC system), discovers the connected services automatically and calculates ready-to-use energy flow values
(grid import/export, house consumption, AC and essential loads, PV total, surplus).

## Requirements

- Node.js 22 or newer, js-controller 6.0.11 or newer, Admin 7.6.20 or newer
- GX device with **Modbus TCP enabled** (Settings → Integrations → Modbus TCP server)
- Network access from ioBroker to the GX device (TCP port 502)

## Configuration

| Tab | Setting | Description |
|---|---|---|
| Connection | GX IP address, port, timeout | Address of the GX device, normally port `502` |
| Connection | System Unit-ID | `100` for `com.victronenergy.system` |
| Connection | Poll interval | 1000–2000 ms for live dashboards |
| Automatic discovery | Unit-IDs to scan | Comma-separated list. The GX shows the real Unit-IDs under *Modbus TCP → Available services* |
| Statistics & forecast | Electricity price, feed-in tariff | Used for the savings in `statistics.*` (default 0.32 / 0.08 €/kWh) |
| Statistics & forecast | Usable battery capacity | For "battery full in"; `0` uses the Dynamic ESS battery capacity |
| Statistics & forecast | Import history from VRM, installation id, access token | Imports the daily values of the last 400 days from the VRM portal (see below) |
| Statistics & forecast | PV forecast state | Optional state of another adapter (e.g. pvforecast, Solcast) with today's forecast in kWh or Wh |
| Lovelace card | Enable Lovelace integration | Optional, see below. **Off by default** |
| Control | Allow write/control commands | Master switch for all writes. **Off by default** |
| Control | Control Unit-ID, setpoint options, safety range | Safety range applies to every writable state with unit `W` |
| Own registers | Table | Additional registers that the adapter does not know (see below) |

## States

| Channel | Content | Writable |
|---|---|---|
| `info.connection` | Connection to the GX device | – |
| `system.*` | Values of `com.victronenergy.system` (grid, PV, consumption, battery, Dynamic ESS) | GX relays `relay_1_state`, `relay_2_state` |
| `controls.*` | ESS settings (grid setpoint, min SOC, ESS mode, charge/discharge limits, feed-in limit, peak shaving, Dynamic ESS) | yes |
| `devices.unit_<id>.<profile>.*` | Automatically discovered services | see below |
| `custom.unit_<id>_reg_<address>` | Own registers from the configuration table | if marked writable |
| `flow.*` | Calculated energy flow values | – |
| `statistics.today.*`, `statistics.month.*`, `statistics.year.*` | Energy in kWh (PV, consumption, grid import, feed-in, battery charged/discharged, EV charger), self-sufficiency %, self-consumption %, savings € | – |
| `statistics.day_curve_json`, `statistics.history_json` | Day curve in 5 minute steps and daily values of the last 400 days | – |
| `dashboard.*`, `view.*` | Live values and JSON snapshots used by the Lovelace card and other visualisations | – |
| `dashboard.alarm_*`, `dashboard.battery_time_*`, `dashboard.battery_soh`, … | Alarms of all devices, battery full in / time to go, state of health, cycles, PV forecast | – |
| `status.*`, `lovelace.*` | Adapter status | – |

### How the statistics are calculated

The adapter integrates the live power values of every poll (trapezoidal rule) instead of relying on Victron energy
counters, so it works on every installation. Gaps longer than 15 minutes (adapter stopped, GX offline) are not
counted. The values are stored in `statistics.storage_json` and restored after a restart. At local midnight the
day is moved into the history. Consumption is the Victron AC consumption (`dashboard.house_total`).

The GX device provides **no history via Modbus TCP** – only live values and lifetime counters. Without further
configuration the statistics therefore start on the day the adapter is installed.

### History from the VRM portal

Enable **Import history from VRM** to fill the history with the values stored in the Victron VRM portal:

1. VRM portal → Preferences → Integrations → **Access tokens** → create a token.
2. The **installation id** is the number in the VRM address `https://vrm.victronenergy.com/installation/<ID>/dashboard`.
3. Enter both in the tab *Statistics & forecast* and save.

The adapter reads the daily kWh values (`/v2/installations/<ID>/stats?type=kwh&interval=days`) of the last 400 days
once and then the last days every 3 hours. Past days are taken from VRM; for today the higher value of VRM and the
local integration is used. Mapping of the VRM energy flows: PV = Pc+Pb+Pg, consumption = Pc+Gc+Bc,
grid import = Gc+Gb, feed-in = Pg+Bg, battery charged = Pb+Gb, battery discharged = Bc+Bg.
`statistics.vrm_status` shows the result of the last import.

- Self-sufficiency = (consumption − grid import) / consumption
- Self-consumption = (PV − feed-in) / PV
- Savings = (consumption − grid import) × electricity price + feed-in × feed-in tariff

### Writable device registers

| Profile | State | Register | Meaning |
|---|---|---|---|
| `vebus` | `mode` | 33 | 1 = charger only, 2 = inverter only, 3 = on, 4 = off |
| `vebus` | `ac_input_current_limit` | 22 | Active AC input current limit (A) |
| `vebus` | `ess_power_setpoint_l1/l2/l3` | 37/40/41 | ESS mode 3 (external control) phase setpoints (W) |
| `vebus` | `ess_disable_charge`, `ess_disable_feed_in` | 38/39 | ESS mode 3 flags |
| `solarcharger` | `mode` | 774 | 1 = on, 4 = off |
| `evcharger` | `mode`, `set_current`, `start_stop` | 3815/3825/3826 | EV charger control – please verify the addresses against the register list of your Venus OS version |

Registers that are not listed can be added in the **Own registers** tab. Take the address, data type and scale from
the official Victron document *"Modbus-TCP register list"* (download on victronenergy.com). The factor is the
multiplier applied after reading: Victron scale factor `10` → factor `0.1`.

### Safety

- Nothing is written to the GX device unless **Allow write/control commands** is enabled.
- Values are checked against the data type range, the min/max of the state and – for states with unit `W` – against
  the configured safety range before they are sent.
- A rejected command is overwritten with the real device value on the next poll.
- ESS phase setpoints on the VE.Bus device only work in ESS mode 3 (external control). Wrong values can lead to
  unwanted grid import or export. Use them only if you understand the Victron ESS documentation.

## Lovelace cards

When **Enable Lovelace integration** is switched on, the adapter

1. copies `victronadapter-card.js` and YAML examples into `/<lovelace instance>/cards/`
   (`victronadapter-dashboard.yaml` contains a complete view with all cards),
2. exposes the `dashboard.*`, `view.*`, `flow.*`, `system.*` and `statistics.*` values as Lovelace sensors
   (`sensor.victronadapter_0_dashboard_grid_total`, …) and all writable states as `input_number`, `input_select`
   or `switch` entities (needed by the control card).

After the first installation and after a card update the log asks you to **restart the Lovelace instance once**;
the adapter does not restart other instances by itself and does not delete files of other adapters.

All new cards follow the Lovelace theme (light/dark), speak German and English (`language: auto | de | en`) and can
be configured with the visual card editor. If you use a second adapter instance, add `instance: victronadapter.1`.

| Card | Content |
|---|---|
| `custom:victronadapter-flow-hub` | Compact energy flow: PV, house, grid, EV charger, battery and up to two own consumers around a hub, animated flow, rings, tap a circle for details (phases, AC/DC, battery), alarm badge |
| `custom:victronadapter-today` | Today / month / year: kWh tiles, self-sufficiency, self-consumption, savings |
| `custom:victronadapter-battery` | State of charge, charging/discharging power, full in / time to go, state of health, cycles, temperature, voltage, current |
| `custom:victronadapter-day-chart` | Day curve of PV, consumption and grid (5 min) with hover values, battery SoC, PV forecast |
| `custom:victronadapter-history` | Days of a month or months of a year as bars (PV, consumption, feed-in, grid import), navigation to earlier periods |
| `custom:victronadapter-status` | GX connection, alarms with device names, grid / island mode |
| `custom:victronadapter-surplus` | Surplus traffic light: green when big loads should run now |
| `custom:victronadapter-dess` | Dynamic ESS mode, strategy, target SoC, optional current electricity price (`price_entity`) |
| `custom:victronadapter-control` | ESS mode, minimum SoC, max. feed-in, Dynamic ESS, GX relays, EV charger, VE.Bus mode – every change asks for confirmation |
| `custom:victronadapter-mini` | One line with PV, house, grid and battery for phones (`navigation_path` opens another view) |
| `custom:victronadapter-flow`, `custom:victronadapter-flow-circle` | Previous energy flow cards (unchanged) |

### Troubleshooting: cards show no values

1. Instance settings → tab *Lovelace card*: **Enable Lovelace integration** must be checked. Save, the instance restarts
   and creates the Lovelace settings for all states (also the new `statistics.*` states).
2. **Restart the Lovelace instance** – Lovelace only learns new entities after a restart.
3. Reload the browser without cache (Ctrl+F5; in the app: clear cache) so the new card file is loaded.
4. If a card still shows no values, it lists the entity it searched for and the Victron entities Lovelace knows.
   Values can always be mapped manually: `values: { "dashboard.battery_soc": sensor.my_entity }`.

### Compact energy flow card options

```yaml
type: custom:victronadapter-flow-hub
pv_peak_w: 10000            # PV peak power for the orange ring (W)
show_ev: auto               # auto | true | false
subtract_ev_from_house: false
consumers:                  # up to two additional consumers
  - name: Wärmepumpe
    entity: sensor.waermepumpe_leistung   # any Lovelace entity in W
    icon: heatpump                       # heatpump | heater | pool | plug
```

| Option | Default | Meaning |
|---|---|---|
| `pv_peak_w` | `10000` | Peak power of the PV system; the PV ring shows current power / peak |
| `show_ev` | `auto` | Show the EV charger node (value from `dashboard.ev_power` or `values.ev_power`) |
| `subtract_ev_from_house` | `false` | Set to `true` if your house consumption already contains the EV charger |
| `consumers` | – | Additional consumers drawn below the hub |
| `min_flow_w` | `20` | Below this power a line is shown as idle |
| `values.<key>` | adapter states | Replace any value by another entity, e.g. `values: { ev_power: sensor.my_wallbox_power }` |

### Control card

Without configuration the card shows ESS mode, minimum SoC, max. feed-in, Dynamic ESS mode, GX relays and – when
detected – EV charger start/stop, EV charging current, VE.Bus mode and solar charger on/off. Own selection:

```yaml
type: custom:victronadapter-control
controls:
  - path: controls.minimum_soc_limit   # adapter state path
    name: Mindest-SoC
    step: 5
  - entity: switch.victronadapter_0_devices_unit_40_evcharger_start_stop
    name: Wallbox
```

Writes from Lovelace pass the same checks as all other writes: **Allow write/control commands** must be enabled and
values outside the configured ranges are rejected.

### Surplus traffic light

`surplus = feed-in + battery charging power (once the battery SoC ≥ min_soc)`. Green from `green_w` (1500 W),
yellow from `yellow_w` (300 W).

## Upgrade notes for 0.7.0

- The raw write channel `raw.write.*` was removed (it allowed writing any register on any Unit-ID). Use the writable
  states or the **Own registers** table instead. Existing `raw.*` objects are deleted automatically.
- For new instances the Lovelace integration is off by default. Existing instances keep their setting.
- The state `lovelace.lastRestart` was removed because the adapter no longer restarts Lovelace.
- States are only written when their value changes. `dashboard.last_update_ms` and `view.revision` still change on
  every poll and can be used as a heartbeat.

## Changelog

<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### 0.9.1

- Adapter requires admin >= 7.8.23 now.
- Updated dependencies (`@iobroker/adapter-core` 3.4.3, `@iobroker/testing` 6.3.0).
- Adapter tests now run with Node.js 22, 24 and 26.
- Responsive layout of the admin configuration (size attributes for all screen widths).
- Lovelace card uses `window.setTimeout()`; author contact data added to `package.json` and `LICENSE`.

### 0.9.0

- History import from the VRM portal (daily values of the last 400 days, updated every 3 hours); the access token is
  stored encrypted.

### 0.8.1

- Lovelace cards also find entities that Lovelace named differently and show a diagnosis when values are missing.

### 0.8.0

- Energy statistics in the adapter: today, month and year for PV, consumption, grid import, feed-in, battery and EV
  charger, self-sufficiency, self-consumption and savings; day curve (5 min) and 400 days of history; values survive
  restarts.
- New dashboard values: alarms of all devices, battery full in / time to go, state of health, cycles, capacity,
  PV forecast from another adapter.
- Writable states are exposed to Lovelace as `input_number`/`input_select`/`switch` when the Lovelace integration is
  enabled; enum registers (e.g. ESS mode) get state texts.
- 9 new Lovelace cards: today, battery, day curve, history, status, surplus traffic light, Dynamic ESS, control,
  mini tile. Visual card editor and German/English texts for the new cards.
- Compact flow card: up to two own consumers (e.g. heat pump), tap a circle for details, alarm badge.
- The Lovelace integration additionally installs `victronadapter-dashboard.yaml` with a complete view.

### 0.7.1

- New Lovelace card `custom:victronadapter-flow-hub`: PV, house, grid, EV charger and battery around a central hub with
  progress rings and animated energy flow (light and dark theme).
- New state `dashboard.ev_power` (sum of all detected Victron EV chargers).
- The Lovelace integration also installs the YAML example `victronadapter-flow-hub.yaml`.

### 0.7.0

- Writable Victron registers are created as regular writable states: GX relays, VE.Bus mode, AC input current
  limit, ESS phase setpoints and flags, solar charger on/off, EV charger control.
- New **Own registers** table for additional registers (read and optional write); replaces the raw write channel.
- Removed `raw.write.*` (deleted automatically on upgrade).
- Lovelace integration is optional (one checkbox), never restarts the Lovelace instance and never deletes files.
- States are only written when their value changed (much lower load on the states database and history adapters).
- State names and descriptions are available in English and German; complete admin translations.
- Fixed: duplicate solar charger states `pv_power`/`user_yield`, overlapping Dynamic ESS register 5429, missing
  shutdown handling for grouped reads, hard coded version in the JSON snapshot, poll interval 5000 ms was silently
  changed to 2000 ms.
- Added integration tests based on `@iobroker/testing`.

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

[Older changelogs can be found there](CHANGELOG_OLD.md)

## License

MIT License

Copyright (c) 2026 FreeProgrammer1 freeprogrammer1@mail.de

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
