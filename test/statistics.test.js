'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { EnergyStatistics } = require('../lib/statistics');

const at = (h, m = 0, day = 3) => new Date(2026, 9, day, h, m, 0).getTime();

describe('energy statistics', () => {
    it('integrates power to kWh with the trapezoidal rule', () => {
        const stats = new EnergyStatistics();
        // 2 kW PV for one hour in 1 minute steps
        for (let minute = 0; minute <= 60; minute++)
            stats.update({ pv: 2000, consumption: 1000, grid: -1000 }, at(12, 0) + minute * 60000);
        const today = stats.periods().today;
        assert.equal(today.pv, 2);
        assert.equal(today.consumption, 1);
        assert.equal(today.gridExport, 1);
        assert.equal(today.gridImport, 0);
    });

    it('does not integrate across long gaps', () => {
        const stats = new EnergyStatistics();
        stats.update({ pv: 5000 }, at(10));
        stats.update({ pv: 5000 }, at(11)); // 60 min gap -> ignored
        assert.equal(stats.periods().today.pv, 0);
    });

    it('moves the day into the history at midnight and keeps month/year sums', () => {
        const stats = new EnergyStatistics();
        stats.update({ pv: 3000 }, at(23, 0, 2));
        stats.update({ pv: 3000 }, at(23, 10, 2));
        const newDay = stats.update({ pv: 0 }, at(0, 1, 3));
        assert.equal(newDay, true);
        assert.equal(stats.history.length, 1);
        assert.equal(stats.history[0].date, '2026-10-02');
        assert.equal(stats.periods().today.pv, 0);
        assert.equal(stats.periods().month.pv, 0.5);
        assert.equal(stats.periods().year.pv, 0.5);
    });

    it('survives a restart through toJSON/restore', () => {
        const stats = new EnergyStatistics();
        stats.update({ pv: 1200, soc: 50 }, at(9));
        stats.update({ pv: 1200, soc: 51 }, at(9, 10));
        const copy = new EnergyStatistics();
        copy.restore(JSON.parse(JSON.stringify(stats.toJSON())), at(9, 20));
        assert.equal(copy.periods().today.pv, 0.2);
        assert.equal(copy.curveCompact().soc[(9 * 60 + 10) / 5], 51);
    });

    it('calculates self-sufficiency, self-consumption and savings', () => {
        const f = EnergyStatistics.figures(
            { pv: 62.4, consumption: 31.2, gridImport: 1.9, gridExport: 21.3 },
            { priceImport: 0.32, priceExport: 0.08 }
        );
        assert.equal(f.autarky, 93.9);
        assert.equal(f.selfConsumption, 65.9);
        assert.equal(f.savings, 11.08);
    });
});
