import { Logger } from '@nestjs/common';

// Disable logger in tests for cleaner output
// Override Logger class methods to prevent any output
// Using type assertion since jest is available at runtime in test environment
const jestFn = (globalThis as any).jest?.fn || (() => () => {});
Logger.prototype.log = jestFn();
Logger.prototype.error = jestFn();
Logger.prototype.warn = jestFn();
Logger.prototype.debug = jestFn();
Logger.prototype.verbose = jestFn();

// Also override the static overrideLogger method
Logger.overrideLogger({
  log: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
  verbose: () => {},
});
