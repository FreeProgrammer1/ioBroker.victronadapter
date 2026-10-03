'use strict';

/**
 * Import of daily energy values from the Victron VRM portal.
 *
 * The GX device does not provide any history via Modbus TCP (only live values and lifetime counters).
 * VRM stores the history; it is read with a personal access token
 * (VRM portal → Preferences → Integrations → Access tokens).
 *
 * Endpoint: GET https://vrmapi.victronenergy.com/v2/installations/{idSite}/stats?type=kwh&interval=days&start=..&end=..
 * Header:   x-authorization: Token <access token>
 *
 * Energy flow codes (kWh): P = PV, G = grid, B = battery, c = consumers/loads, b = battery, g = grid,
 * e.g. Pc = PV to consumers, Gb = grid to battery, Bg = battery to grid.
 */

const timers = require('node:timers');
const { localDate } = require('./statistics');

const VRM_BASE = 'https://vrmapi.victronenergy.com/v2';

/**
 * Converts the VRM "records" object into daily values.
 *
 * @param {unknown} records records object of the stats response
 * @returns {Array<Record<string, number|string>>} days with pv, consumption, gridImport, gridExport, batteryCharge, batteryDischarge
 */
function recordsToDays(records) {
    const byDate = new Map();
    if (!records || typeof records !== 'object') {
        return [];
    }
    for (const [code, series] of Object.entries(records)) {
        if (!Array.isArray(series)) {
            continue;
        }
        for (const point of series) {
            if (!Array.isArray(point) || point.length < 2) {
                continue;
            }
            let ts = Number(point[0]);
            const value = Number(point[1]);
            if (!Number.isFinite(ts) || !Number.isFinite(value)) {
                continue;
            }
            if (ts < 1e12) {
                ts *= 1000;
            } // seconds -> ms
            const date = localDate(ts);
            if (!byDate.has(date)) {
                byDate.set(date, {});
            }
            const day = byDate.get(date);
            day[code] = (day[code] || 0) + value;
        }
    }
    const v = (day, code) => Number(day[code]) || 0;
    return [...byDate.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([date, day]) => ({
            date,
            pv: v(day, 'Pc') + v(day, 'Pb') + v(day, 'Pg'),
            consumption: v(day, 'Pc') + v(day, 'Gc') + v(day, 'Bc'),
            gridImport: v(day, 'Gc') + v(day, 'Gb'),
            gridExport: v(day, 'Pg') + v(day, 'Bg'),
            batteryCharge: v(day, 'Pb') + v(day, 'Gb'),
            batteryDischarge: v(day, 'Bc') + v(day, 'Bg'),
            ev: 0
        }));
}

/**
 * Reads daily kWh values from VRM.
 *
 * @param {{token: string, siteId: string|number, days: number, now?: number, fetchImpl?: typeof fetch, timeoutMs?: number}} options options
 */
async function fetchVrmDays(options) {
    const token = String(options.token || '').trim();
    const siteId = String(options.siteId || '').trim();
    if (!token || !/^\d+$/.test(siteId)) {
        throw new Error('VRM access token or installation id missing');
    }
    const now = options.now || Date.now();
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    const start = Math.floor(midnight.getTime() / 1000) - Math.max(1, options.days || 1) * 86400;
    const end = Math.floor(now / 1000);
    const url = `${VRM_BASE}/installations/${siteId}/stats?type=kwh&interval=days&start=${start}&end=${end}`;
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const controller = new globalThis.AbortController();
    const timer = timers.setTimeout(() => controller.abort(), options.timeoutMs || 30000);
    try {
        const response = await fetchImpl(url, {
            headers: { 'x-authorization': `Token ${token}`, 'Content-Type': 'application/json' },
            signal: controller.signal
        });
        if (response.status === 401 || response.status === 403) {
            throw new Error(`VRM rejected the access token (HTTP ${response.status})`);
        }
        if (!response.ok) {
            throw new Error(`VRM request failed (HTTP ${response.status})`);
        }
        const body = await response.json();
        if (body && body.success === false) {
            throw new Error(`VRM error: ${body.errors || body.error_code || 'unknown'}`);
        }
        return recordsToDays(body && body.records);
    } finally {
        timers.clearTimeout(timer);
    }
}

module.exports = { fetchVrmDays, recordsToDays };
