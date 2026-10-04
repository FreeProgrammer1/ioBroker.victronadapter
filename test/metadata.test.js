'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const io = JSON.parse(fs.readFileSync(path.join(root, 'io-package.json'), 'utf8'));

describe('adapter metadata', () => {
    it('uses matching package and io-package versions', () => {
        assert.equal(pkg.version, io.common.version);
    });

    it('uses lowercase package and adapter names', () => {
        assert.equal(pkg.name, 'iobroker.victronadapter');
        assert.equal(io.common.name, 'victronadapter');
    });

    it('contains required files', () => {
        for (const file of [
            'main.js',
            'io-package.json',
            'package.json',
            'admin/jsonConfig.json',
            'admin/victronadapter.svg'
        ]) {
            assert.equal(fs.existsSync(path.join(root, file)), true, `${file} is missing`);
        }
    });

    it('contains clean canonical Lovelace files only', () => {
        assert.equal(fs.existsSync(path.join(root, 'lovelace/victronadapter-card.js')), true);
        assert.equal(fs.existsSync(path.join(root, 'lovelace/victronadapter-flow.yaml')), true);
        assert.equal(fs.existsSync(path.join(root, 'lovelace/victronadapter-flow-circle.yaml')), true);
    });

    it('uses responsive size attributes in admin jsonConfig items only', () => {
        const jsonConfig = JSON.parse(fs.readFileSync(path.join(root, 'admin/jsonConfig.json'), 'utf8'));
        for (const size of ['xs', 'md', 'lg', 'xl']) {
            assert.equal(
                Object.prototype.hasOwnProperty.call(jsonConfig, size),
                false,
                `${size} must not be at jsonConfig root`
            );
        }
        const visit = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            if (obj.type && obj.type !== 'tabs' && obj.type !== 'panel') {
                for (const size of ['xs', 'md', 'lg', 'xl']) {
                    assert.equal(Number.isInteger(obj[size]), true, `${size} is missing on ${obj.type}`);
                }
            }
            if (obj.type === 'table') return; // table columns use "width" instead of responsive sizes
            for (const value of Object.values(obj)) {
                if (value && typeof value === 'object') visit(value);
            }
        };
        visit(jsonConfig);
    });

    it('documents the current version in the README changelog', () => {
        const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
        assert.match(readme, new RegExp(`## Changelog[\\s\\S]*### ${pkg.version.replace(/\./g, '\\.')}`));
        assert.match(readme, /### 0\.6\.13[\s\S]*- /);
    });

    it('keeps current changelog in README and excludes old changelog from npm package', () => {
        const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
        assert.equal(fs.existsSync(path.join(root, 'CHANGELOG.md')), false);
        assert.equal(fs.existsSync(path.join(root, 'CHANGELOG_OLD.md')), true);
        assert.match(readme, /CHANGELOG_OLD\.md/);
        assert.equal(pkg.files.includes('CHANGELOG.md'), false);
        assert.equal(pkg.files.includes('CHANGELOG_OLD.md'), false);
        for (const devFile of ['test', 'test/', 'tsconfig.json', 'eslint.config.mjs', 'prettier.config.mjs']) {
            assert.equal(pkg.files.includes(devFile), false, `${devFile} must not be published`);
        }
    });

    it('uses Node.js 22 engine and matching type configuration', () => {
        assert.equal(pkg.engines.node, '>=22');
        assert.ok(pkg.devDependencies['@types/node'].startsWith('^22.'));
        assert.ok(pkg.devDependencies['@tsconfig/node22']);
        const tsconfig = JSON.parse(fs.readFileSync(path.join(root, 'tsconfig.json'), 'utf8'));
        assert.equal(tsconfig.extends, '@tsconfig/node22/tsconfig.json');
    });

    it('contains all suggested io-package news translations', () => {
        const languages = ['en', 'de', 'ru', 'pt', 'nl', 'fr', 'it', 'es', 'pl', 'uk', 'zh-cn'];
        for (const [version, entry] of Object.entries(io.common.news)) {
            for (const language of languages) {
                assert.equal(typeof entry[language], 'string', `${version} missing ${language}`);
                assert.notEqual(entry[language].trim(), '', `${version} empty ${language}`);
            }
        }
    });

    it('tests all supported Node.js versions in the adapter-tests workflow', () => {
        const workflow = fs.readFileSync(path.join(root, '.github/workflows/test-and-release.yml'), 'utf8');
        assert.match(workflow, /adapter-tests:/);
        assert.match(workflow, /node-version:\s*\[\s*"?22\.x"?,\s*"?24\.x"?,\s*"?26\.x"?\s*\]/);
        // the repository checker requires the default integration test command
        assert.doesNotMatch(workflow, /integration-test-command/);
    });

    it('does not ship the removed raw write option anymore', () => {
        assert.equal(Object.prototype.hasOwnProperty.call(io.native, 'autoCreateRawWriteObjects'), false);
        assert.equal(io.native.installLovelaceCard, false);
        assert.deepEqual(io.native.customRegisters, []);
    });
});
