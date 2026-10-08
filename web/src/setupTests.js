// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
// Encryption code (src/crypto) needs these; browsers have them, the test environment may not
const { TextEncoder: NodeTextEncoder, TextDecoder: NodeTextDecoder } = require('util');
const { webcrypto } = require('crypto');
if (typeof globalThis.TextEncoder === 'undefined') Object.assign(globalThis, { TextEncoder: NodeTextEncoder, TextDecoder: NodeTextDecoder });
if (!globalThis.crypto?.getRandomValues) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
