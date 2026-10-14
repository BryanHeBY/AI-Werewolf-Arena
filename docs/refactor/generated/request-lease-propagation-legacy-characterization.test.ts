/**
 * 临时真实入口实验：四旧请求原字段改坏、恢复、坏派生别名及原窗口关闭后的查询轨迹。
 * 手写引用／字面预期来自已读旧策略；canonical bootstrap 返回板子用于真实窗口、factory 与 gateway。
 * 不构造假 scope、不改生产或旧测试、不运行整局／模型；千面人与盗贼同owner，此处只执行盗贼。
 */
import { expect, test } from "bun:test";
import fs from "node:fs";
import { bootstrapGame } from "/home/hby/dev/AI-Werewolf-Arena/backend/src/app/bootstrap";
import { Role, Phase, createRandom, type ActionRequest, type GameEvent } from "/home/hby/dev/AI-Werewolf-Arena/backend/src/core/domain";
import { foxBoard } from "/home/hby/dev/AI-Werewolf-Arena/backend/tests/support/features/cursed-fox/builders/scenario";
import { ToolGateway } from "/home/hby/dev/AI-Werewolf-Arena/backend/src/game/gateway/tool_gateway";
import { GameActionRequestFactory } from "/home/hby/dev/AI-Werewolf-Arena/backend/src/game/engine/action_request_factory";
import { InitialIdentitySetupWindow, initialIdentityRequestScope, inheritInitialIdentityDeadlineRequest, authorizedInitialIdentityScope } from "/home/hby/dev/AI-Werewolf-Arena/backend/src/game/mechanisms/roles/initial_identity/setup";
import { WildChildSetupWindow } from "/home/hby/dev/AI-Werewolf-Arena/backend/src/game/mechanisms/roles/wild_child/setup";
import { wildChildRequestScope, inheritWildChildDeadlineRequest, wildChildBinding } from "/home/hby/dev/AI-Werewolf-Arena/backend/src/game/mechanisms/roles/wild_child/lifecycle";
import { LonelyGirlSetupWindow } from "/home/hby/dev/AI-Werewolf-Arena/backend/src/game/mechanisms/roles/lonely_girl/setup";
import { lonelyGirlRequestScope, inheritLonelyGirlDeadlineRequest, lonelyGirlBinding } from "/home/hby/dev/AI-Werewolf-Arena/backend/src/game/mechanisms/roles/lonely_girl/lifecycle";
import { WallNotesWindow } from "/home/hby/dev/AI-Werewolf-Arena/backend/src/game/mechanisms/events/wall_notes/window";
import { wallRequestScope, inheritWallDeadlineRequest, authorizedWallAuthor } from "/home/hby/dev/AI-Werewolf-Arena/backend/src/game/mechanisms/events/wall_notes/authority";
const reports: unknown[] = [];
const output = "/tmp/awa-legacy-request-f02/results.json";
const construction = { get requestFactory() { return GameActionRequestFactory; } };
const gateway = () => new ToolGateway();
function record(value: unknown) { reports.push(value); fs.writeFileSync(output, JSON.stringify(reports, null, 2) + "\n"); }
function probe(request: ActionRequest, query: (r: ActionRequest) => object | undefined, inherit: (a: ActionRequest, b: ActionRequest) => void) {
  const trace: string[] = [], captured = query(request), originalContext = request.context, originalStage = request.context.stage;
  expect(captured).toBeDefined();
  expect(query(request)).toBe(captured);
  trace.push("original:same-scope");
  try {
    request.context.stage = "f02-invalid-stage" as ActionRequest["context"]["stage"];
    expect(query(request)).toBeUndefined();
    trace.push("bad-stage:undefined");
  } finally { originalContext.stage = originalStage; }
  const restored = query(request);
  expect(restored).toBe(captured);
  trace.push("restored:same-scope");
  expect(request.context).toBe(originalContext);
  request.context = { ...originalContext };
  expect(query(request)).toBeUndefined();
  trace.push("copied-context:undefined");
  request.context = originalContext;
  const contextRestored = query(request);
  expect(contextRestored).toBe(captured);
  trace.push("restored-context:same-scope");

  // 原别名规则允许只有期限不同的同字段引用；先证明确实登记，再独立换 alias.context。
  const registeredAlias = { ...request, deadlineAtMs: Date.now() + 60_000 };
  inherit(request, registeredAlias);
  expect(query(registeredAlias)).toBe(captured);
  trace.push("registered-alias:same-scope");
  registeredAlias.context = { ...originalContext };
  expect(query(registeredAlias)).toBeUndefined();
  trace.push("registered-alias-copied-context:undefined");
  expect(query(request)).toBe(captured);
  trace.push("original-after-registered-alias:same-scope");
  registeredAlias.context = originalContext;
  const aliasRestored = query(registeredAlias);
  expect(aliasRestored).toBe(captured);
  trace.push("registered-alias-restored:same-scope");
  const alias = { ...request, context: { ...request.context, stage: "f02-invalid-alias" as ActionRequest["context"]["stage"] }, deadlineAtMs: Date.now() + 60_000 };
  inherit(request, alias);
  expect(query(alias)).toBeUndefined();
  trace.push("bad-alias:undefined");
  expect(query(request)).toBe(captured);
  trace.push("original-after-alias:same-scope");
  expect(request.context.stage).toBe(originalStage);
  return { request, captured, registeredAlias, originalContext, originalStage, trace, restoredSameReference: restored === captured, contextRestoredSameReference: contextRestored === captured, registeredAliasRestoredSameReference: aliasRestored === captured };
}
function finish(name: string, data: ReturnType<typeof probe>, query: (r: ActionRequest) => object | undefined, providerCalls: number, windowResult: unknown) {
  expect(query(data.request)).toBeUndefined();
  data.trace.push("closed:undefined");
  expect(query(data.registeredAlias)).toBeUndefined();
  data.trace.push("closed-registered-alias:undefined");
  // 关闭后再次走改坏／恢复，旧request不再能取得原scope。
  data.request.context.stage = "f02-invalid-after-close" as ActionRequest["context"]["stage"];
  expect(query(data.request)).toBeUndefined();
  data.request.context.stage = data.originalStage;
  expect(query(data.request)).toBeUndefined();
  data.trace.push("closed-restored:undefined");
  expect(data.trace).toEqual(["original:same-scope", "bad-stage:undefined", "restored:same-scope", "copied-context:undefined", "restored-context:same-scope", "registered-alias:same-scope", "registered-alias-copied-context:undefined", "original-after-registered-alias:same-scope", "registered-alias-restored:same-scope", "bad-alias:undefined", "original-after-alias:same-scope", "closed:undefined", "closed-registered-alias:undefined", "closed-restored:undefined"]);
  record({ name, trace: data.trace, restoredSameReference: data.restoredSameReference, contextRestoredSameReference: data.contextRestoredSameReference, registeredAliasRestoredSameReference: data.registeredAliasRestoredSameReference, providerCalls, windowResult: windowResult === undefined ? "void" : windowResult, originalContextRetained: data.request.context === data.originalContext, originalStage: data.originalStage });
}
test("InitialIdentity Thief real bound request can regain field validity but cannot regain a closed scope", async () => {
  const roles = [Role.Thief, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter];
  const fixed = [Role.Thief, Role.Wolf, Role.Witch, Role.Hunter, Role.Villager, Role.Villager, Role.Wolf, Role.Seer];
  const g = bootstrapGame(foxBoard(roles), { fixedRoles: fixed, random: createRandom("f02-thief") }), events: GameEvent[] = [];
  const query = (r: ActionRequest) => initialIdentityRequestScope(g.world, r);
  let data!: ReturnType<typeof probe>, calls = 0;
  const result = await new InitialIdentitySetupWindow(g.world, gateway(), events, "thief", construction).execute(g.boardConfig, { getAction: async request => {
    calls++; data = probe(request, query, inheritInitialIdentityDeadlineRequest);
    expect(authorizedInitialIdentityScope(g.world, request.actorId, 1, Phase.Night, data.captured, "thief")).toBe(data.captured);
    return { name: "choose_thief_card", args: { slot: 0 } };
  } }, 1, () => true);
  expect(result).toBe(true); expect(calls).toBe(1); finish("initial_identity:thief", data, query, calls, result);
});
test("WildChild real bound request can regain field validity but cannot regain a closed choice", async () => {
  const roles = [Role.WildChild, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter];
  const g = bootstrapGame(foxBoard(roles), { fixedRoles: roles, random: createRandom("f02-wild") }), events: GameEvent[] = [];
  const query = (r: ActionRequest) => wildChildRequestScope(g.world, r);
  let data!: ReturnType<typeof probe>, calls = 0;
  const result = await new WildChildSetupWindow(g.world, gateway(), events, construction).execute(g.boardConfig, { getAction: async request => {
    calls++; data = probe(request, query, inheritWildChildDeadlineRequest);
    expect(data.captured).toBe(wildChildBinding(g.world));
    return { name: "choose_wild_model", args: { target_id: 2 } };
  } }, 1, () => true);
  expect(result).toBe(true); expect(calls).toBe(1); finish("wild_child", data, query, calls, result);
});
test("LonelyGirl real bound request can regain field validity but cannot regain a closed choice", async () => {
  const roles = [Role.LonelyGirl, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Villager];
  const g = bootstrapGame(foxBoard(roles), { fixedRoles: roles, random: createRandom("f02-lonely") }), events: GameEvent[] = [];
  const query = (r: ActionRequest) => lonelyGirlRequestScope(g.world, r);
  let data!: ReturnType<typeof probe>, calls = 0;
  const result = await new LonelyGirlSetupWindow(g.world, gateway(), events, construction).execute(g.boardConfig, { getAction: async request => {
    calls++; data = probe(request, query, inheritLonelyGirlDeadlineRequest);
    expect(data.captured).toBe(lonelyGirlBinding(g.world));
    return { name: "choose_admired_player", args: { target_id: 2 } };
  } }, 1, () => true);
  expect(result).toBe(true); expect(calls).toBe(1); finish("lonely_girl", data, query, calls, result);
});
test("Wall real bound request can regain field validity but cannot regain a closed wall", async () => {
  const roles = [Role.Wolf, Role.Seer, Role.Witch, Role.Hunter, Role.Villager, Role.Villager];
  const g = bootstrapGame({ ...foxBoard(roles), events: { pack: "awa_wall_notes_once_v1" } }, { fixedRoles: roles, random: createRandom("f02-wall") }), events: GameEvent[] = [];
  const query = (r: ActionRequest) => wallRequestScope(g.world, r);
  let data!: ReturnType<typeof probe>, calls = 0;
  await new WallNotesWindow(g.world, gateway(), events).execute(g.boardConfig, new GameActionRequestFactory(g.world, events, 1), { getAction: async request => {
    calls++;
    if (request.actorId !== 1) return null;
    data = probe(request, query, inheritWallDeadlineRequest);
    expect(authorizedWallAuthor(g.world, request.actorId, request.context.wall_id, request.context.item_instance_id, data.captured)).not.toBeNull();
    return { name: "write_note", args: { text: "F02 literal note" } };
  } }, 1, () => true, () => createRandom("f02-wall-order"));
  expect(calls).toBe(6); finish("wall", data, query, calls, undefined);
});
