/**
 * 单元测试验证可选匿名墙处理的失败前缀：拒绝事实未落地时不能完成，完成通知抛错也不能撤回已结算作者。
 * 输入为六名原作者、字面坏形态／空回复和具名故障；输出预期为通知顺序、原异常及未付款库存。
 * 只执行真实窗口，不推进完整对局或调用录制／模型；权限、库存及清理仍由原生产 owner 执行。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  Role,
  createRandom,
  type GameEvent,
  type ToolCall,
} from "../../../../src/domain";
import { deferRequestDelivery } from "../../../../src/domain/request-delivery";
import { GameActionRequestFactory } from "../../../../src/engine/actions/action-request-factory";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { hasActiveWall } from "../../../../src/features/wall-notes/authority";
import { WallNotesWindow } from "../../../../src/features/wall-notes/window";
import { foxBoard } from "../../../support/features/cursed-fox/builders/scenario";

const ids = [1, 2, 3, 4, 5, 6];
const roles = [Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter, Role.Villager];
const invalid: ToolCall = { name: "write_note", args: { text: "" } };

for (const failureAt of ["rejection-fact", "completion-notification"] as const)
  test(`optional Wall ${failureAt} preserves the settled prefix and closes all other authors`, async () => {
    const game = bootstrapGame(
      { ...foxBoard(roles), events: { pack: "awa_wall_notes_once_v1" } },
      { fixedRoles: roles },
    );
    const events: GameEvent[] = [],
      notices: Array<[number, boolean]> = [];
    const failure = new Error(`literal-wall-${failureAt}`),
      push = events.push;
    // 只在拒绝事实提交边界注入故障；finally 的到期事实仍可写，避免用清理错误掩盖原错误。
    events.push = function (...incoming) {
      if (
        failureAt === "rejection-fact" &&
        incoming.some(
          (event) => event.type === "wall_note_changed" && event.payload.operation === "rejected",
        )
      )
        throw failure;
      return push.apply(this, incoming);
    };
    await expect(
      new WallNotesWindow(game.world, new ToolGateway(), events).execute(
        game.boardConfig,
        new GameActionRequestFactory(game.world, events, 1),
        {
          getAction: async (request) => {
            expect(
              deferRequestDelivery(request, (completed) => {
                notices.push([request.actorId, completed]);
                if (failureAt === "completion-notification" && completed) throw failure;
              }),
            ).toBe(true);
            return failureAt === "rejection-fact" ? invalid : null;
          },
        },
        1,
        () => true,
        () => createRandom("literal-optional-wall-failure"),
      ),
    ).rejects.toBe(failure);
    // 通知自身抛错发生在终态已落之后；首作者不再补 false，其余作者仍逐一关闭。
    expect(notices).toEqual(
      ids.map((id) => [id, failureAt === "completion-notification" && id === 1]),
    );
    expect(hasActiveWall(game.world)).toBe(false);
    for (const id of ids)
      expect(game.world.getComponent(id, COMPONENT.WallNote)).toMatchObject({
        remaining: 1,
        expired: true,
      });
    expect(
      events.filter(
        (event) => event.type === "wall_note_changed" && event.payload.operation === "accepted",
      ),
    ).toEqual([]);
    expect(
      events.flatMap((event) =>
        event.type === "wall_note_changed" && event.payload.operation === "expired"
          ? [event.payload.actorId]
          : [],
      ),
    ).toEqual(ids);
    expect(events.some((event) => event.type === "wall_notes_published")).toBe(false);
  });
