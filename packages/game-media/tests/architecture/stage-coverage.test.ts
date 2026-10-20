/**
 * 架构测试负责核对复盘阶段、生产事件契约及中英消息的完整覆盖。
 * 输入为公开枚举、源码声明与原 fixture 字节；输出为完整集合和无缺项断言。
 * 手写必需阶段、字段及实际声明集合是独立预期；仅用本前端声明的 TypeScript 静态读源，
 * 沿显式组合根的本地常量和相对命名导入追踪每个展开，未知动态结构直接失败。
 * 不执行后端对局或规则结算，不重写 fixture、编译配置或测试发现输入来掩盖遗漏。
 */
import { frontendFixtureURL, frontendFixtureArtifacts } from "../support/fixtures/manifest";
import {
  Phase,
  ActionWindow,
  KnightDuelWindow,
  ACTION_STAGES,
} from "@ai-werewolf-arena/game-contract";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { dictionaries } from "@ai-werewolf-arena/game-text";
import { stageName } from "../../src/replay/replay-localization";
import { KNOWN_REPLAY_EVENT_TYPES } from "../../src/replay/replay-event-reader";

// 只读生产契约源码，不把后端运行模块导入前端 bundle，也不执行其规则。
const root = new URL("../../../../", import.meta.url);
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
function unwrap(expression: ts.Expression): ts.Expression {
  while (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  )
    expression = expression.expression;
  return expression;
}
/** 仅接受可穷举的返回值；phase_changed 的已知载荷分支由独立 Phase 枚举覆盖。 */
function stageReturns(expression: ts.Expression, parameter?: string): string[] {
  const value = unwrap(expression);
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return [value.text];
  if (ts.isConditionalExpression(value))
    return [
      ...stageReturns(value.whenTrue, parameter),
      ...stageReturns(value.whenFalse, parameter),
    ];
  if (
    parameter &&
    ts.isCallExpression(value) &&
    ts.isIdentifier(value.expression) &&
    value.expression.text === "String" &&
    value.arguments.length === 1
  ) {
    const argument = unwrap(value.arguments[0]!);
    if (
      ts.isBinaryExpression(argument) &&
      argument.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken &&
      ts.isPropertyAccessExpression(argument.left) &&
      argument.left.name.text === "phase" &&
      ts.isPropertyAccessExpression(argument.left.expression) &&
      argument.left.expression.name.text === "payload" &&
      ts.isIdentifier(argument.left.expression.expression) &&
      argument.left.expression.expression.text === parameter &&
      ts.isStringLiteral(argument.right) &&
      argument.right.text === "phase_changed"
    )
      return [...Object.values(Phase), "phase_changed"];
  }
  throw new Error("stage_return_not_static");
}
/** 源码加载器可在定向测试中替换；只解析 AST，不 import 或执行后端模块。 */
function staticStageHandlers(
  entry = "packages/game-runtime/src/agents/presentation/event-render-assembly.ts",
  load: (path: string) => ts.SourceFile = source,
): Map<string, string[]> {
  const files = new Map<string, ts.SourceFile>(),
    active = new Set<string>();
  const file = (name: string) => {
    if (!files.has(name)) files.set(name, load(name));
    return files.get(name)!;
  };
  function binding(owner: string, name: string, exported = false): Map<string, string[]> {
    const key = `${owner}#${name}`;
    if (active.has(key)) throw new Error("stage_binding_cycle");
    active.add(key);
    try {
      const declarations = file(owner).statements.flatMap((statement) =>
        ts.isVariableStatement(statement) &&
        (!exported || statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
          ? statement.declarationList.declarations
              .filter((d) => ts.isIdentifier(d.name) && d.name.text === name)
              .map((declaration) => ({ statement, declaration }))
          : [],
      );
      if (declarations.length) {
        const { statement, declaration } = declarations[0]!;
        if (
          declarations.length !== 1 ||
          !(statement.declarationList.flags & ts.NodeFlags.Const) ||
          !declaration.initializer
        )
          throw new Error("stage_binding_not_const");
        return object(owner, declaration.initializer);
      }
      if (!exported)
        for (const statement of file(owner).statements) {
          if (!ts.isImportDeclaration(statement)) continue;
          const clause = statement.importClause,
            imports = clause?.namedBindings;
          if (!imports || !ts.isNamedImports(imports)) continue;
          const imported = imports.elements.find((item) => item.name.text === name);
          if (!imported) continue;
          const specifier = statement.moduleSpecifier;
          if (
            clause!.isTypeOnly ||
            imported.isTypeOnly ||
            !ts.isStringLiteral(specifier) ||
            !specifier.text.startsWith(".")
          )
            throw new Error("stage_import_not_static");
          const target = path.posix.normalize(
            path.posix.join(path.posix.dirname(owner), specifier.text),
          );
          if (target.startsWith("../")) throw new Error("stage_import_outside_source");
          return binding(
            target.endsWith(".ts") ? target : `${target}.ts`,
            (imported.propertyName ?? imported.name).text,
            true,
          );
        }
      throw new Error("stage_binding_missing");
    } finally {
      active.delete(key);
    }
  }
  function object(owner: string, expression: ts.Expression): Map<string, string[]> {
    const value = unwrap(expression);
    if (ts.isIdentifier(value)) return binding(owner, value.text);
    if (!ts.isObjectLiteralExpression(value)) throw new Error("stage_registry_not_static");
    const handlers = new Map<string, string[]>();
    for (const property of value.properties) {
      if (ts.isSpreadAssignment(property)) {
        for (const [event, stages] of object(owner, property.expression))
          handlers.set(event, stages);
        continue;
      }
      if (
        !ts.isPropertyAssignment(property) ||
        !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
      )
        throw new Error("stage_handler_not_static");
      const handler = unwrap(property.initializer);
      if (!ts.isArrowFunction(handler) || ts.isBlock(handler.body))
        throw new Error("stage_handler_not_static");
      const parameter = handler.parameters[0]?.name;
      handlers.set(
        property.name.text,
        stageReturns(
          handler.body,
          parameter && ts.isIdentifier(parameter) ? parameter.text : undefined,
        ),
      );
    }
    return handlers;
  }
  return binding(entry, "REPLAY_STAGE_HANDLERS");
}
function enumValues(name: "Phase" | "ActionWindow" | "KnightDuelWindow"): string[] {
  return Object.values({ Phase, ActionWindow, KnightDuelWindow }[name]);
}
function eventTypes() {
  const parentContracts: Readonly<Record<string, string>> = {
    AnimalDreamPayloadMap: "packages/game-contract/src/facts/animal-dream.ts",
    NobleSecretBodyPayloadMap: "packages/game-contract/src/facts/noble-secret-body.ts",
    FragrantPairPayloadMap: "packages/game-contract/src/facts/fragrant-pair-seer.ts",
    SilenceElderPayloadMap: "packages/game-contract/src/facts/silence-elder.ts",
    WardenPayloadMap: "packages/game-contract/src/facts/warden.ts",
    AwakenedClawPayloadMap: "packages/game-contract/src/facts/awakened-claws.ts",
    AwakenedWitchPayloadMap: "packages/game-contract/src/facts/awakened-witch.ts",
    AwakenedBeautyPayloadMap: "packages/game-contract/src/facts/awakened-beauty.ts",
    AwakenedPatrolPayloadMap: "packages/game-contract/src/facts/awakened-patrol.ts",
    AwakenedGuardPayloadMap: "packages/game-contract/src/facts/awakened-guard.ts",
    AwakenedDuelPayloadMap: "packages/game-contract/src/facts/awakened-duel.ts",
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
  const runtimeStageIds = [...staticStageHandlers().values()].flat();
  const stages = new Set([
    ...ACTION_STAGES,
    ...enumValues("ActionWindow"),
    ...enumValues("KnightDuelWindow"),
    ...enumValues("Phase"),
    ...runtimeStageIds,
    ...eventTypes(),
  ]);
  for (const artifact of frontendFixtureArtifacts("god-replay")) {
    const replay = JSON.parse(readFileSync(frontendFixtureURL(artifact.originPath), "utf8")) as {
      events: { type: string; stage?: string }[];
    };
    for (const event of replay.events) stages.add(event.stage ?? event.type);
  }
  return [...stages].sort();
}

test("the static assembly trace retains every feature-owned event stage handler", () => {
  // 独立字面表覆盖全部十五个机制／通用贡献；只检阶段集合会漏掉返回相同阶段的整组展开。
  expect(Object.fromEntries(staticStageHandlers())).toEqual({
    awakened_inherited: ["awakened_inherited"],
    awakened_ready: ["awakened_activation"],
    awakened_mimicked: ["awakened_mimic"],
    awakened_mimic_skipped: ["awakened_mimic"],
    awakened_poison_used: ["awakened_skill"],
    awakened_guard_chosen: ["awakened_skill"],
    awakened_skill_skipped: ["awakened_skill"],
    awakened_attack_chosen: ["awakened_attack"],
    player_shot: ["death_shot"],
    gargoyle_awakened: ["gargoyle_awakened"],
    role_inspected: ["role_inspected"],
    role_inspection_skipped: ["role_inspection_skipped"],
    hidden_wolf_awakened: ["hidden_wolf_awakened"],
    bear_roared: ["bear_roared"],
    dream_applied: ["dreamer"],
    dream_death: ["dream_death"],
    gravekeeper_reported: ["gravekeeper_feedback"],
    phase_changed: ["night", "day", "voting", "game_over", "phase_changed"],
    day_speech: ["day_speech"],
    exile_pk_started: ["exile_pk_speech"],
    vote_cast: ["voting"],
    vote_summary: ["voting"],
    voted_out: ["voting"],
    sheriff_pk_started: ["sheriff_pk_speech"],
    sheriff_candidate_declared: ["sheriff"],
    sheriff_candidates_finalized: ["sheriff"],
    sheriff_vote_cast: ["sheriff"],
    sheriff_elected: ["sheriff"],
    idiot_revealed: ["voting"],
    wolf_discussion: ["wolf_discussion"],
    wolf_discussion_ended: ["wolf_discussion"],
    wolf_kill_vote_cast: ["wolf_discussion"],
    guard_applied: ["guard"],
    seer_checked: ["seer"],
    witch_potion_used: ["witch"],
    witch_potion_skipped: ["witch"],
  });
});

function memoryStageHandlers(files: Readonly<Record<string, string>>) {
  return staticStageHandlers("entry.ts", (name) => {
    if (!Object.hasOwn(files, name)) throw new Error("stage_source_missing");
    return ts.createSourceFile(name, files[name]!, ts.ScriptTarget.Latest, true);
  });
}
test("the static trace follows aliases and nested spreads in runtime overwrite order without evaluation", () => {
  const handlers = memoryStageHandlers({
    "entry.ts": `
      import { CONTRIBUTION as Imported } from "./feature";
      throw new Error("this source must never execute");
      const Local = Imported;
      export const REPLAY_STAGE_HANDLERS = ({
        initial: () => "first",
        ...Local,
        overwritten: () => "last",
      } as const) satisfies StageHandlers;
    `,
    "feature.ts": `
      const Base = { overwritten: () => "old", nested: () => "middle" };
      export const CONTRIBUTION = {
        ...({ ...Base } as const),
        conditional: (event) => event.payload.ready ? "ready" : "waiting",
      };
    `,
  });
  expect(Object.fromEntries(handlers)).toEqual({
    initial: ["first"],
    overwritten: ["last"],
    nested: ["middle"],
    conditional: ["ready", "waiting"],
  });
});

// 不支持的结构必须显式失败，不能返回空集合让双语覆盖检查假通过。
for (const [label, entry, extra] of [
  ["dynamic spread call", "const REPLAY_STAGE_HANDLERS = { ...makeHandlers() };"],
  ["dynamic spread access", "const REPLAY_STAGE_HANDLERS = { ...namespace.handlers };"],
  ["computed event key", 'const REPLAY_STAGE_HANDLERS = { [key]: () => "stage" };'],
  ["dynamic handler", "const REPLAY_STAGE_HANDLERS = { event: createHandler() };"],
  ["dynamic stage return", "const REPLAY_STAGE_HANDLERS = { event: () => stageForEvent() };"],
  ["mutable binding", 'let REPLAY_STAGE_HANDLERS = { event: () => "stage" };'],
  ["local cycle", "const REPLAY_STAGE_HANDLERS = NEXT; const NEXT = REPLAY_STAGE_HANDLERS;"],
  [
    "external import",
    'import { HANDLERS } from "external-package"; const REPLAY_STAGE_HANDLERS = HANDLERS;',
  ],
  [
    "namespace import",
    'import * as imported from "./feature"; const REPLAY_STAGE_HANDLERS = imported;',
  ],
  [
    "type-only import",
    'import type { HANDLERS } from "./feature"; const REPLAY_STAGE_HANDLERS = HANDLERS;',
  ],
  [
    "unexported import",
    'import { HANDLERS } from "./feature"; const REPLAY_STAGE_HANDLERS = HANDLERS;',
    { "feature.ts": 'const HANDLERS = { event: () => "stage" };' },
  ],
  [
    "import cycle",
    'import { HANDLERS } from "./feature"; export const REPLAY_STAGE_HANDLERS = HANDLERS;',
    {
      "feature.ts":
        'import { REPLAY_STAGE_HANDLERS } from "./entry"; export const HANDLERS = REPLAY_STAGE_HANDLERS;',
    },
  ],
] as const)
  test(`the static stage trace rejects ${label}`, () => {
    expect(() => memoryStageHandlers({ "entry.ts": entry, ...extra })).toThrow();
  });

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
