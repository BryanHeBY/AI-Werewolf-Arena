// Test setup file for AI-Werewolf-Arena backend
// This file runs before each test file

import { jest } from "bun:test";
import { SessionRecordHub } from "../src/observability";
import { cleanupTestTempDirectories } from "./support/temp_directory";

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
  SessionRecordHub.setActive(null);
  await cleanupTestTempDirectories();
});

// Clean up after all tests
afterAll(() => {
  jest.restoreAllMocks();
});
