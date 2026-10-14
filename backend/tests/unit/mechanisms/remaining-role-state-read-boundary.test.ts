/**
 * 单元测试：验证剩余普通角色槽的只读输出与脱离 modifier 数据。输入为手写丘比特、魔术师、学者记录；原引用、descriptor getter 轨迹及独立归一化字面值为预期。库存、选择、历史及嵌套 tuple 的编译反例不执行，不经 reader 改权限或调用模型。
 */
import "../../../src/app/bootstrap";
import { expect, test } from "bun:test";
import {
  Camp,
  Role,
  type CupidState,
  type MagicianState,
  type ModifierState,
} from "@ai-werewolf-arena/game-contract";
import { createRoleComponent } from "../../../src/game/observation/role-presentation";
import type { RoleInitializationComponent } from "../../../src/game/mechanisms/roles/contracts";
import { getCupidState } from "../../../src/game/mechanisms/roles/cupid/ports";
import { getHybridState } from "../../../src/game/mechanisms/roles/hybrid/ports";
import { getWildChildState } from "../../../src/game/mechanisms/roles/wild_child/ports";
import { getThiefState } from "../../../src/game/mechanisms/roles/thief/state-ports";
import { getShapeshifterState } from "../../../src/game/mechanisms/roles/shapeshifter/state-ports";
import { getDebaterState } from "../../../src/game/mechanisms/roles/debater/state";
import { getEvilKnightState } from "../../../src/game/mechanisms/roles/evil_knight/ports";
import { getNightmareShadowState } from "../../../src/game/mechanisms/roles/nightmare_shadow/ports";
import {
  getMagicianState,
  projectMagicianState,
} from "../../../src/game/mechanisms/roles/magician/state-slot";
import { getTricksterState } from "../../../src/game/mechanisms/roles/trickster/ports";
import { getWolfSorcererState } from "../../../src/game/mechanisms/roles/wolf_sorcerer/state-slot";
import { getTimeConsortState } from "../../../src/game/mechanisms/roles/time_wolf_consort/ports";
import { scholarMentorStateForRole } from "../../../src/game/mechanisms/roles/scholar_mentor/ports";
import { readModifierState } from "../../../src/game/mechanisms/roles/scholar_mentor/ports";
import { getLonelyGirlState } from "../../../src/game/mechanisms/roles/lonely_girl/ports";
import { getRedMoonState } from "../../../src/game/mechanisms/roles/red_moon_apostle/state-slot";

function forbiddenLiveWrites(
  cupid: NonNullable<ReturnType<typeof getCupidState>>,
  hybrid: NonNullable<ReturnType<typeof getHybridState>>,
  wild: NonNullable<ReturnType<typeof getWildChildState>>,
  thief: NonNullable<ReturnType<typeof getThiefState>>,
  shape: NonNullable<ReturnType<typeof getShapeshifterState>>,
  debate: NonNullable<ReturnType<typeof getDebaterState>>,
  evil: NonNullable<ReturnType<typeof getEvilKnightState>>,
  nightmare: NonNullable<ReturnType<typeof getNightmareShadowState>>,
  magician: NonNullable<ReturnType<typeof getMagicianState>>,
  trickster: NonNullable<ReturnType<typeof getTricksterState>>,
  sorcerer: NonNullable<ReturnType<typeof getWolfSorcererState>>,
  consort: NonNullable<ReturnType<typeof getTimeConsortState>>,
  scholar: NonNullable<ReturnType<typeof scholarMentorStateForRole>>,
  lonely: NonNullable<ReturnType<typeof getLonelyGirlState>>,
  red: NonNullable<ReturnType<typeof getRedMoonState>>,
) {
  // @ts-expect-error 读取活库存不等于已接受的丘比特命令。
  cupid.remaining = 0;
  if (cupid.choice) {
    // @ts-expect-error 活状态读取中的内层配对身份也只读。
    cupid.choice.pairIds[0] = 2;
  }
  if (hybrid.choice) {
    // @ts-expect-error 榜样选择仍由实际选择阶段提交。
    hybrid.choice.targetId = 2;
  }
  // @ts-expect-error 野孩子的夜间资格由其实际状态命令更新。
  wild.eligibleNight = 2;
  // @ts-expect-error 读取初始身份选择不授予修改选择的权限。
  thief.choice = 0;
  // @ts-expect-error 千面人库存由初始身份选择命令提交。
  shape.remaining = 0;
  if (debate.choice) {
    // @ts-expect-error 槽内的辩论目标也只读。
    debate.choice.targetId = 2;
  }
  // @ts-expect-error 反射库存仅在原授权检查后消费。
  evil.reflectionRemaining = 0;
  // @ts-expect-error 普通读取方不能追加恐惧历史。
  nightmare.history.push({ day: 1, targetId: null });
  if (magician.history[0]?.pair) {
    // @ts-expect-error 已存历史中的交换元组也只读。
    magician.history[0].pair[0] = 2;
  }
  // @ts-expect-error 诡术师历史由原夜帧命令写入。
  trickster.history.push({ day: 1, pair: null });
  if (sorcerer.history[0]?.pair) {
    // @ts-expect-error 不能经读视图重写狼术师已存配对编号。
    sorcerer.history[0].pair[1] = 3;
  }
  if (consort.history[0]) {
    // @ts-expect-error 时间狼妃历史条目的内层字段也只读。
    consort.history[0].targetId = 2;
  }
  // @ts-expect-error 学者活库存与脱离归一化DTO保持区别。
  scholar.remaining.enhance = 0;
  if (scholar.history[0]) {
    // @ts-expect-error 学者已存历史条目也保持只读。
    scholar.history[0].mode = "enhance";
  }
  if (lonely.choice) {
    // @ts-expect-error 孤独少女槽内的来源选择也只读。
    lonely.choice.targetId = 2;
  }
  // @ts-expect-error 赤月结算标记由原带检查的权威写入。
  red.expirySettled = true;
}
void forbiddenLiveWrites;

