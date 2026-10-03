'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const utils = require('@iobroker/adapter-core');
const ioPackage = require('./io-package.json');
const { ModbusTcpClient } = require('./lib/modbusClient');
const { EnergyStatistics, ENERGY_KEYS } = require('./lib/statistics');
const { fetchVrmDays } = require('./lib/vrm');
const {
    SYSTEM_REGISTERS,
    FLOW_STATES,
    CONTROL_REGISTERS,
    DEVICE_PROFILES,
    getRegisterLength,
    decodeRegisters,
    encodeValue,
    stateCommon
} = require('./lib/registerMap');

const ADAPTER_VERSION = ioPackage.common.version;
const CUSTOM_REGISTER_TYPES = ['uint16', 'int16', 'uint32', 'int32'];

/**
 * Builds a translated text object for object names and descriptions.
 *
 * @param {string} en English text
 * @param {string} de German text
 */
function t(en, de) {
    return { en, de };
}

const LIVE_NAMES_EN = {
    last_update_ms: 'Dashboard update timestamp',
    grid_total: 'Grid power total',
    grid_flow: 'Grid flow direction',
    grid_status: 'Grid status',
    pv_total: 'PV total',
    pv_ac: 'PV AC',
    pv_dc: 'PV DC',
    house_total: 'House consumption total',
    ac_loads_total: 'AC loads total',
    essential_loads_total: 'Essential loads total',
    battery_soc: 'Battery state of charge',
    battery_power: 'Battery power',
    battery_flow: 'Battery flow direction',
    battery_voltage: 'Battery voltage',
    battery_current: 'Battery current',
    battery_temperature: 'Battery temperature',
    battery_status: 'Battery status',
    surplus: 'PV surplus',
    ev_power: 'EV charger power',
    alarm_count: 'Number of active alarms',
    alarm_level: 'Alarm level',
    alarms_json: 'Active alarms',
    battery_time_to_full_min: 'Battery full in',
    battery_time_to_go_min: 'Battery time to go',
    battery_capacity_kwh: 'Battery capacity',
    battery_soh: 'Battery state of health',
    battery_cycles: 'Battery charge cycles',
    pv_forecast_today_kwh: 'PV forecast today'
};

/**
 * English name for the calculated live values in dashboard.* and view.*.
 *
 * @param {string} id state id without channel
 */
function liveNameEn(id) {
    if (LIVE_NAMES_EN[id]) return LIVE_NAMES_EN[id];
    const phase = id.match(/^(.*)_l([123])$/);
    if (phase) {
        const base = {
            grid: 'Grid power',
            pv_ac: 'PV AC',
            house: 'House consumption',
            ac_loads: 'AC loads',
            essential_loads: 'Essential loads'
        }[phase[1]];
        if (base) return `${base} L${phase[2]}`;
    }
    return id.replace(/_/g, ' ');
}

class VictronAdapter extends utils.Adapter {
    constructor(options = {}) {
        super({
            ...options,
            name: 'victronadapter'
        });

        this.client = null;
        this.pollTimer = null;
        this.scanTimer = null;
        this.isPolling = false;
        this.isScanning = false;
        this.discoveredDevices = new Map();
        this.writableStates = new Map();
        this.customRegisters = [];
        this.lastValues = new Map();
        this.stateCache = new Map();
        this.stats = new EnergyStatistics();
        this.lastStatsWrite = 0;
        this.lastStatsPersist = 0;
        this.forecastTodayKwh = null;
        this.isStopping = false;

        this.on('ready', () => this.onReady());
        this.on('stateChange', (id, state) => this.onStateChange(id, state));
        this.on('unload', (callback) => this.onUnload(callback));
    }

    async onReady() {
        try {
            await this.setStateAsync('info.connection', false, true);
            this.normalizeConfig();
            this.client = new ModbusTcpClient({
                host: this.config.host,
                port: this.config.port,
                timeout: this.config.timeout,
                logger: this.log
            });

            await this.createBaseObjects();
            await this.createSystemObjects();
            await this.createFlowObjects();
            await this.createDashboardObjects();
            await this.createViewObjects();
            await this.createStatisticsObjects();
            await this.restoreStatistics();
            await this.setupForecast();
            this.setupVrmSync();
            await this.createControlObjects();
            await this.createCustomRegisterObjects();
            await this.removeLegacyRawObjects();
            await this.installLovelaceCard();

            await this.pollOnce();
            this.schedulePolling();

            if (this.config.enableDeviceScan) {
                await this.scanDevices();
                this.scheduleScan();
            }
        } catch (error) {
            this.log.error(`Startup failed: ${error.message}`);
            await this.safeSetStateAsync('info.connection', false, true).catch(() => undefined);
            // Only keep polling when the configuration itself was valid and a client exists.
            if (this.client) this.schedulePolling();
        }
    }

    normalizeConfig() {
        const cfg = this.config;
        const originalHost = String(cfg.host || '');
        const trimmedHost = originalHost.trim();
        const cleanedHost = trimmedHost.replace(/\s+/g, '');
        cfg.host = cleanedHost;
        cfg.port = Number(cfg.port || 502);
        cfg.timeout = Number(cfg.timeout || 3000);
        cfg.pollInterval = Number(cfg.pollInterval || 2000);
        cfg.unitIdSystem = Number(cfg.unitIdSystem || 100);
        cfg.controlUnitId = Number(cfg.controlUnitId || cfg.unitIdSystem || 100);
        const defaultScanUnitIds =
            '100,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,247';
        if (!cfg.scanUnitIds) {
            if (cfg.scanFrom || cfg.scanTo) {
                const from = Math.max(1, Math.min(255, Number(cfg.scanFrom || 223)));
                const to = Math.max(1, Math.min(255, Number(cfg.scanTo || 247)));
                const range = [];
                for (let id = Math.min(from, to); id <= Math.max(from, to); id++) range.push(id);
                cfg.scanUnitIds = [cfg.unitIdSystem, cfg.controlUnitId, ...range].join(',');
            } else {
                cfg.scanUnitIds = defaultScanUnitIds;
            }
        }
        cfg.scanUnitIds = this.normalizeUnitIdList(
            cfg.scanUnitIds,
            [cfg.unitIdSystem, cfg.controlUnitId],
            defaultScanUnitIds
        );
        cfg.scanInterval = Number(cfg.scanInterval || 300000);
        cfg.writeSafetyMinW = Number(cfg.writeSafetyMinW ?? -30000);
        cfg.writeSafetyMaxW = Number(cfg.writeSafetyMaxW ?? 30000);
        cfg.installLovelaceCard = cfg.installLovelaceCard === true;
        cfg.lovelaceInstance = String(cfg.lovelaceInstance || 'lovelace.0').trim() || 'lovelace.0';
        cfg.allowWrites = cfg.allowWrites === true;
        cfg.priceImport =
            Number.isFinite(Number(cfg.priceImport)) && cfg.priceImport !== '' ? Number(cfg.priceImport) : 0.32;
        cfg.priceExport =
            Number.isFinite(Number(cfg.priceExport)) && cfg.priceExport !== '' ? Number(cfg.priceExport) : 0.08;
        cfg.batteryCapacityKwh = Number(cfg.batteryCapacityKwh) > 0 ? Number(cfg.batteryCapacityKwh) : 0;
        cfg.forecastTodayStateId = String(cfg.forecastTodayStateId || '').trim();
        cfg.forecastUnit = cfg.forecastUnit === 'Wh' ? 'Wh' : 'kWh';
        cfg.vrmEnabled = cfg.vrmEnabled === true;
        cfg.vrmSiteId = String(cfg.vrmSiteId || '').trim();
        cfg.vrmToken = String(cfg.vrmToken || '').trim();
        this.customRegisters = this.normalizeCustomRegisters(cfg.customRegisters);

        if (trimmedHost && cleanedHost !== trimmedHost) {
            this.log.warn(`GX host/IP contained spaces and was normalized from '${trimmedHost}' to '${cleanedHost}'`);
        }
        if (!cfg.host) {
            throw new Error('No GX host/IP configured');
        }
        if (!Number.isInteger(cfg.port) || cfg.port < 1 || cfg.port > 65535) {
            throw new Error(`Invalid Modbus TCP port '${cfg.port}'`);
        }
        if (!Number.isInteger(cfg.unitIdSystem) || cfg.unitIdSystem < 0 || cfg.unitIdSystem > 255) {
            throw new Error(`Invalid system Unit-ID '${cfg.unitIdSystem}'`);
        }
        if (!Number.isInteger(cfg.controlUnitId) || cfg.controlUnitId < 0 || cfg.controlUnitId > 255) {
            throw new Error(`Invalid control Unit-ID '${cfg.controlUnitId}'`);
        }
        if (cfg.installLovelaceCard && !/^lovelace\.\d+$/.test(cfg.lovelaceInstance)) {
            this.log.warn(`Invalid Lovelace instance '${cfg.lovelaceInstance}', using lovelace.0`);
            cfg.lovelaceInstance = 'lovelace.0';
        }
    }

    /**
     * Validates the user defined register table from the admin UI.
     *
     * @param {any} rows table rows from the instance configuration
     */
    normalizeCustomRegisters(rows) {
        const result = [];
        const seen = new Set();
        for (const row of Array.isArray(rows) ? rows : []) {
            if (!row || row.enabled === false) continue;
            const unitId = Number(row.unitId);
            const address = Number(row.address);
            const type = CUSTOM_REGISTER_TYPES.includes(row.type) ? row.type : 'uint16';
            const scale = row.scale === undefined || row.scale === '' ? 1 : Number(row.scale);
            if (!Number.isInteger(unitId) || unitId < 0 || unitId > 255) {
                this.log.warn(`Custom register ignored: invalid Unit-ID '${row.unitId}'`);
                continue;
            }
            if (!Number.isInteger(address) || address < 0 || address > 65535) {
                this.log.warn(`Custom register ignored: invalid address '${row.address}'`);
                continue;
            }
            if (!Number.isFinite(scale) || scale === 0) {
                this.log.warn(`Custom register ${unitId}/${address} ignored: invalid scale '${row.scale}'`);
                continue;
            }
            const id = `unit_${unitId}_reg_${address}`;
            if (seen.has(id)) {
                this.log.warn(`Custom register ${unitId}/${address} is configured twice; only the first entry is used`);
                continue;
            }
            seen.add(id);
            const label = String(row.name || '').trim() || `Unit ${unitId} register ${address}`;
            const unit = String(row.unit || '').trim();
            result.push({
                id,
                unitId,
                name: label,
                nameDe: label,
                address,
                type,
                scale,
                unit: unit || undefined,
                role: row.writable ? (unit === 'W' ? 'level.power' : 'level') : unit === 'W' ? 'value.power' : 'value',
                write: row.writable === true,
                descriptionEn: `User defined register ${address} on Unit-ID ${unitId} (${type}, scale ${scale}).`,
                descriptionDe: `Benutzerdefiniertes Register ${address} auf Unit-ID ${unitId} (${type}, Faktor ${scale}).`
            });
        }
        return result;
    }

    schedulePolling() {
        if (this.isStopping) return;
        this.clearTimer('pollTimer');
        this.pollTimer = this.setInterval(() => this.pollOnce(), Math.max(1000, this.config.pollInterval));
    }

    scheduleScan() {
        if (this.isStopping) return;
        this.clearTimer('scanTimer');
        this.scanTimer = this.setInterval(() => this.scanDevices(), Math.max(60000, this.config.scanInterval));
    }

    clearTimer(name) {
        if (this[name]) {
            this.clearInterval(this[name]);
            this[name] = null;
        }
    }

    isShutdownError(error) {
        const message = String(error && error.message ? error.message : error || '');
        return (
            this.isStopping ||
            /DB closed|Connection is closed|Modbus connection closed|Adapter is stopping/i.test(message)
        );
    }

    isUnitTimeoutError(error) {
        const message = String(error && error.message ? error.message : error || '');
        return (
            error &&
            (error.code === 'TIMEOUT' ||
                /timeout|timed out|connection closed|ECONNRESET|EHOSTUNREACH|ENETUNREACH|ECONNREFUSED/i.test(message))
        );
    }

    formatScanError(error) {
        const message = String(error && error.message ? error.message : error || 'unknown error');
        const code = error && error.code !== undefined ? `, code=${error.code}` : '';
        return `${message}${code}`;
    }

    async safeSetStateAsync(id, value, ack = true) {
        if (this.isStopping) return false;
        // Only write when the value changed. This keeps the load on the states DB and on
        // history adapters low; live signals (timestamps, revision, JSON snapshots) change anyway.
        if (ack && this.stateCache.has(id) && this.stateCache.get(id) === value) return true;
        try {
            await this.setStateAsync(id, value, ack);
            if (ack) this.stateCache.set(id, value);
            return true;
        } catch (error) {
            if (this.isShutdownError(error)) {
                this.log.debug(`State update skipped during shutdown for ${id}: ${error.message}`);
                return false;
            }
            throw error;
        }
    }

    async ensureChannelObject(objectId, name, desc, native = {}) {
        const nextObject = {
            type: 'channel',
            common: { name, desc },
            native
        };
        const existing = await this.getObjectAsync(objectId);
        if (existing) {
            await this.setObjectAsync(objectId, {
                ...existing,
                type: 'channel',
                common: {
                    ...(existing.common || {}),
                    ...nextObject.common
                },
                native: {
                    ...(existing.native || {}),
                    ...nextObject.native
                }
            });
        } else {
            await this.setObjectNotExistsAsync(objectId, nextObject);
        }
    }

