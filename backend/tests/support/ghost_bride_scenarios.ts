import { GHOST_BRIDE_POLICY } from "@ai-werewolf-arena/game-text";
import {
  Role,
  WinCondition,
  ActionWindow,
  WitchSelfHealRule,
  type BoardConfig,
} from "../../src/core";
export const ghostBrideDeck = [
  Role.GhostBride,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Seer,
  Role.Witch,
  Role.Hunter,
  Role.Guard,
];
export function ghostBrideBoard(): BoardConfig {
  return {
    boardSize: 12,
    enableSheriff: true,
    winConditions: [WinCondition.ThreeFactionsElimination],
    ghostBride: { policy: GHOST_BRIDE_POLICY },
    roleSetups: [...new Set(ghostBrideDeck)].map((role) => ({
      role,
      count: ghostBrideDeck.filter((r) => r === role).length,
    })),
    hooks: { onPreElection: true, onPreVote: true, onDaybreak: false, onPerSpeechGap: false },
    selfDestruct: { enabledWindows: [ActionWindow.OnPreElection, ActionWindow.OnPreVote] },
    seer: { targetPolicy: "awa_alive_v1", actionPolicy: "awa_required_when_legal_v1" },
    guard: { repeatPolicy: "netease_consecutive_nights_v1" },
    witch: {
      canSelfHeal: WitchSelfHealRule.Disabled,
      knifeVisibility: "awa_with_heal_v1",
      potionPolicy: "awa_one_native_v1",
    },
    hunter: { deathActionPolicy: "awa_knife_or_exile_v1" },
    sheriff: {
      electionPolicy: "awa_final_candidates_v1",
      badgePolicy: "awa_next_seat_v1",
      voteWeight: 1.5,
    },
    tieBreaker: { sheriffVote: "min_seat", wolfKillVote: "min_id", exileVote: "min_id" },
    voting: { exilePolicy: "awa_direct_v1" },
    disclosure: { deathRevealPolicy: "awa_hidden_v1" },
    lastWords: { policy: "awa_initial_wave_v1" },
  };
}

