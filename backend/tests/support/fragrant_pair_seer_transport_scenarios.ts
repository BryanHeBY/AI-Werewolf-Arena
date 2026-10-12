import {
  Role,
  PotionType,
  ActionWindow,
  Camp,
  createRandom,
  shuffled,
  type ActionStage,
  type ToolCall,
} from "../../src/core";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../src/runtime/config/board_definition";
import { fragrantPairSeerTwelveConfig } from "../../src/runtime/scenarios/fragrant_pair_seer_twelve";
import type { PlannedTurn } from "./foundation_transport_plan";
import type { TransportGameScenario } from "./run_transport_game";
/** Literal old-seat damage and life lists are an independent complete-game oracle. */
const plans = {
  caster_gun: {
    bind: [[5, 6], null, null],
    knife: [11, 7, 8],
    poison: [1, null, null],
    exile: [2, 3, null],
    pair: [
      [9, 2],
      [9, 4],
      [9, 4],
    ],
    deaths: [[1, 11], [7], [8]],
    actual: [[1, 11], [7], [8]],
    alive: [
      [3, 4, 7, 8, 9, 10, 12],
      [4, 8, 9, 10, 12],
      [4, 9, 10, 12],
    ],
    dayGun: { day: 1, target: 5, added: 6 },
    gun: null,
    winner: Camp.Wolf,
  },
  link_hunter: {
    bind: [[1, 11], null, null],
    knife: [5, 6, 7],
    poison: [1, null, null],
    exile: [2, 3, 4],
    pair: [
      [9, 2],
      [9, 4],
      [9, 4],
    ],
    deaths: [[1, 5], [6], [7]],
    actual: [[1, 5, 11], [6], [7]],
    alive: [
      [3, 4, 6, 7, 8, 9, 10, 12],
      [4, 7, 8, 9, 10, 12],
      [8, 9, 10, 12],
    ],
    gun: null,
    winner: Camp.Good,
  },
  second_night: {
    bind: [null, [5, 6], null],
    knife: [7, 5, 8],
    poison: [null, null, null],
    exile: [2, 3, null],
    pair: [
      [9, 2],
      [9, 4],
      [9, 1],
    ],
    deaths: [[7], [5], [8]],
    actual: [[7], [5, 6], [8]],
    alive: [
      [1, 3, 4, 5, 6, 8, 9, 10, 11, 12],
      [1, 4, 8, 9, 10, 11, 12],
      [1, 4, 9, 10, 11, 12],
    ],
    gun: null,
    winner: Camp.Wolf,
  },
  protected: {
    bind: [[5, 6], null, [6, 7], null],
    guard: [5, null, null, null],
    knife: [5, 5, 6, 8],
    poison: [null, null, null, null],
    exile: [2, 3, 4, null],
    pair: [
      [9, 2],
      [9, 4],
      [9, 1],
      [9, 1],
    ],
    deaths: [[], [5], [6], [8]],
    actual: [[], [5], [6, 7], [8]],
    alive: [
      [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      [1, 4, 6, 7, 8, 9, 10, 11, 12],
      [1, 8, 9, 10, 11, 12],
      [1, 9, 10, 11, 12],
    ],
    gun: null,
    winner: Camp.Wolf,
  },
  badge: {
    bind: [[5, 6], null, null],
    knife: [5, 7, 8],
    poison: [null, null, null],
    exile: [2, 3, null],
    pair: [
      [9, 2],
      [9, 4],
      [9, 1],
    ],
    deaths: [[5], [7], [8]],
    actual: [[5, 6], [7], [8]],
    alive: [
      [1, 3, 4, 7, 8, 9, 10, 11, 12],
      [1, 4, 8, 9, 10, 11, 12],
      [1, 4, 9, 10, 11, 12],
    ],
    sheriff: 6,
    gun: null,
    winner: Camp.Wolf,
  },
  pre_election_overlap: {
    bind: [[2, 5], null, null],
    knife: [2, 3, 6],
    poison: [null, null, null],
    exile: [null, 4, 1],
    pair: [
      [9, 2],
      [9, 10],
      [9, 10],
    ],
    deaths: [[2], [3], [6]],
    actual: [[2, 5], [3], [6]],
    alive: [
      [1, 3, 4, 6, 7, 8, 9, 10, 11, 12],
      [1, 6, 7, 8, 9, 10, 11, 12],
      [7, 8, 9, 10, 11, 12],
    ],
    blast: { day: 1, actor: 2, window: ActionWindow.OnPreElection },
    gun: null,
    winner: Camp.Good,
  },
  pre_vote: {
    bind: [[2, 5], null, null],
    knife: [6, 3, 7],
    poison: [null, null, null],
    exile: [null, 4, 1],
    pair: [
      [9, 2],
      [9, 10],
      [9, 10],
    ],
    deaths: [[6], [3], [7]],
    actual: [[6], [3], [7]],
    alive: [
      [1, 3, 4, 7, 8, 9, 10, 11, 12],
      [1, 7, 8, 9, 10, 11, 12],
      [8, 9, 10, 11, 12],
    ],
    blast: { day: 1, actor: 2, window: ActionWindow.OnPreVote },
    gun: null,
    winner: Camp.Good,
  },
  inherited_gun: {
    bind: [null, null, [1, 12]],
    knife: [9, 10, 11],
    poison: [2, null, null],
    exile: [3, 4, null],
    pair: [[9, 2], null, null],
    deaths: [[2, 9], [10], [11]],
    alive: [
      [1, 4, 5, 6, 7, 8, 10, 11, 12],
      [1, 5, 6, 7, 8, 11, 12],
      [5, 6, 7, 8],
    ],
    gun: 1,
    winner: Camp.Good,
  },
  first_link: {
    bind: [[5, 6], null, null],
    knife: [5, 7, 8],
    poison: [null, null, null],
    exile: [2, 3, null],
    pair: [
      [9, 2],
      [9, 4],
      [9, 1],
    ],
    deaths: [[5], [7], [8]],
    alive: [
      [1, 3, 4, 7, 8, 9, 10, 11, 12],
      [1, 4, 8, 9, 10, 11, 12],
      [1, 4, 9, 10, 11, 12],
    ],
    gun: null,
    winner: Camp.Wolf,
  },
  expiry: {
    bind: [[5, 6], null, [5, 6], null],
    knife: [null, 7, 5, null],
    poison: [null, null, null, null],
    exile: [2, 3, 4, 1],
    pair: [
      [2, 4],
      [9, 10],
      [9, 10],
      [9, 10],
    ],
    deaths: [[], [7], [5], []],
    alive: [
      [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      [1, 4, 5, 6, 8, 9, 10, 11, 12],
      [1, 8, 9, 10, 11, 12],
      [8, 9, 10, 11, 12],
    ],
    gun: null,
    winner: Camp.Good,
  },
  dead_caster: {
    bind: [[5, 6], null],
    knife: [3, 7],
    poison: [1, null],
    exile: [2, 4],
    pair: [
      [9, 2],
      [9, 10],
    ],
    deaths: [[1, 3], [7]],
    alive: [
      [4, 5, 6, 7, 8, 9, 10, 11, 12],
      [5, 6, 8, 9, 10, 11, 12],
    ],
    gun: null,
    winner: Camp.Good,
  },
  same_wave: {
    bind: [[5, 6], null, null],
    knife: [5, 7, 8],
    poison: [6, null, null],
    exile: [2, 3, null],
    pair: [
      [9, 2],
      [9, 4],
      [9, 1],
    ],
    deaths: [[5, 6], [7], [8]],
    alive: [
      [1, 3, 4, 7, 8, 9, 10, 11, 12],
      [1, 4, 8, 9, 10, 11, 12],
      [1, 4, 9, 10, 11, 12],
    ],
    gun: null,
    winner: Camp.Wolf,
  },
} as const;
export type FragrantTransportPlanName = keyof typeof plans;
export function fragrantTransportScenario(name: FragrantTransportPlanName = "inherited_gun") {
  const seed = "fragrant-transport-v1",
    board = parseBoardDefinition(
      boardDefinitionFromConfig("awa_fragrant_pair_seer_12_v1", fragrantPairSeerTwelveConfig),
    ),
    original = fragrantPairSeerTwelveConfig.roleSetups.flatMap((r) =>
      Array<Role>(r.count).fill(r.role),
    ),
    roles = shuffled(original, createRandom(seed).fork("deal")),
    ids = roles.map((_, i) => i + 1),
    used = new Map<Role, number>(),
    mapping = new Map<number, number>();
  for (let old = 1; old <= 12; old++) {
    const role = original[old - 1]!,
      matches = ids.filter((id) => roles[id - 1] === role),
      index = used.get(role) ?? 0;
    mapping.set(old, matches[index]!);
    used.set(role, index + 1);
  }
  const map = (old: number) => mapping.get(old)!,
    target = (old: number | null) => (old === null ? null : map(old)),
    list = (old: readonly number[]) => old.map(map).sort((a, b) => a - b),
    p = plans[name],
    turns = new Map<number, PlannedTurn[]>(ids.map((id) => [id, []]));
  const add = (
    day: number,
    actors: readonly number[],
    stage: ActionStage,
    action: ToolCall | null | ((old: number) => ToolCall | null),
  ) => {
    for (const old of actors)
      turns
        .get(map(old))!
        .push({ day, stage, action: typeof action === "function" ? action(old) : action });
  };
  let sheriff: number | null = "sheriff" in p ? p.sheriff : null;
  const blast = "blast" in p ? p.blast : null;
  for (let i = 0; i < p.knife.length; i++) {
    const day = i + 1,
      start: readonly number[] =
        i === 0 ? Array.from({ length: 12 }, (_, j) => j + 1) : p.alive[i - 1]!,
      pack = [2, 3, 4].filter((id) => start.includes(id)),
      knife = p.knife[i]!,
      binding = p.bind[i],
      triggered = ["first_link", "same_wave", "badge", "pre_election_overlap", "pre_vote"].includes(
        name,
      )
        ? i > 0
        : name === "second_night"
          ? i > 1
          : name === "protected"
            ? i > 2
            : name === "expiry"
              ? i > 2
              : false;
    if (start.includes(1) && !triggered)
      add(day, [1], "fragrant_bind", {
        name: "bind_fragrant_pair",
        args: { target_ids: binding ? ([map(binding[0]), map(binding[1])] as const) : null },
      });
    add(day, pack, "wolf_discussion", {
      name: "speak_to_wolves",
      args: { text: "End discussion", end_chat: true },
    });
    if (start.includes(12))
      add(day, [12], "guard", {
        name: "guard",
        args: {
          target_id: "guard" in p ? target(p.guard[i]!) : null,
          abstain: !("guard" in p) || p.guard[i] === null,
        },
      });
    add(day, pack.length ? pack : start.includes(1) ? [1] : [], "wolf_vote", {
      name: "kill_vote",
      args: { target_id: target(knife), abstain: knife === null },
    });
    if (start.includes(10))
      add(day, [10], "witch", {
        name: "use_potion",
        args: {
          target_id: target(p.poison[i] ?? 10)!,
          potion_type: p.poison[i] === null ? PotionType.None : PotionType.Poison,
        },
      });
    if (start.includes(9)) {
      const pair = p.pair[i]!;
      add(day, [9], "pair_inspection", {
        name: "check_pair",
        args: { target_ids: [map(pair![0]), map(pair![1])] },
      });
    }
    const blastAction = (old: number): ToolCall | null =>
      old === blast?.actor
        ? { name: "self_destruct", args: { confirm: true, reason: "Literal role linkage." } }
        : null;
    if (day === 1) {
      add(
        day,
        pack,
        ActionWindow.OnPreElection,
        blast?.day === day && blast.window === ActionWindow.OnPreElection ? blastAction : null,
      );
      if (blast?.day === day && blast.window === ActionWindow.OnPreElection) continue;
      add(day, start, "sheriff_nomination", (old) => ({
        name: "run_for_sheriff",
        args: { run: old === sheriff },
      }));
      if (sheriff !== null) {
        add(day, [sheriff], "sheriff_campaign_speech", {
          name: "speak",
          args: { text: "Literal campaign" },
        });
        add(day, [sheriff], "sheriff_withdraw", { name: "run_for_sheriff", args: { run: true } });
      }
    }
    let nightActual: number[] = "actual" in p ? [...p.actual[i]!] : [...p.deaths[i]!];
    if ((name === "first_link" && day === 1) || (name === "expiry" && day === 3))
      nightActual.push(6);
    if (day === 1)
      add(day, nightActual, "last_words", {
        name: "speak",
        args: { text: "Literal first-night words" },
      });
    if (name === "inherited_gun" && day === 3) {
      add(day, [11], "hunter_shot", { name: "shoot", args: { target_id: map(1) } });
      continue;
    }
    if (sheriff !== null && nightActual.includes(sheriff)) {
      add(day, [sheriff], "sheriff_badge_choice", {
        name: "choose_badge_successor",
        args: { target_id: map(12) },
      });
      sheriff = 12;
    }
    let live = start.filter((id) => !nightActual.includes(id));
    if ("dayGun" in p && p.dayGun.day === day) {
      add(day, [11], "hunter_shot", { name: "shoot", args: { target_id: map(p.dayGun.target) } });
      live = live.filter((id) => id !== p.dayGun.target && id !== p.dayGun.added);
    }
    if (day === p.knife.length && p.winner === Camp.Wolf) continue;
    if (sheriff !== null)
      add(day, [sheriff], "sheriff_choose_direction", {
        name: "choose_direction",
        args: { direction: "clockwise" },
      });
    add(day, live, "day_speech", { name: "speak", args: { text: "Literal public speech" } });
    add(
      day,
      [2, 3, 4].filter((id) => live.includes(id)),
      ActionWindow.OnPreVote,
      blast?.day === day && blast.window === ActionWindow.OnPreVote ? blastAction : null,
    );
    if (blast?.day === day && blast.window === ActionWindow.OnPreVote) continue;
    const exile = p.exile[i]!;
    add(day, live, "voting", (old) => ({
      name: "vote",
      args: {
        target_id: old === exile ? null : target(exile),
        abstain: old === exile || exile === null,
      },
    }));
    if (exile !== null)
      add(day, [exile], "last_words", { name: "speak", args: { text: "Literal exile words" } });
  }
  const scenario: TransportGameScenario = {
    board,
    seed,
    roles,
    turns,
    promptAssertions(actor, locale) {
      const role = roles[actor - 1]!;
      return {
        verifyGameWire: true,
        expectedTeammateIds:
          role === Role.Wolf
            ? list([2, 3, 4]).filter((id) => id !== actor)
            : role === Role.FragrantPhantom
              ? undefined
              : [],
      };
    },
  };
  return {
    ...scenario,
    name,
    mapping,
    winner: p.winner,
    alive: list(p.alive.at(-1)!),
    nightDeaths: p.deaths.map(list),
    cycleAlive: p.alive.map(list),
  };
}
