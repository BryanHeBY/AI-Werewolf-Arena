import { loadConfig } from "../../src/config";

const ORIGINAL_ENV = process.env;

describe("cutover rollback", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test("V3_ENGINE_ENABLED supports enable -> rollback -> restore flow", () => {
    process.env.V3_ENGINE_ENABLED = "true";
    expect(loadConfig().v3EngineEnabled).toBe(true);

    process.env.V3_ENGINE_ENABLED = "false";
    expect(loadConfig().v3EngineEnabled).toBe(false);

    process.env.V3_ENGINE_ENABLED = "1";
    expect(loadConfig().v3EngineEnabled).toBe(true);
  });

  test("invalid switch value falls back to default enabled", () => {
    process.env.V3_ENGINE_ENABLED = "invalid";
    expect(loadConfig().v3EngineEnabled).toBe(true);
  });
});

