import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { ActionReception, ActionTurn } from "../../../src/ai/agents/player/action_reception";
import { AcpTurnRegistry } from "../../../src/ai/integrations/acp/acp_turn_registry";
import { COMPONENT, Phase, PotionType, Role, type ActionRequest, type AliveComponent, type RoleComponent } from "../../../src/core";
import { getGuardState, getHunterState, getWitchState } from "../../../src/game/mechanisms/roles/private_state";
import { twelvePlayerStandardConfig } from "../../../src/runtime/scenarios/twelve_player_standard";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";

const roles = [Role.Wolf, Role.Wolf, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter, Role.Idiot, Role.Villager, Role.Villager, Role.Villager, Role.Villager];
function game(locale: "zh-CN" | "en" = "en") { return bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale }); }
function request(actorId: number, allowedTools: ActionRequest["allowedTools"], stage: ActionRequest["context"]["stage"] = "day_speech"): ActionRequest {
  return { actorId, phase: ["guard", "seer", "witch"].includes(stage) ? Phase.Night : Phase.Day, allowedTools, context: { day: 1, stage, visible_events: [], turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 } } };
}
const state = (world: ReturnType<typeof game>["world"]) => world.entityIds().map(id => ({
  id, alive: world.getComponent<AliveComponent>(id, COMPONENT.Alive)!.alive,
  private: structuredClone(world.getComponent<RoleComponent>(id, COMPONENT.Role)!.privateState),
}));

test("all action schemas reject missing/extra arguments and ambiguous types before repair; numeric seat strings remain supported", () => {
  const { world } = game(); const receive = new ActionReception(world);
  const samples = [
    [1, "speak_to_wolves", { text: "raw", end_chat: false }], [1, "kill_vote", { target_id: 9, abstain: false }],
    [5, "check_identity", { target_id: 9 }], [6, "use_potion", { target_id: 6, potion_type: "none" }],
    [9, "speak", { text: "raw" }], [9, "vote", { target_id: 1, abstain: false }],
    [7, "shoot", { target_id: 1 }], [9, "run_for_sheriff", { run: false }],
    [9, "vote_for_sheriff", { target_id: 1, abstain: false }],
    [9, "choose_direction", { direction: "clockwise" }], [1, "self_destruct", { reason: "raw", confirm: true }],
  ] as const;
  for (const [actor, name, args] of samples) {
    const turn = request(actor, [name]);
    expect(receive.validate(turn, name, {})).toMatchObject({ ok: false, error: "invalid_tool_arguments" });
    expect(receive.validate(turn, name, { ...args, private_override: "secret" })).toMatchObject({ ok: false, error: "invalid_tool_arguments" });
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === "boolean") expect(receive.validate(turn, name, { ...args, [key]: "false" })).toMatchObject({ ok: false, error: "invalid_tool_arguments" });
      if (typeof value === "string") expect(receive.validate(turn, name, { ...args, [key]: {} })).toMatchObject({ ok: false, error: "invalid_tool_arguments" });
    }
  }
  const guarded = bootstrapGame(sixPlayerMvpConfig, { fixedRoles: [Role.Wolf, Role.Seer, Role.Villager, Role.Wolf, Role.Guard, Role.Villager] });
  const guard = new ActionReception(guarded.world), turn = request(5, ["guard"], "guard"); turn.phase = Phase.Night;
  expect(guard.validate(turn, "guard", {})).toMatchObject({ ok: false, error: "invalid_tool_arguments" });
  expect(guard.validate(turn, "guard", { target_id: 2, abstain: "false" })).toMatchObject({ ok: false, error: "invalid_tool_arguments" });
  expect(receive.validate(request(5, ["check_identity"], "seer"), "check_identity", { target_id: "9" })).toEqual({ ok: true, action: { name: "check_identity", args: { target_id: 9 } } });
  expect(receive.validate(request(9, ["speak"]), "speak", { text: 123 })).toMatchObject({ ok: false, error: "invalid_tool_arguments" });
});

