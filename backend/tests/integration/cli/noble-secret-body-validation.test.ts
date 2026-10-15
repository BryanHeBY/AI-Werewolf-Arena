/**
 * Configuration integration tests verify public Noble/Body examples, config-check files and bootstrap rejection agree without partial entity installation.
 * Input: Original wolf/body policy matrix, public board JSON and temporary runtime/game/board trees.
 * Output and oracle: Literal normalized/roundtrip/diagnostic fields and zero entity creation preserve validation order; source configurations and fixture bytes are unchanged.
 */
import { fileURLToPath } from "node:url";
import { expect, test, spyOn } from "bun:test";
import { readFile, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { World } from "../../../src/domain";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../../src/app/config/board-definition";
import { configDiagnostic } from "../../../src/app/config/error-codes";
import { checkConfig } from "../../../src/app/cli/check-config";

const root = fileURLToPath(new URL("../../../../configs.example/boards", import.meta.url));

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
