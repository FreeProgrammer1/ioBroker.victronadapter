// ioBroker eslint template configuration file for js and ts files
import config from '@iobroker/eslint-config';

export default [
    ...config,
    {
        // Lovelace custom card runs in the browser and is not part of the adapter runtime
        ignores: ['lovelace/**', 'admin/**', 'test/**/*.js', '**/*.test.js', '.dev-server/', 'node_modules/']
    },
    {
        rules: {
            'jsdoc/require-jsdoc': 'off',
            'jsdoc/require-param-description': 'off'
        }
    }
];
