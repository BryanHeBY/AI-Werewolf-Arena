/**
 * 单元测试负责真实孤独少女准备窗口的贡献准入和原严格输入读取。
 * 输入为公开六人装配、真实 factory 请求及手写候选，输出用字面拒绝码／目标／Camp／事实数量断言。
 * 伪造 isCurrent 回调不是原 scope；成功候选不代替窗口自身付款，原角色库存与事件仍由真实 setup 提交。
 */
import { expect, test } from "bun:test";
import { Camp, Phase, Role, RuleError, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT } from "../../../../src/domain/components/names";
import { ActionReception } from "../../../../src/engine/actions/action-reception";
import { GameActionRequestFactory } from "../../../../src/engine/actions/action-request-factory";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { LonelyGirlSetupWindow } from "../../../../src/features/lonely-girl/setup";
import { getLonelyGirlState } from "../../../../src/features/lonely-girl/state-slot";
import { foxBoard } from "../../../support/features/cursed-fox/builders/scenario";

test("注册贡献保严格 raw 拒绝与真实证明，任意 true 回调不能替代本族 scope", async () => {
  const roles = [Role.LonelyGirl, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Villager];
  const game = bootstrapGame(foxBoard(roles), { fixedRoles: roles });
  const events: GameEvent[] = [];
  const receive = new ActionReception(game.world);
  const gateway = new ToolGateway();
  let entered = 0;
  const result = await new LonelyGirlSetupWindow(game.world, gateway, events, {
    get requestFactory() {
      return GameActionRequestFactory;
    },
  }).execute(
    game.boardConfig,
    {
      async getAction(request) {
        entered++;
        expect(request.actorId).toBe(1);
        expect(request.context.stage).toBe("lonely_girl");
        // 本族 reader 早于一般数字字符串修复，不能因搬出核心而接受原来非法的字符串目标。
        expect(
          receive.validate(request, "choose_admired_player", { target_id: "2" }),
        ).toMatchObject({
          ok: false,
          error: RuleError.LonelyGirlChoice,
        });
        expect(
          gateway.validateAndSanitize(
            game.world,
            1,
            { name: "choose_admired_player", args: { target_id: 2 } },
            { phase: Phase.Night, day: 1, scope: { isCurrent: () => true } },
          ),
        ).toMatchObject({ ok: false, error: RuleError.LonelyGirlUnavailable });
        expect(receive.validate(request, "choose_admired_player", { target_id: 2 })).toMatchObject({
          ok: true,
          action: { name: "choose_admired_player", args: { target_id: 2 } },
        });
        const role = game.world.getComponent(1, COMPONENT.Role)!;
        expect(getLonelyGirlState(role)?.remaining).toBe(1);
        expect(events).toHaveLength(0);
        return { name: "choose_admired_player", args: { target_id: 2 } };
      },
    },
    1,
    () => true,
  );
  expect(result).toBe(true);
  expect(entered).toBe(1);
  expect(getLonelyGirlState(game.world.getComponent(1, COMPONENT.Role)!)?.remaining).toBe(0);
  // 选择狼只改变胜利归属；真实阵营仍为好人，不能把成员关系当作刀权或狼聊许可。
  expect(game.world.getComponent(1, COMPONENT.Camp)?.camp).toBe(Camp.Good);
  expect(game.world.getComponent(1, COMPONENT.Victory)?.affiliations).toEqual([
    { kind: "faction", faction: Camp.Wolf },
  ]);
  expect(events.map((event) => event.type)).toEqual(["lonely_girl_admired_chosen"]);
  expect(events[0]?.payload).toMatchObject({ actorId: 1, targetId: 2, day: 1, camp: Camp.Wolf });
  expect(Object.hasOwn(receive, "world")).toBe(false);
  expect(receive.locale).toBe(game.world.locale);
});