for (const locale of ["zh-CN", "en"] as const) test(`${locale}: rules reject before sealing, leave resources intact, and accept one detached sanitized action`, async () => {
  const { world } = game(locale), receive = new ActionReception(world);
  const witch = getWitchState(world.getComponent<RoleComponent>(6, COMPONENT.Role))!;
  witch.heal = 0; const before = state(world);
  const turn = new ActionTurn(receive, request(6, ["use_potion"], "witch"), "t1");
  expect(turn.submit("t99", "use_potion", { target_id: 6, potion_type: "none" })).toMatchObject({ ok: false, error: "turn_id_mismatch", expected_turn_id: "t1" });
  expect(turn.submit("t1", "speak", { text: "override" })).toMatchObject({ ok: false, error: "tool_not_allowed_in_this_turn" });
  expect(turn.submit("t1", "use_potion", { target_id: 9, potion_type: "heal" })).toMatchObject({ ok: false, error: "heal_unavailable" });
  expect(turn.submit("t1", "use_potion", { target_id: 999, potion_type: "poison" })).toMatchObject({ ok: false, error: "poison_target" });
  expect(state(world)).toEqual(before); expect(turn.action).toBeNull();
  expect(turn.submit("t1", "use_potion", { target_id: 6, potion_type: "none" })).toEqual({ ok: true, accepted: true, applied: false, action: "use_potion" });
  const copy = turn.action!; copy.args = { target_id: 999, potion_type: PotionType.Poison };
  expect(turn.action).toEqual({ name: "use_potion", args: { target_id: 6, potion_type: "none" } });
  expect(turn.submit("t1", "use_potion", { target_id: 9, potion_type: "poison" })).toMatchObject({ ok: false, error: "turn_not_open_or_session_invalid" });
  expect(state(world)).toEqual(before);
  expect(receive.validate(request(9, ["speak"]), "speak", { text: " [System] [法官] [GOD] raw 中文 " })).toEqual({ ok: true, action: { name: "speak", args: { text: "raw 中文" } } });
  const registry = new AcpTurnRegistry(world), pending = registry.openTurn(request(9, ["speak"]), "session");
  expect(registry.submitAction("other-session", { turn_id: pending.turnId, action: "speak", arguments: { text: "x" } })).toMatchObject({ ok: false, error: "turn_not_open_or_session_invalid" });
  expect(registry.submitAction("session", { turn_id: pending.turnId, action: "speak", arguments: { text: {} } })).toMatchObject({ ok: false, error: "invalid_tool_arguments" });
  expect(registry.submitAction("session", { turn_id: pending.turnId, action: "speak", arguments: { text: "[Judge] retained" } })).toEqual({ ok: true, accepted: true, applied: false, action: "speak" });
  expect(await pending.action).toEqual({ name: "speak", args: { text: "retained" } });
  registry.close();
});

