/**
 * 测试支持模块负责按 linked、saved-dreamer、protected-heal 或 draw 变体构造迷雾组合板传输场景；读取原公开板子并使用内部固定种子与映射。输出原行动、提示标记和字面场景预期；不启动传输或游戏循环。
 */
import { ActionWindow } from "../../../../../src/domain";
import { Camp } from "../../../../../src/domain";
import { Role } from "../../../../../src/domain";
import { createRandom } from "../../../../../src/domain";
import { shuffled } from "../../../../../src/domain";
import type { ActionStage } from "../../../../../src/domain";
import type { ToolCall } from "../../../../../src/domain";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";
import type { MistExpectedWireChoice } from "../oracles/transport";
import { mistBoard } from "./board";

export async function mistTransportScenario(
  variant: "linked" | "saved-dreamer" | "protected-heal" | "draw" = "linked",
) {
  const board = await mistBoard(),
    seed = "mist-raven-transport-v1";
  const roles = shuffled(
    board.config.roleSetups.flatMap((r) => Array.from({ length: r.count }, () => r.role)),
    createRandom(seed).fork("deal"),
  );
  const ids = roles.map((_, i) => i + 1),
    id = (r: Role) => roles.indexOf(r) + 1;
  const alchemist = id(Role.Alchemist),
    dreamer = id(Role.Dreamer),
    seer = id(Role.Seer),
    raven = id(Role.RavenClawWolf);
  const ordinary = ids.filter((i) => roles[i - 1] === Role.Wolf),
    villagers = ids.filter((i) => roles[i - 1] === Role.Villager);
  const [w0, w1, w2] = ordinary as [number, number, number],
    [v0, v1, v2, v3] = villagers as [number, number, number, number];
  const protectedHeal = variant === "protected-heal",
    saved = variant === "saved-dreamer",
    draw = variant === "draw";
  // 本种子独立手算的 FNV／Mulberry 固定结果为 index 2；该字面顺序选中 w1。
  const circle = draw ? [w0, w2, w1] : [v0, v1, w1],
    unsealDay = protectedHeal ? 3 : 2,
    known = protectedHeal ? [] : [w0];
  const turns = new Map<number, PlannedTurn[]>(ids.map((i) => [i, []]));
  const add = (
    day: number,
    actors: number[],
    stage: ActionStage,
    action: ToolCall | null | ((actor: number) => ToolCall | null),
  ) => {
    for (const actor of actors)
      turns
        .get(actor)!
        .push({ day, stage, action: typeof action === "function" ? action(actor) : action });
  };
  const words = (day: number, actors: number[]) =>
    add(day, actors, "last_words", { name: "speak", args: { text: "Words" } });
  const pack = (day: number, actors: number[], target: number | null) => {
    add(day, actors, "wolf_discussion", {
      name: "speak_to_wolves",
      args: { text: `End day ${day}`, end_chat: true },
    });
    add(day, actors, "wolf_vote", {
      name: "kill_vote",
      args: { target_id: target, abstain: target === null },
    });
  };
  const night = (
    day: number,
    m: number | null,
    actors: number[],
    knife: number | null,
    extra: number | null | undefined,
  ) => {
    if (m !== null) add(day, [dreamer], "dreamer", { name: "dream", args: { target_id: m } });
    pack(day, actors, knife);
    if (extra !== undefined)
      add(day, [raven], "raven_knife", { name: "raven_knife", args: { target_id: extra } });
    add(day, [seer], "seer", { name: "check_identity", args: { target_id: raven } });
  };
  const day = (
    day: number,
    start: number[],
    deaths: number[],
    target: number,
    snake: number | null | undefined,
  ) => {
    const alive = start.filter((i) => !deaths.includes(i)),
      speakers = snake !== undefined ? start : alive;
    if (day === 1) {
      add(day, ordinary, ActionWindow.OnPreElection, null);
      add(day, start, "sheriff_nomination", { name: "run_for_sheriff", args: { run: false } });
    }
    const daytimeWolves = ordinary.filter((i) => speakers.includes(i));
    add(day, daytimeWolves, ActionWindow.OnDaybreak, null);
    for (const speaker of [...speakers].sort((a, b) => a - b)) {
      add(day, [speaker], "day_speech", { name: "speak", args: { text: "Speech" } });
      add(day, daytimeWolves, ActionWindow.OnPerSpeechGap, null);
    }
    if (snake !== undefined)
      add(day, [alchemist], "alchemist_snake", { name: "use_snake", args: { target_id: snake } });
    if (day === 1) words(day, deaths);
    add(
      day,
      ordinary.filter((i) => alive.includes(i)),
      ActionWindow.OnPreVote,
      null,
    );
    add(day, alive, "voting", (actor) => ({
      name: "vote",
      args: { target_id: actor === target ? null : target, abstain: actor === target },
    }));
    words(day, [target]);
    return alive.filter((i) => i !== target);
  };
  add(1, [alchemist], "alchemist_mist", { name: "cast_mist", args: { target_ids: circle } });
  night(1, protectedHeal ? v0 : v3, ordinary, draw ? null : protectedHeal ? v0 : w1, undefined);
  const deaths1 = protectedHeal ? [] : [w1];
  let alive = day(1, ids, deaths1, protectedHeal ? w0 : w2, protectedHeal ? v0 : null);
  night(
    2,
    protectedHeal ? v3 : v0,
    protectedHeal ? ordinary.filter((i) => alive.includes(i)) : [w0, raven],
    protectedHeal ? w1 : dreamer,
    protectedHeal ? undefined : saved ? v0 : dreamer,
  );
  const deaths2 = protectedHeal ? [w1] : saved ? [v0] : [dreamer, v0];
  alive = day(2, alive, deaths2, protectedHeal ? w2 : w0, protectedHeal ? undefined : dreamer);
  night(
    3,
    protectedHeal ? v0 : saved ? v2 : null,
    [raven],
    v1,
    protectedHeal ? dreamer : undefined,
  );
  const deaths3 = protectedHeal ? [v1, dreamer, v0] : [v1];
  alive = day(3, alive, deaths3, raven, undefined);
  for (const turn of turns.get(raven)!)
    turn.currentTeammateIds = turn.day >= unsealDay ? [...known] : [];
  for (const turn of turns.get(alchemist)!) {
    const spentDay = protectedHeal ? 1 : 2;
    const beforeSpent = turn.day < spentDay || (turn.day === spentDay && turn.stage !== "voting");
    turn.requiredPromptMarkers = [`"healRemaining":${beforeSpent ? 1 : 0}`];
  }
  const wolves = [...ordinary, raven].sort((a, b) => a - b);
  const after = (actor: number, day: number, stage: ActionStage) =>
    turns.get(actor)!.findIndex((t) => t.day === day && t.stage === stage) + 1;
  const alphaChoices: MistExpectedWireChoice[] = [
    {
      type: "alchemist_mist_chosen",
      payload: { actorId: alchemist, day: 1, targetIds: circle },
      afterOrdinal: after(alchemist, 1, "alchemist_mist"),
    },
    ...[2, 3].map((day) => ({
      type: "alchemist_mist_skipped",
      payload: { actorId: alchemist, day, reason: "spent" },
    })),
    {
      type: "alchemist_snake_chosen",
      payload: { actorId: alchemist, day: 1, targetId: protectedHeal ? v0 : null },
      afterOrdinal: after(alchemist, 1, "alchemist_snake"),
    },
    ...(protectedHeal
      ? []
      : [
          {
            type: "alchemist_snake_chosen",
            payload: { actorId: alchemist, day: 2, targetId: dreamer },
            afterOrdinal: after(alchemist, 2, "alchemist_snake"),
          },
        ]),
  ];
  const ravenChoices: MistExpectedWireChoice[] = [
    { type: "raven_knife_skipped", payload: { actorId: raven, day: 1, reason: "sealed" } },
    {
      type: "raven_unsealed",
      payload: { actorId: raven, day: unsealDay, awakened: true, knownTeammateIds: known },
    },
    {
      type: "raven_knife_chosen",
      payload: { actorId: raven, day: unsealDay, targetId: saved ? v0 : dreamer },
      afterOrdinal: after(raven, unsealDay, "raven_knife"),
    },
    {
      type: "raven_knife_skipped",
      payload: {
        actorId: raven,
        day: protectedHeal ? 2 : 3,
        reason: protectedHeal ? "sealed" : "spent",
      },
      afterOrdinal: protectedHeal ? undefined : after(raven, 3, "wolf_vote"),
    },
  ];
  const packFacts: MistExpectedWireChoice[] = Array.from(
    { length: 4 - unsealDay },
    (_, i) => i + unsealDay,
  ).flatMap((day) => {
    const actors = day === 2 ? [w0, raven] : [raven],
      target = day === 2 ? dreamer : v1;
    return actors.flatMap((actor) => [
      {
        type: "wolf_discussion_ended",
        sourceDay: day,
        payload: { actorId: actor, reason: `End day ${day}`, round: 1 },
        afterOrdinal: actor === raven ? after(raven, day, "wolf_discussion") : undefined,
      },
      {
        type: "wolf_kill_vote_cast",
        sourceDay: day,
        payload: { actorId: actor, targetId: target, abstain: false },
        afterOrdinal: after(raven, day, actor === raven ? "wolf_vote" : "wolf_discussion"),
      },
    ]);
  });
  const names: Partial<Record<Role, [string, string]>> = {
    [Role.Alchemist]: ["炼金魔女", "Alchemist"],
    [Role.RavenClawWolf]: ["狼鸦之爪", "Raven-Claw Wolf"],
    [Role.Wolf]: ["狼人", "Werewolf"],
    [Role.Villager]: ["平民", "Villager"],
    [Role.Dreamer]: ["摄梦人", "Dreamer"],
    [Role.Seer]: ["预言家", "Seer"],
    [Role.Idiot]: ["白痴", "Village Idiot"],
  };
  const scenario: TransportGameScenario = {
    board,
    seed,
    roles,
    turns,
    promptAssertions: (actor, locale) => ({
      expectedIdentityMarker:
        locale === "en"
          ? `Your true role when this session begins is ${names[roles[actor - 1]!]![1]}.`
          : `你的真实身份是${names[roles[actor - 1]!]![0]}。`,
      expectedTeammateIds:
        actor === raven
          ? []
          : ordinary.includes(actor)
            ? wolves.filter((i) => i !== actor)
            : undefined,
      mistWire: {
        packFacts: actor === raven ? packFacts : undefined,
        choices: actor === alchemist ? alphaChoices : actor === raven ? ravenChoices : undefined,
        unseal: actor === raven ? { day: unsealDay, knownTeammateIds: known } : undefined,
        draw:
          draw && ordinary.includes(actor)
            ? {
                day: 1,
                candidates: circle,
                targetId: w1,
                afterOrdinal: after(actor, 1, "wolf_vote"),
              }
            : undefined,
      },
    }),
  };
  return {
    ...scenario,
    variant,
    alchemist,
    dreamer,
    seer,
    raven,
    ordinary,
    villagers,
    circle,
    nightDeaths: [deaths1, deaths2, deaths3],
    alive,
    winner: Camp.Good,
    unsealDay,
    known,
  };
}