    async createBaseObjects() {
        await this.ensureChannelObject(
            'system',
            t('Victron system values', 'Victron Systemwerte'),
            t(
                'Values read directly from the GX device (grid, battery, PV, consumption).',
                'Direkt gelesene Systemwerte vom Cerbo/GX, zum Beispiel Netz, Batterie, PV und Hausverbrauch.'
            )
        );
        await this.ensureChannelObject(
            'flow',
            t('Calculated energy flow', 'Energiefluss berechnet'),
            t(
                'Calculated values for energy dashboards and visualisation.',
                'Berechnete, gut verständliche Werte für Energiezentrale und Visualisierung.'
            )
        );
        await this.ensureChannelObject(
            'controls',
            t('ESS control', 'ESS Steuerung'),
            t(
                'Writable ESS settings. Writing must be enabled in the instance settings.',
                'Schreibbare Steuerpunkte für ESS, Einspeisung, Batterie und Netz-Sollwerte. Schreiben muss in der Adapterkonfiguration freigegeben werden.'
            )
        );
        await this.ensureChannelObject(
            'devices',
            t('Discovered Victron devices', 'Gefundene Victron Geräte'),
            t(
                'Victron services detected automatically via Modbus Unit-IDs.',
                'Automatisch erkannte Victron-Dienste und Geräte über Modbus Unit-IDs.'
            )
        );
        await this.ensureChannelObject(
            'status',
            t('Adapter status', 'Adapterstatus'),
            t(
                'Connection, polling and discovery status.',
                'Statusinformationen zur Verbindung, Abfrage und Geräteerkennung.'
            )
        );
        await this.ensureStateObject(
            'status.lastPoll',
            {
                id: 'lastPoll',
                nameEn: 'Last successful poll',
                name: 'Letzte erfolgreiche Abfrage',
                descriptionEn: 'Time of the last successful poll.',
                description: 'Zeitpunkt der letzten erfolgreichen Datenabfrage.',
                type: 'string',
                role: 'date'
            },
            false
        );
        await this.ensureStateObject(
            'status.lastError',
            {
                id: 'lastError',
                nameEn: 'Last error',
                name: 'Letzter Fehler',
                descriptionEn: 'Last error or warning of the adapter.',
                description: 'Letzte Fehler- oder Warnmeldung des Adapters.',
                type: 'string',
                role: 'text'
            },
            false
        );
        await this.ensureStateObject(
            'status.discoveredCount',
            {
                id: 'discoveredCount',
                nameEn: 'Number of discovered device profiles',
                name: 'Anzahl erkannter Geräteprofile',
                descriptionEn: 'Number of automatically detected Victron device profiles.',
                description: 'Anzahl automatisch erkannter Victron-Geräteprofile.',
                type: 'number',
                role: 'value'
            },
            false
        );
        await this.ensureChannelObject(
            'lovelace',
            t('Lovelace visualisation', 'Lovelace Visualisierung'),
            t(
                'Status of the optional Victron energy flow card for ioBroker Lovelace.',
                'Status der optionalen Victron-Energieflusskarte für ioBroker Lovelace.'
            )
        );
        await this.ensureStateObject(
            'lovelace.cardInstalled',
            {
                id: 'cardInstalled',
                nameEn: 'Lovelace card installed',
                name: 'Lovelace-Karte installiert',
                descriptionEn: 'True when the card was copied into the Lovelace instance.',
                description:
                    'Zeigt an, ob die Victron-Energieflusskarte erfolgreich in die Lovelace-Instanz kopiert wurde.',
                type: 'boolean',
                role: 'indicator'
            },
            false
        );
        await this.ensureStateObject(
            'lovelace.cardPath',
            {
                id: 'cardPath',
                nameEn: 'Lovelace card path',
                name: 'Pfad der Lovelace-Karte',
                descriptionEn: 'Target path of the custom card in the Lovelace instance.',
                description: 'Zielpfad der installierten Custom Card in der Lovelace-Instanz.',
                type: 'string',
                role: 'text'
            },
            false
        );
        await this.ensureStateObject(
            'lovelace.cardError',
            {
                id: 'cardError',
                nameEn: 'Lovelace card error',
                name: 'Lovelace-Kartenfehler',
                descriptionEn: 'Last error while installing or updating the Lovelace card.',
                description: 'Letzter Fehler bei Installation oder Aktualisierung der Lovelace-Karte.',
                type: 'string',
                role: 'text'
            },
            false
        );
        // State of 0.6.x that is no longer used (the adapter does not restart Lovelace anymore).
        await this.delObjectAsync('lovelace.lastRestart').catch(() => undefined);
    }

    /**
     * Copies the bundled Lovelace custom card and YAML examples into the file storage of the
     * configured Lovelace instance. Only runs when the user enabled the option.
     * The Lovelace instance is never restarted or modified otherwise; foreign files are not deleted.
     */
    async installLovelaceCard() {
        if (!this.config.installLovelaceCard) {
            await this.safeSetStateAsync('lovelace.cardInstalled', false, true);
            await this.safeSetStateAsync('lovelace.cardError', '', true);
            return;
        }

        const instance = this.config.lovelaceInstance || 'lovelace.0';
        const files = [
            'cards/victronadapter-card.js',
            'cards/victronadapter-flow.yaml',
            'cards/victronadapter-flow-circle.yaml',
            'cards/victronadapter-flow-hub.yaml',
            'cards/victronadapter-dashboard.yaml'
        ];
        const statePath = files.map((file) => `/${instance}/${file}`).join(', ');

        try {
            const lovelaceObj = await this.getForeignObjectAsync(`system.adapter.${instance}`);
            if (!lovelaceObj) {
                const msg = `Lovelace instance ${instance} not found. Install the Lovelace adapter first, then restart this instance.`;
                await this.safeSetStateAsync('lovelace.cardInstalled', false, true);
                await this.safeSetStateAsync('lovelace.cardPath', statePath, true);
                await this.safeSetStateAsync('lovelace.cardError', msg, true);
                this.log.warn(msg);
                return;
            }

            const sources = {
                'cards/victronadapter-card.js': await fs.readFile(
                    path.join(__dirname, 'lovelace', 'victronadapter-card.js'),
                    'utf8'
                ),
                'cards/victronadapter-flow.yaml': this.buildLovelaceYaml('custom:victronadapter-flow', false),
                'cards/victronadapter-flow-circle.yaml': this.buildLovelaceYaml(
                    'custom:victronadapter-flow-circle',
                    true
                ),
                'cards/victronadapter-flow-hub.yaml': this.buildLovelaceYaml('custom:victronadapter-flow-hub', false, [
                    'pv_peak_w: 10000',
                    'show_ev: auto',
                    'subtract_ev_from_house: false',
                    'show_debug: false'
                ]),
                'cards/victronadapter-dashboard.yaml': this.buildDashboardYaml()
            };

            let changed = false;
            for (const file of files) {
                const current = await this.readForeignFileText(instance, file);
                if (current === sources[file]) continue;
                await this.writeFileAsync(instance, file, sources[file]);
                changed = true;
                this.log.info(`Lovelace file installed/updated: /${instance}/${file}`);
            }

            await this.safeSetStateAsync('lovelace.cardInstalled', true, true);
            await this.safeSetStateAsync('lovelace.cardPath', statePath, true);
            await this.safeSetStateAsync('lovelace.cardError', '', true);
            if (changed) {
                this.log.info(
                    `The Victron Lovelace card was installed or updated. Please restart ${instance} once so Lovelace loads the new card.`
                );
            }
        } catch (error) {
            await this.safeSetStateAsync('lovelace.cardInstalled', false, true);
            await this.safeSetStateAsync('lovelace.cardPath', statePath, true);
            await this.safeSetStateAsync('lovelace.cardError', error.message, true);
            this.log.warn(`Could not install Lovelace custom card: ${error.message}`);
        }
    }

    /**
     * Returns the content of a file in the ioBroker file storage as text, or null if it does not exist.
     *
     * @param {string} instance adapter instance owning the file storage
     * @param {string} file file path inside the storage
     */
    async readForeignFileText(instance, file) {
        try {
            const result = await this.readFileAsync(instance, file);
            return this.fileContentToString(result);
        } catch {
            return null;
        }
    }

    /**
     * Builds one of the YAML example files for the Lovelace card.
     *
     * @param {string} type Lovelace card type
     * @param {boolean} circle true for the circle variant
     */
    /** Complete example view with all cards (paste into the raw configuration editor). */
    buildDashboardYaml() {
        const instance = this.namespace;
        const card = (type, extra = []) => [
            `      - type: custom:${type}`,
            ...(instance === 'victronadapter.0' ? [] : [`        instance: ${instance}`]),
            ...extra.map((line) => `        ${line}`)
        ];
        return [
            '# Victron dashboard view - paste into Lovelace: Edit dashboard > Raw configuration editor > views',
            'title: Energie',
            'path: energie',
            'icon: mdi:solar-power',
            'cards:',
            '  - type: vertical-stack',
            '    cards:',
            ...card('victronadapter-status'),
            ...card('victronadapter-flow-hub', [
                'pv_peak_w: 10000',
                'show_ev: auto',
                '# consumers:',
                '#   - name: Wärmepumpe',
                '#     entity: sensor.waermepumpe_leistung',
                '#     icon: heatpump'
            ]),
            ...card('victronadapter-mini'),
            '  - type: vertical-stack',
            '    cards:',
            ...card('victronadapter-today'),
            ...card('victronadapter-day-chart'),
            ...card('victronadapter-history'),
            '  - type: vertical-stack',
            '    cards:',
            ...card('victronadapter-battery'),
            ...card('victronadapter-surplus'),
            ...card('victronadapter-dess', ['# price_entity: sensor.tibber_price']),
            ...card('victronadapter-control'),
            ''
        ].join('\n');
    }

    buildLovelaceYaml(type, circle, extraLines = []) {
        const ns = this.namespace;
        const sensorPrefix = `sensor.${ns.replace(/\./g, '_')}_dashboard`;
        const keys = [
            'last_update_ms',
            'grid_total',
            'grid_l1',
            'grid_l2',
            'grid_l3',
            'grid_status',
            'pv_total',
            'pv_ac',
            'pv_ac_l1',
            'pv_ac_l2',
            'pv_ac_l3',
            'pv_dc',
            'house_total',
            'ac_loads_total',
            'ac_loads_l1',
            'ac_loads_l2',
            'ac_loads_l3',
            'essential_loads_total',
            'essential_loads_l1',
            'essential_loads_l2',
            'essential_loads_l3',
            'battery_soc',
            'battery_power',
            'battery_voltage',
            'battery_current',
            'battery_temperature',
            'battery_status',
            'surplus',
            'ev_power'
        ];
        const lines = [`type: ${type}`, 'title: Energiefluss', 'subtitle: Victron Adapter', 'show_details: true'];
        if (circle) lines.push('transparent_background: true');
        lines.push(...extraLines);
        if (!extraLines.some((line) => line.startsWith('show_debug'))) lines.push('show_debug: true');
        lines.push('values:');
        for (const key of keys) {
            lines.push(`  ${key}:`, `    - ${sensorPrefix}_${key}`, `    - ${ns}.dashboard.${key}`);
        }
        lines.push('');
        return lines.join('\n');
    }

