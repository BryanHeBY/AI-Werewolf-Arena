import { expect, test } from "bun:test";
import { parseRuntimeConfig } from "../../src/runtime/config/parse_config";
import { resolveGameSetup } from "../../src/runtime/config/resolve_game_setup";
import { describeResolvedSetup } from "../../src/runtime/config/describe_setup";
import { bootstrapGame } from "../../src/app/bootstrap";
import { COMPONENT, type IdentityComponent } from "../../src/core";
import { readFile } from "node:fs/promises";
import { parseBoardDefinition } from "../../src/runtime/config/board_definition";
import path from "node:path";

const input = {
  providers: { default: "test", items: { test: { type: "openai", apiKey: "private-key" } } },
  agents: {
    default: "test",
    items: {
      test: {
        kind: "llm",
        provider: "test",
        model: "test",
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
  expect(world.getComponent<IdentityComponent>(1, COMPONENT.Identity)?.name).toBe(" 苏茶茶 ");
  const output = JSON.stringify(describeResolvedSetup(setup));
  expect(output).not.toContain("private seat style");
  expect(output).not.toContain("private English style");
  expect(output).not.toContain("default-private-personality");
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
      path.resolve(import.meta.dir, "../../../configs.example/boards/twelve_player_standard.json"),
      "utf8",
    ),
  );
  delete raw.roles.witch;
  const board = parseBoardDefinition(raw);
  expect(board.fieldSources["roles.witch.selfHeal"]).toBe("default");
  expect(board.fieldSources["board.roleSetups"]).toBe("explicit");
});
