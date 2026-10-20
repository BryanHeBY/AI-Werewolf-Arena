/**
 * 单元测试负责验证模型参数分支与旧输入兼容。输入为字面合法／矛盾参数及内存局，
 * 预期来自手写接受矩阵、原参数和库存不变断言；不请求模型或消费药剂。
 */
import { expect, test } from "bun:test";
import { z } from "zod";
import {
  Phase,
  PotionType,
  Role,
  type ActionRequest,
  type ToolName,
} from "@ai-werewolf-arena/game-contract";
import { getDefaultToolSpecRegistry } from "../../../../src/engine/actions/tool-spec-registry";
import { ActionReception } from "../../../../src/engine/actions/action-reception";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { twelvePlayerStandardConfig } from "../../../../src/rulesets/presets/twelve-player-standard";
import { COMPONENT } from "../../../../src/domain/components/names";
import { getWitchState } from "../../../../src/features/witch/ports";
import {
  findNightAbility,
  type NightAbility,
} from "../../../../src/features/night-abilities/abilities";

const registry = getDefaultToolSpecRegistry();
const accepts = (name: ToolName, args: unknown) =>
  z.fromJSONSchema(registry.get(name)!.parameters).safeParse(args).success;

test("不用药省略目标，实际用药必须有目标；无目标分支不接受占位或额外字段", () => {
  expect(accepts("use_potion", { potion_type: "none" })).toBe(true);
  for (const potion_type of ["heal", "poison"]) {
    expect(accepts("use_potion", { potion_type, target_id: 6 })).toBe(true);
    expect(accepts("use_potion", { potion_type })).toBe(false);
    expect(accepts("use_potion", { potion_type, target_id: null })).toBe(false);
    expect(accepts("use_potion", { potion_type, target_id: 6, extra: true })).toBe(false);
  }
  expect(accepts("use_potion", { potion_type: "none", target_id: 6 })).toBe(false);
  expect(accepts("use_potion", { potion_type: "none", extra: true })).toBe(false);
});

for (const name of [
  "vote",
  "kill_vote",
  "guard",
  "vote_for_sheriff",
  "wedding_kill_vote",
  "fear",
  "inspect_night_identity",
  "demon_hunt",
  "lock_time",
  "bonus_action",
] as const)
  test(`${name}：执行与弃权不能组合出矛盾目标`, () => {
    const extra = name === "bonus_action" ? { kind: "check" } : {};
    expect(accepts(name, { ...extra, target_id: 3, abstain: false })).toBe(true);
    expect(accepts(name, { ...extra, target_id: null, abstain: true })).toBe(true);
    expect(accepts(name, { ...extra, target_id: 3, abstain: true })).toBe(false);
    expect(accepts(name, { ...extra, target_id: null, abstain: false })).toBe(false);
    expect(accepts(name, { ...extra, target_id: 3, abstain: false, extra: 1 })).toBe(false);
    // 保留旧形状并不代表领域接受这个动作；后续资格和原修复语义继续生效。
    expect(
      z
        .fromJSONSchema(registry.get(name)!.legacyParameters!)
        .safeParse({ ...extra, target_id: 3, abstain: true }).success,
    ).toBe(true);
  });

for (const name of ["swap_targets", "swap_night_seats", "swap_exile_targets"] as const)
  test(`${name}：交换需要两个目标，弃权需要两个 null`, () => {
    expect(accepts(name, { first_id: 1, second_id: 2, abstain: false })).toBe(true);
    expect(accepts(name, { first_id: null, second_id: null, abstain: true })).toBe(true);
    expect(accepts(name, { first_id: 1, second_id: null, abstain: false })).toBe(false);
    expect(accepts(name, { first_id: 1, second_id: 2, abstain: true })).toBe(false);
  });

