/**
 * 单元测试验证动物／普通放逐死亡提案的来源顺序，以及两种反馈的实际死亡门控差异。
 * 输入为手写重复名单、真实内存角色／生命和明确失败 getter；预期是独立字面死因、查验结果与读取轨迹。
 * 不运行模型或完整对局，不让生产结算输出生成预期；准备结果不视为付款或生命提交凭据。
 */
import { expect, test } from "bun:test";
import { Camp, DeathCause, Role } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";
import { createAliveComponent } from "../../../src/domain/components/alive";
import { createRoleComponent } from "../../../src/agents/observation/role-presentation";
import {
  prepareAnimalExileDeaths,
  captureAnimalExileFeedback,
  captureOrdinaryExileFeedback,
  prepareOrdinaryExileDeaths,
} from "../../../src/rulesets/exile-death-preparation";

test("动物死亡提案保重复来源合并和首次席位顺序，普通提案只含实际移除者", () => {
  const selection = { summary: { target: 2 }, removed: [2, 2], animalRetaliation: [3, 2, 3] };
  expect(prepareAnimalExileDeaths(selection)).toEqual({
    ids: [2, 3],
    sources: { 2: [DeathCause.Exile, DeathCause.PufferRetaliation], 3: [DeathCause.PufferRetaliation] },
  });
  expect(prepareOrdinaryExileDeaths(selection)).toEqual({ 2: [DeathCause.Exile] });
  expect(selection.removed).toEqual([2, 2]);
  expect(selection.animalRetaliation).toEqual([3, 2, 3]);
});

test("普通反馈在标死前捕获，动物反馈只在主目标真正放逐死亡之后捕获", () => {
  const world = new World(), target = world.createEntity(), life = createAliveComponent();
  world.addComponent(target, COMPONENT.Role, createRoleComponent(Role.Wolf));
  world.addComponent(target, COMPONENT.Camp, { camp: Camp.Wolf });
  world.addComponent(target, COMPONENT.Alive, life);
  const selection = { summary: { target }, removed: [target] }, reads: string[] = [];
  const runtime = () => { reads.push("world"); return world; };
  expect(captureOrdinaryExileFeedback(runtime, selection, target, 4)).toEqual({ exileDay: 4, targetId: target, result: { kind: "camp", camp: Camp.Wolf } });
  expect(reads).toEqual(["world"]);
  reads.length = 0;
  expect(captureAnimalExileFeedback(runtime, selection, { [target]: [DeathCause.Exile] }, 4)).toBeNull();
  expect(reads).toEqual(["world"]);
  life.alive = false;
  reads.length = 0;
  expect(captureAnimalExileFeedback(runtime, selection, { [target]: [DeathCause.PufferRetaliation] }, 4)).toBeNull();
  expect(reads).toEqual([]);
  expect(captureAnimalExileFeedback(runtime, selection, { [target]: [DeathCause.Exile] }, 4)).toEqual({ exileDay: 4, targetId: target, result: { kind: "camp", camp: Camp.Wolf } });
  expect(reads).toEqual(["world", "world"]);
});

test("空目标不读取名单或世界，动物生命查询失败先于身份捕获且不修改来源", () => {
  const failure = new Error("literal_alive_read_failure"), reads: string[] = [];
  const unavailable = () => { throw new Error("literal_world_must_not_read"); };
  const absent = { get removed(): number[] { throw new Error("literal_removed_must_not_read"); } };
  expect(captureOrdinaryExileFeedback(unavailable, absent, null, 1)).toBeNull();
  expect(captureAnimalExileFeedback(unavailable, { summary: { target: null } }, {}, 1)).toBeNull();
  const world = { getComponent(_id: number, kind: unknown) { reads.push(String(kind)); throw failure; } } as unknown as World;
  const sources = { 2: [DeathCause.Exile] };
  expect(() => captureAnimalExileFeedback(() => world, { summary: { target: 2 } }, sources, 1)).toThrow(failure);
  expect(reads).toEqual([COMPONENT.Alive]);
  expect(sources).toEqual({ 2: [DeathCause.Exile] });
});
