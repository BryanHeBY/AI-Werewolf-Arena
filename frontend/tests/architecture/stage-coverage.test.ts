/**
 * Architecture tests for public stage/event and bilingual message coverage.
 * Input: existing public source/config declarations and the actual test tree;
 * output: original complete-set and no-missing-entry assertions. Literal required
 * fields and enumerated current files are the independent oracle; these tests
 * neither run gameplay nor rewrite fixture or compiler inputs to hide omissions.
 */
/**
 * Responsibility: verify replay integration coverage of public stage identifiers
 * and the current producer event contract across Chinese and English fixtures.
 * Input: public identity enums, existing source contributions and fixture bytes;
 * output: coverage assertions. Literal expected stages and complete set equality
 * are the oracle; no backend game or rule settlement is executed by this test.
 */
import {
  Phase,
  ActionWindow,
  KnightDuelWindow,
  ACTION_STAGES,
} from "@ai-werewolf-arena/game-contract";
import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";
import { dictionaries } from "@ai-werewolf-arena/game-text";
import { stageName } from "../../src/replay/replay-localization";
import { KNOWN_REPLAY_EVENT_TYPES } from "../../src/replay/replay-event-reader";

// Read producer contracts without importing the backend into any frontend bundle or executing it.
const root = new URL("../../../", import.meta.url);
function source(path: string) {
  return ts.createSourceFile(
    path,
    readFileSync(new URL(path, root), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
}
function find<T extends ts.Node>(file: ts.Node, match: (node: ts.Node) => node is T): T {
  let found: T | undefined;
  function visit(node: ts.Node) {
    if (match(node)) found = node;
    else ts.forEachChild(node, visit);
  }
  visit(file);
  if (!found) throw new Error("stage_contract_node_missing");
  return found;
}
function strings(node: ts.Node): string[] {
  const values: string[] = [];
  function visit(item: ts.Node) {
    if (ts.isStringLiteral(item)) values.push(item.text);
    else ts.forEachChild(item, visit);
  }
  visit(node);
  return values;
}
function variable(path: string, name: string) {
  return find(
    source(path),
    (node): node is ts.VariableDeclaration =>
      ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name,
  );
}
function enumValues(name: "Phase" | "ActionWindow" | "KnightDuelWindow"): string[] {
  return Object.values({ Phase, ActionWindow, KnightDuelWindow }[name]);
}
function eventTypes() {
  const parentContracts: Readonly<Record<string, string>> = {
    AnimalDreamPayloadMap: "packages/game-contract/src/facts/animal-dream.ts",
    NobleSecretBodyPayloadMap: "packages/game-contract/src/facts/noble-secret-body.ts",
    FragrantPairPayloadMap: "packages/game-contract/src/facts/fragrant-pair-seer.ts",
  };
  const declaration = find(
    source("packages/game-contract/src/events.ts"),
    (node): node is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(node) && node.name.text === "EventPayloadMap",
  );
  const inherited =
    declaration.heritageClauses?.flatMap((clause) =>
      clause.types.flatMap((type) => {
        const name = type.expression.getText();
        if (!Object.hasOwn(parentContracts, name)) throw new Error("event_parent_contract_unknown");
        return find(
          source(parentContracts[name]!),
          (node): node is ts.InterfaceDeclaration =>
            ts.isInterfaceDeclaration(node) && node.name.text === name,
        ).members;
      }),
    ) ?? [];
  return [...declaration.members, ...inherited].map((member) => {
    if (!member.name || !(ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)))
      throw new Error("event_name_not_literal");
    return member.name.text;
  });
}
function currentStageIds(): string[] {
  const registry = variable(
    "backend/src/game/mechanisms/script/event_render_registry.ts",
    "REPLAY_STAGE_HANDLERS",
  );
  if (!registry.initializer || !ts.isObjectLiteralExpression(registry.initializer))
    throw new Error("stage_registry_missing");
  const runtimeStageIds = registry.initializer.properties.flatMap((property) => {
    if (!ts.isPropertyAssignment(property)) throw new Error("stage_handler_not_static");
    return strings(property.initializer);
  });
  const stages = new Set([
    ...ACTION_STAGES,
    ...enumValues("ActionWindow"),
    ...enumValues("KnightDuelWindow"),
    ...enumValues("Phase"),
    ...runtimeStageIds,
    ...eventTypes(),
  ]);
  const fixtures = new URL("frontend/tests/fixtures/", root);
  for (const file of readdirSync(fixtures).filter((file) => file.endsWith(".json"))) {
    const replay = JSON.parse(readFileSync(new URL(file, fixtures), "utf8")) as {
      events: { type: string; stage?: string }[];
    };
    for (const event of replay.events) stages.add(event.stage ?? event.type);
  }
  return [...stages].sort();
}

test("the common reader handles the complete current producer event contract", () => {
  expect([...KNOWN_REPLAY_EVENT_TYPES].sort()).toEqual(eventTypes().sort());
});
for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: every action window, runtime stage and raw-event fallback has a stage name`, () => {
    const stages = currentStageIds();
    expect(stages).toContain("on_per_speech_gap");
    expect(stages).toContain("after_speeches");
    expect(stages).toContain("mechanical_mimic_skipped");
    expect(stages).toContain("merchant_trade_skipped");
    expect(stages).toContain("fragrant_night_opened");
    expect(stages).toContain("fragrant_pair_inspected");
    const missing = stages.filter(
      (stage) =>
        !Object.hasOwn(dictionaries[locale], `replay.stage.${stage}`) &&
        !Object.hasOwn(dictionaries[locale], `stage.${stage}`),
    );
    expect(missing).toEqual([]);
    for (const stage of stages) expect(stageName(stage, locale)).not.toBe(stage);
    expect(stageName("future_stage", locale)).toBe("future_stage");
  });