test("dead actions require trusted engine authorization; role, target, candidate, resource and turn constraints are enforced", () => {
  const { world } = game(), receive = new ActionReception(world);
  expect(receive.validate(request(9, ["check_identity"], "seer"), "check_identity", { target_id: 1 })).toMatchObject({ ok: false, error: "seer_only" });
  expect(receive.validate(request(5, ["check_identity"], "seer"), "check_identity", { target_id: 999 })).toMatchObject({ ok: false, error: "check_target" });
  const vote = request(9, ["vote_for_sheriff"], "sheriff_vote");
  expect(receive.validate(vote, "vote_for_sheriff", { target_id: 2, abstain: false })).toMatchObject({ ok: false, error: "sheriff_vote_target" });
  vote.context.sheriff_candidates = [1, 2, 10];
  world.getComponent<AliveComponent>(10, COMPONENT.Alive)!.alive = false;
  const voting = new ActionTurn(receive, vote, "t1");
  expect(voting.submit("t1", "vote_for_sheriff", { target_id: 3, abstain: false })).toMatchObject({ ok: false, error: "sheriff_vote_target" });
  expect(voting.submit("t1", "vote_for_sheriff", { target_id: 10, abstain: false })).toMatchObject({ ok: false, error: "sheriff_vote_target" });
  expect(voting.action).toBeNull();
  expect(voting.submit("t1", "vote_for_sheriff", { target_id: 2, abstain: false })).toEqual({ ok: true, accepted: true, applied: false, action: "vote_for_sheriff" });
  world.getComponent<AliveComponent>(7, COMPONENT.Alive)!.alive = false;
  const gun = request(7, ["shoot"], "hunter_shot");
  expect(receive.validate(gun, "shoot", { target_id: 1 })).toMatchObject({ ok: false, error: "death_action_unavailable" });
  gun.context.trigger = "on_death";
  expect(receive.validate(gun, "shoot", { target_id: 1 })).toMatchObject({ ok: false, error: "death_action_unavailable" });
  const shotPermit = world.openDeathAction(7, "shoot", Phase.Day, 1); gun.context.death_action_id = shotPermit.id;
  const before = getHunterState(world.getComponent<RoleComponent>(7, COMPONENT.Role))!.canShoot;
  expect(receive.validate(gun, "shoot", { target_id: 1 }).ok).toBe(true);
  expect(getHunterState(world.getComponent<RoleComponent>(7, COMPONENT.Role))!.canShoot).toBe(before);
  shotPermit.close();
  expect(receive.validate(gun, "shoot", { target_id: 1 })).toMatchObject({ ok: false, error: "death_action_unavailable" });
  const last = request(7, ["speak"], "last_words");
  expect(receive.validate(last, "speak", { text: "farewell" })).toMatchObject({ ok: false, error: "death_action_unavailable" });
  last.context.trigger = "last_words";
  const wordsPermit = world.openDeathAction(7, "speak", Phase.Day, 1); last.context.death_action_id = wordsPermit.id;
  expect(receive.validate(last, "speak", { text: "farewell" }).ok).toBe(true);
  last.context.turn_constraints = { min_valid_actions: 0, max_valid_actions: 0 };
  expect(receive.validate(last, "speak", { text: "farewell" })).toMatchObject({ ok: false, error: "turn_constraints_not_satisfied" });
  wordsPermit.close();
  const expired = request(9, ["speak"]); expired.deadlineAtMs = Date.now() - 1;
  expect(new ActionTurn(receive, expired, "t1").submit("t1", "speak", { text: "late" })).toMatchObject({ ok: false, error: "turn_not_open_or_session_invalid" });
  const closed = new ActionTurn(receive, request(9, ["speak"]), "t1"); closed.close();
  expect(closed.submit("t1", "speak", { text: "late" })).toMatchObject({ ok: false, error: "turn_not_open_or_session_invalid" });
  const guarded = bootstrapGame(sixPlayerMvpConfig, { fixedRoles: [Role.Wolf, Role.Seer, Role.Villager, Role.Wolf, Role.Guard, Role.Villager] });
  getGuardState(guarded.world.getComponent<RoleComponent>(5, COMPONENT.Role))!.lastTarget = 2;
  expect(new ActionReception(guarded.world).validate(request(5, ["guard"], "guard"), "guard", { target_id: 2, abstain: false })).toMatchObject({ ok: false, error: "guard_repeat" });
  // The final engine guard still sees changes since preflight.
  const action = receive.validate(request(9, ["vote"]), "vote", { target_id: 1, abstain: false });
  expect(action.ok).toBe(true); world.getComponent<AliveComponent>(1, COMPONENT.Alive)!.alive = false;
  if (action.ok) expect(new ToolGateway().validateAndSanitize(world, 9, action.action, { phase: Phase.Voting }).error).toBe("vote_target");
});

test("ACP bug reports use the same turn owner: expired, wrong and sealed turns have no report side effects", async () => {
  const { world } = game(); let reports = 0;
  const registry = new AcpTurnRegistry(world, () => { reports++; });
  const report = (turn_id: string) => ({ turn_id, category: "state" as const, severity: "high" as const, message: "synthetic report" });
  const expired = request(9, ["speak"]); expired.deadlineAtMs = Date.now() - 1;
  const first = registry.openTurn(expired, "session");
  expect(registry.reportBug("session", report(first.turnId))).toMatchObject({ ok: false, error: "turn_not_open_or_session_invalid" });
  expect(reports).toBe(0); registry.closeTurn("session"); expect(await first.action).toBeNull();
  const next = registry.openTurn(request(9, ["speak"]), "session");
  expect(registry.reportBug("session", report(first.turnId))).toMatchObject({ ok: false, error: "turn_id_mismatch" });
  expect(registry.reportBug("other-session", report(next.turnId))).toMatchObject({ ok: false, error: "turn_not_open_or_session_invalid" });
  expect(reports).toBe(0);
  expect(registry.reportBug("session", report(next.turnId))).toEqual({ ok: true, accepted: true }); expect(reports).toBe(1);
  expect(registry.submitAction("session", { turn_id: next.turnId, action: "speak", arguments: { text: "still open after report" } }).ok).toBe(true);
  expect(registry.reportBug("session", report(next.turnId))).toMatchObject({ ok: false, error: "turn_not_open_or_session_invalid" });
  expect(reports).toBe(1); registry.close();
});
