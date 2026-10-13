/**
 * 单元测试验证红月两种显式政策和恶意描述符下的私有观察。输入为原内存 fixture、访问器与冻结对象；
 * 手写 owner 字段和脱离副本断言确保外来访问器不能读出库存，不运行模型或完整对局。
 * 保原字面／fixture oracle；类型迁移不改变状态读取和拒绝边界。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT, Phase, Role, type RoleComponent } from "../../../../src/core";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import { ObservedPlayersActionProvider } from "../../../../src/ai/agents/providers/observed_players";
import type { PlayerObservation } from "../../../../src/game/observation/player-observation";
import { redMoonTwelveConfig } from "../../../../src/runtime/scenarios/red_moon_twelve";
import { getRedMoonState } from "../../../../src/game/mechanisms/roles/red_moon_apostle/state";
for (const policy of ["ends_game", "forbidden"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    test(
      "Red Moon ownState is private detached frozen and rejects accessors " + policy + "/" + locale,
      async () => {
        const config = structuredClone(redMoonTwelveConfig);
        config.redMoon!.lastWolfBlastPolicy = policy;
        const f = bootstrapGame(config, { locale });
        const id = (r: Role) =>
          f.playerIds.find(
            (id) => f.world.getComponent(id, COMPONENT.Role)?.role === r,
          )!;
        const actor = id(Role.RedMoonApostle),
          other = id(Role.Villager);
        const seen: PlayerObservation[] = [];
        const provider = new ObservedPlayersActionProvider(
          f.world,
          new Map(
            [actor, other].map((id) => [
              id,
              {
                async decide(o: PlayerObservation) {
                  seen.push(o);
                  return null;
                },
              },
            ]),
          ),
          config,
        );
        const factory = new GameActionRequestFactory(f.world, f.phaseManager.getEvents(), 1);
        const request = (actorId: number) =>
          factory.create({
            actorId,
            phase: Phase.Voting,
            allowedTools: ["vote"],
            stage: "voting",
            requiresAction: true,
            summary: "Vote",
          });
        const state = getRedMoonState(f.world.getComponent(actor, COMPONENT.Role))!;
        await provider.getAction(request(actor));
        const snapshot = seen[0]!.ownState.redMoon!;
        expect(snapshot).toEqual(state);
        expect(snapshot).not.toBe(state);
        expect(Object.isFrozen(snapshot)).toBe(true);
        expect(() => {
          snapshot.blastDay = 2;
        }).toThrow();
        (state as { blastDay: number | null }).blastDay = 1;
        expect(snapshot.blastDay).toBeNull();
        await provider.getAction(request(other));
        expect(seen[1]!.ownState.redMoon).toBeUndefined();
        let accessed = 0;
        Object.defineProperty(state, "exileDay", {
          configurable: true,
          get() {
            accessed++;
            throw new Error("forbidden getter");
          },
        });
        await provider.getAction(request(actor));
        expect(accessed).toBe(0);
        expect(seen[2]!.ownState.redMoon).toBeUndefined();
      },
    );
