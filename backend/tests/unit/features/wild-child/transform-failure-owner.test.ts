/**
 * 单元测试负责核野孩子转换核心失败与晚事实失败的不同资格结果。输入为真实首夜选择、
 * 原榜样首死及测试自有安装／发表抛错；字面组件引用、写序、原错误和 owner 查询为预期。
 * 不变量：核心失败保已写前缀但字段恢复不复活本族许可；完整核心后的事实失败仍保转换。
 * 只调用本族死亡贡献，不执行中央死亡波、全周期或模型，不据此授予其它赠予能力权限。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { Camp, COMPONENT, DeathCause, Phase, Role, type GameEvent } from "../../../../src/domain";
import { GameActionRequestFactory } from "../../../../src/engine/actions/action-request-factory";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import {
  openWildChildNight,
  projectWildChild,
  recordWildChildDeathCommit,
  resolveWildChildDeathWave,
  validWildChildOwner,
  wildChildBinding,
  wildChildPackActive,
  wildChildPackKnown,
} from "../../../../src/features/wild-child/lifecycle";
import { WildChildSetupWindow } from "../../../../src/features/wild-child/setup";
import { foxBoard } from "../../../support/features/cursed-fox/builders/scenario";

/** 真实 setup 使用已绑定的 canonical 配置；榜样首死保原 Alive 对象／版本，不伪造生命周期绑定。 */
async function prepared() {
  const roles = [Role.WildChild, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter];
  const game = bootstrapGame(foxBoard(roles), { fixedRoles: roles });
  const events: GameEvent[] = [];
  const result = await new WildChildSetupWindow(game.world, new ToolGateway(), events, {
    get requestFactory() {
      return GameActionRequestFactory;
    },
  }).execute(
    game.boardConfig,
    {
      async getAction() {
        return { name: "choose_wild_model", args: { target_id: 2 } };
      },
    },
    1,
    () => true,
  );
  if (!result) throw new Error("literal_wild_setup_expected_success");
  const binding = wildChildBinding(game.world)!;
  recordWildChildDeathCommit(game.world, 2);
  game.world.getComponent(2, COMPONENT.Alive)!.alive = false;
  return { ...game, events, binding };
}

const contribute = (g: Awaited<ReturnType<typeof prepared>>) =>
  resolveWildChildDeathWave(g.world, [2], { 2: [DeathCause.Poison] }, 1, Phase.Night, g.events);

test("Camp installation failure keeps its prefix and restoring duplicate fields cannot revive the Wild owner", async () => {
  const g = await prepared(),
    b = g.binding;
  const role = b.actor.role,
    camp = b.camp,
    victory = b.victory;
  const state = structuredClone(b.state),
    expected = b.expectedState;
  const error = new Error("literal_wild_camp_install_failure"),
    writes: string[] = [];
  const original = g.world.addComponent;
  // 仅测试实例拦截原安装点；正常调用保原 receiver，不新增生产 hook 或补偿。
  g.world.addComponent = new Proxy(original, {
    apply(target, receiver, args) {
      if (args[0] === 1 && args[1] === COMPONENT.Camp) {
        writes.push("Camp:throw");
        throw error;
      }
      return Reflect.apply(target, receiver, args);
    },
  });
  let caught: unknown;
  try {
    contribute(g);
  } catch (e) {
    caught = e;
  } finally {
    g.world.addComponent = original;
  }
  expect(caught).toBe(error);
  expect(writes).toEqual(["Camp:throw"]);
  expect(g.world.getComponent(1, COMPONENT.Role)).toBe(role);
  // 原Camp安装未执行即抛，单一实际阵营仍是旧Good，已退休Role不因读数一致恢复。
  expect(camp.camp).toBe(Camp.Good);
  expect(g.world.getComponent(1, COMPONENT.Camp)).toBe(camp);
  expect(camp.camp).toBe(Camp.Good);
  expect(g.world.getComponent(1, COMPONENT.Victory)).toBe(victory);
  expect(b.state).toEqual(state);
  expect(b.expectedState).toBe(expected);
  expect(b.modelCommitted).toBe(true);
  expect(g.events.map((e) => e.type)).toEqual([
    "wild_child_model_chosen",
    "wild_child_model_eliminated",
  ]);
  expect(validWildChildOwner(b)).toBe(false);
  camp.camp = Camp.Wolf;
  camp.camp = Camp.Good;
  expect(validWildChildOwner(b)).toBe(false);
  expect(projectWildChild(g.world, role)?.status).toBe("closed");
  expect(wildChildPackKnown(role, g.world)).toBe(false);
  expect(wildChildPackActive(role, g.world)).toBe(false);
  contribute(g);
  const close = openWildChildNight(g.world, 2, g.events);
  close();
  expect(b.state).toEqual(state);
  expect(g.events.map((e) => e.type)).toEqual([
    "wild_child_model_chosen",
    "wild_child_model_eliminated",
  ]);
});

