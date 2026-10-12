/**
 * Unit test verifies Noble and Secret Body enum or unknown-key policy failures precede silent normalization.
 * Input: The original immutable public board JSON as fixture input and three literal policy/key alterations.
 * Output and oracle: Exact diagnostic codes and private-canary omission preserve parser behavior; the test reads input but creates no config tree or archive.
 */
import { fileURLToPath } from "node:url";
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseBoardDefinition } from "../../../src/runtime/config/board_definition";
import { configDiagnostic, CONFIG_ERROR_CODES } from "../../../src/runtime/config/error_codes";

const root = fileURLToPath(new URL("../../../../configs.example/boards", import.meta.url));

test("public role policy enums and unknown keys fail before normalization can silently accept them", async () => {
  const baseline = JSON.parse(
    await readFile(join(root, "awa_noble_secret_body_12_standard_nonconsecutive_v1.json"), "utf8"),
  );
  for (const change of [
    (r: any) => (r.roles.night_noble.wolfActionPolicy = "all_wolves_disabled"),
    (r: any) => (r.roles.awakened_idiot.protectionRepeatPolicy = "unlimited"),
    (r: any) => (r.roles.night_noble.extraCanary = "private-not-for-errors"),
  ]) {
    const raw = structuredClone(baseline);
    change(raw);
    let error: unknown;
    try {
      parseBoardDefinition(raw);
    } catch (e) {
      error = e;
    }
    const diagnostic = configDiagnostic(error);
    expect(diagnostic.code).toBe("board_config_invalid_field");
    expect(JSON.stringify(diagnostic)).not.toContain("private-not-for-errors");
  }
  expect(CONFIG_ERROR_CODES).toContain("board_config_noble_secret_body_preset_invalid");
});
