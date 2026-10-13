/**
 * 单元测试验证梦魇的首次恐惧政策、组件构造变体及私有观察。输入为字面政策、原 fixture 与 descriptor；
 * 手写 owner 字段、冻结历史和描述符预期检查脱离状态，不调用模型或完整对局。
 * 观察类型迁移保原输入与 oracle，不把访问器或他人状态猜成已知事实。
 */
import { getNightmareShadowState } from "../../../../src/game/mechanisms/roles/nightmare_shadow/state";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT, Phase, Role, type RoleComponent } from "../../../../src/core";
import { createRandom, randomDraws } from "../../../../src/core/domain/random";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import { ObservedBot } from "../../../../src/ai/agents/providers/observed_bot";
import { ObservedPlayersActionProvider } from "../../../../src/app/observed-players-action-provider";
import type { PlayerObservation } from "../../../../src/game/observation/player-observation";
import { nightmareTwelveConfig } from "../../../../src/runtime/scenarios/nightmare_twelve";
import {
  beginNightmareNight,
  commitNightmareFear,
} from "../../../../src/game/mechanisms/roles/nightmare_shadow/night_frame";
for (const fear of ["optional", "required_when_legal"] as const)
  for (const constructorLocation of ["own", "inherited"] as const)
    test(`nightmare first-fear observation is private, detached, and satisfies ${fear} with ${constructorLocation} constructor`, async () => {
      const config = structuredClone(nightmareTwelveConfig);
      config.nightmareShadow!.fearActionPolicy = fear;
      const f = bootstrapGame(config);
      const id = (role: Role) =>
        f.world
          .entityIds()
          .find((id) => f.world.getComponent(id, COMPONENT.Role)?.role === role)!;
      const actor = id(Role.NightmareShadow),
        villager = id(Role.Villager),
        wolf = id(Role.Wolf);
      const seen: PlayerObservation[] = [];
      const bot = new ObservedBot(randomDraws(createRandom("fear-observed")), "conservative");
      const provider = new ObservedPlayersActionProvider(
        f.world,
        new Map(
          [actor, villager].map((id) => [
            id,
            {
              async decide(o: PlayerObservation) {
                seen.push(o);
                return id === actor ? bot.decide(o) : null;
              },
            },
          ]),
        ),
        config,
      );
      const privateState = getNightmareShadowState(
        f.world.getComponent(actor, COMPONENT.Role)!,
      )!;
      Object.defineProperty(privateState.history, "map", {
        get() {
          throw new Error("nightmare_history_map_getter_executed");
        },
      });
      let constructorReads = 0;
      const constructorOwner =
        constructorLocation === "own"
          ? privateState.history
          : (Object.create(Array.prototype) as object);
      Object.defineProperty(constructorOwner, "constructor", {
        get() {
          constructorReads++;
          throw new Error("nightmare_history_constructor_getter_executed");
        },
      });
      if (constructorLocation === "inherited")
        Object.setPrototypeOf(privateState.history, constructorOwner);
      beginNightmareNight(f.world, 1);
      const factory = new GameActionRequestFactory(f.world, f.phaseManager.getEvents(), 1);
      const action = await provider.getAction(
        factory.create({
          actorId: actor,
          phase: Phase.Night,
          allowedTools: ["fear"],
          stage: "nightmare_fear",
          requiresAction: true,
          summary: "Fear",
        }),
      );
      expect(seen[0]!.teammateIds).toEqual([]);
      expect(seen[0]!.ownState.nightmare?.packReady).toBe(false);
      expect(action?.name).toBe("fear");
      if (action?.name !== "fear") throw new Error("missing fear");
      expect(action.args.abstain).toBe(fear === "optional");
      expect(() => {
        seen[0]!.ownState.nightmare!.history.push({ day: 99, targetId: wolf });
      }).toThrow();
      commitNightmareFear(f.world, actor, 1, wolf);
      expect(seen[0]!.ownState.nightmare!.history).toHaveLength(0);
      await provider.getAction(
        factory.create({
          actorId: actor,
          phase: Phase.Voting,
          allowedTools: ["vote"],
          stage: "voting",
          requiresAction: true,
          summary: "Vote",
        }),
      );
      expect(seen[1]!.ownState.nightmare!.history).toEqual([{ day: 1, targetId: wolf }]);
      expect(seen[1]!.ownState.nightmare!.history).not.toBe(privateState.history);
      expect(Object.isFrozen(seen[1]!.ownState.nightmare!.history)).toBe(true);
      expect(constructorReads).toBe(0);
      await provider.getAction(
        factory.create({
          actorId: villager,
          phase: Phase.Voting,
          allowedTools: ["vote"],
          stage: "voting",
          requiresAction: true,
          summary: "Vote",
        }),
      );
      expect(seen[2]!.ownState.nightmare).toBeUndefined();
      expect(constructorReads).toBe(0);
    });