    fileContentToString(value) {
        if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'file')) {
            value = value.file;
        }
        if (Buffer.isBuffer(value)) return value.toString('utf8');
        if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8');
        if (value === null || value === undefined) return '';
        return String(value);
    }

    sanitizeLovelaceEntityName(value) {
        return (
            String(value || '')
                .toLowerCase()
                .replace(/ä/g, 'ae')
                .replace(/ö/g, 'oe')
                .replace(/ü/g, 'ue')
                .replace(/ß/g, 'ss')
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '')
                .substring(0, 120) || 'victron_value'
        );
    }

    buildLovelaceCustom(objectId, definition, writable, common = {}) {
        if (!this.config.installLovelaceCard) return null;
        const instance = String(this.config.lovelaceInstance || 'lovelace.0').trim() || 'lovelace.0';
        if (!/^lovelace\.\d+$/.test(instance)) return null;

        const exposed = ['system.', 'flow.', 'dashboard.', 'view.', 'statistics.', 'controls.', 'devices.', 'custom.'];
        if (!exposed.some((prefix) => objectId.startsWith(prefix))) return null;
        // Read-only device values stay in ioBroker (there are hundreds); writable ones are needed by the control card.
        if (
            !writable &&
            (objectId.startsWith('devices.') || objectId.startsWith('custom.') || objectId.startsWith('controls.'))
        ) {
            return null;
        }
        if (objectId === 'statistics.storage_json') return null;
        if (writable) {
            // Writes from Lovelace go through the same checks (allowWrites, ranges) as every other write.
            const name = this.sanitizeLovelaceEntityName(`${this.namespace}_${objectId.replace(/\./g, '_')}`);
            const entity = definition.boolean
                ? 'switch'
                : definition.states || common.states
                  ? 'input_select'
                  : 'input_number';
            return { [instance]: { enabled: true, entity, name } };
        }

        const commonType = definition.commonType || definition.objectType || definition.type;
        const ioBrokerType = ['string', 'number', 'boolean', 'mixed', 'array', 'object'].includes(commonType)
            ? commonType
            : definition.boolean
              ? 'boolean'
              : 'number';
        if (!['number', 'string', 'boolean'].includes(ioBrokerType)) return null;

        const name = this.sanitizeLovelaceEntityName(`${this.namespace}_${objectId.replace(/\./g, '_')}`);
        return {
            [instance]: {
                enabled: true,
                entity: ioBrokerType === 'boolean' ? 'binary_sensor' : 'sensor',
                name
            }
        };
    }

    async ensureStateObject(objectId, definition, writable, native = {}) {
        const common = stateCommon(definition, writable);
        if (writable && common.type === 'number') {
            if (definition.unit === 'W' && common.min === undefined) common.min = this.config.writeSafetyMinW;
            if (definition.unit === 'W' && common.max === undefined) common.max = this.config.writeSafetyMaxW;
            if (definition.unit === '%' && common.min === undefined) common.min = 0;
            if (definition.unit === '%' && common.max === undefined) common.max = 100;
        }
        const lovelaceCustom = this.buildLovelaceCustom(objectId, definition, writable, common);
        if (lovelaceCustom) {
            common.custom = lovelaceCustom;
        }

        const nextObject = {
            type: 'state',
            common,
            native
        };
        const existing = await this.getObjectAsync(objectId);
        if (existing) {
            const mergedCommon = {
                ...(existing.common || {}),
                ...nextObject.common
            };
            if ((existing.common && existing.common.custom) || nextObject.common.custom) {
                mergedCommon.custom = {
                    ...((existing.common && existing.common.custom) || {}),
                    ...(nextObject.common.custom || {})
                };
            }

            await this.setObjectAsync(objectId, {
                ...existing,
                type: 'state',
                common: mergedCommon,
                native: {
                    ...(existing.native || {}),
                    ...nextObject.native
                }
            });
        } else {
            await this.setObjectNotExistsAsync(objectId, nextObject);
        }
    }

    async createSystemObjects() {
        for (const definition of SYSTEM_REGISTERS) {
            const objectId = `system.${definition.id}`;
            await this.ensureStateObject(objectId, definition, Boolean(definition.write), {
                unitId: this.config.unitIdSystem,
                address: definition.address,
                type: definition.type,
                scale: definition.scale
            });
            if (definition.write) await this.registerWritableState(objectId, this.config.unitIdSystem, definition);
        }
    }

    /**
     * Remembers a writable state together with its Modbus target and subscribes to it.
     *
     * @param {string} objectId state id relative to the adapter namespace
     * @param {number} unitId Modbus Unit-ID that receives the write
     * @param {object} definition register definition
     */
    async registerWritableState(objectId, unitId, definition) {
        const fullId = `${this.namespace}.${objectId}`;
        if (!this.writableStates.has(fullId)) {
            await this.subscribeStatesAsync(objectId);
        }
        this.writableStates.set(fullId, { objectId, unitId, definition });
    }

    async createFlowObjects() {
        for (const definition of FLOW_STATES) {
            await this.ensureStateObject(`flow.${definition.id}`, definition, false, {
                calculated: true
            });
        }
    }

    async createDashboardObjects() {
        await this.ensureChannelObject(
            'dashboard',
            t('Live dashboard values', 'Lovelace Dashboard'),
            t(
                'Synchronised live values for dashboards and the Lovelace energy flow cards, all from the same poll cycle.',
                'Synchronisierte Live-Werte für die Lovelace-Energieflusskarten. Die Einzelwerte und die JSON-Momentaufnahme stammen aus demselben Abfragezyklus.'
            )
        );
        await this.ensureStateObject(
            'dashboard.snapshot_json',
            {
                id: 'snapshot_json',
                nameEn: 'Dashboard snapshot',
                descriptionEn: 'JSON snapshot with grid, PV, battery, loads and flow direction from one poll cycle.',
                name: 'Dashboard Momentaufnahme',
                friendlyName: 'Dashboard Momentaufnahme',
                description:
                    'JSON-Momentaufnahme für die Victron Lovelace-Karten. Enthält Netz, PV, Batterie, Lasten und Flussrichtung aus einem Polling-Zyklus.',
                commonType: 'string',
                type: 'string',
                role: 'json'
            },
            false,
            { calculated: true, snapshot: true }
        );

        const dashboardStates = [
            [
                'last_update_ms',
                'Dashboard Aktualisierung',
                'Zeitpunkt der letzten Dashboard-Momentaufnahme als Unix-Zeit in Millisekunden.',
                'number',
                'value.time',
                'ms'
            ],
            [
                'grid_total',
                'Netzleistung gesamt live',
                'Live-Wert für Netzleistung gesamt. Negativ bedeutet Einspeisung, positiv bedeutet Netzbezug.',
                'number',
                'value.power',
                'W'
            ],
            ['grid_l1', 'Netzleistung L1 live', 'Live-Wert Netzleistung Phase L1.', 'number', 'value.power', 'W'],
            ['grid_l2', 'Netzleistung L2 live', 'Live-Wert Netzleistung Phase L2.', 'number', 'value.power', 'W'],
            ['grid_l3', 'Netzleistung L3 live', 'Live-Wert Netzleistung Phase L3.', 'number', 'value.power', 'W'],
            [
                'grid_flow',
                'Netzfluss live',
                'Entprellter Live-Wert für die Richtung der Netzfluss-Animation.',
                'number',
                'value.power',
                'W'
            ],
            [
                'grid_status',
                'Netzstatus live',
                'Textstatus Netzbezug, Einspeisung oder ausgeglichen.',
                'string',
                'text',
                ''
            ],
            ['pv_total', 'PV gesamt live', 'Live-Wert PV-Erzeugung gesamt.', 'number', 'value.power', 'W'],
            ['pv_ac', 'PV AC live', 'Live-Wert PV-Erzeugung über AC-Wechselrichter.', 'number', 'value.power', 'W'],
            ['pv_ac_l1', 'PV AC L1 live', 'Live-Wert PV AC Phase L1.', 'number', 'value.power', 'W'],
            ['pv_ac_l2', 'PV AC L2 live', 'Live-Wert PV AC Phase L2.', 'number', 'value.power', 'W'],
            ['pv_ac_l3', 'PV AC L3 live', 'Live-Wert PV AC Phase L3.', 'number', 'value.power', 'W'],
            ['pv_dc', 'PV DC live', 'Live-Wert PV-Erzeugung über DC-Laderegler.', 'number', 'value.power', 'W'],
            [
                'house_total',
                'Haus gesamt live',
                'Live-Wert gesamter Hausverbrauch aus AC-Lasten und essentiellen Lasten.',
                'number',
                'value.power',
                'W'
            ],
            ['ac_loads_total', 'AC-Lasten gesamt live', 'Live-Wert normale AC-Lasten.', 'number', 'value.power', 'W'],
            ['ac_loads_l1', 'AC-Lasten L1 live', 'Live-Wert normale AC-Lasten Phase L1.', 'number', 'value.power', 'W'],
            ['ac_loads_l2', 'AC-Lasten L2 live', 'Live-Wert normale AC-Lasten Phase L2.', 'number', 'value.power', 'W'],
            ['ac_loads_l3', 'AC-Lasten L3 live', 'Live-Wert normale AC-Lasten Phase L3.', 'number', 'value.power', 'W'],
            [
                'essential_loads_total',
                'Essentielle Lasten gesamt live',
                'Live-Wert essentielle Lasten am Wechselrichter-/Notstromausgang.',
                'number',
                'value.power',
                'W'
            ],
            [
                'essential_loads_l1',
                'Essentielle Lasten L1 live',
                'Live-Wert essentielle Lasten Phase L1.',
                'number',
                'value.power',
                'W'
            ],
            [
                'essential_loads_l2',
                'Essentielle Lasten L2 live',
                'Live-Wert essentielle Lasten Phase L2.',
                'number',
                'value.power',
                'W'
            ],
            [
                'essential_loads_l3',
                'Essentielle Lasten L3 live',
                'Live-Wert essentielle Lasten Phase L3.',
                'number',
                'value.power',
                'W'
            ],
            ['battery_soc', 'Akku Ladezustand live', 'Live-Wert Batterie-Ladezustand.', 'number', 'value.battery', '%'],
            [
                'battery_power',
                'Akku Leistung live',
                'Live-Wert Batterieleistung. Positiv bedeutet Laden, negativ bedeutet Entladen.',
                'number',
                'value.power',
                'W'
            ],
            [
                'battery_flow',
                'Akku Fluss live',
                'Entprellter Live-Wert für die Richtung der Batterie-Animation.',
                'number',
                'value.power',
                'W'
            ],
            ['battery_voltage', 'Akku Spannung live', 'Live-Wert Batteriespannung.', 'number', 'value.voltage', 'V'],
            ['battery_current', 'Akku Strom live', 'Live-Wert Batteriestrom.', 'number', 'value.current', 'A'],
            [
                'battery_temperature',
                'Akku Temperatur live',
                'Live-Wert Batterietemperatur.',
                'number',
                'value.temperature',
                '°C'
            ],
            ['battery_status', 'Akku Status live', 'Textstatus Laden, Entladen oder Standby.', 'string', 'text', ''],
            ['surplus', 'PV Überschuss live', 'Live-Wert verfügbarer PV-Überschuss.', 'number', 'value.power', 'W'],
            [
                'ev_power',
                'Wallbox Leistung live',
                'Live-Wert Ladeleistung aller erkannten Victron-Wallboxen (EV charger).',
                'number',
                'value.power',
                'W'
            ],
            [
                'alarm_count',
                'Anzahl aktiver Alarme',
                'Anzahl aktiver Alarme und Fehler aller erkannten Geräte.',
                'number',
                'value',
                ''
            ],
            ['alarm_level', 'Alarmstufe', '0 = OK, 1 = Warnung, 2 = Alarm.', 'number', 'value', ''],
            ['alarms_json', 'Aktive Alarme', 'Liste der aktiven Alarme als JSON.', 'string', 'json', ''],
            [
                'battery_time_to_full_min',
                'Akku voll in',
                'Geschätzte Zeit bis der Akku voll ist (Minuten).',
                'number',
                'value',
                'min'
            ],
            [
                'battery_time_to_go_min',
                'Akku Restlaufzeit',
                'Geschätzte Restlaufzeit beim Entladen (Minuten).',
                'number',
                'value',
                'min'
            ],
            [
                'battery_capacity_kwh',
                'Akku Kapazität',
                'Nutzbare Akkukapazität aus der Konfiguration oder Dynamic ESS.',
                'number',
                'value',
                'kWh'
            ],
            ['battery_soh', 'Akku Gesundheit', 'State of Health des Akkus.', 'number', 'value', '%'],
            ['battery_cycles', 'Akku Ladezyklen', 'Anzahl Ladezyklen des Akkus.', 'number', 'value', ''],
            [
                'pv_forecast_today_kwh',
                'PV-Prognose heute',
                'PV-Prognose für heute aus dem konfigurierten Prognose-Datenpunkt.',
                'number',
                'value.energy',
                'kWh'
            ]
        ];

        for (const [id, name, description, commonType, role, unit] of dashboardStates) {
            await this.ensureStateObject(
                `dashboard.${id}`,
                {
                    id,
                    nameEn: `${liveNameEn(id)} (live)`,
                    descriptionEn: `Live value: ${liveNameEn(id)}.`,
                    name,
                    friendlyName: name,
                    description,
                    commonType,
                    type: commonType,
                    role,
                    unit
                },
                false,
                { calculated: true, dashboardScalar: true }
            );
        }
    }

    async createViewObjects() {
        await this.ensureChannelObject(
            'view',
            t('Live view', 'Live Ansicht'),
            t(
                'Display values calculated by the adapter for visualisations.',
                'Vom Adapter fertig berechnete Anzeige-Werte für Lovelace. Lovelace berechnet hier nichts mehr, sondern zeigt nur noch diese Werte an.'
            )
        );
        await this.ensureStateObject(
            'view.payload_json',
            {
                id: 'payload_json',
                nameEn: 'Live view payload',
                descriptionEn: 'Calculated JSON payload for visualisations, rewritten on every poll.',
                name: 'Live Ansicht Payload',
                friendlyName: 'Live Ansicht Payload',
                description:
                    'Fertig berechnetes JSON-Payload für die Lovelace-Ansichten. Wird bei jedem Polling-Zyklus neu geschrieben, damit Lovelace Live-Updates erhält.',
                commonType: 'string',
                type: 'string',
                role: 'json'
            },
            false,
            { calculated: true, viewPayload: true }
        );
        await this.ensureStateObject(
            'view.load_sources_json',
            {
                id: 'load_sources_json',
                nameEn: 'Load sources diagnostics',
                descriptionEn: 'Diagnostics of the registers used for AC loads and essential loads.',
                name: 'Lasten Quellen Diagnose',
                friendlyName: 'Lasten Quellen Diagnose',
                description:
                    'Diagnose der verwendeten Quellen für AC-Lasten und essentielle Lasten inklusive Roh-Phasenwerte.',
                commonType: 'string',
                type: 'string',
                role: 'json'
            },
            false,
            { calculated: true, viewPayload: true }
        );
        await this.ensureStateObject(
            'view.revision',
            {
                id: 'revision',
                nameEn: 'Live view revision',
                descriptionEn: 'Counter increased on every poll cycle.',
                name: 'Live Ansicht Revision',
                friendlyName: 'Live Ansicht Revision',
                description: 'Zähler, der bei jedem Polling-Zyklus erhöht wird. Dient Lovelace als Live-Update-Signal.',
                commonType: 'number',
                type: 'number',
                role: 'value'
            },
            false,
            { calculated: true, viewPayload: true }
        );
        await this.ensureStateObject(
            'view.last_change_ms',
            {
                id: 'last_change_ms',
                nameEn: 'Live view timestamp',
                descriptionEn: 'Time of the last display update in milliseconds.',
                name: 'Live Ansicht Änderung',
                friendlyName: 'Live Ansicht Änderung',
                description: 'Zeitpunkt der letzten Anzeige-Wert-Änderung als Unix-Zeit in Millisekunden.',
                commonType: 'number',
                type: 'number',
                role: 'value.time',
                unit: 'ms'
            },
            false,
            { calculated: true, viewPayload: true }
        );

        const numberStates = [
            ['grid_total', 'Netzleistung gesamt', 'W'],
            ['grid_l1', 'Netzleistung L1', 'W'],
            ['grid_l2', 'Netzleistung L2', 'W'],
            ['grid_l3', 'Netzleistung L3', 'W'],
            ['grid_flow', 'Netzfluss Richtung', 'W'],
            ['pv_total', 'PV gesamt', 'W'],
            ['pv_ac', 'PV AC', 'W'],
            ['pv_ac_l1', 'PV AC L1', 'W'],
            ['pv_ac_l2', 'PV AC L2', 'W'],
            ['pv_ac_l3', 'PV AC L3', 'W'],
            ['pv_dc', 'PV DC', 'W'],
            ['house_total', 'Haus gesamt', 'W'],
            ['house_l1', 'Haus L1', 'W'],
            ['house_l2', 'Haus L2', 'W'],
            ['house_l3', 'Haus L3', 'W'],
            ['ac_loads_total', 'AC-Lasten gesamt', 'W'],
            ['ac_loads_l1', 'AC-Lasten L1', 'W'],
            ['ac_loads_l2', 'AC-Lasten L2', 'W'],
            ['ac_loads_l3', 'AC-Lasten L3', 'W'],
            ['essential_loads_total', 'Essentielle Lasten gesamt', 'W'],
            ['essential_loads_l1', 'Essentielle Lasten L1', 'W'],
            ['essential_loads_l2', 'Essentielle Lasten L2', 'W'],
            ['essential_loads_l3', 'Essentielle Lasten L3', 'W'],
            ['battery_soc', 'Akku Ladezustand', '%'],
            ['battery_power', 'Akku Leistung', 'W'],
            ['battery_flow', 'Akku Fluss Richtung', 'W'],
            ['battery_voltage', 'Akku Spannung', 'V'],
            ['battery_current', 'Akku Strom', 'A'],
            ['battery_temperature', 'Akku Temperatur', '°C'],
            ['surplus', 'PV Überschuss', 'W']
        ];
        for (const [id, name, unit] of numberStates) {
            await this.ensureStateObject(
                `view.${id}`,
                {
                    id,
                    name,
                    friendlyName: name,
                    nameEn: liveNameEn(id),
                    descriptionEn: `Calculated display value: ${liveNameEn(id)}.`,
                    description: `Fertig berechneter Anzeige-Wert: ${name}.`,
                    commonType: 'number',
                    type: 'number',
                    role:
                        unit === '%'
                            ? 'value.battery'
                            : unit === 'V'
                              ? 'value.voltage'
                              : unit === 'A'
                                ? 'value.current'
                                : unit === '°C'
                                  ? 'value.temperature'
                                  : 'value.power',
                    unit
                },
                false,
                { calculated: true, viewPayload: true }
            );
        }
        const textStates = [
            ['grid_status', 'Netzstatus'],
            ['battery_status', 'Akku Status']
        ];
        for (const [id, name] of textStates) {
            await this.ensureStateObject(
                `view.${id}`,
                {
                    id,
                    name,
                    friendlyName: name,
                    nameEn: liveNameEn(id),
                    descriptionEn: `Calculated display text: ${liveNameEn(id)}.`,
                    description: `Fertig berechneter Anzeige-Text: ${name}.`,
                    commonType: 'string',
                    type: 'string',
                    role: 'text'
                },
                false,
                { calculated: true, viewPayload: true }
            );
        }
    }

    async createControlObjects() {
        for (const definition of CONTROL_REGISTERS) {
            if (definition.requiresNewSetpoint && !this.config.useNewSetpoint) continue;
            if (definition.requiresLegacySetpoint && !this.config.legacySetpointEnabled) continue;

            const objectId = `controls.${definition.id}`;
            await this.ensureStateObject(objectId, definition, Boolean(definition.write), {
                unitId: this.config.controlUnitId,
                address: definition.address,
                type: definition.type,
                scale: definition.scale,
                rawScaleForWrite: definition.rawScaleForWrite
            });
            if (definition.write) await this.registerWritableState(objectId, this.config.controlUnitId, definition);
        }
    }

    /**
     * Creates the states for the user defined registers (admin tab "Own registers") and removes
     * states of rows that were deleted from the table.
     */
    async createCustomRegisterObjects() {
        const wanted = new Set(this.customRegisters.map((definition) => `${this.namespace}.custom.${definition.id}`));
        const existing = await this.getAdapterObjectsAsync();
        for (const id of Object.keys(existing || {})) {
            if (id.startsWith(`${this.namespace}.custom.`) && existing[id].type === 'state' && !wanted.has(id)) {
                await this.delForeignObjectAsync(id);
                this.log.info(`Removed custom register state ${id} (no longer configured)`);
            }
        }
        if (!this.customRegisters.length) return;

        await this.ensureChannelObject(
            'custom',
            t('Own registers', 'Eigene Register'),
            t('Registers defined in the instance settings.', 'In der Instanzkonfiguration definierte Register.')
        );
        for (const definition of this.customRegisters) {
            const objectId = `custom.${definition.id}`;
            await this.ensureStateObject(objectId, definition, definition.write, {
                unitId: definition.unitId,
                address: definition.address,
                type: definition.type,
                scale: definition.scale,
                custom: true
            });
            if (definition.write) await this.registerWritableState(objectId, definition.unitId, definition);
        }
    }

    /**
     * Version 0.6.x created a raw write channel (raw.write.*). It allowed writing any register
     * on any Unit-ID and was replaced by typed writable states and the own register table.
     */
    async removeLegacyRawObjects() {
        try {
            const obj = await this.getObjectAsync('raw');
            if (obj) {
                await this.delObjectAsync('raw', { recursive: true });
                this.log.info('Removed obsolete raw.write.* objects of version 0.6.x');
            }
        } catch (error) {
            this.log.debug(`Could not remove legacy raw objects: ${error.message}`);
        }
    }

    async pollOnce() {
        if (this.isStopping || this.isPolling || !this.client) return;
        this.isPolling = true;
        let successCount = 0;
        try {
            try {
                await this.client.connect();
            } catch (error) {
                if (this.isStopping) return;
                await this.safeSetStateAsync('info.connection', false, true);
                await this.safeSetStateAsync(
                    'status.lastError',
                    `Connection failed to ${this.config.host}:${this.config.port} - ${error.message}`,
                    true
                );
                this.log.warn(`Connection failed to ${this.config.host}:${this.config.port}: ${error.message}`);
                return;
            }

            if (this.isStopping) return;
            this.lastValues.clear();

            successCount += await this.readDefinitions(this.config.unitIdSystem, SYSTEM_REGISTERS, 'system');
            if (this.isStopping) return;

            const activeControls = CONTROL_REGISTERS.filter((definition) => {
                if (definition.requiresNewSetpoint && !this.config.useNewSetpoint) return false;
                if (definition.requiresLegacySetpoint && !this.config.legacySetpointEnabled) return false;
                return true;
            });
            successCount += await this.readDefinitions(this.config.controlUnitId, activeControls, 'controls');
            if (this.isStopping) return;

            for (const device of this.discoveredDevices.values()) {
                if (this.isStopping) return;
                successCount += await this.readDefinitions(
                    device.unitId,
                    device.profile.registers,
                    `devices.unit_${device.unitId}.${device.profile.key}`
                );
            }

            const customByUnit = new Map();
            for (const definition of this.customRegisters) {
                if (!customByUnit.has(definition.unitId)) customByUnit.set(definition.unitId, []);
                customByUnit.get(definition.unitId).push(definition);
            }
            for (const [unitId, definitions] of customByUnit) {
                if (this.isStopping) return;
                successCount += await this.readDefinitions(unitId, definitions, 'custom');
            }

            if (this.isStopping) return;
            await this.updateFlowStates();
            if (this.isStopping) return;

            const connected = successCount > 0;
            await this.safeSetStateAsync('info.connection', connected, true);
            if (connected) {
                await this.safeSetStateAsync('status.lastPoll', new Date().toISOString(), true);
                await this.safeSetStateAsync('status.lastError', '', true);
            } else {
                await this.safeSetStateAsync('status.lastError', 'No Modbus registers could be read', true);
            }
        } catch (error) {
            if (this.isShutdownError(error)) {
                this.log.debug(`Polling stopped during shutdown: ${error.message}`);
                return;
            }
            await this.safeSetStateAsync('info.connection', false, true);
            await this.safeSetStateAsync('status.lastError', error.message, true);
            this.log.warn(`Polling error: ${error.message}`);
        } finally {
            this.isPolling = false;
        }
    }

    async readDefinitions(unitId, definitions, prefix) {
        if (this.isStopping) return 0;
        let count = 0;
        for (const group of this.groupDefinitions(definitions)) {
            if (this.isStopping) break;
            if (group.length === 1) {
                if (await this.readDefinition(unitId, group[0], `${prefix}.${group[0].id}`)) count++;
                continue;
            }
            const groupCount = await this.readDefinitionGroup(unitId, group, prefix);
            count += groupCount;
        }
        return count;
    }

    groupDefinitions(definitions) {
        const sorted = [...definitions].sort((a, b) => a.address - b.address);
        const groups = [];
        let group = [];
        let end = null;
        for (const definition of sorted) {
            const length = getRegisterLength(definition.type);
            if (!group.length || (definition.address === end && definition.address + length - group[0].address <= 60)) {
                group.push(definition);
                end = definition.address + length;
            } else {
                groups.push(group);
                group = [definition];
                end = definition.address + length;
            }
        }
        if (group.length) groups.push(group);
        return groups;
    }

    async readDefinitionGroup(unitId, group, prefix) {
        if (this.isStopping) return 0;
        const start = group[0].address;
        const end = group.reduce(
            (max, definition) => Math.max(max, definition.address + getRegisterLength(definition.type)),
            start
        );
        const quantity = end - start;
        try {
            const registers = await this.client.readHoldingRegisters(unitId, start, quantity);
            let count = 0;
            for (const definition of group) {
                if (this.isStopping) return count;
                const offset = definition.address - start;
                const length = getRegisterLength(definition.type);
                const slice = registers.slice(offset, offset + length);
                const value = decodeRegisters(slice, definition.type, definition.scale, definition.boolean);
                if (value !== null && value !== undefined) {
                    const objectId = `${prefix}.${definition.id}`;
                    await this.safeSetStateAsync(objectId, value, true);
                    this.lastValues.set(objectId, value);
                    count++;
                }
            }
            return count;
        } catch (error) {
            if (this.isShutdownError(error)) {
                this.log.debug(
                    `Grouped read stopped during shutdown unit=${unitId} address=${start}: ${error.message}`
                );
                return 0;
            }
            this.log.debug(
                `Grouped read failed unit=${unitId} address=${start} quantity=${quantity}: ${error.message}`
            );
            let count = 0;
            for (const definition of group) {
                if (this.isStopping) break;
                if (await this.readDefinition(unitId, definition, `${prefix}.${definition.id}`)) count++;
            }
            return count;
        }
    }

    async readDefinition(unitId, definition, objectId) {
        if (this.isStopping) return false;
        try {
            const registers = await this.client.readHoldingRegisters(
                unitId,
                definition.address,
                getRegisterLength(definition.type)
            );
            if (this.isStopping) return false;
            const value = decodeRegisters(registers, definition.type, definition.scale, definition.boolean);
            if (value !== null && value !== undefined) {
                await this.safeSetStateAsync(objectId, value, true);
                this.lastValues.set(objectId, value);
                return true;
            }
        } catch (error) {
            if (this.isShutdownError(error)) {
                this.log.debug(
                    `Read stopped during shutdown unit=${unitId} address=${definition.address}: ${error.message}`
                );
                return false;
            }
            this.log.debug(`Read failed unit=${unitId} address=${definition.address}: ${error.message}`);
        }
        return false;
    }

    async updateFlowStates() {
        const value = (id) => this.lastValues.get(`system.${id}`);
        const first = (...ids) => {
            for (const id of ids) {
                const v = value(id);
                if (Number.isFinite(v)) return v;
            }
            return undefined;
        };
        const sum = (groups) => {
            let total = 0;
            let found = false;
            for (const ids of groups) {
                const v = first(...ids);
                if (Number.isFinite(v)) {
                    total += v;
                    found = true;
                }
            }
            return found ? total : undefined;
        };
        const setFlow = async (id, val) => {
            if (this.isStopping) return;
            if (Number.isFinite(val)) {
                await this.safeSetStateAsync(`flow.${id}`, Number.isInteger(val) ? val : Number(val.toFixed(3)), true);
            } else {
                // Avoid keeping obsolete calculated values in Lovelace after a mapping change.
                await this.safeSetStateAsync(`flow.${id}`, null, true);
            }
        };

        const gridTotal = sum([
            ['grid_l1_32', 'grid_l1'],
            ['grid_l2_32', 'grid_l2'],
            ['grid_l3_32', 'grid_l3']
        ]);
        const acConsumptionL1 = first('ac_consumption_l1_32', 'ac_consumption_l1');
        const acConsumptionL2 = first('ac_consumption_l2_32', 'ac_consumption_l2');
        const acConsumptionL3 = first('ac_consumption_l3_32', 'ac_consumption_l3');
        const acConsumptionTotal = sum([
            ['ac_consumption_l1_32', 'ac_consumption_l1'],
            ['ac_consumption_l2_32', 'ac_consumption_l2'],
            ['ac_consumption_l3_32', 'ac_consumption_l3']
        ]);

        let criticalL1 = first('consumption_on_output_l1');
        let criticalL2 = first('consumption_on_output_l2');
        let criticalL3 = first('consumption_on_output_l3');
        let nonCriticalL1 = first('consumption_on_input_l1');
        let nonCriticalL2 = first('consumption_on_input_l2');
        let nonCriticalL3 = first('consumption_on_input_l3');

        // Some GX installations do not expose all split load registers consistently in Lovelace.
        // Fall back to the total AC consumption phases for essential loads and derive the other side if possible.
        const deriveRemainder = (total, part) =>
            Number.isFinite(total) && Number.isFinite(part) ? Math.max(0, total - part) : undefined;
        if (!Number.isFinite(criticalL1))
            criticalL1 =
                Number.isFinite(acConsumptionL1) && Number.isFinite(nonCriticalL1)
                    ? Math.max(0, acConsumptionL1 - nonCriticalL1)
                    : acConsumptionL1;
        if (!Number.isFinite(criticalL2))
            criticalL2 =
                Number.isFinite(acConsumptionL2) && Number.isFinite(nonCriticalL2)
                    ? Math.max(0, acConsumptionL2 - nonCriticalL2)
                    : acConsumptionL2;
        if (!Number.isFinite(criticalL3))
            criticalL3 =
                Number.isFinite(acConsumptionL3) && Number.isFinite(nonCriticalL3)
                    ? Math.max(0, acConsumptionL3 - nonCriticalL3)
                    : acConsumptionL3;
        if (!Number.isFinite(nonCriticalL1)) nonCriticalL1 = deriveRemainder(acConsumptionL1, criticalL1);
        if (!Number.isFinite(nonCriticalL2)) nonCriticalL2 = deriveRemainder(acConsumptionL2, criticalL2);
        if (!Number.isFinite(nonCriticalL3)) nonCriticalL3 = deriveRemainder(acConsumptionL3, criticalL3);

        const criticalLoads = [criticalL1, criticalL2, criticalL3].filter(Number.isFinite).reduce((a, b) => a + b, 0);
        const criticalLoadsFound = [criticalL1, criticalL2, criticalL3].some(Number.isFinite);
        const nonCriticalLoads = [nonCriticalL1, nonCriticalL2, nonCriticalL3]
            .filter(Number.isFinite)
            .reduce((a, b) => a + b, 0);
        const nonCriticalLoadsFound = [nonCriticalL1, nonCriticalL2, nonCriticalL3].some(Number.isFinite);
        const pvAcOutput = sum([
            ['pv_ac_output_l1_32', 'pv_ac_output_l1'],
            ['pv_ac_output_l2_32', 'pv_ac_output_l2'],
            ['pv_ac_output_l3_32', 'pv_ac_output_l3']
        ]);
        const pvAcGrid = sum([
            ['pv_ac_input_l1_32', 'pv_ac_input_l1'],
            ['pv_ac_input_l2_32', 'pv_ac_input_l2'],
            ['pv_ac_input_l3_32', 'pv_ac_input_l3']
        ]);
        const pvAcGenset = sum([
            ['pv_ac_genset_l1_32', 'pv_ac_genset_l1'],
            ['pv_ac_genset_l2_32', 'pv_ac_genset_l2'],
            ['pv_ac_genset_l3_32', 'pv_ac_genset_l3']
        ]);
        const gensetTotal = sum([
            ['genset_l1_32', 'genset_l1'],
            ['genset_l2_32', 'genset_l2'],
            ['genset_l3_32', 'genset_l3']
        ]);
        const pvDc = first('pv_dc_power');
        const batteryPower = first('battery_power');
        const inverterChargerPower = first('inverter_charger_power');
        const pvAcTotal = [pvAcOutput, pvAcGrid, pvAcGenset].filter(Number.isFinite).reduce((a, b) => a + b, 0);
        const pvAcFound = [pvAcOutput, pvAcGrid, pvAcGenset].some(Number.isFinite);
        const pvTotal = (pvAcFound ? pvAcTotal : 0) + (Number.isFinite(pvDc) ? pvDc : 0);

        await setFlow('grid_total', gridTotal);
        await setFlow('grid_import', Number.isFinite(gridTotal) ? Math.max(0, gridTotal) : undefined);
        await setFlow('grid_export', Number.isFinite(gridTotal) ? Math.max(0, -gridTotal) : undefined);
        await setFlow('available_surplus', Number.isFinite(gridTotal) ? Math.max(0, -gridTotal) : undefined);
        await setFlow('ac_consumption_total', acConsumptionTotal);
        await setFlow('critical_loads_total', criticalLoadsFound ? criticalLoads : undefined);
        await setFlow('critical_loads_l1', criticalL1);
        await setFlow('critical_loads_l2', criticalL2);
        await setFlow('critical_loads_l3', criticalL3);
        await setFlow('non_critical_loads_total', nonCriticalLoadsFound ? nonCriticalLoads : undefined);
        await setFlow('non_critical_loads_l1', nonCriticalL1);
        await setFlow('non_critical_loads_l2', nonCriticalL2);
        await setFlow('non_critical_loads_l3', nonCriticalL3);

        // Adapter-side load split for Lovelace views.
        // 0.3.9: corrected against the user-provided Victron CCGX Modbus TCP register list 3.73.
        // com.victronenergy.system / Unit-ID 100:
        //   /Ac/ConsumptionOnInput/Lx/Power   -> 872/874/876 int32
        //      Remark in Victron sheet: "This is the power shown on the overview in the Loads box".
        //      Therefore this is the value displayed as AC-Lasten in the Lovelace view.
        //   /Ac/ConsumptionOnOutput/Lx/Power  -> 878/880/882 int32
        //      This is output/AC-Out and is displayed as Essentielle Lasten.
        //   /Ac/Consumption/Lx/Power          -> 902/904/906 uint32, fallback 817/818/819 uint16
        //      This is total AC consumption / house total, not a source for splitting AC vs essential.
        const inputL1 = first('consumption_on_input_l1');
        const inputL2 = first('consumption_on_input_l2');
        const inputL3 = first('consumption_on_input_l3');
        const outputL1 = first('consumption_on_output_l1');
        const outputL2 = first('consumption_on_output_l2');
        const outputL3 = first('consumption_on_output_l3');
        const acMapL1 = first('ac_consumption_l1_32', 'ac_consumption_l1');
        const acMapL2 = first('ac_consumption_l2_32', 'ac_consumption_l2');
        const acMapL3 = first('ac_consumption_l3_32', 'ac_consumption_l3');

        const phaseHasAny = (arr) => arr.some(Number.isFinite);
        const phaseSum = (arr) =>
            phaseHasAny(arr) ? arr.filter(Number.isFinite).reduce((a, b) => a + b, 0) : undefined;
        const phaseValuesOrUndefined = (arr) => (phaseHasAny(arr) ? arr : [undefined, undefined, undefined]);
        const sumPhase = (a, b) =>
            Number.isFinite(a) || Number.isFinite(b)
                ? (Number.isFinite(a) ? a : 0) + (Number.isFinite(b) ? b : 0)
                : undefined;

        const inputPhases = phaseValuesOrUndefined([inputL1, inputL2, inputL3]);
        const outputPhases = phaseValuesOrUndefined([outputL1, outputL2, outputL3]);
        const acConsumptionPhases = phaseValuesOrUndefined([acMapL1, acMapL2, acMapL3]);

        const acDisplayPhases = inputPhases; // AC-Lasten / Victron Loads box
        const essentialDisplayPhases = outputPhases; // Essentielle Lasten / AC-Out
        const houseDisplayPhases = phaseHasAny(acConsumptionPhases)
            ? acConsumptionPhases
            : [
                  sumPhase(inputPhases[0], outputPhases[0]),
                  sumPhase(inputPhases[1], outputPhases[1]),
                  sumPhase(inputPhases[2], outputPhases[2])
              ];

        const acLoadSource = phaseHasAny(acDisplayPhases) ? 'consumption_on_input_872_874_876_loads_box' : 'missing';
        const essentialLoadSource = phaseHasAny(essentialDisplayPhases)
            ? 'consumption_on_output_878_880_882_ac_out'
            : 'missing';
        const houseLoadSource = phaseHasAny(acConsumptionPhases)
            ? 'ac_consumption_902_904_906_fallback_817_818_819'
            : 'derived_from_input_plus_output';

        const displayAcL1 = acDisplayPhases[0];
        const displayAcL2 = acDisplayPhases[1];
        const displayAcL3 = acDisplayPhases[2];
        const displayEssentialL1 = essentialDisplayPhases[0];
        const displayEssentialL2 = essentialDisplayPhases[1];
        const displayEssentialL3 = essentialDisplayPhases[2];
        const displayHouseL1 = houseDisplayPhases[0];
        const displayHouseL2 = houseDisplayPhases[1];
        const displayHouseL3 = houseDisplayPhases[2];
        const displayAcLoads = phaseSum(acDisplayPhases);
        const displayAcFound = phaseHasAny(acDisplayPhases);
        const displayEssentialLoads = phaseSum(essentialDisplayPhases);
        const displayEssentialFound = phaseHasAny(essentialDisplayPhases);
        const displayHouseLoads = phaseSum(houseDisplayPhases);

        this.currentLoadSourceInfo = {
            mapping: 'victron_modbus_register_list_3.73_adapter_0.3.9',
            ac: acLoadSource,
            essential: essentialLoadSource,
            house: houseLoadSource,
            note: 'AC-Lasten use /Ac/ConsumptionOnInput L1-L3 because Victron marks these as the overview Loads box. Essentielle Lasten use /Ac/ConsumptionOnOutput L1-L3. Haus gesamt uses /Ac/Consumption L1-L3.',
            rawInputLoadsBox: [inputL1, inputL2, inputL3],
            rawOutputEssential: [outputL1, outputL2, outputL3],
            rawAcConsumptionHouse: [acMapL1, acMapL2, acMapL3],
            displayAc: acDisplayPhases,
            displayEssential: essentialDisplayPhases,
            displayHouse: houseDisplayPhases,
            registers: {
                acLoads: [
                    '872:int32 L1 /Ac/ConsumptionOnInput/L1/Power',
                    '874:int32 L2 /Ac/ConsumptionOnInput/L2/Power',
                    '876:int32 L3 /Ac/ConsumptionOnInput/L3/Power'
                ],
                essentialLoads: [
                    '878:int32 L1 /Ac/ConsumptionOnOutput/L1/Power',
                    '880:int32 L2 /Ac/ConsumptionOnOutput/L2/Power',
                    '882:int32 L3 /Ac/ConsumptionOnOutput/L3/Power'
                ],
                houseTotal: [
                    '902:uint32 L1 /Ac/Consumption/L1/Power',
                    '904:uint32 L2 /Ac/Consumption/L2/Power',
                    '906:uint32 L3 /Ac/Consumption/L3/Power',
                    'fallback 817/818/819:uint16'
                ]
            }
        };

        await setFlow('ac_loads_total', displayAcFound ? displayAcLoads : undefined);
        await setFlow('ac_loads_l1', displayAcL1);
        await setFlow('ac_loads_l2', displayAcL2);
        await setFlow('ac_loads_l3', displayAcL3);
        await setFlow('essential_loads_total', displayEssentialFound ? displayEssentialLoads : undefined);
        await setFlow('essential_loads_l1', displayEssentialL1);
        await setFlow('essential_loads_l2', displayEssentialL2);
        await setFlow('essential_loads_l3', displayEssentialL3);

        await setFlow('pv_ac_output_total', pvAcOutput);
        await setFlow('pv_ac_grid_total', pvAcGrid);
        await setFlow('pv_ac_genset_total', pvAcGenset);
        await setFlow('pv_ac_total', pvAcFound ? pvAcTotal : undefined);
        await setFlow('pv_dc_total', pvDc);
        await setFlow('pv_total', pvAcFound || Number.isFinite(pvDc) ? pvTotal : undefined);
        await setFlow('battery_power', batteryPower);
        await setFlow('battery_charge', Number.isFinite(batteryPower) ? Math.max(0, batteryPower) : undefined);
        await setFlow('battery_discharge', Number.isFinite(batteryPower) ? Math.max(0, -batteryPower) : undefined);
        await setFlow('genset_total', gensetTotal);
        await setFlow('inverter_charger_power', inverterChargerPower);

        if (this.isStopping) return;
        await this.updateDashboardSnapshot({
            gridTotal,
            gridL1: first('grid_l1_32', 'grid_l1'),
            gridL2: first('grid_l2_32', 'grid_l2'),
            gridL3: first('grid_l3_32', 'grid_l3'),
            acConsumptionTotal,
            houseTotal: displayHouseLoads,
            houseL1: displayHouseL1,
            houseL2: displayHouseL2,
            houseL3: displayHouseL3,
            acLoadsL1: displayAcL1,
            acLoadsL2: displayAcL2,
            acLoadsL3: displayAcL3,
            essentialL1: displayEssentialL1,
            essentialL2: displayEssentialL2,
            essentialL3: displayEssentialL3,
            pvAcTotal: pvAcFound ? pvAcTotal : undefined,
            pvDc,
            pvTotal: pvAcFound || Number.isFinite(pvDc) ? pvTotal : undefined,
            batteryPower,
            batteryVoltage: first('battery_voltage'),
            batteryCurrent: first('battery_current'),
            batterySoc: first('battery_soc'),
            batteryTemp: first('battery_temperature'),
            surplus: Number.isFinite(gridTotal) ? Math.max(0, -gridTotal) : undefined,
            inverterState: first('battery_state', 'active_input_source'),
            inverterChargerPower
        });
    }

    _deviceValuesByUnit(profileKey, candidateIds) {
        const ids = Array.isArray(candidateIds) ? candidateIds : [candidateIds];
        const wanted = new Set(ids.filter(Boolean));
        const values = new Map();
        for (const [key, val] of this.lastValues.entries()) {
            const match = String(key).match(/^devices\.unit_(\d+)\.([^.]+)\.(.+)$/);
            if (!match) continue;
            const [, unit, profile, stateId] = match;
            if (profile !== profileKey || !wanted.has(stateId)) continue;
            if (!Number.isFinite(val)) continue;
            const sortIndex = ids.indexOf(stateId);
            const existing = values.get(unit);
            if (!existing || sortIndex < existing.sortIndex) {
                values.set(unit, { value: val, sortIndex });
            }
        }
        return Array.from(values.values()).map((item) => item.value);
    }

    _sumDeviceFirst(profileKey, ...candidateIds) {
        const values = this._deviceValuesByUnit(profileKey, candidateIds);
        if (!values.length) return undefined;
        return values.reduce((sum, val) => sum + val, 0);
    }

    _firstDeviceValue(profileKey, ...candidateIds) {
        const values = this._deviceValuesByUnit(profileKey, candidateIds);
        return values.length ? values[0] : undefined;
    }

    _roundForSnapshot(value) {
        if (!Number.isFinite(value)) return null;
        return Number.isInteger(value) ? value : Number(value.toFixed(3));
    }

    _deadband(value, threshold = 0) {
        if (!Number.isFinite(value)) return null;
        return Math.abs(value) <= threshold ? 0 : value;
    }

    _sumSnapshotValues(...values) {
        const finite = values.filter(Number.isFinite);
        if (!finite.length) return null;
        return finite.reduce((sum, val) => sum + val, 0);
    }

    async updateDashboardSnapshot(base) {
        const pick = (...values) => values.find(Number.isFinite);
        const loadDeadband = 0;

        const pvInvL1 = this._sumDeviceFirst('pvinverter', 'l1_power_1058', 'l1_power');
        const pvInvL2 = this._sumDeviceFirst('pvinverter', 'l2_power_1060', 'l2_power');
        const pvInvL3 = this._sumDeviceFirst('pvinverter', 'l3_power_1062', 'l3_power');
        const pvInvPhaseTotal = this._sumSnapshotValues(pvInvL1, pvInvL2, pvInvL3);
        const pvInvTotal = pick(base.pvAcTotal, this._sumDeviceFirst('pvinverter', 'total_power'), pvInvPhaseTotal);
        const pvDcTotal = pick(base.pvDc, this._sumDeviceFirst('solarcharger', 'pv_power', 'pv_power_3730'));
        const pvTotal = this._sumSnapshotValues(pvInvTotal, pvDcTotal);

        const batteryPower = pick(
            base.batteryPower,
            this._sumDeviceFirst('battery', 'battery_power', 'battery_power_258')
        );
        const batteryCurrent = pick(base.batteryCurrent, this._firstDeviceValue('battery', 'current'));
        const batteryVoltage = pick(base.batteryVoltage, this._firstDeviceValue('battery', 'battery_voltage'));
        const batterySoc = pick(base.batterySoc, this._firstDeviceValue('battery', 'soc'));
        const batteryTemp = pick(base.batteryTemp, this._firstDeviceValue('battery', 'battery_temperature'));

        const acL1 = this._deadband(base.acLoadsL1, loadDeadband);
        const acL2 = this._deadband(base.acLoadsL2, loadDeadband);
        const acL3 = this._deadband(base.acLoadsL3, loadDeadband);
        const acTotal = this._sumSnapshotValues(acL1, acL2, acL3);

        const essentialL1 = this._deadband(base.essentialL1, 2);
        const essentialL2 = this._deadband(base.essentialL2, 2);
        const essentialL3 = this._deadband(base.essentialL3, 2);
        const essentialTotal = this._sumSnapshotValues(essentialL1, essentialL2, essentialL3);
        const houseL1 = pick(base.houseL1, this._sumSnapshotValues(acL1, essentialL1));
        const houseL2 = pick(base.houseL2, this._sumSnapshotValues(acL2, essentialL2));
        const houseL3 = pick(base.houseL3, this._sumSnapshotValues(acL3, essentialL3));
        const houseTotal = pick(
            base.houseTotal,
            this._sumSnapshotValues(houseL1, houseL2, houseL3),
            this._sumSnapshotValues(acTotal, essentialTotal)
        );

        const gridTotal = pick(base.gridTotal, this._sumSnapshotValues(base.gridL1, base.gridL2, base.gridL3));
        const gridDeadband = 15;
        const gridFlow = this._deadband(gridTotal, gridDeadband);
        const batteryFlow = this._deadband(batteryPower, 25);
        const snapshot = {
            version: ADAPTER_VERSION,
            timestamp: new Date().toISOString(),
            timestampMs: Date.now(),
            grid: {
                total: this._roundForSnapshot(gridTotal),
                l1: this._roundForSnapshot(base.gridL1),
                l2: this._roundForSnapshot(base.gridL2),
                l3: this._roundForSnapshot(base.gridL3),
                import: this._roundForSnapshot(Number.isFinite(gridTotal) ? Math.max(0, gridTotal) : null),
                export: this._roundForSnapshot(Number.isFinite(gridTotal) ? Math.max(0, -gridTotal) : null),
                flow: this._roundForSnapshot(gridFlow),
                status: gridFlow < 0 ? 'Einspeisung' : gridFlow > 0 ? 'Netzbezug' : 'Ausgeglichen'
            },
            pv: {
                total: this._roundForSnapshot(pvTotal),
                ac: this._roundForSnapshot(pvInvTotal),
                acL1: this._roundForSnapshot(pvInvL1),
                acL2: this._roundForSnapshot(pvInvL2),
                acL3: this._roundForSnapshot(pvInvL3),
                dc: this._roundForSnapshot(pvDcTotal)
            },
            loads: {
                houseTotal: this._roundForSnapshot(houseTotal),
                houseL1: this._roundForSnapshot(houseL1),
                houseL2: this._roundForSnapshot(houseL2),
                houseL3: this._roundForSnapshot(houseL3),
                ac: {
                    total: this._roundForSnapshot(acTotal),
                    l1: this._roundForSnapshot(acL1),
                    l2: this._roundForSnapshot(acL2),
                    l3: this._roundForSnapshot(acL3)
                },
                essential: {
                    total: this._roundForSnapshot(essentialTotal),
                    l1: this._roundForSnapshot(essentialL1),
                    l2: this._roundForSnapshot(essentialL2),
                    l3: this._roundForSnapshot(essentialL3)
                }
            },
            battery: {
                soc: this._roundForSnapshot(batterySoc),
                power: this._roundForSnapshot(batteryPower),
                voltage: this._roundForSnapshot(batteryVoltage),
                current: this._roundForSnapshot(batteryCurrent),
                temperature: this._roundForSnapshot(batteryTemp),
                flow: this._roundForSnapshot(batteryFlow),
                status: batteryFlow > 0 ? 'Laden' : batteryFlow < 0 ? 'Entladen' : 'Standby'
            },
            inverter: {
                state: this._roundForSnapshot(base.inverterState),
                chargerPower: this._roundForSnapshot(base.inverterChargerPower)
            },
            surplus: this._roundForSnapshot(Number.isFinite(gridTotal) ? Math.max(0, -gridTotal) : base.surplus),
            ev: {
                power: this._roundForSnapshot(this._sumDeviceFirst('evcharger', 'total_power'))
            }
        };

        // Dedicated live view data for Lovelace cards.
        // This is the only source used by V18/V19. It intentionally mirrors the values shown in the
        // dashboard and avoids old fallbacks, discovered device sums, or mixed Lovelace entities.
        snapshot.ui = {
            grid: {
                total: snapshot.grid.total,
                l1: snapshot.grid.l1,
                l2: snapshot.grid.l2,
                l3: snapshot.grid.l3,
                status: snapshot.grid.status,
                flow: snapshot.grid.flow
            },
            pv: {
                total: snapshot.pv.total,
                ac: snapshot.pv.ac,
                acL1: snapshot.pv.acL1,
                acL2: snapshot.pv.acL2,
                acL3: snapshot.pv.acL3,
                dc: snapshot.pv.dc
            },
            loads: {
                ac: {
                    total: snapshot.loads.ac.total,
                    l1: snapshot.loads.ac.l1,
                    l2: snapshot.loads.ac.l2,
                    l3: snapshot.loads.ac.l3
                },
                essential: {
                    total: snapshot.loads.essential.total,
                    l1: snapshot.loads.essential.l1,
                    l2: snapshot.loads.essential.l2,
                    l3: snapshot.loads.essential.l3
                },
                houseTotal: snapshot.loads.houseTotal,
                houseL1: snapshot.loads.houseL1,
                houseL2: snapshot.loads.houseL2,
                houseL3: snapshot.loads.houseL3
            },
            battery: {
                soc: snapshot.battery.soc,
                power: snapshot.battery.power,
                voltage: snapshot.battery.voltage,
                current: snapshot.battery.current,
                temperature: snapshot.battery.temperature,
                flow: snapshot.battery.flow,
                status: snapshot.battery.status
            },
            inverter: snapshot.inverter,
            surplus: snapshot.surplus,
            sources: this.currentLoadSourceInfo || {}
        };

        if (this.isStopping) return;
        await this.updateViewStates(snapshot);
        if (this.isStopping) return;

        const setDashboard = async (id, value) => {
            if (this.isStopping) return;
            if (value === undefined) value = null;
            await this.safeSetStateAsync(`dashboard.${id}`, value, true);
        };

        await setDashboard('grid_total', snapshot.grid.total);
        await setDashboard('grid_l1', snapshot.grid.l1);
        await setDashboard('grid_l2', snapshot.grid.l2);
        await setDashboard('grid_l3', snapshot.grid.l3);
        await setDashboard('grid_flow', snapshot.grid.flow);
        await setDashboard('grid_status', snapshot.grid.status);
        await setDashboard('pv_total', snapshot.pv.total);
        await setDashboard('pv_ac', snapshot.pv.ac);
        await setDashboard('pv_ac_l1', snapshot.pv.acL1);
        await setDashboard('pv_ac_l2', snapshot.pv.acL2);
        await setDashboard('pv_ac_l3', snapshot.pv.acL3);
        await setDashboard('pv_dc', snapshot.pv.dc);
        await setDashboard('house_total', snapshot.loads.houseTotal);
        await setDashboard('ac_loads_total', snapshot.loads.ac.total);
        await setDashboard('ac_loads_l1', snapshot.loads.ac.l1);
        await setDashboard('ac_loads_l2', snapshot.loads.ac.l2);
        await setDashboard('ac_loads_l3', snapshot.loads.ac.l3);
        await setDashboard('essential_loads_total', snapshot.loads.essential.total);
        await setDashboard('essential_loads_l1', snapshot.loads.essential.l1);
        await setDashboard('essential_loads_l2', snapshot.loads.essential.l2);
        await setDashboard('essential_loads_l3', snapshot.loads.essential.l3);
        await setDashboard('battery_soc', snapshot.battery.soc);
        await setDashboard('battery_power', snapshot.battery.power);
        await setDashboard('battery_flow', snapshot.battery.flow);
        await setDashboard('battery_voltage', snapshot.battery.voltage);
        await setDashboard('battery_current', snapshot.battery.current);
        await setDashboard('battery_temperature', snapshot.battery.temperature);
        await setDashboard('battery_status', snapshot.battery.status);
        await setDashboard('surplus', snapshot.surplus);
        await setDashboard('ev_power', snapshot.ev.power);
        await this.safeSetStateAsync('dashboard.snapshot_json', JSON.stringify(snapshot), true);
        // Commit signal for Lovelace live cards. Must be written after all values and snapshot.
        await this.updateDashboardExtras(snapshot);
        await this.updateStatistics(snapshot);
        await setDashboard('last_update_ms', snapshot.timestampMs);
    }

    async updateViewStates(snapshot) {
        const ui = snapshot && snapshot.ui ? snapshot.ui : null;
        if (!ui) return;

        // In 0.3.3 this function returned early when the visible values were equal.
        // That is bad for Lovelace custom cards because they only receive a new hass update
        // when an exposed state changes. Therefore 0.3.4 writes a fresh payload on EVERY poll.
        // The load calculation is still done in the adapter; Lovelace only displays this payload.
        this.viewRevision = (this.viewRevision || 0) + 1;

        const valuesOnly = {
            grid: ui.grid || {},
            pv: ui.pv || {},
            loads: ui.loads || {},
            battery: ui.battery || {},
            surplus: ui.surplus,
            sources: ui.sources || {}
        };

        const payload = {
            version: ADAPTER_VERSION,
            revision: this.viewRevision,
            updatedAt: snapshot.timestamp || new Date().toISOString(),
            updatedMs: Number.isFinite(snapshot.timestampMs) ? snapshot.timestampMs : Date.now(),
            ...valuesOnly
        };

        const setView = async (id, value) => {
            if (this.isStopping) return;
            if (value === undefined) value = null;
            await this.safeSetStateAsync(`view.${id}`, value, true);
        };

        await setView('grid_total', ui.grid && ui.grid.total);
        await setView('grid_l1', ui.grid && ui.grid.l1);
        await setView('grid_l2', ui.grid && ui.grid.l2);
        await setView('grid_l3', ui.grid && ui.grid.l3);
        await setView('grid_flow', ui.grid && ui.grid.flow);
        await setView('grid_status', ui.grid && ui.grid.status);

        await setView('pv_total', ui.pv && ui.pv.total);
        await setView('pv_ac', ui.pv && ui.pv.ac);
        await setView('pv_ac_l1', ui.pv && ui.pv.acL1);
        await setView('pv_ac_l2', ui.pv && ui.pv.acL2);
        await setView('pv_ac_l3', ui.pv && ui.pv.acL3);
        await setView('pv_dc', ui.pv && ui.pv.dc);

        await setView('house_total', ui.loads && ui.loads.houseTotal);
        await setView('house_l1', ui.loads && ui.loads.houseL1);
        await setView('house_l2', ui.loads && ui.loads.houseL2);
        await setView('house_l3', ui.loads && ui.loads.houseL3);
        await setView('ac_loads_total', ui.loads && ui.loads.ac && ui.loads.ac.total);
        await setView('ac_loads_l1', ui.loads && ui.loads.ac && ui.loads.ac.l1);
        await setView('ac_loads_l2', ui.loads && ui.loads.ac && ui.loads.ac.l2);
        await setView('ac_loads_l3', ui.loads && ui.loads.ac && ui.loads.ac.l3);
        await setView('essential_loads_total', ui.loads && ui.loads.essential && ui.loads.essential.total);
        await setView('essential_loads_l1', ui.loads && ui.loads.essential && ui.loads.essential.l1);
        await setView('essential_loads_l2', ui.loads && ui.loads.essential && ui.loads.essential.l2);
        await setView('essential_loads_l3', ui.loads && ui.loads.essential && ui.loads.essential.l3);

        await setView('battery_soc', ui.battery && ui.battery.soc);
        await setView('battery_power', ui.battery && ui.battery.power);
        await setView('battery_flow', ui.battery && ui.battery.flow);
        await setView('battery_voltage', ui.battery && ui.battery.voltage);
        await setView('battery_current', ui.battery && ui.battery.current);
        await setView('battery_temperature', ui.battery && ui.battery.temperature);
        await setView('battery_status', ui.battery && ui.battery.status);
        await setView('surplus', ui.surplus);

        await setView('load_sources_json', JSON.stringify(ui.sources || {}));

        // Write payload_json before revision/last_change_ms. The revision is the final commit signal.
        await setView('payload_json', JSON.stringify(payload));
        await setView('revision', this.viewRevision);
        await setView('last_change_ms', payload.updatedMs);
    }

    async scanDevices() {
        if (this.isStopping || this.isScanning || !this.client) return;
        this.isScanning = true;
        const started = Date.now();
        let checkedUnits = 0;
        try {
            const candidates = this.buildScanCandidates();
            let added = 0;
            this.log.debug(`Device scan started: checking ${candidates.length} Unit-ID(s): ${candidates.join(', ')}`);

            for (const unitId of candidates) {
                if (this.isStopping) break;
                checkedUnits++;
                const unitStarted = Date.now();
                let foundForUnit = 0;
                const errors = [];
                this.log.debug(`Scan Unit-ID ${unitId}: checking profiles`);

                try {
                    for (const profile of DEVICE_PROFILES) {
                        if (this.isStopping) break;
                        const key = `${unitId}.${profile.key}`;
                        if (this.discoveredDevices.has(key)) continue;

                        const result = await this.probeProfile(unitId, profile);
                        if (this.isStopping) break;

                        if (result.detected) {
                            await this.createDeviceProfile(unitId, profile);
                            if (this.isStopping) break;
                            this.discoveredDevices.set(key, { unitId, profile });
                            added++;
                            foundForUnit++;
                            this.log.info(`Detected Victron ${profile.name} at Unit-ID ${unitId}`);
                            continue;
                        }

                        if (result.error) {
                            errors.push(`${profile.key}: ${this.formatScanError(result.error)}`);
                            if (this.isUnitTimeoutError(result.error)) {
                                this.log.debug(
                                    `Scan Unit-ID ${unitId}: ${this.formatScanError(result.error)}; continuing with next Unit-ID`
                                );
                                break;
                            }
                        }
                    }
                } catch (error) {
                    if (this.isShutdownError(error)) break;
                    errors.push(`unexpected: ${this.formatScanError(error)}`);
                    this.log.debug(
                        `Scan Unit-ID ${unitId}: unexpected error ${this.formatScanError(error)}; continuing with next Unit-ID`
                    );
                }

                if (this.isStopping) break;
                if (foundForUnit > 0) {
                    this.log.debug(
                        `Scan Unit-ID ${unitId}: finished, detected ${foundForUnit} profile(s) in ${Date.now() - unitStarted} ms`
                    );
                } else if (errors.length > 0) {
                    const uniqueErrors = Array.from(new Set(errors)).slice(0, 4).join('; ');
                    this.log.debug(
                        `Scan Unit-ID ${unitId}: no matching profile detected in ${Date.now() - unitStarted} ms; ${uniqueErrors}`
                    );
                } else {
                    this.log.debug(
                        `Scan Unit-ID ${unitId}: no matching profile detected in ${Date.now() - unitStarted} ms`
                    );
                }
            }

            if (this.isStopping) {
                this.log.debug(`Device scan stopped during shutdown after ${checkedUnits} Unit-ID(s)`);
                return;
            }

            await this.safeSetStateAsync('status.discoveredCount', this.discoveredDevices.size, true);
            if (added > 0) {
                await this.pollOnce();
            }
            this.log.debug(
                `Device scan finished: checked ${checkedUnits}/${candidates.length} Unit-ID(s), added ${added} profile(s) in ${Date.now() - started} ms`
            );
        } catch (error) {
            if (this.isShutdownError(error)) {
                this.log.debug(`Device scan stopped during shutdown: ${error.message}`);
                return;
            }
            this.log.warn(`Device scan failed: ${error.message}`);
        } finally {
            this.isScanning = false;
        }
    }

    normalizeUnitIdList(
        value,
        extraIds = [],
        fallback = '100,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,247'
    ) {
        const ids = new Set();
        const add = (entry) => {
            const n = Number(String(entry).trim());
            if (Number.isInteger(n) && n >= 0 && n <= 255) ids.add(n);
        };

        for (const entry of String(value || fallback).split(',')) add(entry);
        for (const entry of extraIds || []) add(entry);

        if (!ids.size) {
            for (const entry of String(fallback).split(',')) add(entry);
        }

        return Array.from(ids)
            .sort((a, b) => a - b)
            .join(',');
    }

    parseUnitIdList(value) {
        const ids = new Set();
        for (const entry of String(value || '').split(',')) {
            const n = Number(String(entry).trim());
            if (Number.isInteger(n) && n >= 0 && n <= 255) ids.add(n);
        }
        ids.add(this.config.unitIdSystem);
        ids.add(this.config.controlUnitId);
        return Array.from(ids)
            .filter((id) => id >= 0 && id <= 255)
            .sort((a, b) => a - b);
    }

    buildScanCandidates() {
        return this.parseUnitIdList(this.config.scanUnitIds);
    }

    async probeProfile(unitId, profile) {
        if (this.isStopping) return { detected: false, stopped: true };
        try {
            const probe = profile.probe;
            await this.client.readHoldingRegisters(unitId, probe.address, getRegisterLength(probe.type));
            return { detected: true };
        } catch (error) {
            return { detected: false, error };
        }
    }

    async createDeviceProfile(unitId, profile) {
        if (this.isStopping) return;
        const unitChannel = `devices.unit_${unitId}`;
        const profileChannel = `${unitChannel}.${profile.key}`;
        await this.ensureChannelObject(
            unitChannel,
            t(`Victron device Unit-ID ${unitId}`, `Victron Gerät Unit-ID ${unitId}`),
            t(
                `Automatically detected Victron service on Modbus Unit-ID ${unitId}.`,
                `Automatisch erkannter Victron-Dienst mit Modbus Unit-ID ${unitId}.`
            ),
            { unitId }
        );
        if (this.isStopping) return;
        await this.ensureChannelObject(
            profileChannel,
            profile.name,
            t(
                `Automatically detected Victron profile: ${profile.name}.`,
                `Automatisch erkanntes Victron-Profil: ${profile.name}.`
            ),
            { unitId, profile: profile.key }
        );
        for (const definition of profile.registers) {
            if (this.isStopping) return;
            const objectId = `${profileChannel}.${definition.id}`;
            await this.ensureStateObject(objectId, definition, Boolean(definition.write), {
                unitId,
                address: definition.address,
                type: definition.type,
                scale: definition.scale
            });
            if (definition.write) await this.registerWritableState(objectId, unitId, definition);
        }
    }

    async onStateChange(id, state) {
        if (id && id === this.config.forecastTodayStateId) {
            this.applyForecast(state);
            return;
        }
        if (!state || state.ack) return;
        const entry = this.writableStates.get(id);
        if (!entry) return;

        // Make sure the next poll writes the real device value again (with ack=true),
        // even if it did not change, so a rejected command does not stay visible.
        this.stateCache.delete(entry.objectId);
        try {
            await this.handleWrite(entry, state.val);
        } catch (error) {
            this.log.error(`Write to ${id} failed: ${error.message}`);
            await this.safeSetStateAsync(
                'status.lastError',
                `Write to ${entry.objectId} failed: ${error.message}`,
                true
            );
        }
    }

    /**
     * Writes a value to the Modbus register behind a writable state.
     *
     * @param {{objectId: string, unitId: number, definition: any}} entry writable state entry
     * @param {any} value value written by the user (scaled, as shown in ioBroker)
     */
    async handleWrite(entry, value) {
        const { objectId, unitId, definition } = entry;
        if (!this.config.allowWrites) {
            this.log.warn(
                `Write to ${objectId} blocked. Enable "Allow write commands" in the instance settings first.`
            );
            await this.safeSetStateAsync('status.lastError', `Write blocked: writing is disabled (${objectId})`, true);
            return;
        }
        if (!this.client) throw new Error('Modbus client not available');

        if (!definition.boolean) {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) throw new Error(`Value '${value}' is not numeric`);
            if (typeof definition.min === 'number' && numeric < definition.min)
                throw new Error(`Value ${numeric} is below minimum ${definition.min}`);
            if (typeof definition.max === 'number' && numeric > definition.max)
                throw new Error(`Value ${numeric} is above maximum ${definition.max}`);
            if (
                definition.unit === 'W' &&
                (numeric < this.config.writeSafetyMinW || numeric > this.config.writeSafetyMaxW)
            ) {
                throw new Error(
                    `${numeric} W is outside the safety range ${this.config.writeSafetyMinW}..${this.config.writeSafetyMaxW} W`
                );
            }
        }

        const registers = encodeValue(value, definition);
        if (registers.length === 1) {
            await this.client.writeSingleRegister(unitId, definition.address, registers[0]);
        } else {
            await this.client.writeMultipleRegisters(unitId, definition.address, registers);
        }

        const ackValue = definition.boolean
            ? value === true || value === 'true' || value === 1 || value === '1'
            : Number(value);
        await this.safeSetStateAsync(objectId, ackValue, true);
        await this.safeSetStateAsync('status.lastError', '', true);
        this.log.info(`Wrote ${value} to Unit-ID ${unitId}, register ${definition.address} (${objectId})`);
    }

    // ------------------------------------------------------------------
    // Energy statistics (today / month / year, day curve, history)
    // ------------------------------------------------------------------

    static get STAT_FIELDS() {
        return {
            pv: ['PV yield', 'PV-Ertrag'],
            consumption: ['Consumption', 'Verbrauch'],
            gridImport: ['Grid import', 'Netzbezug'],
            gridExport: ['Grid feed-in', 'Einspeisung'],
            batteryCharge: ['Battery charged', 'Akku geladen'],
            batteryDischarge: ['Battery discharged', 'Akku entladen'],
            ev: ['EV charger', 'Wallbox']
        };
    }

    static statKey(key) {
        return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    }

    async createStatisticsObjects() {
        await this.ensureChannelObject(
            'statistics',
            t('Energy statistics', 'Energiestatistik'),
            t(
                'Energy values integrated by the adapter from the live power values.',
                'Vom Adapter aus den Live-Leistungen aufsummierte Energiewerte.'
            )
        );
        const periods = {
            today: ['today', 'heute'],
            month: ['current month', 'aktueller Monat'],
            year: ['current year', 'aktuelles Jahr']
        };
        for (const [period, [periodEn, periodDe]] of Object.entries(periods)) {
            await this.ensureChannelObject(
                `statistics.${period}`,
                t(`Statistics ${periodEn}`, `Statistik ${periodDe}`),
                t('', '')
            );
            for (const [key, [en, de]] of Object.entries(VictronAdapter.STAT_FIELDS)) {
                await this.ensureStateObject(
                    `statistics.${period}.${VictronAdapter.statKey(key)}_kwh`,
                    {
                        id: key,
                        nameEn: `${en} ${periodEn}`,
                        name: `${de} ${periodDe}`,
                        nameDe: `${de} ${periodDe}`,
                        descriptionEn: `${en} ${periodEn} in kWh.`,
                        descriptionDe: `${de} ${periodDe} in kWh.`,
                        type: 'number',
                        role: 'value.energy',
                        unit: 'kWh'
                    },
                    false
                );
            }
            const extra = [
                ['autarky_percent', 'Self-sufficiency', 'Autarkie', '%', 'value'],
                ['self_consumption_percent', 'Self-consumption rate', 'Eigenverbrauchsquote', '%', 'value'],
                ['savings_eur', 'Savings', 'Ersparnis', '€', 'value'],
                ['savings_self_eur', 'Savings from self-consumption', 'Ersparnis durch Eigenverbrauch', '€', 'value'],
                ['savings_export_eur', 'Feed-in revenue', 'Einspeisevergütung', '€', 'value']
            ];
            for (const [id, en, de, unit, role] of extra) {
                await this.ensureStateObject(
                    `statistics.${period}.${id}`,
                    {
                        id,
                        nameEn: `${en} ${periodEn}`,
                        name: `${de} ${periodDe}`,
                        nameDe: `${de} ${periodDe}`,
                        descriptionEn: `${en} ${periodEn}.`,
                        descriptionDe: `${de} ${periodDe}.`,
                        type: 'number',
                        role,
                        unit
                    },
                    false
                );
            }
        }
        await this.ensureStateObject(
            'statistics.vrm_status',
            {
                id: 'vrm_status',
                nameEn: 'VRM import status',
                name: 'VRM-Import Status',
                nameDe: 'VRM-Import Status',
                descriptionEn: 'Result of the last history import from the VRM portal.',
                descriptionDe: 'Ergebnis des letzten Historien-Imports aus dem VRM-Portal.',
                type: 'string',
                role: 'text'
            },
            false
        );
        await this.ensureStateObject(
            'statistics.vrm_last_sync',
            {
                id: 'vrm_last_sync',
                nameEn: 'VRM last import',
                name: 'VRM letzter Import',
                nameDe: 'VRM letzter Import',
                descriptionEn: 'Time of the last successful VRM import.',
                descriptionDe: 'Zeitpunkt des letzten erfolgreichen VRM-Imports.',
                type: 'string',
                role: 'date'
            },
            false
        );
        const jsonStates = [
            [
                'day_curve_json',
                'Day curve (5 min)',
                'Tagesverlauf (5 min)',
                'PV, consumption, grid and battery SoC of today in 5 minute steps.',
                'PV, Verbrauch, Netz und Akku-Ladezustand von heute in 5-Minuten-Schritten.'
            ],
            [
                'history_json',
                'Daily history',
                'Tageshistorie',
                'Daily energy values of the last 400 days.',
                'Tägliche Energiewerte der letzten 400 Tage.'
            ],
            [
                'storage_json',
                'Internal storage',
                'Interner Speicher',
                'Internal state of the statistics (restored after a restart).',
                'Interner Zustand der Statistik (wird nach einem Neustart wiederhergestellt).'
            ]
        ];
        for (const [id, en, de, descEn, descDe] of jsonStates) {
            await this.ensureStateObject(
                `statistics.${id}`,
                {
                    id,
                    nameEn: en,
                    name: de,
                    nameDe: de,
                    descriptionEn: descEn,
                    descriptionDe: descDe,
                    type: 'string',
                    role: 'json'
                },
                false
            );
        }
    }

    async restoreStatistics() {
        try {
            const state = await this.getStateAsync('statistics.storage_json');
            if (state && typeof state.val === 'string' && state.val) {
                this.stats.restore(JSON.parse(state.val), Date.now());
                this.log.debug(`Statistics restored (${this.stats.history.length} days of history)`);
            }
        } catch (error) {
            this.log.warn(`Could not restore statistics: ${error.message}`);
        }
    }

    /**
     * @param {any} snapshot dashboard snapshot of the current poll
     */
    async updateStatistics(snapshot) {
        if (this.isStopping) return;
        const now = Number.isFinite(snapshot.timestampMs) ? snapshot.timestampMs : Date.now();
        const newDay = this.stats.update(
            {
                pv: snapshot.pv.total,
                consumption: snapshot.loads.houseTotal,
                grid: snapshot.grid.total,
                battery: snapshot.battery.power,
                ev: snapshot.ev ? snapshot.ev.power : null,
                soc: snapshot.battery.soc
            },
            now
        );
        // Statistics change slowly: write them once per minute (and immediately after midnight).
        if (!newDay && now - this.lastStatsWrite < 60000) return;
        this.lastStatsWrite = now;
        await this.writeStatistics();
        if (newDay || now - this.lastStatsPersist >= 5 * 60000) {
            this.lastStatsPersist = now;
            await this.safeSetStateAsync('statistics.storage_json', JSON.stringify(this.stats.toJSON()), true);
        }
    }

    async writeStatistics() {
        const prices = { priceImport: this.config.priceImport, priceExport: this.config.priceExport };
        const periods = this.stats.periods();
        for (const [period, energy] of Object.entries(periods)) {
            for (const key of ENERGY_KEYS) {
                await this.safeSetStateAsync(
                    `statistics.${period}.${VictronAdapter.statKey(key)}_kwh`,
                    energy[key],
                    true
                );
            }
            const figures = EnergyStatistics.figures(energy, prices);
            await this.safeSetStateAsync(`statistics.${period}.autarky_percent`, figures.autarky, true);
            await this.safeSetStateAsync(
                `statistics.${period}.self_consumption_percent`,
                figures.selfConsumption,
                true
            );
            await this.safeSetStateAsync(`statistics.${period}.savings_eur`, figures.savings, true);
            await this.safeSetStateAsync(`statistics.${period}.savings_self_eur`, figures.savingsSelf, true);
            await this.safeSetStateAsync(`statistics.${period}.savings_export_eur`, figures.savingsExport, true);
        }
        await this.safeSetStateAsync('statistics.day_curve_json', JSON.stringify(this.stats.curveCompact()), true);
        await this.safeSetStateAsync('statistics.history_json', JSON.stringify(this.stats.historyCompact()), true);
    }

    // ------------------------------------------------------------------
    // History import from the VRM portal (the GX has no history via Modbus)
    // ------------------------------------------------------------------

    setupVrmSync() {
        if (!this.config.vrmEnabled) {
            this.safeSetStateAsync('statistics.vrm_status', 'disabled', true).catch(() => undefined);
            return;
        }
        if (!this.config.vrmToken || !/^\d+$/.test(this.config.vrmSiteId)) {
            this.log.warn('VRM import is enabled, but the access token or the installation id is missing.');
            this.safeSetStateAsync('statistics.vrm_status', 'Access token or installation id missing', true).catch(
                () => undefined
            );
            return;
        }
        // first sync shortly after start, then every 3 hours
        this.vrmTimer = this.setTimeout(() => this.syncVrm(), 15000);
        this.vrmInterval = this.setInterval(() => this.syncVrm(), 3 * 3600 * 1000);
    }

    async syncVrm() {
        if (this.isStopping || this.vrmBusy) return;
        this.vrmBusy = true;
        try {
            const fullImport = this.stats.history.length < 300 && !this.vrmFullDone;
            const days = fullImport ? 400 : 4;
            const result = await fetchVrmDays({ token: this.config.vrmToken, siteId: this.config.vrmSiteId, days });
            if (this.isStopping) return;
            const count = this.stats.importDays(result, Date.now());
            if (fullImport) this.vrmFullDone = true;
            await this.writeStatistics();
            await this.safeSetStateAsync('statistics.storage_json', JSON.stringify(this.stats.toJSON()), true);
            await this.safeSetStateAsync('statistics.vrm_status', `OK – ${count} days imported`, true);
            await this.safeSetStateAsync('statistics.vrm_last_sync', new Date().toISOString(), true);
            this.log.info(`VRM import: ${count} days imported (${days} days requested)`);
        } catch (error) {
            if (this.isStopping) return;
            this.log.warn(`VRM import failed: ${error.message}`);
            await this.safeSetStateAsync('statistics.vrm_status', `Error: ${error.message}`, true);
        } finally {
            this.vrmBusy = false;
        }
    }

    // ------------------------------------------------------------------
    // PV forecast from another adapter (e.g. pvforecast, solcast)
    // ------------------------------------------------------------------

    async setupForecast() {
        const id = this.config.forecastTodayStateId;
        if (!id) return;
        try {
            await this.subscribeForeignStatesAsync(id);
            const state = await this.getForeignStateAsync(id);
            this.applyForecast(state);
            this.log.info(`PV forecast is read from ${id}`);
        } catch (error) {
            this.log.warn(`PV forecast state ${id} could not be read: ${error.message}`);
        }
    }

    /**
     * @param {any} state forecast state
     */
    applyForecast(state) {
        const value = state ? Number(state.val) : NaN;
        this.forecastTodayKwh = Number.isFinite(value)
            ? this.config.forecastUnit === 'Wh'
                ? value / 1000
                : value
            : null;
    }

    // ------------------------------------------------------------------
    // Additional dashboard values: alarms, battery details, forecast
    // ------------------------------------------------------------------

    collectAlarms() {
        const alarms = [];
        for (const [key, value] of this.lastValues.entries()) {
            const match = String(key).match(/^devices\.unit_(\d+)\.([^.]+)\.(.+)$/);
            if (!match || !Number.isFinite(value) || value <= 0) continue;
            const [, unit, profileKey, stateId] = match;
            const isAlarm = /alarm$/.test(stateId) && !/alarms$/.test(stateId);
            const isError = /^(error_code|ve_bus_error)$/.test(stateId);
            if (!isAlarm && !isError) continue;
            const profile = DEVICE_PROFILES.find((entry) => entry.key === profileKey);
            const definition = profile && profile.registers.find((entry) => entry.id === stateId);
            alarms.push({
                id: `${profileKey}.${stateId}`,
                unit: Number(unit),
                device: profile ? profile.name : profileKey,
                name: definition ? definition.name : stateId,
                level: isError ? 2 : value >= 2 ? 2 : 1,
                value
            });
        }
        return alarms;
    }

    /**
     * @param {any} snapshot dashboard snapshot of the current poll
     */
    async updateDashboardExtras(snapshot) {
        if (this.isStopping) return;
        const alarms = this.collectAlarms();
        const level = alarms.reduce((max, alarm) => Math.max(max, alarm.level), 0);
        await this.safeSetStateAsync('dashboard.alarm_count', alarms.length, true);
        await this.safeSetStateAsync('dashboard.alarm_level', level, true);
        await this.safeSetStateAsync('dashboard.alarms_json', JSON.stringify(alarms), true);

        const soc = snapshot.battery.soc;
        const power = snapshot.battery.power;
        const capacity =
            this.config.batteryCapacityKwh > 0
                ? this.config.batteryCapacityKwh
                : this.lastValues.get('controls.dynamic_ess_battery_capacity_kwh') || null;
        let toFull = null;
        if (Number.isFinite(soc) && Number.isFinite(power) && power > 50 && soc < 100 && capacity > 0) {
            toFull = Math.round(((((100 - soc) / 100) * capacity * 1000) / power) * 60);
        }
        let toGo = null;
        const systemToGo = this.lastValues.get('system.battery_time_to_go_s');
        const deviceToGo = this._firstDeviceValue('battery', 'time_to_go');
        const seconds = Number.isFinite(systemToGo) && systemToGo > 0 ? systemToGo : deviceToGo;
        if (Number.isFinite(power) && power < -50) {
            if (Number.isFinite(seconds) && seconds > 0) {
                toGo = Math.round(seconds / 60);
            } else if (Number.isFinite(soc) && capacity > 0) {
                toGo = Math.round((((soc / 100) * capacity * 1000) / -power) * 60);
            }
        }
        await this.safeSetStateAsync('dashboard.battery_time_to_full_min', toFull, true);
        await this.safeSetStateAsync('dashboard.battery_time_to_go_min', toGo, true);
        await this.safeSetStateAsync('dashboard.battery_capacity_kwh', capacity || null, true);
        await this.safeSetStateAsync(
            'dashboard.battery_soh',
            this._roundForSnapshot(this._firstDeviceValue('battery', 'state_of_health')),
            true
        );
        await this.safeSetStateAsync(
            'dashboard.battery_cycles',
            this._roundForSnapshot(this._firstDeviceValue('battery', 'charge_cycles')),
            true
        );
        await this.safeSetStateAsync(
            'dashboard.pv_forecast_today_kwh',
            this.forecastTodayKwh === null ? null : Math.round(this.forecastTodayKwh * 100) / 100,
            true
        );
    }

    onUnload(callback) {
        try {
            if (this.stats && this.stats.today.date) {
                this.setState('statistics.storage_json', JSON.stringify(this.stats.toJSON()), true);
            }
            this.isStopping = true;
            this.clearTimer('pollTimer');
            this.clearTimer('scanTimer');
            if (this.vrmTimer) this.clearTimeout(this.vrmTimer);
            if (this.vrmInterval) this.clearInterval(this.vrmInterval);
            if (this.client) {
                this.client.destroy();
                this.client = null;
            }
            this.log.debug('Adapter unload requested: active polls/scans will stop without further state writes.');
            callback();
        } catch (error) {
            callback();
        }
    }
}

if (require.main !== module) {
    module.exports = (options) => new VictronAdapter(options);
} else {
    new VictronAdapter();
}