test("模式分支限制目标及协助者，不从当前局隐藏状态推导 schema", () => {
  expect(accepts("modify_skill", { mode: null, target_id: null })).toBe(true);
  expect(accepts("modify_skill", { mode: null, target_id: 3 })).toBe(false);
  expect(accepts("modify_skill", { mode: "enhance", target_id: 3 })).toBe(true);
  expect(accepts("modify_skill", { mode: "weaken", target_id: null })).toBe(false);
  for (const mode of ["wait", "pass"]) {
    expect(accepts("awakened_protect", { mode, target_id: null })).toBe(true);
    expect(accepts("awakened_protect", { mode, target_id: 3 })).toBe(false);
  }
  expect(accepts("awakened_protect", { mode: "protect", target_id: 3 })).toBe(true);
  expect(accepts("awakened_protect", { mode: "protect", target_id: null })).toBe(false);
  expect(accepts("awakened_brew", { mode: "pass", target_id: null, assistant_ids: [] })).toBe(true);
  expect(accepts("awakened_brew", { mode: "pass", target_id: 3, assistant_ids: [] })).toBe(false);
  expect(accepts("awakened_brew", { mode: "pass", target_id: null, assistant_ids: [1] })).toBe(
    false,
  );
  expect(accepts("awakened_brew", { mode: "heal", target_id: 3, assistant_ids: [] })).toBe(true);
  expect(accepts("awakened_brew", { mode: "heal", target_id: 3, assistant_ids: [1] })).toBe(false);
  expect(accepts("awakened_brew", { mode: "poison", target_id: 3, assistant_ids: [1] })).toBe(true);
  expect(accepts("awakened_brew", { mode: "poison", target_id: 3, assistant_ids: [] })).toBe(false);
  expect(accepts("awakened_brew", { mode: "poison", target_id: 3, assistant_ids: [1, 1] })).toBe(
    false,
  );
});

test("确认必须 true；迷雾的三个目标必须各不相同", () => {
  for (const name of ["self_destruct", "self_destruct_with_target", "duel"] as const) {
    const extra =
      name === "duel"
        ? { target_id: 3 }
        : name === "self_destruct_with_target"
          ? { reason: "test", target_id: null }
          : { reason: "test" };
    expect(accepts(name, { ...extra, confirm: true })).toBe(true);
    expect(accepts(name, { ...extra, confirm: false })).toBe(false);
  }
  expect(accepts("cast_mist", { target_ids: null })).toBe(true);
  expect(accepts("cast_mist", { target_ids: [1, 2, 3] })).toBe(true);
  expect(accepts("cast_mist", { target_ids: [1, 1, 2] })).toBe(false);
});

test("新旧不用药输入进入同一领域形态，保留旧目标与库存，缺目标用药仍被拒绝", () => {
  const { world } = bootstrapGame(twelvePlayerStandardConfig, {
    fixedRoles: [
      Role.Wolf,
      Role.Wolf,
      Role.Wolf,
      Role.Wolf,
      Role.Seer,
      Role.Witch,
      Role.Hunter,
      Role.Idiot,
      Role.Villager,
      Role.Villager,
      Role.Villager,
      Role.Villager,
    ],
  });
  const request: ActionRequest = {
    actorId: 6,
    phase: Phase.Night,
    allowedTools: ["use_potion"],
    context: {
      day: 1,
      stage: "witch",
      visible_events: [],
      turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
    },
  };
  const receive = new ActionReception(world);
  const stock = getWitchState(world.getComponent(6, COMPONENT.Role)!)!;
  const before = JSON.stringify(stock);
  expect(receive.validate(request, "use_potion", { potion_type: "none" })).toEqual({
    ok: true,
    action: { name: "use_potion", args: { target_id: 6, potion_type: PotionType.None } },
  });
  for (const target_id of [6, 9, 0])
    expect(receive.validate(request, "use_potion", { target_id, potion_type: "none" })).toEqual({
      ok: true,
      action: { name: "use_potion", args: { target_id, potion_type: PotionType.None } },
    });
  for (const potion_type of ["heal", "poison"])
    expect(receive.validate(request, "use_potion", { potion_type })).toMatchObject({
      ok: false,
      error: "invalid_tool_arguments",
    });
  expect(receive.validate(request, "use_potion", { potion_type: "none", extra: 1 })).toMatchObject({
    ok: false,
    error: "invalid_tool_arguments",
  });
  expect(JSON.stringify(stock)).toBe(before);
  const ability = findNightAbility(
    world.getComponent(6, COMPONENT.Role)!,
    "potion",
  ) as NightAbility<"potion">;
  for (const activation of [undefined, "lucky", "black_market"] as const) {
    ability.activation = activation;
    expect(receive.validate(request, "use_potion", { potion_type: "none" })).toEqual({
      ok: true,
      action: { name: "use_potion", args: { target_id: 6, potion_type: PotionType.None } },
    });
    expect(JSON.stringify(stock)).toBe(before);
  }
});
