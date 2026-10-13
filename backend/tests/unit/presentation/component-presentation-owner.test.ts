/**
 * 单元测试验证公开组件展示退出领域后的数据身份、语言、读取与故障边界。输入为手写
 * getter／印记方法陷阱和原工厂组件；精确中文／英文、trace 与错误身份是独立预期。
 * 不运行完整对局、模型、归档或死亡流水线，展示数据不授予写权限。
 */
import { expect, test } from "bun:test";
import { Camp, StatusMark, type ComponentPresentationPart } from "@ai-werewolf-arena/game-contract";
import type { BadgeComponent } from "../../../src/core/domain/components/badge";
import type { VotingRightComponent } from "../../../src/core/domain/components/voting_right";
import { aliveLifeDescriptor, aliveLifeVersion } from "../../../src/core/domain/components/alive";
import { StatusMarksComponent, statusMarkSnapshot } from "../../../src/core/domain/components/status_marks";
import {
  createAliveComponent, createBadgeComponent, createCampComponent, createVotingRightComponent,
  createStatusMarksComponent, renderAlivePrompt, renderBadgePrompt, renderCampPrompt,
  renderVotingRightPrompt, renderStatusMarksPrompt,
} from "../../../src/game/observation/component-presentation";
import { demonWitchMarksSafe } from "../../../src/game/mechanisms/roles/demon_hunter/native_potion_requests";
import { World } from "../../../src/core/domain/world";
import { COMPONENT } from "../../../src/core/domain/components/names";

function rejectsRuntimeData(component: BadgeComponent) {
  // @ts-expect-error 纯展示片段不接受领域组件句柄作为票重。
  const part: ComponentPresentationPart = { kind: "badge-held", weight: component };
  void part;
}
void rejectsRuntimeData;

test("component factories retain domain data and life identity while language belongs to display", () => {
  const alive = createAliveComponent(true, "en"), badge = createBadgeComponent(false, false, "en"),
    camp = createCampComponent(Camp.Wolf, "en"), vote = createVotingRightComponent(2, true, "en"),
    marks = createStatusMarksComponent("en");
  expect(Object.keys(alive)).toEqual(["alive"]);
  expect(Object.keys(badge)).toEqual(["isSheriff", "destroyed", "voteWeight"]);
  expect(Object.keys(camp)).toEqual(["camp"]);
  expect(Object.keys(vote)).toEqual(["weight", "canVote"]);
  expect(Object.keys(marks)).toEqual([]);
  const descriptor = aliveLifeDescriptor(alive)!;
  expect(descriptor.get).toBe(Object.getOwnPropertyDescriptor(alive, "alive")!.get);
  expect(aliveLifeVersion(alive)).toBe(0);
  expect(renderAlivePrompt(alive)).toBe("You are still alive.");
  alive.alive = false;
  expect(aliveLifeVersion(alive)).toBe(1);
  expect(renderAlivePrompt(alive)).toBe("You have been eliminated.");
  expect(renderCampPrompt(camp)).toBe("You belong to the Werewolf team.");
  expect(renderBadgePrompt(badge)).toBe("You do not hold the sheriff badge.");
  expect(renderVotingRightPrompt(vote)).toBe("Your voting weight is 2.");
  expect(renderStatusMarksPrompt(marks)).toBe("You have no status marks.");
});

test("destroyed badge and denied vote never read unused downstream fields", () => {
  const trace: string[] = [];
  const badge: BadgeComponent = {
    get destroyed() { trace.push("destroyed"); return true; },
    get isSheriff(): boolean { throw new Error("unused_sheriff"); },
    get voteWeight(): number { throw new Error("unused_weight"); },
  };
  expect(renderBadgePrompt(badge, "en")).toBe("The sheriff badge has been destroyed.");
  expect(trace).toEqual(["destroyed"]);
  const vote: VotingRightComponent = {
    get canVote() { trace.push("canVote"); return false; },
    get weight(): number { throw new Error("unused_weight"); },
  };
  expect(renderVotingRightPrompt(vote, "en")).toBe("You currently have no voting right.");
  expect(trace).toEqual(["destroyed", "canVote"]);
});

test("badge getter failure precedes language validation with the original identity", () => {
  const failure = new Error("original_badge_read"), trace: string[] = [];
  const badge: BadgeComponent = {
    get destroyed() { trace.push("destroyed"); return false; },
    get isSheriff() { trace.push("sheriff"); return true; },
    get voteWeight(): number { trace.push("weight"); throw failure; },
  };
  expect(() => renderBadgePrompt(badge, "invalid" as "en")).toThrow(failure);
  expect(trace).toEqual(["destroyed", "sheriff", "weight"]);
});

test("empty marks short circuit values and nonempty marks retain dynamic method receiver", () => {
  const marks = createStatusMarksComponent("en"), trace: string[] = [];
  const original = marks.values;
  marks.values = function () { expect(this).toBe(marks); trace.push("values"); return original.call(this); };
  expect(renderStatusMarksPrompt(marks)).toBe("You have no status marks.");
  expect(trace).toEqual([]);
  marks.add(StatusMark.GuardMark);
  marks.add(StatusMark.WolfKillMark);
  expect(renderStatusMarksPrompt(marks)).toBe("Your current status marks: [Guard mark] [Wolf kill mark]");
  expect(trace).toEqual(["values"]);
  expect(statusMarkSnapshot(marks, StatusMark.GuardMark)).toEqual({ revision: 1, present: true });
  expect(renderStatusMarksPrompt(marks, "zh-CN")).toBe("你当前持有状态：[守护印记] [狼刀印记]");
});

test("foreign marks refuse before invoking values or validating language", () => {
  let reads = 0;
  const foreign = { values() { reads++; return []; } } as unknown as StatusMarksComponent;
  expect(() => renderStatusMarksPrompt(foreign, "invalid" as "en")).toThrow("status_marks_component_invalid");
  expect(reads).toBe(0);
});

test("Demon mark trust retains mutation methods and rejects injected retired display names", () => {
  const world = new World(), id = world.createEntity(), marks = new StatusMarksComponent();
  world.addComponent(id, COMPONENT.StatusMarks, marks);
  expect(demonWitchMarksSafe(world, id)).toBe(true);
  Object.defineProperty(marks, "renderPrompt", { value: () => "injected", configurable: true });
  expect(demonWitchMarksSafe(world, id)).toBe(false);
  Reflect.deleteProperty(marks, "renderPrompt");
  expect(demonWitchMarksSafe(world, id)).toBe(true);
  const old = Object.getOwnPropertyDescriptor(StatusMarksComponent.prototype, "has")!;
  try {
    Object.defineProperty(StatusMarksComponent.prototype, "has", { ...old, value: () => true });
    expect(demonWitchMarksSafe(world, id)).toBe(false);
  } finally { Object.defineProperty(StatusMarksComponent.prototype, "has", old); }
  expect(demonWitchMarksSafe(world, id)).toBe(true);
});


test("saved invalid locale is not silently replaced by the display default", () => {
  const camp = createCampComponent(Camp.Good, null as unknown as "en");
  expect(() => renderCampPrompt(camp)).toThrow("i18n_locale_invalid");
  expect(renderCampPrompt(camp, "en")).toBe("You belong to the Good team.");
});
