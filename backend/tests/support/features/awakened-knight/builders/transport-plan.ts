/**
 * 场景测试支持负责原觉醒骑士十二人板的独立字面传输计划。固定seed的牌序是预先核对的输入，不从生产规则推导预期。
 * 首日四连决斗对照本体盾、替身盾及无盾，次夜毒掉保活狼美人；延期词只按实际死亡顺序安排。
 * 此计划不读取God状态做决定、不调用生产保护或判胜计算，实际发牌和死亡由正式引擎完成。
 */
import { ActionWindow, Camp, PotionType, Role } from "@ai-werewolf-arena/game-contract";
import { awakenedKnightTwelveConfig } from "../../../../../src/rulesets/presets/awakened-knight-twelve";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../../src/app/config/board-definition";
import type { PlannedTurn, TransportGameScenario } from "../../../transport/contracts";
export type KnightProtection = "body" | "substitute" | "none";
export function awakenedKnightScenario(protection: KnightProtection): TransportGameScenario & {
  alive: number[];
  winner: Camp;
  protection: KnightProtection;
} {
  const roles = [
      Role.Villager,
      Role.Villager,
      Role.Witch,
      Role.Villager,
      Role.AwakenedGuard,
      Role.Villager,
      Role.AwakenedKnight,
      Role.Wolf,
      Role.Wolf,
      Role.AwakenedWolfBeauty,
      Role.Seer,
      Role.Wolf,
    ],
    turns = new Map<number, PlannedTurn[]>(roles.map((_, i) => [i + 1, []])),
    add = (actor: number, turn: PlannedTurn) => turns.get(actor)!.push(turn);
  for (const actor of [8, 9, 10, 12]) {
    add(actor, {
      day: 1,
      stage: "wolf_discussion",
      action: { name: "speak_to_wolves", args: { text: "End", end_chat: true } },
    });
    add(actor, {
      day: 1,
      stage: "wolf_vote",
      action: { name: "kill_vote", args: { target_id: 1, abstain: false } },
    });
  }
  add(5, {
    day: 1,
    stage: "awakened_protection_night",
    action: {
      name: "awakened_protect",
      args:
        protection === "body"
          ? { mode: "wait", target_id: null }
          : protection === "substitute"
            ? { mode: "protect", target_id: 2 }
            : { mode: "pass", target_id: null },
    },
  });
  add(10, {
    day: 1,
    stage: "awakened_charm",
    action: { name: "awakened_charm", args: { target_id: 2 } },
  });
  add(3, {
    day: 1,
    stage: "witch",
    action: { name: "use_potion", args: { target_id: 3, potion_type: PotionType.None } },
  });
  add(11, { day: 1, stage: "seer", action: { name: "check_identity", args: { target_id: 8 } } });
  for (const actor of [8, 9, 12])
    add(actor, { day: 1, stage: ActionWindow.OnPreElection, action: null });
  for (let actor = 1; actor <= 12; actor++)
    add(actor, {
      day: 1,
      stage: "sheriff_nomination",
      action: { name: "run_for_sheriff", args: { run: false } },
    });
  add(1, {
    day: 1,
    stage: "last_words",
    action: { name: "speak", args: { text: "Initial night words" } },
  });
  if (protection === "body")
    add(5, {
      day: 1,
      stage: "awakened_protection_day",
      action: { name: "awakened_protect", args: { mode: "protect", target_id: 10 } },
    });
  for (const [index, target] of [10, 8, 9, 12, null].entries())
    add(7, {
      day: 1,
      stage: index === 0 ? "awakened_duel" : "awakened_duel_continue",
      action: { name: "awakened_duel", args: { target_id: target } },
    });
  // 替死者只有无盾案真死；各波词统一推迟到主动结束，未死狼美人没有遗言。
  for (const actor of [...(protection === "none" ? [2] : []), 8, 9, 12])
    add(actor, {
      day: 1,
      stage: "last_words",
      action: { name: "speak", args: { text: "Deferred duel words" } },
    });
  add(10, {
    day: 2,
    stage: "wolf_discussion",
    action: { name: "speak_to_wolves", args: { text: "End", end_chat: true } },
  });
  add(10, {
    day: 2,
    stage: "wolf_vote",
    action: { name: "kill_vote", args: { target_id: 11, abstain: false } },
  });
  add(5, {
    day: 2,
    stage: "awakened_protection_night",
    action: { name: "awakened_protect", args: { mode: "pass", target_id: null } },
  });
  add(3, {
    day: 2,
    stage: "witch",
    action: { name: "use_potion", args: { target_id: 10, potion_type: PotionType.Poison } },
  });
  add(11, { day: 2, stage: "seer", action: { name: "check_identity", args: { target_id: 10 } } });
  return {
    board: parseBoardDefinition(
      boardDefinitionFromConfig(
        "awa_netease_awakened_knight_12_v1",
        structuredClone(awakenedKnightTwelveConfig),
      ),
    ),
    seed: "awakened-knight:delivery",
    roles,
    turns,
    protection,
    alive: protection === "none" ? [3, 4, 5, 6, 7] : [2, 3, 4, 5, 6, 7],
    winner: Camp.Good,
  };
}

