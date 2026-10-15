/**
 * 配置集成测试以原十二种错误板子组合及临时公开配置文件为输入，核对公开检查入口和 bootstrap 拒绝相同的不支持有限预设。预期为两入口一致的字面诊断码及路径；不执行游戏循环或 provider 请求。
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  parseBoardDefinition,
  type BoardDefinition,
} from "../../../src/app/config/board-definition";
import { configDiagnostic } from "../../../src/app/config/error-codes";
import { checkConfig } from "../../../src/app/cli/check-config";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";

const cases = [
  ["awa_mist_raven_12_v1", "mist_raven"],
  ["awa_trickster_12_v1", "trickster"],
  ["awa_scholar_mentor_12_v1", "scholar_mentor"],
  ["awa_time_consort_12_v1", "time_consort"],
  ["awa_wolf_sorcerer_12_v1", "wolf_sorcerer"],
  ["awa_magician_12_n1_original_v1", "magician"],
  ["awa_red_moon_12_ends_game_v1", "red_moon"],
  ["awa_nightmare_12_optional_standard_v1", "nightmare"],
  ["awa_evil_knight_12_night_shot_immune_disabled_v1", "evil_knight"],
  ["awa_pure_white_12_good_disabled_v1", "pure_white"],
  ["awa_netease_demon_hunter_12_side_v1", "demon_hunter"],
  ["awa_melbourne_ghost_bride_12_v1", "ghost_bride"],
] as const;

for (const [id, preset] of cases) {
  test(`${preset}: config check and bootstrap reject the same unsupported combination`, async () => {
    const raw: BoardDefinition = JSON.parse(
      readFileSync(
        new URL(`../../../../configs.example/boards/${id}.json`, import.meta.url),
        "utf8",
      ),
    );
    const config = parseBoardDefinition(raw).config;
    expect(() => bootstrapGame(config)).not.toThrow();
    // 该值符合通用警长 schema，但不受这些有限板子支持。
    config.sheriff!.voteWeight = 2;
    raw.mechanisms.sheriff.voteWeight = 2;
    expect(() => bootstrapGame(config)).toThrow(`${preset}_preset_invalid`);
    const code = `board_config_${preset}_preset_invalid`;
    expect(() => parseBoardDefinition(raw)).toThrow(code);
    try {
      parseBoardDefinition(raw);
    } catch (error) {
      expect(configDiagnostic(error)).toEqual({ code, path: "board" });
    }

    const root = await createTestTempDirectory("awa-finite-preset-");
    for (const dir of ["runtime", "games", "boards"]) await mkdir(path.join(root, dir));
    await writeFile(
      path.join(root, "runtime/providers.json"),
      JSON.stringify({
        default: "fake",
        items: { fake: { type: "openai", apiKey: "synthetic-unused" } },
      }),
    );
    await writeFile(
      path.join(root, "runtime/agents.json"),
      JSON.stringify({
        default: "fake",
        items: { fake: { kind: "llm", provider: "fake", model: "unused" } },
      }),
    );
    await writeFile(
      path.join(root, "games/test.json"),
      JSON.stringify({ board: id, agent: "fake" }),
    );
    await writeFile(path.join(root, `boards/${id}.json`), JSON.stringify(raw));
    await expect(checkConfig(root, "test")).rejects.toThrow(code);
  });
}
