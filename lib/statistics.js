'use strict';

/**
 * Energy statistics for the Victron adapter.
 *
 * The adapter feeds one power sample per poll (W). Energy is integrated with the trapezoidal
 * rule, so it does not depend on Victron energy counters being available on every installation.
 * Gaps longer than MAX_GAP_MS (adapter stopped, GX offline) are not integrated.
 *
 * Persistence is done by the adapter: it stores toJSON() in a state and passes it back to
 * restore() after a restart.
 */

const MAX_GAP_MS = 15 * 60 * 1000;
const SLOT_MINUTES = 5;
const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES;
const HISTORY_DAYS = 400;
const ENERGY_KEYS = ['pv', 'consumption', 'gridImport', 'gridExport', 'batteryCharge', 'batteryDischarge', 'ev'];

/**
 * Local calendar date as YYYY-MM-DD.
 *
 * @param {number} ts timestamp in ms
 */
function localDate(ts) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function emptyEnergy() {
    const result = {};
    for (const key of ENERGY_KEYS) result[key] = 0;
    return result;
}

function emptyCurve() {
    return {
        pv: new Array(SLOTS_PER_DAY).fill(null),
        consumption: new Array(SLOTS_PER_DAY).fill(null),
        grid: new Array(SLOTS_PER_DAY).fill(null),
        soc: new Array(SLOTS_PER_DAY).fill(null),
        sums: { pv: {}, consumption: {}, grid: {} }
    };
}

