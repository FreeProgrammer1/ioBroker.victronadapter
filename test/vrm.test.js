'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { fetchVrmDays, recordsToDays } = require('../lib/vrm');
const { EnergyStatistics } = require('../lib/statistics');

const day = (d) => new Date(2026, 9, d, 0, 0, 0).getTime();

describe('VRM import', () => {
    it('maps VRM energy flow codes to daily values', () => {
        const days = recordsToDays({
            Pc: [[day(1), 10]],
            Pb: [[day(1), 8]],
            Pg: [[day(1), 4]],
            Gc: [[day(1), 2]],
            Gb: [[day(1), 1]],
            Bc: [[day(1), 5]],
            Bg: [[day(1 / 1), 0.5]]
        });
        assert.equal(days.length, 1);
        assert.deepEqual(days[0], {
            date: '2026-10-01',
            pv: 22,
            consumption: 17,
            gridImport: 3,
            gridExport: 4.5,
            batteryCharge: 9,
            batteryDischarge: 5.5,
            ev: 0
        });
    });

    it('accepts timestamps in seconds', () => {
        const days = recordsToDays({ Pc: [[day(2) / 1000, 3]] });
        assert.equal(days[0].date, '2026-10-02');
    });

    it('sends the token header and handles errors', async () => {
        let seen;
        const fetchImpl = async (url, opts) => {
            seen = { url, opts };
            return { ok: true, status: 200, json: async () => ({ success: true, records: { Pc: [[day(2), 7]] } }) };
        };
        const days = await fetchVrmDays({ token: 'abc', siteId: '12345', days: 3, now: day(3) + 3600000, fetchImpl });
        assert.match(seen.url, /installations\/12345\/stats\?type=kwh&interval=days&start=\d+&end=\d+/);
        assert.equal(seen.opts.headers['x-authorization'], 'Token abc');
        assert.equal(days[0].pv, 7);
        await assert.rejects(
            fetchVrmDays({ token: 'x', siteId: '1', fetchImpl: async () => ({ ok: false, status: 401 }) }),
            /access token/
        );
        await assert.rejects(fetchVrmDays({ token: '', siteId: '1' }), /missing/);
    });

    it('fills the statistics history and keeps the higher value for today', () => {
        const stats = new EnergyStatistics();
        stats.update({ pv: 0, consumption: 600 }, day(3) + 10 * 3600000);
        stats.update({ pv: 0, consumption: 600 }, day(3) + 10 * 3600000 + 600000);
        const count = stats.importDays(
            [
                { date: '2026-10-01', pv: 20, consumption: 10 },
                { date: '2026-10-02', pv: 30, consumption: 12 },
                { date: '2026-10-03', pv: 5, consumption: 4 }
            ],
            day(3) + 10 * 3600000 + 600000
        );
        assert.equal(count, 3);
        assert.equal(stats.history.length, 2);
        assert.equal(stats.periods().today.pv, 5);
        assert.equal(stats.periods().today.consumption, 4);
        assert.equal(stats.periods().month.pv, 55);
    });
});
