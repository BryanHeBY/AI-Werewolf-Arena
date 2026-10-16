/**
 * 单元测试：验证玩家模型无关配置。输入为字面昵称、人设、语言、种子和旧绑定；规范化资料与歧义拒绝采用精确预期，不执行模型或完整对局。
 */
import { expect, test } from "bun:test";
import { parseRuntimeConfig } from "../../../src/app/config/parse-config";
import { resolveGameSetup } from "../../../src/app/config/resolve-game-setup";
import { describeResolvedSetup } from "../../../src/app/config/describe-setup";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, type IdentityComponent } from "../../../src/domain";
import { readFile } from "node:fs/promises";
import { parseBoardDefinition } from "../../../src/app/config/board-definition";
import path from "node:path";
const input = {
  backends: {
    schemaVersion: 2,
    items: {
      test: {
        kind: "llm",
        config: {
          type: "openai",
          apiKey: "private-key",
        },
      },
    },
  },
  agents: {
    schemaVersion: 2,
    default: "test",
    items: {
      test: {
        backend: "test",
        options: {
          model: "test",
        },
        personalityPrompt: "default-private-personality",
      },
    },
  },
};
test("player names and personalities are independent of model selection", () => {
  const runtime = parseRuntimeConfig({
    ...input,
    game: {
      players: {
        "1": { name: " 苏茶茶 ", personalityPrompt: "  private seat style\n" },
        "2": { personalityPrompt: null },
        "3": { personalityPrompt: { en: "private English style" } },
      },
    },
  });
  const setup = resolveGameSetup(runtime);
  expect(setup.players["1"].profile).toBeUndefined();
  expect(setup.players["1"].name).toBe(" 苏茶茶 ");
  expect(setup.players["1"].personalityPrompt).toBe("  private seat style\n");
  expect(setup.players["2"].personalityPrompt).toBeNull();
  expect(setup.players["3"].personalityPrompt).toBe("private English style");
  expect(setup.warnings).toContainEqual({
    code: "locale_prompt_fallback",
    path: "players.3.personalityPrompt",
    requestedLocale: "zh-CN",
    fallbackLocale: "en",
  });
  const { world } = bootstrapGame(setup.boardConfig, {
    playerNames: { "1": setup.players["1"].name! },
  });
  expect(world.getComponent(1, COMPONENT.Identity)?.name).toBe(" 苏茶茶 ");
  expect(Object.hasOwn(world.getComponent(2, COMPONENT.Identity)!, "name")).toBe(false);
  const output = JSON.stringify(describeResolvedSetup(setup));
  expect(output).not.toContain("private seat style");
  expect(output).not.toContain("private English style");
  expect(output).not.toContain("default-private-personality");
});
test("昵称可以重名，但空白、超长和控制字符会被拒绝", () => {
  for (const name of ["", "  ", "a".repeat(121), "茶\n茶", "\u001b[31m茶茶", "茶\u2028茶"]) {
    expect(() => parseRuntimeConfig({ ...input, game: { players: { "1": { name } } } })).toThrow(
      "runtime_config_player_name_invalid",
    );
  }
  const runtime = parseRuntimeConfig({
    ...input,
    game: { players: { "1": { name: "茶茶" }, "2": { name: "茶茶" } } },
  });
  expect(resolveGameSetup(runtime).players["2"].name).toBe("茶茶");
});
test("locale, seed and conflicting legacy player bindings fail explicitly", () => {
  expect(() => parseRuntimeConfig({ ...input, game: { locale: "en-US" } })).toThrow(
    "runtime_config_locale_invalid",
  );
  expect(() => parseRuntimeConfig({ ...input, game: { seed: " " } })).toThrow(
    "runtime_config_required_string_invalid",
  );
  expect(() =>
    parseRuntimeConfig({
      ...input,
      game: { players: { "1": { personalityPrompt: { fr: "style" } } } },
    }),
  ).toThrow("runtime_config_unknown_field");
  const runtime = parseRuntimeConfig({
    ...input,
    game: { players: { "1": { name: "name" } }, playerAgents: { "1": "test" } },
  });
  expect(() => resolveGameSetup(runtime)).toThrow("runtime_config_player_binding_conflict");
  const english = resolveGameSetup(
    parseRuntimeConfig({ ...input, game: { locale: "en", seed: "my-seed" } }),
  );
  expect(english.context).toEqual({ locale: "en", displayLocale: "en", seed: "my-seed" });
});
test("normalized role defaults expose their source without exposing private prompts", async () => {
  const raw = JSON.parse(
    await readFile(
      path.resolve(
        import.meta.dir,
        "../../../../configs.example/boards/twelve_player_standard.json",
      ),
      "utf8",
    ),
  );
  delete raw.roles.witch;
  const board = parseBoardDefinition(raw);
  expect(board.fieldSources["roles.witch.selfHeal"]).toBe("default");
  expect(board.fieldSources["board.roleSetups"]).toBe("explicit");
});
