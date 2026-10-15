/**
 * Builds original noble-secret-body test input plans, fixed boards and explicit player/marker data. Inputs
 * are supplied variant/locale/seed choices; outputs retain the same arrays, stock parameters and configured
 * identities. Existing dealing may construct input identities, while handwritten expected outcomes remain
 * supplied data. It runs no game or model and changes no oracle algorithm.
 */
import { ActionWindow } from "../../../../../src/domain";
import { Camp } from "../../../../../src/domain";
import { Role } from "../../../../../src/domain";
import { PotionType } from "../../../../../src/domain";
import { createRandom } from "../../../../../src/domain";
import { shuffled } from "../../../../../src/domain";
import type { ActionStage } from "../../../../../src/domain";
import type { ToolCall } from "../../../../../src/domain";
import { boardDefinitionFromConfig } from "../../../../../src/runtime/config/board_definition";
import { parseBoardDefinition } from "../../../../../src/runtime/config/board_definition";
import { nobleSecretBodyTwelveConfig } from "../../../../../src/runtime/scenarios/noble_secret_body_twelve";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";

const plans = {
  pass_breaks_repeat: {
    body: [6, null, 6, 5],
    servant: [null, null, null, null],
    knife: [null, null, null, null],
    hunt: [null, null, null, null],
    exile: [10, 11, 12, 1],
    deaths: [[], [], [], []],
    alive: [
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 12],
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
      [2, 3, 4, 5, 6, 7, 8, 9],
    ],
    bodyActive: [true, true, true, true],
    nobleActive: [false, true, true, true],
    sheriff: null,
  },
  noble_pre_election_blast: {
    blast: { day: 1, stage: "on_pre_election", actor: 1 },
    body: [6, 7, 6, 7],
    servant: [null, null, null, null],
    knife: [null, null, null, null],
    hunt: [null, null, null, null],
    exile: [10, 10, 11, 12],
    deaths: [[], [], [], []],
    alive: [
      [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      [2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
      [2, 3, 4, 5, 6, 7, 8, 9, 12],
      [2, 3, 4, 5, 6, 7, 8, 9],
    ],
    bodyActive: [true, true, true, true],
    nobleActive: [false, false, false, false],
    sheriff: null,
  },
  noble_pre_vote_blast: {
    blast: { day: 2, stage: "on_pre_vote", actor: 1 },
    body: [6, 7, 6, null],
    servant: [null, 6, null, null],
    knife: [null, null, null, null],
    hunt: [null, null, null, null],
    exile: [10, 11, 11, 12],
    deaths: [[], [], [], []],
    alive: [
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
      [2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
      [2, 3, 4, 5, 6, 7, 8, 9, 12],
      [2, 3, 4, 5, 6, 7, 8, 9],
    ],
    bodyActive: [true, true, true, false],
    nobleActive: [false, true, false, false],
    sheriff: null,
  },
  ordinary_pre_election_blast: {
    blast: { day: 1, stage: "on_pre_election", actor: 10 },
    body: [6, 7, 6, 7],
    servant: [null, null, null, null],
    knife: [null, null, null, null],
    hunt: [null, null, null, null],
    exile: [10, 11, 12, 1],
    deaths: [[], [], [], []],
    alive: [
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 12],
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
      [2, 3, 4, 5, 6, 7, 8, 9],
    ],
    bodyActive: [true, true, true, true],
    nobleActive: [false, true, true, true],
    sheriff: null,
  },
  ordinary_pre_vote_blast: {
    blast: { day: 2, stage: "on_pre_vote", actor: 10 },
    body: [6, 7, 6, null],
    servant: [null, 6, null, 7],
    knife: [null, null, null, null],
    hunt: [null, null, null, null],
    exile: [11, 10, 12, 1],
    deaths: [[], [], [], []],
    alive: [
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 12],
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
      [2, 3, 4, 5, 6, 7, 8, 9],
    ],
    bodyActive: [true, true, true, false],
    nobleActive: [false, true, false, true],
    sheriff: null,
  },
  healed_target_fallback_then_exile: {
    body: [7, 8, 6, null],
    servant: [null, 5, null, 7],
    knife: [null, null, 6, 12],
    hunt: [null, null, null, null],
    exile: [10, 11, 5, 1],
    potions: [null, null, ["heal", 6], null],
    deaths: [[], [], [], [12]],
    alive: [
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 12],
      [1, 2, 3, 4, 6, 7, 8, 9, 12],
      [2, 3, 4, 6, 7, 8, 9],
    ],
    bodyActive: [true, true, true, false],
    nobleActive: [false, true, false, true],
    sheriff: null,
  },
  self_poison_expiry: {
    body: [7, 8, 6, null],
    servant: [null, 5, null, 7],
    knife: [null, null, 9, null],
    hunt: [null, null, null, null],
    exile: [10, 11, 12, 1],
    potions: [null, null, ["poison", 5], null],
    deaths: [[], [], [5, 9], []],
    alive: [
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 12],
      [1, 2, 3, 4, 6, 7, 8],
      [2, 3, 4, 6, 7, 8],
    ],
    bodyActive: [true, true, true, false],
    nobleActive: [false, true, false, true],
    sheriff: null,
  },
  toxin_immunity: {
    body: [7, 4, 6, 7],
    servant: [null, null, null, null],
    knife: [null, null, null, null],
    hunt: [null, null, null, null],
    exile: [10, 11, 12, 1],
    potions: [null, ["poison", 4], null, null],
    deaths: [[], [], [], []],
    alive: [
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 12],
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
      [2, 3, 4, 5, 6, 7, 8, 9],
    ],
    bodyActive: [true, true, true, true],
    nobleActive: [false, true, true, true],
    sheriff: null,
  },
  toxin_immunity_backlash: {
    body: [7, 4, null, null],
    servant: [null, null, null, null],
    knife: [null, null, null, null],
    hunt: [null, 6, null, null],
    exile: [10, 11, 12, 1],
    potions: [null, ["poison", 4], null, null],
    deaths: [[], [], [], []],
    alive: [
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 12],
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
      [2, 3, 4, 5, 6, 7, 8, 9],
    ],
    bodyActive: [true, true, false, false],
    nobleActive: [false, true, true, true],
    sheriff: null,
  },
  dead_noble_expiry: {
    body: [7, 8, 7, 8],
    servant: [null, 6, null, null],
    knife: [null, null, null, null],
    hunt: [null, null, null, null],
    exile: [10, 1, 11, 12],
    deaths: [[], [], [6], []],
    alive: [
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
      [2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
      [2, 3, 4, 5, 7, 8, 9, 12],
      [2, 3, 4, 5, 7, 8, 9],
    ],
    bodyActive: [true, true, true, true],
    nobleActive: [false, true, false, false],
    sheriff: null,
  },
  day_target_death_reopens: {
    body: [7, 8, 7, 8],
    servant: [null, 6, 9, null],
    knife: [null, null, null, 12],
    hunt: [null, null, null, null],
    exile: [10, 6, 11, 1],
    deaths: [[], [], [], [9, 12]],
    alive: [
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
      [1, 2, 3, 4, 5, 7, 8, 9, 11, 12],
      [1, 2, 3, 4, 5, 7, 8, 9, 12],
      [2, 3, 4, 5, 7, 8],
    ],
    bodyActive: [true, true, true, true],
    nobleActive: [false, true, true, false],
    sheriff: null,
  },
  first_night_death_pending_end: {
    body: [7, 8],
    servant: [null, 6],
    knife: [10, 12],
    hunt: [null, null],
    exile: [11, 1],
    deaths: [[10], [12]],
    alive: [
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 12],
      [2, 3, 4, 5, 6, 7, 8, 9],
    ],
    bodyActive: [true, true],
    nobleActive: [false, true],
    sheriff: null,
  },
  clear_preserves_poison: {
    body: [null, null, null, null],
    servant: [null, 6, 12, null],
    knife: [null, null, null, 12],
    hunt: [null, 6, null, 12],
    exile: [10, 11, 8, 1],
    potions: [null, ["poison", 6], null, null],
    deaths: [[], [6], [], [12]],
    alive: [
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
      [1, 2, 3, 4, 5, 7, 8, 9, 12],
      [1, 2, 3, 4, 5, 7, 9, 12],
      [2, 3, 4, 5, 7, 9],
    ],
    bodyActive: [true, true, true, true],
    nobleActive: [false, true, true, false],
    sheriff: null,
  },
  pending_at_end: {
    body: [null, null],
    servant: [null, 7],
    knife: [null, 12],
    hunt: [null, 11],
    exile: [10, 1],
    deaths: [[], [11, 12]],
    alive: [
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
      [2, 3, 4, 5, 6, 7, 8, 9],
    ],
    bodyActive: [true, true],
    nobleActive: [false, true],
    sheriff: null,
  },
  caster_death: {
    body: [6, 7, 6],
    servant: [null, 6, null],
    knife: [null, 1, null],
    hunt: [null, null, null],
    exile: [10, 11, 12],
    deaths: [[], [1], []],
    alive: [
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
      [2, 3, 4, 5, 6, 7, 8, 9, 12],
      [2, 3, 4, 5, 6, 7, 8, 9],
    ],
    bodyActive: [true, true, true],
    nobleActive: [false, true, false],
    sheriff: null,
  },
  expiry: {
    body: [6, 7, 6, null],
    servant: [null, 6, null, 7],
    knife: [null, null, null, null],
    hunt: [null, null, null, null],
    exile: [10, 11, 12, 1],
    deaths: [[], [], [], []],
    alive: [
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 12],
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
      [2, 3, 4, 5, 6, 7, 8, 9],
    ],
    bodyActive: [true, true, true, false],
    nobleActive: [false, true, false, true],
    sheriff: null,
  },
  new_and_old_clear: {
    body: [null, null, null, null],
    servant: [null, 6, 12, null],
    knife: [null, null, null, 12],
    hunt: [null, 6, null, 12],
    exile: [10, 11, 6, 1],
    deaths: [[], [], [], [12]],
    alive: [
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 12],
      [1, 2, 3, 4, 5, 7, 8, 9, 12],
      [2, 3, 4, 5, 7, 8, 9],
    ],
    bodyActive: [true, true, true, true],
    nobleActive: [false, true, true, false],
    sheriff: null,
  },
  two_sources: {
    body: [null, 7, 6, null],
    servant: [null, 5, null, 7],
    knife: [null, null, 6, null],
    hunt: [null, null, null, null],
    exile: [10, 11, 12, 1],
    deaths: [[], [], [5, 6], []],
    alive: [
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 12],
      [1, 2, 3, 4, 7, 8, 9],
      [2, 3, 4, 7, 8, 9],
    ],
    bodyActive: [true, true, true, false],
    nobleActive: [false, true, false, true],
    sheriff: null,
  },
  pending_last_wolf: {
    body: [null, null, null],
    servant: [null, 7, null],
    knife: [null, null, null],
    hunt: [null, 12, null],
    exile: [10, 11, 1],
    deaths: [[], [12], [7]],
    alive: [
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
      [2, 3, 4, 5, 6, 8, 9],
    ],
    bodyActive: [true, true, true],
    nobleActive: [false, true, false],
    sheriff: null,
  },
  badge_reveal: {
    body: [6, null, null, null],
    servant: [null, null, null, null],
    knife: [null, null, null, 12],
    hunt: [null, null, null, 11],
    exile: [5, 10, 5, 1],
    deaths: [[], [], [], [11, 12]],
    alive: [
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
      [1, 2, 3, 4, 6, 7, 8, 9, 11, 12],
      [2, 3, 4, 6, 7, 8, 9],
    ],
    bodyActive: [true, false, false, false],
    nobleActive: [false, true, true, true],
    sheriff: 5,
  },
} as const;