function roleWithSlot(role: Role, key: string, state: unknown) {
  const result = createRoleComponent(role, Camp.Good);
  (result as RoleInitializationComponent).privateState[key] = state;
  return result;
}

test("Cupid read output retains its stored record and tuple without freezing the input", () => {
  const state: CupidState = {
    policy: "lui_meme_lovers_only_v1",
    remaining: 0,
    choice: { day: 1, pairIds: [2, 3] },
  };
  const role = roleWithSlot(Role.Cupid, "cupid", state),
    read = getCupidState(role)!;
  expect(read).toBe(state);
  expect(read.choice!.pairIds).toBe(state.choice!.pairIds);
  expect(Object.isFrozen(state)).toBe(false);
  state.choice!.pairIds[0] = 4;
  expect(getCupidState(role)!.choice!.pairIds[0]).toBe(4);
});

test("Magician validation keeps the original live record and a separately copied player projection", () => {
  const state: MagicianState = {
    policy: "awa_magician_wolf_king_v1",
    firstNight: 1,
    deathShotTargetPolicy: "original",
    history: [{ day: 1, pair: [2, 3] }],
  };
  const role = roleWithSlot(Role.Magician, "magician", state);
  expect(getMagicianState(role)).toBe(state);
  const projected = projectMagicianState(role)!;
  expect(projected).not.toBe(state);
  expect(projected.history[0]!.pair).not.toBe(state.history[0]!.pair);
  projected.history[0]!.pair![0] = 4;
  expect(state.history[0]!.pair![0]).toBe(2);
  let reads = 0;
  Object.defineProperty(state, "history", {
    get() {
      reads++;
      return [];
    },
  });
  expect(getMagicianState(role)).toBeUndefined();
  expect(reads).toBe(0);
});

test("Scholar normalized DTO remains detached and writable while its live slot read keeps identity", () => {
  const state: ModifierState = {
    policy: "awa_scholar_mentor_twelve_v1",
    caster: "day_scholar",
    remaining: { enhance: 0, weaken: 1 },
    history: [{ day: 2, mode: "enhance", targetId: 2 }],
  };
  const role = roleWithSlot(Role.DayScholar, "scholarMentor", state);
  expect(scholarMentorStateForRole(role)).toBe(state);
  const normalized = readModifierState(state)!;
  expect(normalized).toEqual(state);
  expect(normalized).not.toBe(state);
  expect(normalized.remaining).not.toBe(state.remaining);
  expect(normalized.history[0]).not.toBe(state.history[0]);
  normalized.remaining.weaken = 0;
  normalized.history[0]!.targetId = 3;
  expect(state.remaining.weaken).toBe(1);
  expect(state.history[0]!.targetId).toBe(2);
});
