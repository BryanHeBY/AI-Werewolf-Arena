/**
 * Backend test preload support verify test-local mock reset and tracked temporary-directory retirement.
 * Input: Bun per-test/after-all hooks and the original shared temporary directory owner.
 * Output and independent oracle: Outputs reset console/Jest mocks and awaited cleanup; hook order and ten-second default are retained, not a fixture or rule oracle.
 * The preload changes no production module, callback policy, archived input or expected game result.
 */
// Test setup file for AI-Werewolf-Arena backend
// This file runs before each test file

import { afterAll, afterEach, beforeEach, jest } from "bun:test";
import { cleanupTestTempDirectories } from "./support/drivers/temp-directories";

// Global test timeout
jest.setTimeout(10000);

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(async () => {
  await cleanupTestTempDirectories();
});

// Clean up after all tests
afterAll(() => {
  jest.restoreAllMocks();
});
