'use strict';

const path = require('node:path');
const { tests } = require('@iobroker/testing');

// Starts the adapter in a test js-controller and checks that it runs without crashing.
// No GX device is reachable in CI; the adapter must handle that gracefully.
tests.integration(path.join(__dirname, '..'));