test("Victory installation failure keeps installed Wolf Camp while retiring only the Wild transformation owner", async () => {
  const g = await prepared(),
    b = g.binding;
  const camp = b.camp,
    victory = b.victory,
    state = structuredClone(b.state);
  const error = new Error("literal_wild_victory_install_failure"),
    writes: string[] = [];
  const original = g.world.addComponent;
  g.world.addComponent = new Proxy(original, {
    apply(target, receiver, args) {
      if (args[0] === 1 && args[1] === COMPONENT.Camp) writes.push("Camp:installed");
      if (args[0] === 1 && args[1] === COMPONENT.Victory) {
        writes.push("Victory:throw");
        throw error;
      }
      return Reflect.apply(target, receiver, args);
    },
  });
  let caught: unknown;
  try {
    contribute(g);
  } catch (e) {
    caught = e;
  } finally {
    g.world.addComponent = original;
  }
  expect(caught).toBe(error);
  expect(writes).toEqual(["Camp:installed", "Victory:throw"]);
  expect(g.world.getComponent(1, COMPONENT.Camp)).not.toBe(camp);
  expect(g.world.getComponent(1, COMPONENT.Camp)?.camp).toBe(Camp.Wolf);
  expect(g.world.getComponent(1, COMPONENT.Victory)).toBe(victory);
  expect(victory.affiliations).toEqual([{ kind: "faction", faction: Camp.Good }]);
  expect(g.world.getComponent(1, COMPONENT.Camp)!.camp).toBe(Camp.Wolf);
  expect(b.actor.camp).toBe(Camp.Good);
  expect(b.camp).toBe(camp);
  expect(b.state).toEqual(state);
  expect(validWildChildOwner(b)).toBe(false);
  // 恢复原组件和重复值仍不解锁失败标记；同值新引用的旧撤权规则没有在此改写。
  g.world.addComponent(1, COMPONENT.Camp, camp);
  g.world.getComponent(1, COMPONENT.Camp)!.camp = Camp.Wolf;
  g.world.getComponent(1, COMPONENT.Camp)!.camp = Camp.Good;
  expect(validWildChildOwner(b)).toBe(false);
  expect(projectWildChild(g.world, b.actor.role)?.status).toBe("closed");
  expect(g.events.map((e) => e.type)).toEqual([
    "wild_child_model_chosen",
    "wild_child_model_eliminated",
  ]);
});

test("transformed fact publication failure preserves a fully committed owner and following-night pack activation", async () => {
  const g = await prepared(),
    b = g.binding;
  const error = new Error("literal_wild_transformed_fact_failure");
  const original = g.events.push;
  g.events.push = new Proxy(original, {
    apply(target, receiver, args) {
      if (args.some((event: GameEvent) => event.type === "wild_child_transformed")) throw error;
      return Reflect.apply(target, receiver, args);
    },
  });
  let caught: unknown;
  try {
    contribute(g);
  } catch (e) {
    caught = e;
  } finally {
    g.events.push = original;
  }
  expect(caught).toBe(error);
  expect(g.world.getComponent(1, COMPONENT.Camp)?.camp).toBe(Camp.Wolf);
  expect(g.world.getComponent(1, COMPONENT.Victory)?.affiliations).toEqual([
    { kind: "faction", faction: Camp.Wolf },
  ]);
  expect(b.state.status).toBe("transformed");
  expect(b.state.eligibleNight).toBe(2);
  expect(b.expectedState).toBe(JSON.stringify(b.state));
  expect(validWildChildOwner(b)).toBe(true);
  expect(projectWildChild(g.world, b.actor.role)?.status).toBe("transformed");
  expect(g.events.map((e) => e.type)).toEqual([
    "wild_child_model_chosen",
    "wild_child_model_eliminated",
  ]);
  contribute(g);
  const close = openWildChildNight(g.world, 2, g.events);
  close();
  expect(b.state.status).toBe("active");
  expect(wildChildPackKnown(b.actor.role, g.world)).toBe(true);
  expect(wildChildPackActive(b.actor.role, g.world)).toBe(true);
  expect(g.events.map((e) => e.type)).toEqual([
    "wild_child_model_chosen",
    "wild_child_model_eliminated",
    "wild_child_pack_activated",
  ]);
});

test("a frozen public binding does not replace the original Camp error while private failure revocation remains permanent", async () => {
  const g = await prepared(),
    b = g.binding;
  const camp = b.camp,
    error = new Error("literal_frozen_binding_camp_failure");
  expect(validWildChildOwner(b)).toBe(true);
  const original = g.world.addComponent;
  g.world.addComponent = new Proxy(original, {
    apply(target, receiver, args) {
      if (args[0] === 1 && args[1] === COMPONENT.Camp) {
        // 原 modelCommitted 已写；在实际安装调用内冻结绑定，再抛本例同一错误。
        Object.freeze(b);
        throw error;
      }
      return Reflect.apply(target, receiver, args);
    },
  });
  let caught: unknown;
  try {
    contribute(g);
  } catch (e) {
    caught = e;
  } finally {
    g.world.addComponent = original;
  }
  expect(caught).toBe(error);
  expect(Object.isFrozen(b)).toBe(true);
  expect(g.world.getComponent(1, COMPONENT.Camp)).toBe(camp);
  // 此注入同样在原Camp写入之前抛；冻结binding不改变actual旧Good或原错误。
  expect(g.world.getComponent(1, COMPONENT.Camp)!.camp).toBe(Camp.Good);
  expect(validWildChildOwner(b)).toBe(false);
  g.world.getComponent(1, COMPONENT.Camp)!.camp = Camp.Wolf;
  g.world.getComponent(1, COMPONENT.Camp)!.camp = Camp.Good;
  expect(validWildChildOwner(b)).toBe(false);
  expect(projectWildChild(g.world, b.actor.role)?.status).toBe("closed");
});