function finite(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function round(value, digits = 3) {
    const f = 10 ** digits;
    return Math.round(value * f) / f;
}

class EnergyStatistics {
    constructor() {
        this.today = { date: null, energy: emptyEnergy() };
        this.history = []; // [{ date, pv, consumption, gridImport, gridExport, batteryCharge, batteryDischarge, ev }]
        this.curve = emptyCurve();
        this.last = null; // { ts, sample }
    }

    /**
     * Restores the persisted state.
     *
     * @param {any} data object created by toJSON()
     * @param {number} now current timestamp
     */
    restore(data, now = Date.now()) {
        if (!data || typeof data !== 'object') return;
        if (Array.isArray(data.history)) {
            this.history = data.history.filter((entry) => entry && typeof entry.date === 'string').slice(-HISTORY_DAYS);
        }
        if (data.today && typeof data.today.date === 'string' && data.today.energy) {
            this.today = { date: data.today.date, energy: { ...emptyEnergy(), ...data.today.energy } };
        }
        if (data.curve && data.curve.date === this.today.date && Array.isArray(data.curve.pv)) {
            const curve = emptyCurve();
            for (const key of ['pv', 'consumption', 'grid', 'soc']) {
                if (Array.isArray(data.curve[key]) && data.curve[key].length === SLOTS_PER_DAY)
                    curve[key] = data.curve[key];
            }
            this.curve = curve;
        }
        this.rollover(now);
    }

    /**
     * Closes the current day when the local date changed.
     *
     * @param {number} now current timestamp
     * @returns {boolean} true when a new day was started
     */
    rollover(now) {
        const date = localDate(now);
        if (this.today.date === date) return false;
        if (this.today.date) {
            const hasEnergy = ENERGY_KEYS.some((key) => this.today.energy[key] > 0);
            if (hasEnergy) {
                this.history = this.history.filter((entry) => entry.date !== this.today.date);
                this.history.push({ date: this.today.date, ...this.roundedEnergy(this.today.energy) });
                this.history.sort((a, b) => (a.date < b.date ? -1 : 1));
                this.history = this.history.slice(-HISTORY_DAYS);
            }
        }
        this.today = { date, energy: emptyEnergy() };
        this.curve = emptyCurve();
        this.last = null;
        return true;
    }

    /**
     * Imports daily energy values from an external source (e.g. the VRM portal).
     * Past days replace the locally integrated values (the external source covers the whole day);
     * for today the higher value per key is kept, because the adapter may have started during the day.
     *
     * @param {Array<{date: string} & Record<string, number>>} days daily kWh values
     * @param {number} now current timestamp
     * @returns {number} number of imported days
     */
    importDays(days, now = Date.now()) {
        this.rollover(now);
        let count = 0;
        for (const day of days || []) {
            if (!day || typeof day.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day.date)) continue;
            const energy = {};
            for (const key of ENERGY_KEYS) energy[key] = Math.max(0, finite(day[key]) ?? 0);
            if (day.date === this.today.date) {
                for (const key of ENERGY_KEYS) {
                    if (energy[key] > this.today.energy[key]) this.today.energy[key] = energy[key];
                }
                count++;
                continue;
            }
            if (day.date > (this.today.date || '9999')) continue;
            this.history = this.history.filter((entry) => entry.date !== day.date);
            this.history.push({ date: day.date, ...this.roundedEnergy(energy) });
            count++;
        }
        this.history.sort((a, b) => (a.date < b.date ? -1 : 1));
        this.history = this.history.slice(-HISTORY_DAYS);
        return count;
    }

    /**
     * Adds one sample.
     *
     * @param {{pv?: number, consumption?: number, grid?: number, battery?: number, ev?: number, soc?: number}} sample power in W, soc in %
     * @param {number} now timestamp of the sample
     * @returns {boolean} true when a new day was started
     */
    update(sample, now = Date.now()) {
        const newDay = this.rollover(now);
        const current = {
            pv: Math.max(0, finite(sample.pv) ?? 0),
            consumption: Math.max(0, finite(sample.consumption) ?? 0),
            gridImport: Math.max(0, finite(sample.grid) ?? 0),
            gridExport: Math.max(0, -(finite(sample.grid) ?? 0)),
            batteryCharge: Math.max(0, finite(sample.battery) ?? 0),
            batteryDischarge: Math.max(0, -(finite(sample.battery) ?? 0)),
            ev: Math.max(0, finite(sample.ev) ?? 0)
        };

        if (this.last && now > this.last.ts && now - this.last.ts <= MAX_GAP_MS) {
            const hours = (now - this.last.ts) / 3600000;
            for (const key of ENERGY_KEYS) {
                // W * h / 1000 = kWh, trapezoidal rule
                this.today.energy[key] += (((this.last.sample[key] + current[key]) / 2) * hours) / 1000;
            }
        }
        this.last = { ts: now, sample: current };

        // 5 minute curve (averages)
        const d = new Date(now);
        const slot = Math.floor((d.getHours() * 60 + d.getMinutes()) / SLOT_MINUTES);
        const grid = finite(sample.grid);
        const values = { pv: current.pv, consumption: current.consumption, grid: grid ?? 0 };
        for (const key of ['pv', 'consumption', 'grid']) {
            const sums = this.curve.sums[key];
            if (!sums[slot]) sums[slot] = { sum: 0, count: 0 };
            sums[slot].sum += values[key];
            sums[slot].count += 1;
            this.curve[key][slot] = Math.round(sums[slot].sum / sums[slot].count);
        }
        const soc = finite(sample.soc);
        if (soc !== null) this.curve.soc[slot] = round(soc, 1);
        return newDay;
    }

    roundedEnergy(energy) {
        const result = {};
        for (const key of ENERGY_KEYS) result[key] = round(energy[key] || 0, 3);
        return result;
    }

    /**
     * Derived key figures for a block of energy values.
     *
     * @param {Record<string, number>} energy kWh values
     * @param {{priceImport?: number, priceExport?: number}} prices prices per kWh
     */
    static figures(energy, prices = {}) {
        const consumption = energy.consumption || 0;
        const pv = energy.pv || 0;
        const selfUsed = Math.max(0, consumption - (energy.gridImport || 0));
        const autarky = consumption > 0 ? Math.max(0, Math.min(100, (selfUsed / consumption) * 100)) : null;
        const selfConsumption =
            pv > 0 ? Math.max(0, Math.min(100, ((pv - (energy.gridExport || 0)) / pv) * 100)) : null;
        const priceImport = Number(prices.priceImport) || 0;
        const priceExport = Number(prices.priceExport) || 0;
        const savingsSelf = selfUsed * priceImport;
        const savingsExport = (energy.gridExport || 0) * priceExport;
        return {
            autarky: autarky === null ? null : round(autarky, 1),
            selfConsumption: selfConsumption === null ? null : round(selfConsumption, 1),
            savings: round(savingsSelf + savingsExport, 2),
            savingsSelf: round(savingsSelf, 2),
            savingsExport: round(savingsExport, 2)
        };
    }

    /**
     * Sum of all days whose date starts with the prefix (YYYY-MM or YYYY), including today.
     *
     * @param {string} prefix date prefix
     */
    sumPeriod(prefix) {
        const total = emptyEnergy();
        for (const entry of this.history) {
            if (!entry.date.startsWith(prefix) || entry.date === this.today.date) continue;
            for (const key of ENERGY_KEYS) total[key] += entry[key] || 0;
        }
        if (this.today.date && this.today.date.startsWith(prefix)) {
            for (const key of ENERGY_KEYS) total[key] += this.today.energy[key];
        }
        return this.roundedEnergy(total);
    }

    /** Values for today, the current month and the current year. */
    periods() {
        const date = this.today.date || localDate(Date.now());
        return {
            today: this.roundedEnergy(this.today.energy),
            month: this.sumPeriod(date.slice(0, 7)),
            year: this.sumPeriod(date.slice(0, 4))
        };
    }

    /** Compact day list for the history card (one array per value). */
    historyCompact() {
        const days = [...this.history.filter((entry) => entry.date !== this.today.date)];
        if (this.today.date) days.push({ date: this.today.date, ...this.roundedEnergy(this.today.energy) });
        const result = { date: [] };
        for (const key of ENERGY_KEYS) result[key] = [];
        for (const entry of days.slice(-HISTORY_DAYS)) {
            result.date.push(entry.date);
            for (const key of ENERGY_KEYS) result[key].push(round(entry[key] || 0, 2));
        }
        return result;
    }

    /** Day curve for the chart card. */
    curveCompact() {
        return {
            date: this.today.date,
            slotMinutes: SLOT_MINUTES,
            pv: this.curve.pv,
            consumption: this.curve.consumption,
            grid: this.curve.grid,
            soc: this.curve.soc
        };
    }

    toJSON() {
        return {
            version: 1,
            today: { date: this.today.date, energy: this.roundedEnergy(this.today.energy) },
            history: this.history,
            curve: {
                date: this.today.date,
                pv: this.curve.pv,
                consumption: this.curve.consumption,
                grid: this.curve.grid,
                soc: this.curve.soc
            }
        };
    }
}

module.exports = { EnergyStatistics, ENERGY_KEYS, localDate, SLOTS_PER_DAY };
