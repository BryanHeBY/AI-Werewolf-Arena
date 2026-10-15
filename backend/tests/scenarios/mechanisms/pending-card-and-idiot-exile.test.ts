/**
 * 公开死亡场景测试：验证首日竞选隐藏 pending 身份，存活白痴放逐不变成死亡披露。输入为原固定名单、公开政策及完整 PM 请求；早期错误身份、无公开底牌和保留生命为手写预期，不添加生成式 oracle。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Phase, Role, type GameEvent, type BoardConfig } from "../../../src/domain";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { DeathResolution } from "../../../src/engine/death-resolution";
import { EventRegistry } from "../../../src/engine/events/event-registry";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";

const roles = [Role.Wolf, Role.Hunter, Role.WolfKing, Role.Villager, Role.Villager, Role.Villager];

const newWords = "netease_2017_day_and_first_night_v1" as const;

const open = "netease_2017_open_v1" as const;

function fixture(
  policy: "awa_initial_wave_v1" | typeof newWords = newWords,
  reveal: "awa_hidden_v1" | typeof open = open,
  day = 1,
) {
  const config: BoardConfig = {
    ...sixPlayerMvpConfig,
    roleSetups: [
      { role: Role.Wolf, count: 1 },
      { role: Role.Hunter, count: 1 },
      { role: Role.WolfKing, count: 1 },
      { role: Role.Villager, count: 3 },
    ],
    lastWords: { policy },
    disclosure: { deathRevealPolicy: reveal },
  };
  const game = bootstrapGame(config, { fixedRoles: roles });
  const events: GameEvent[] = [];
  const state = { phase: Phase.Day, day, gameOver: false, result: null };
  const gateway = new ToolGateway();
  const resolver = new DeathResolution(
    game.world,
    events,
    gateway,
    new EventRegistry(),
    state,
    config,
  );
  return { ...game, config, events, state, gateway, resolver };
}

test("first-day election sees no premature role card for pending night deaths", async () => {
  const f = fixture();
  f.config.enableSheriff = true;
  const game = bootstrapGame(f.config, { fixedRoles: roles });
  const stop = new Error("election_barrier");
  let election = false;
  await expect(
    game.phaseManager.runSingleCycle(
      {
        async getAction(req) {
          if (req.context.stage?.startsWith("sheriff")) {
            election = true;
            expect(
              req.context.visible_events?.some((event) => event.type === "player_role_revealed"),
            ).toBe(false);
            expect(game.world.getComponent(2, COMPONENT.Alive)!.alive).toBe(true);
            throw stop;
          }
          if (req.allowedTools.includes("speak_to_wolves"))
            return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
          if (req.allowedTools.includes("kill_vote"))
            return { name: "kill_vote", args: { target_id: 2, abstain: false } };
          throw new Error("unexpected before election");
        },
      },
      2,
    ),
  ).rejects.toBe(stop);
  expect(election).toBe(true);
  expect(game.phaseManager.getEvents().some((event) => event.type === "player_role_revealed")).toBe(
    false,
  );
});

test("actual surviving Village Idiot exile gets its special reveal but no death card or last words", async () => {
  const config: BoardConfig = {
    ...sixPlayerMvpConfig,
    lastWords: { policy: newWords },
    disclosure: { deathRevealPolicy: open },
    roleSetups: [
      { role: Role.Wolf, count: 1 },
      { role: Role.Idiot, count: 1 },
      { role: Role.Seer, count: 1 },
      { role: Role.Villager, count: 3 },
    ],
  };
  const game = bootstrapGame(config, {
    fixedRoles: [Role.Wolf, Role.Idiot, Role.Seer, Role.Villager, Role.Villager, Role.Villager],
  });
  await game.phaseManager.runSingleCycle(
    {
      async getAction(req) {
        if (req.allowedTools.includes("speak_to_wolves"))
          return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
        if (req.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: null, abstain: true } };
        if (req.allowedTools.includes("check_identity"))
          return { name: "check_identity", args: { target_id: 4 } };
        if (req.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
        if (req.allowedTools.includes("vote"))
          return { name: "vote", args: { target_id: 2, abstain: false } };
        throw new Error("unexpected idiot phase");
      },
    },
    2,
  );
  expect(game.world.getComponent(2, COMPONENT.Alive)!.alive).toBe(true);
  expect(
    game.phaseManager.getEvents().filter((event) => event.type === "idiot_revealed"),
  ).toHaveLength(1);
  expect(
    game.phaseManager
      .getEvents()
      .filter(
        (event) => event.type === "player_role_revealed" || event.type === "last_words_granted",
      ),
  ).toEqual([]);
});
