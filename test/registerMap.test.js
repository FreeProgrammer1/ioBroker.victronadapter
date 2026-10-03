'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const {
    SYSTEM_REGISTERS,
    CONTROL_REGISTERS,
    DEVICE_PROFILES,
    getRegisterLength,
    decodeRegisters,
    encodeValue,
    stateCommon
} = require('../lib/registerMap');

const lists = [
    ['system', SYSTEM_REGISTERS],
    ['controls', CONTROL_REGISTERS],
    ...DEVICE_PROFILES.map((profile) => [profile.key, profile.registers])
];

describe('register map', () => {
    for (const [key, list] of lists) {
        it(`${key}: state ids are unique`, () => {
            const ids = list.map((definition) => definition.id);
            assert.equal(new Set(ids).size, ids.length);
        });

        it(`${key}: registers do not overlap`, () => {
            const sorted = [...list].sort((a, b) => a.address - b.address);
            for (let i = 1; i < sorted.length; i++) {
                const previous = sorted[i - 1];
                assert.ok(
                    previous.address + getRegisterLength(previous.type) <= sorted[i].address,
                    `${previous.id} overlaps ${sorted[i].id}`
                );
            }
        });
    }

    it('creates writable states for system relays and VE.Bus mode', () => {
        assert.equal(SYSTEM_REGISTERS.find((d) => d.id === 'relay_1_state').write, true);
        const vebus = DEVICE_PROFILES.find((p) => p.key === 'vebus');
        assert.equal(vebus.registers.find((d) => d.id === 'mode').write, true);
    });

    it('uses translated names', () => {
        const common = stateCommon(SYSTEM_REGISTERS[0], true);
        assert.equal(typeof common.name.en, 'string');
        assert.equal(typeof common.name.de, 'string');
        assert.equal(common.write, true);
    });

    it('encodes and decodes signed values symmetrically', () => {
        const int32 = { type: 'int32', scale: 1 };
        assert.equal(decodeRegisters(encodeValue(-1500, int32), 'int32', 1), -1500);
        const int16 = { type: 'int16', scale: 0.1 };
        assert.equal(decodeRegisters(encodeValue(-12.5, int16), 'int16', 0.1), -12.5);
        const scaled = { type: 'int16', scale: 100, rawScaleForWrite: 0.01 };
        assert.deepEqual(encodeValue(3000, scaled), [30]);
    });

    it('rejects values outside the register range', () => {
        assert.throws(() => encodeValue(70000, { type: 'uint16', scale: 1 }));
        assert.throws(() => encodeValue(-1, { type: 'uint16', scale: 1 }));
    });
});