import {
  Camp,
  PotionType,
  createRandom,
  shuffled,
  type ActionStage,
  type ToolCall,
} from "../../src/core";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../src/runtime/config/board_definition";
import type { PlannedTurn } from "./foundation_transport_plan";
import type { TransportGameScenario } from "./run_transport_game";
export type GhostBrideCase = "good" | "wolf" | "pair" | "witness";
/** Literal complete finite games; plans and winner oracle never inspect a production World. */
export function ghostBrideScenario(kind: GhostBrideCase): TransportGameScenario & {
  winner: Camp;
  winners: number[];
  brideId: number;
  groomId: number;
  witnessId: number;
  alive: number[];
} {
  const config = ghostBrideBoard(),
    seed = `ghost-bride:${kind}`;
  const roles = shuffled(ghostBrideDeck, createRandom(seed).fork("deal")),
    ids = roles.map((_, i) => i + 1);
  const bride = roles.indexOf(Role.GhostBride) + 1,
    wolves = ids.filter((id) => roles[id - 1] === Role.Wolf);
  const groom = kind === "wolf" ? roles.indexOf(Role.Villager) + 1 : wolves[0]!;
  const witness = kind === "wolf" ? roles.indexOf(Role.Seer) + 1 : wolves[1]!;
  const members = [bride, groom, witness],
    singles = wolves.filter((id) => !members.includes(id)),
    good = ids.filter((id) => roles[id - 1] !== Role.Wolf && !members.includes(id));
  const winner = kind === "good" ? Camp.Good : kind === "wolf" ? Camp.Wolf : Camp.ThirdParty;
  const turns = new Map(ids.map((id) => [id, [] as PlannedTurn[]])),
    dead = new Set<number>();
  const add = (
    day: number,
    actors: number[],
    stage: ActionStage,
    action: ToolCall | null | ((id: number) => ToolCall | null),
  ) => {
    for (const id of actors)
      turns
        .get(id)!
        .push({ day, stage, action: typeof action === "function" ? action(id) : action });
  };
  const words = (day: number, actors: number[]) =>
    add(day, actors, "last_words", { name: "speak", args: { text: "" } });
  add(1, [bride], "ghost_bride_groom", { name: "choose_bridegroom", args: { target_id: groom } });
  add(1, [bride, groom], "ghost_bride_chat", {
    name: "speak_to_partner",
    args: { text: "Private authorized partner message" },
  });
  add(1, [bride, groom], "ghost_bride_witness", {
    name: "choose_wedding_witness",
    args: { target_id: witness },
  });
  const seer = roles.indexOf(Role.Seer) + 1,
    witch = roles.indexOf(Role.Witch) + 1,
    guard = roles.indexOf(Role.Guard) + 1,
    hunter = roles.indexOf(Role.Hunter) + 1;
  let goodIndex = 0;
  for (let day = 1; day <= 8; day++) {
    const alive = () => ids.filter((id) => !dead.has(id));
    if (day > 1 && !dead.has(bride) && !dead.has(groom))
      add(day, [bride, groom], "ghost_bride_chat", {
        name: "speak_to_partner",
        args: { text: "" },
      });
    if (!dead.has(guard))
      add(day, [guard], "guard", { name: "guard", args: { target_id: null, abstain: true } });
    const pack = singles.filter((id) => !dead.has(id));
    const knifeActors = pack.length
      ? pack
      : !dead.has(bride) && !dead.has(groom)
        ? [bride, groom]
        : dead.has(bride) && dead.has(groom) && !dead.has(witness)
          ? [witness]
          : [];
    const target =
      day === 1
        ? kind === "pair"
          ? null
          : bride
        : kind === "good"
          ? null
          : (good[goodIndex++] ?? null);
    if (pack.length)
      add(day, pack, "wolf_discussion", {
        name: "speak_to_wolves",
        args: { text: "", end_chat: true },
      });
    const knifeArgs = { target_id: target, abstain: target === null };
    add(
      day,
      knifeActors,
      pack.length ? "wolf_vote" : "ghost_bride_knife",
      pack.length
        ? { name: "kill_vote", args: knifeArgs }
        : { name: "wedding_kill_vote", args: knifeArgs },
    );
    if (!dead.has(witch))
      add(day, [witch], "witch", {
        name: "use_potion",
        args: { target_id: witch, potion_type: PotionType.None },
      });
    if (!dead.has(seer))
      add(day, [seer], "seer", {
        name: "check_identity",
        args: { target_id: alive().find((id) => id !== seer)! },
      });
    const nightDead =
      target === null ? [] : members.slice(0, 2).includes(target) ? [bride, groom] : [target];
    nightDead.forEach((id) => dead.add(id));
    if (day === 1 && target !== null) words(day, [target]);
    if (nightDead.includes(hunter))
      add(day, [hunter], "hunter_shot", { name: "shoot", args: { target_id: null } });
    const remainingFactions = new Set(
      alive().map((id) =>
        members.includes(id) ? Camp.ThirdParty : wolves.includes(id) ? Camp.Wolf : Camp.Good,
      ),
    );
    if (remainingFactions.size === 1) break;
    if (day === 1) {
      add(
        day,
        pack.filter((id) => !dead.has(id)),
        ActionWindow.OnPreElection,
        null,
      );
      add(day, alive(), "sheriff_nomination", { name: "run_for_sheriff", args: { run: false } });
    }
    add(day, alive(), "day_speech", { name: "speak", args: { text: "Public speech" } });
    add(
      day,
      pack.filter((id) => !dead.has(id)),
      ActionWindow.OnPreVote,
      null,
    );
    const exile =
      day === 1
        ? kind === "pair" || kind === "witness"
          ? singles[0]!
          : witness
        : kind === "good"
          ? singles[0]!
          : good[goodIndex++]!;
    add(day, alive(), "voting", (id) => ({
      name: "vote",
      args: { target_id: id === exile ? null : exile, abstain: id === exile },
    }));
    const exileDead = [bride, groom].includes(exile) ? [bride, groom] : [exile];
    exileDead.forEach((id) => dead.add(id));
    words(day, [exile]);
    if (exileDead.includes(hunter))
      add(day, [hunter], "hunter_shot", { name: "shoot", args: { target_id: null } });
    if (
      new Set(
        alive().map((id) =>
          members.includes(id) ? Camp.ThirdParty : wolves.includes(id) ? Camp.Wolf : Camp.Good,
        ),
      ).size === 1
    )
      break;
  }
  const winners = ids.filter(
    (id) =>
      (members.includes(id) ? Camp.ThirdParty : wolves.includes(id) ? Camp.Wolf : Camp.Good) ===
      winner,
  );
  for (const [actor, rows] of turns)
    if (!members.includes(actor))
      for (const row of rows)
        row.forbiddenPromptMarkers = [
          "ghost-bride:1:",
          "Private authorized partner message",
          '"partnerId"',
          '"witnessId"',
        ];
  return {
    board: parseBoardDefinition(boardDefinitionFromConfig(`ghost_bride_12_${kind}`, config)),
    seed,
    roles,
    turns,
    winner,
    winners,
    brideId: bride,
    groomId: groom,
    witnessId: witness,
    alive: ids.filter((id) => !dead.has(id)),
    promptAssertions: (actor) => ({
      expectedTeammateIds: singles.includes(actor) ? singles.filter((id) => id !== actor) : [],
    }),
  };
}