/** 自爆对照：N1毒9、8自爆有无盾均跳日；N2救11，骑士处理剩余狼后全链终局。 */
export function awakenedKnightBlastScenario(protectedBlast: boolean): TransportGameScenario & {
  alive: number[];
  winner: Camp;
} {
  const base = awakenedKnightScenario("none"),
    turns = new Map<number, PlannedTurn[]>(base.roles.map((_, i) => [i + 1, []])),
    add = (actor: number, turn: PlannedTurn) => turns.get(actor)!.push(turn);
  for (const actor of [8, 9, 10, 12]) {
    add(actor, {
      day: 1,
      stage: "wolf_discussion",
      action: { name: "speak_to_wolves", args: { text: "End", end_chat: true } },
    });
    add(actor, {
      day: 1,
      stage: "wolf_vote",
      action: { name: "kill_vote", args: { target_id: 1, abstain: false } },
    });
  }
  add(5, {
    day: 1,
    stage: "awakened_protection_night",
    action: {
      name: "awakened_protect",
      args: protectedBlast ? { mode: "protect", target_id: 8 } : { mode: "pass", target_id: null },
    },
  });
  add(10, {
    day: 1,
    stage: "awakened_charm",
    action: { name: "awakened_charm", args: { target_id: 2 } },
  });
  add(3, {
    day: 1,
    stage: "witch",
    action: { name: "use_potion", args: { target_id: 9, potion_type: PotionType.Poison } },
  });
  add(11, { day: 1, stage: "seer", action: { name: "check_identity", args: { target_id: 8 } } });
  for (const actor of [8, 9, 12])
    add(actor, {
      day: 1,
      stage: ActionWindow.OnPreElection,
      action:
        actor === 8
          ? { name: "self_destruct", args: { confirm: true, reason: "Synthetic public blast" } }
          : null,
    });
  for (const actor of [1, 9])
    add(actor, {
      day: 1,
      stage: "last_words",
      action: { name: "speak", args: { text: "First night words" } },
    });
  for (const actor of [...(protectedBlast ? [8] : []), 10, 12]) {
    add(actor, {
      day: 2,
      stage: "wolf_discussion",
      action: { name: "speak_to_wolves", args: { text: "End", end_chat: true } },
    });
    add(actor, {
      day: 2,
      stage: "wolf_vote",
      action: { name: "kill_vote", args: { target_id: 11, abstain: false } },
    });
  }
  add(5, {
    day: 2,
    stage: "awakened_protection_night",
    action: { name: "awakened_protect", args: { mode: "pass", target_id: null } },
  });
  add(3, {
    day: 2,
    stage: "witch",
    action: { name: "use_potion", args: { target_id: 11, potion_type: PotionType.Heal } },
  });
  add(11, { day: 2, stage: "seer", action: { name: "check_identity", args: { target_id: 10 } } });
  const targets = [10, ...(protectedBlast ? [8] : []), 12];
  for (const [index, target] of [...targets, null].entries())
    add(7, {
      day: 2,
      stage: index === 0 ? "awakened_duel" : "awakened_duel_continue",
      action: { name: "awakened_duel", args: { target_id: target } },
    });
  for (const actor of targets)
    add(actor, {
      day: 2,
      stage: "last_words",
      action: { name: "speak", args: { text: "Deferred duel words" } },
    });
  return { ...base, turns, alive: [2, 3, 4, 5, 6, 7, 11], winner: Camp.Good };
}
