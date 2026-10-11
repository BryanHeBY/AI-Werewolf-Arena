import { fileURLToPath } from "node:url";
import { expect, test, spyOn } from "bun:test";
import { readFile, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { bootstrapGame } from "../../src/app/bootstrap";
import { World } from "../../src/core";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../src/runtime/config/board_definition";
import { configDiagnostic, CONFIG_ERROR_CODES } from "../../src/runtime/config/error_codes";
import { checkConfig } from "../../src/runtime/cli/check_config";

const root = fileURLToPath(new URL("../../../configs.example/boards", import.meta.url));
const variants = [
  ["standard", "nonconsecutive", "awa_nonconsecutive_nights_v1"],
  ["standard", "repeat", "awa_repeat_v1"],
  ["no_blast_no_self_knife", "nonconsecutive", "awa_nonconsecutive_nights_v1"],
  ["no_blast_no_self_knife", "repeat", "awa_repeat_v1"],
] as const;
for (const [wolf, suffix, body] of variants)
  test(`public actual CLI check / named diagnostic / no partial native installation ${wolf}/${suffix}`, async () => {
    const id = `awa_noble_secret_body_12_${wolf}_${suffix}_v1`,
      raw = JSON.parse(await readFile(join(root, `${id}.json`), "utf8"));
    const parsed = parseBoardDefinition(raw);
    expect(parsed.config.nightNoble).toEqual({ wolfActionPolicy: wolf });
    expect(parsed.config.awakenedIdiot).toEqual({ protectionRepeatPolicy: body });
    expect(parsed.config.nobleSecretBody).toEqual({ policy: "awa_noble_secret_body_v1" });
    expect(boardDefinitionFromConfig(id, parsed.config)).toEqual(raw);
    const temp = await mkdtemp("/tmp/awa-noble-public-a-");
    try {
      for (const dir of ["runtime", "games", "boards"]) await mkdir(join(temp, dir));
      await writeFile(
        join(temp, "runtime/providers.json"),
        JSON.stringify({
          default: "synthetic",
          items: { synthetic: { type: "openai", apiKey: "synthetic-unused" } },
        }),
      );
      await writeFile(
        join(temp, "runtime/agents.json"),
        JSON.stringify({
          default: "synthetic",
          items: { synthetic: { kind: "llm", provider: "synthetic", model: "unused" } },
        }),
      );
      await writeFile(
        join(temp, "games/test.json"),
        JSON.stringify({ board: id, agent: "synthetic" }),
      );
      await writeFile(join(temp, "boards", `${id}.json`), JSON.stringify(raw));
      expect(await checkConfig(temp, "test")).toBeDefined();
      raw.mechanisms.sheriff.voteWeight = 2;
      parsed.config.sheriff!.voteWeight = 2;
      const expected = { code: "board_config_noble_secret_body_preset_invalid", path: "board" };
      let publicError: unknown;
      try {
        parseBoardDefinition(raw);
      } catch (e) {
        publicError = e;
      }
      expect(configDiagnostic(publicError)).toEqual(expected);
      const entitySpy = spyOn(World.prototype, "createEntity");
      try {
        expect(() => bootstrapGame(parsed.config)).toThrow("noble_secret_body_preset_invalid");
        expect(entitySpy).not.toHaveBeenCalled();
      } finally {
        entitySpy.mockRestore();
      }
      expect(() => boardDefinitionFromConfig(id, parsed.config)).toThrow(
        "board_config_noble_secret_body_preset_invalid",
      );
      await writeFile(join(temp, "boards", `${id}.json`), JSON.stringify(raw));
      let cliError: unknown;
      try {
        await checkConfig(temp, "test");
      } catch (e) {
        cliError = e;
      }
      expect(configDiagnostic(cliError)).toEqual(expected);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });
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