export type NobleTransportPlanName = keyof typeof plans;

export function nobleTransportScenario(
  name: NobleTransportPlanName = "expiry",
  options: {
    wolf?: "standard" | "no_blast_no_self_knife";
    repeat?: "awa_nonconsecutive_nights_v1" | "awa_repeat_v1";
  } = {},
) {
  const config = nobleSecretBodyTwelveConfig(options.wolf, options.repeat),
    seed = "noble-body-transport-v1",
    board = parseBoardDefinition(boardDefinitionFromConfig("awa_noble_secret_body_12_v1", config)),
    original = config.roleSetups.flatMap((row) => Array<Role>(row.count).fill(row.role)),
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
    list = (olds: readonly number[]) => olds.map(map).sort((a, b) => a - b),
    plan = plans[name],
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
  const wolves = [1, 10, 11, 12];
  const blast = "blast" in plan ? plan.blast : null,
    blastAction = (old: number): ToolCall | null =>
      old === blast?.actor
        ? { name: "self_destruct", args: { confirm: true, reason: "Literal window interruption." } }
        : null;
  let sheriff: number | null = plan.sheriff;
  for (let i = 0; i < plan.exile.length; i++) {
    const day = i + 1,
      start: readonly number[] =
        i === 0 ? Array.from({ length: 12 }, (_, i) => i + 1) : plan.alive[i - 1]!,
      pack = wolves.filter((id) => start.includes(id)),
      canBlast = pack.filter((id) => !(id === 1 && options.wolf === "no_blast_no_self_knife"));
    if (plan.bodyActive[i])
      add(day, [5], "secret_body", {
        name: "protect_secret_body",
        args: {
          target_id: target(
            name === "expiry" && options.repeat === "awa_repeat_v1" && day === 2
              ? 6
              : plan.body[i]!,
          ),
        },
      });
    add(day, pack, "wolf_discussion", {
      name: "speak_to_wolves",
      args: { text: "End discussion", end_chat: true },
    });
    add(day, pack, "wolf_vote", {
      name: "kill_vote",
      args: { target_id: target(plan.knife[i]!), abstain: plan.knife[i] === null },
    });
    if (plan.nobleActive[i])
      add(day, [1], "night_noble", {
        name: "choose_servant",
        args: { target_id: target(plan.servant[i]!) },
      });
    const bottle =
      "potions" in plan
        ? plan.potions[i]
        : name === "two_sources" && day === 3
          ? (["poison", 6] as const)
          : null;
    if (start.includes(3))
      add(day, [3], "witch", {
        name: "use_potion",
        args: {
          target_id: bottle ? map(bottle[1]) : map(3),
          potion_type: bottle
            ? bottle[0] === "heal"
              ? PotionType.Heal
              : PotionType.Poison
            : PotionType.None,
        },
      });
    if (start.includes(2))
      add(day, [2], "seer", { name: "check_identity", args: { target_id: map(7) } });
    if (day >= 2 && start.includes(4))
      add(day, [4], "demon_hunter", {
        name: "demon_hunt",
        args: { target_id: target(plan.hunt[i]!), abstain: plan.hunt[i] === null },
      });
    const live = start.filter((id) => !(plan.deaths[i] as readonly number[]).includes(id));
    if (day === 1) {
      add(day, plan.deaths[i]!, "last_words", {
        name: "speak",
        args: { text: "Literal initial-wave last words" },
      });
      add(
        day,
        canBlast.filter((id) => live.includes(id)),
        ActionWindow.OnPreElection,
        blast?.day === day && blast.stage === "on_pre_election" ? blastAction : null,
      );
      if (blast?.day === day && blast.stage === "on_pre_election") continue;
      add(day, live, "sheriff_nomination", (old) => ({
        name: "run_for_sheriff",
        args: { run: old === sheriff },
      }));
      if (sheriff !== null) {
        add(day, [sheriff], "sheriff_campaign_speech", {
          name: "speak",
          args: { text: "Campaign" },
        });
        add(day, [sheriff], "sheriff_withdraw", { name: "run_for_sheriff", args: { run: true } });
      }
    }
    if (sheriff !== null)
      add(day, [sheriff], "sheriff_choose_direction", {
        name: "choose_direction",
        args: { direction: "clockwise" },
      });
    add(day, live, "day_speech", { name: "speak", args: { text: "Literal public speech" } });
    add(
      day,
      canBlast.filter((id) => live.includes(id)),
      ActionWindow.OnPreVote,
      blast?.day === day && blast.stage === "on_pre_vote" ? blastAction : null,
    );
    if (blast?.day === day && blast.stage === "on_pre_vote") continue;
    const exile = plan.exile[i]!;
    add(day, live, "voting", (old) => ({
      name: "vote",
      args: { target_id: old === exile ? null : map(exile), abstain: old === exile },
    }));
    if (name === "badge_reveal" && day === 1)
      add(day, [5], "awakened_idiot_reveal_speech", {
        name: "speak",
        args: { text: "My revealed role retains the vote and badge." },
      });
    else {
      add(day, [exile], "last_words", { name: "speak", args: { text: "Literal last words" } });
      if (sheriff === exile) {
        add(day, [exile], "sheriff_badge_choice", {
          name: "choose_badge_successor",
          args: { target_id: map(2) },
        });
        sheriff = 2;
      }
    }
  }
  const names: Partial<Record<Role, [string, string]>> = {
    [Role.NightNoble]: ["夜之贵族", "Night Noble"],
    [Role.AwakenedIdiot]: ["觉醒愚者", "Awakened Village Idiot"],
    [Role.Seer]: ["预言家", "Seer"],
    [Role.Witch]: ["女巫", "Witch"],
    [Role.DemonHunter]: ["猎魔人", "Demon Hunter"],
    [Role.Wolf]: ["狼人", "Werewolf"],
    [Role.Villager]: ["平民", "Villager"],
  };
  const scenario: TransportGameScenario = {
    board,
    seed,
    roles,
    turns,
    promptAssertions(actor, locale) {
      const role = roles[actor - 1]!;
      return {
        verifyGameWire: true,
        expectedIdentityMarker:
          locale === "en"
            ? `your true role is ${names[role]![1]}.`
            : `你的真实身份是${names[role]![0]}。`,
        expectedTeammateIds: [Role.Wolf, Role.NightNoble].includes(role)
          ? list(wolves).filter((id) => id !== actor)
          : [],
      };
    },
  };
  return {
    ...scenario,
    name,
    mapping,
    winner: Camp.Good,
    alive: list(plan.alive.at(-1)!),
    nightDeaths: plan.deaths.map(list),
    cycleAlive: plan.alive.map(list),
    plan,
  };
}
