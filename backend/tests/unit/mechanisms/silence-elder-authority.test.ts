/**
 * 负责禁言原体授权的单元测试；输入为最小真实 World 与手写选择，按字面预期核付款和撤权。
 * 覆盖首写前目标换体、期限回调、失败重开、施者付款后死亡及手势／翻译的独立前缀。
 * 测试不登记生产板子，也不以生产观察结果生成 oracle。
 */
import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import { SILENCE_ELDER_ROLE_ID } from "@ai-werewolf-arena/game-contract/facts/silence-elder";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";
import { createAliveComponent } from "../../../src/domain/components/alive";
import { createRoleComponent } from "../../../src/domain/components/role";
import { createCampComponent } from "../../../src/domain/components/camp";
import {
  getSilenceElderState,
  initializeSilenceElderState,
} from "../../../src/features/silence-elder/state";
import {
  openSilenceNight,
  silenceNightCurrent,
  closeSilenceNight,
  silenceChoiceAllowed,
  commitSilenceChoice,
  pendingSilenceAnnouncement,
  markSilenceAnnounced,
  openSilenceExpression,
  silenceExpressionCurrent,
  finishSilenceGesture,
  closeSilenceExpression,
  expireSilence,
} from "../../../src/features/silence-elder/authority";

function fixture() {
  const world = new World();
  for (const id of [1, 2, 3]) {
    expect(world.createEntity()).toBe(id);
    const role = createRoleComponent(id === 1 ? (SILENCE_ELDER_ROLE_ID as Role) : Role.Villager);
    if (id === 1) initializeSilenceElderState(role);
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    world.addComponent(id, COMPONENT.Camp, createCampComponent(Camp.Good));
  }
  openSilenceNight(world, 1, 1);
  return world;
}

test("night choice pays once; self target and consecutive same target are explicit legal choices", () => {
  const world = fixture();
  expect(silenceChoiceAllowed(world, 1, 1, 1, null)).toBe(true);
  expect(silenceChoiceAllowed(world, 1, 1, 1, 1)).toBe(false);
  commitSilenceChoice(world, 1, 1, 1, 3, () => true);
  expect(() => commitSilenceChoice(world, 1, 1, 2, null, () => true)).toThrow();
  openSilenceNight(world, 1, 2);
  commitSilenceChoice(world, 1, 2, 1, null, () => true);
  expect(getSilenceElderState(world.getComponent(1, COMPONENT.Role))!.history).toEqual([
    { day: 1, targetId: 1, translatorId: 3 },
    { day: 2, targetId: 1, translatorId: null },
  ]);
});

test("an unpaid close cannot reopen the same date; the next night is independent", () => {
  const world = fixture();
  closeSilenceNight(world);
  expect(() => openSilenceNight(world, 1, 1)).toThrow("silence_night_unavailable");
  expect(pendingSilenceAnnouncement(world, 1)).toBeNull();
  openSilenceNight(world, 1, 2);
  expect(silenceChoiceAllowed(world, 1, 2, 2, 3)).toBe(true);
});

test("an active night rejects the next date without replacing the original scope", () => {
  const world = fixture();
  expect(() => openSilenceNight(world, 1, 2)).toThrow("silence_night_unavailable");
  expect(silenceNightCurrent(world, 1, 1)).toBe(true);
  expect(silenceChoiceAllowed(world, 1, 1, 2, null)).toBe(true);
  commitSilenceChoice(world, 1, 1, 2, null, () => true);
  openSilenceNight(world, 1, 2);
  expect(silenceNightCurrent(world, 1, 2)).toBe(true);
});

for (const mode of ["target", "translator", "elder", "deadline", "sentinel"] as const)
  test(`首写前${mode}撤权保零付款`, () => {
    const world = fixture();
    const sentinel = new Error("original_deadline_error");
    const act = () =>
      commitSilenceChoice(world, 1, 1, 2, 3, () => {
        if (mode === "sentinel") throw sentinel;
        if (mode === "deadline") return false;
        world.addComponent(
          mode === "target" ? 2 : mode === "translator" ? 3 : 1,
          COMPONENT.Alive,
          createAliveComponent(),
        );
        return true;
      });
    if (mode === "sentinel") expect(act).toThrow(sentinel);
    else expect(act).toThrow("silence_choice_revoked");
    expect(getSilenceElderState(world.getComponent(1, COMPONENT.Role))!.history).toEqual([]);
    expect(pendingSilenceAnnouncement(world, 1)).toBeNull();
  });

test("paid effect survives Elder death and role replacement, but never a replacement target life", () => {
  const world = fixture();
  commitSilenceChoice(world, 1, 1, 2, 3, () => true);
  world.getComponent(1, COMPONENT.Alive)!.alive = false;
  world.addComponent(1, COMPONENT.Role, createRoleComponent(Role.Wolf));
  expect(pendingSilenceAnnouncement(world, 1)).toEqual({ targetId: 2, translatorId: 3 });
  world.getComponent(3, COMPONENT.Alive)!.alive = false;
  expect(pendingSilenceAnnouncement(world, 1)).toEqual({ targetId: 2, translatorId: null });
  world.getComponent(2, COMPONENT.Alive)!.alive = false;
  world.getComponent(2, COMPONENT.Alive)!.alive = true;
  expect(pendingSilenceAnnouncement(world, 1)).toBeNull();
});

test("only original expression handle moves gesture to translation; close keeps the day round spent", () => {
  const world = fixture();
  commitSilenceChoice(world, 1, 1, 2, 3, () => true);
  expect(openSilenceExpression(world, 1, 2, "day")).toBeNull();
  markSilenceAnnounced(world, 1);
  const expression = openSilenceExpression(world, 1, 2, "day")!;
  expect(silenceExpressionCurrent(world, { ...expression }, 2, "gesture")).toBe(false);
  expect(silenceExpressionCurrent(world, expression, 2, "gesture")).toBe(true);
  expect(silenceExpressionCurrent(world, expression, 3, "translation")).toBe(false);
  expect(() => openSilenceExpression(world, 1, 2, "pk")).toThrow("silence_expression_in_progress");
  expect(silenceExpressionCurrent(world, expression, 2, "gesture")).toBe(true);
  finishSilenceGesture(world, expression);
  expect(silenceExpressionCurrent(world, expression, 2, "gesture")).toBe(false);
  expect(silenceExpressionCurrent(world, expression, 3, "translation")).toBe(true);
  expect(() => openSilenceExpression(world, 1, 2, "pk")).toThrow("silence_expression_in_progress");
  expect(silenceExpressionCurrent(world, expression, 3, "translation")).toBe(true);
  closeSilenceExpression(expression);
  expect(() => openSilenceExpression(world, 1, 2, "day")).toThrow(
    "silence_expression_already_opened",
  );
  const pk = openSilenceExpression(world, 1, 2, "pk")!;
  expect(silenceExpressionCurrent(world, pk, 2, "gesture")).toBe(true);
  expect(expireSilence(world, 1)).toBe(2);
  expect(expireSilence(world, 1)).toBeNull();
  expect(silenceExpressionCurrent(world, pk, 2, "gesture")).toBe(false);
  expect(openSilenceExpression(world, 2, 2, "day")).toBeNull();
});
