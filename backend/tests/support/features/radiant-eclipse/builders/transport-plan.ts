/**
 * Owns Radiant/Eclipse transport test input construction from a handwritten plan.
 * Inputs are the tracked public configs.example board JSON and original plan name;
 * outputs retain deterministic role remapping, action turns, prompt markers and
 * scenario expectations derived from that supplied literal plan. The original
 * public readFile/JSON/board parse and input callbacks stay intact. This builder
 * starts no server or model and invokes no production settlement or game cycle.
 */
import { readFile } from "node:fs/promises";
import { ActionWindow } from "../../../../../src/domain";
import { Camp } from "../../../../../src/domain";
import { Role } from "../../../../../src/domain";
import { PotionType } from "../../../../../src/domain";
import { createRandom } from "../../../../../src/domain";
import { shuffled } from "../../../../../src/domain";
import type { ActionStage } from "../../../../../src/domain";
import type { ToolCall } from "../../../../../src/domain";
import { parseBoardDefinition } from "../../../../../src/runtime/config/board_definition";
import { radiantRoles } from "./runtime-game";
import { radiantFullPlans } from "../oracles/literal-plans";
import type { RadiantFullPlanName } from "../oracles/literal-plans";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";

export async function radiantTransportScenario(
  name: RadiantFullPlanName = "independent-stock-card16-card17",
) {
  const board = parseBoardDefinition(
      JSON.parse(
        await readFile(
          new URL(
            "../../../../../../configs.example/boards/awa_radiant_eclipse_12_v1.json",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    ),
    seed = "radiant-eclipse-transport-v1";
  const roles = shuffled(
    board.config.roleSetups.flatMap((row) => Array.from({ length: row.count }, () => row.role)),
    createRandom(seed).fork("deal"),
  );
  const ids = roles.map((_, i) => i + 1),
    plan = radiantFullPlans.find((p) => p.name === name)!,
    mapping = new Map<number, number>();
  const used = new Map<Role, number>();
  for (let old = 1; old <= 12; old++) {
    const role = radiantRoles[old - 1]!,
      matches = ids.filter((id) => roles[id - 1] === role),
      index = used.get(role) ?? 0;
    mapping.set(old, matches[index]!);
    used.set(role, index + 1);
  }
  const map = (old: number) => mapping.get(old)!,
    list = (old: readonly number[]) => old.map(map).sort((a, b) => a - b);
  const turns = new Map<number, PlannedTurn[]>(ids.map((id) => [id, []]));
  const add = (
    day: number,
    oldActors: readonly number[],
    stage: ActionStage,
    action: ToolCall | null | ((old: number) => ToolCall | null),
    markers?: string[],
  ) => {
    for (const old of oldActors)
      turns.get(map(old))!.push({
        day,
        stage,
        action: typeof action === "function" ? action(old) : action,
        ...(markers ? { requiredPromptMarkers: markers } : {}),
      });
  };
  let dreamLast: { target: number | null; day: number | null } = { target: null, day: null };
  let shelterLast: { target: number | null; day: number | null } = { target: null, day: null };
  let originalStock = { heal: 1, poison: 1 },
    sheriff: number | null = plan.sheriff;
  const originalWolves = [10, 11, 12],
    sourceState = (id: number) => (id === 4 ? { ...originalStock } : undefined);
  const nightDeaths: number[][] = [];
  for (let index = 0; index < plan.nights.length; index++) {
    const day = index + 1,
      n = plan.nights[index]!,
      start =
        index === 0 ? Array.from({ length: 12 }, (_, i) => i + 1) : [...plan.alive[index - 1]!];
    const borrow = day >= 2 && start.includes(1) ? n.swallow : null;
    if (day >= 2 && start.includes(1))
      add(day, [1], "eclipse_swallow", {
        name: "swallow_skill",
        args: { target_id: borrow === null ? null : map(borrow) },
      });
    if (day >= 2 && start.includes(2) && borrow !== 2)
      add(day, [2], "radiant_shelter", {
        name: "cast_shelter",
        args: { target_id: n.shelter === null ? null : map(n.shelter) },
      });
    if (borrow === 2)
      add(
        day,
        [1],
        "radiant_shelter",
        { name: "cast_shelter", args: { target_id: n.shelter === null ? null : map(n.shelter) } },
        [`copy:eclipse:night:${day}`],
      );
    if (start.includes(5) && borrow !== 5) {
      add(day, [5], "dreamer", { name: "dream", args: { target_id: map(n.dream) } });
    }
    if (borrow === 5)
      add(day, [1], "dreamer", { name: "dream", args: { target_id: map(n.dream) } }, [
        `copy:eclipse:night:${day}`,
      ]);
    const pack = originalWolves.filter((id) => start.includes(id)),
      knife = pack.length ? pack : start.includes(1) ? [1] : [];
    add(day, pack, "wolf_discussion", {
      name: "speak_to_wolves",
      args: { text: "End", end_chat: true },
    });
    add(day, knife, "wolf_vote", {
      name: "kill_vote",
      args: { target_id: map(n.knife), abstain: false },
    });
    const bottle = "potion" in n ? n.potion : undefined;
    const use = (old: number) =>
      ({
        name: "use_potion",
        args: {
          target_id: bottle ? map(bottle[1]) : map(old),
          potion_type:
            bottle?.[0] === "heal"
              ? PotionType.Heal
              : bottle?.[0] === "poison"
                ? PotionType.Poison
                : PotionType.None,
        },
      }) as const;
    if (start.includes(4) && borrow !== 4) {
      add(day, [4], "witch", use(4));
      if (bottle) originalStock[bottle[0]]--;
    }
    if (borrow === 4 && (originalStock.heal || originalStock.poison))
      add(day, [1], "witch", use(1), [
        `copy:eclipse:night:${day}`,
        `"heal":${originalStock.heal}`,
        `"poison":${originalStock.poison}`,
      ]);
    if (start.includes(3) && borrow !== 3)
      add(day, [3], "seer", {
        name: "check_identity",
        args: { target_id: map("seer" in n ? n.seer : 1) },
      });
    if (borrow === 3)
      add(
        day,
        [1],
        "seer",
        { name: "check_identity", args: { target_id: map("seer" in n ? n.seer : 1) } },
        [`copy:eclipse:night:${day}`],
      );
    if (borrow !== null && borrow !== 6 && [2, 3, 4, 5].includes(borrow)) {
      const borrowed = turns
        .get(map(1))!
        .find(
          (t) =>
            t.day === day &&
            t.stage ===
              (
                { 2: "radiant_shelter", 3: "seer", 4: "witch", 5: "dreamer" } as Record<
                  number,
                  string
                >
              )[borrow],
        );
      if (borrowed)
        borrowed.radiantBorrow = {
          id: `copy:eclipse:night:${day}`,
          state:
            borrow === 2
              ? {
                  policy: "awa_radiant_eclipse_v1",
                  lastTarget: shelterLast.target,
                  lastDay: shelterLast.day,
                }
              : borrow === 3
                ? {
                    targetPolicy: "awa_alive_v1",
                    actionPolicy: "awa_required_when_legal_v1",
                    lastTarget: null,
                    lastIsWerewolf: null,
                    lastResult: null,
                    history: [],
                  }
                : borrow === 4
                  ? {
                      ...originalStock,
                      selfHealRule: "disabled",
                      knifeVisibility: "awa_with_heal_v1",
                      potionPolicy: "awa_one_native_v1",
                      canSelfHeal: false,
                      healUsedThisNight: false,
                      poisonUsedThisNight: false,
                    }
                  : {
                      lastTarget: dreamLast.target,
                      lastDay: dreamLast.day,
                      protectionPolicy: "netease_2026_night_immunity_v1",
                      history: [],
                    },
        };
    }
    if (day >= 2 && start.includes(2) && borrow !== 2)
      shelterLast = { target: n.shelter === null ? null : map(n.shelter), day };
    if (start.includes(5) && borrow !== 5) dreamLast = { target: map(n.dream), day };
    const linked: number[] = plan.dreamDeaths
        .filter((d) => d.day === day && d.reason === "linked")
        .map((d) => d.targetId),
      direct = plan.nightDeaths[index]!.filter((id) => !linked.includes(id));
    const deaths = [...list(direct), ...linked.map(map).filter((id) => !list(direct).includes(id))];
    nightDeaths.push(deaths);
    if (day === 1) {
      add(day, pack, ActionWindow.OnPreElection, null);
      add(day, start, "sheriff_nomination", (old) => ({
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
      add(day, plan.nightDeaths[index]!, "last_words", { name: "speak", args: { text: "Words" } });
    }
    if (sheriff !== null && (plan.nightDeaths[index]! as readonly number[]).includes(sheriff)) {
      add(day, [sheriff], "sheriff_badge_choice", {
        name: "choose_badge_successor",
        args: { target_id: map(2) },
      });
      sheriff = 2;
    }
    if (index === plan.nights.length - 1 && plan.phase === "day") continue;
    const alive = start.filter(
      (id) => !(plan.nightDeaths[index]! as readonly number[]).includes(id),
    );
    if (sheriff !== null)
      add(day, [sheriff], "sheriff_choose_direction", {
        name: "choose_direction",
        args: { direction: "clockwise" },
      });
    add(day, alive, "day_speech", { name: "speak", args: { text: "Speech" } });
    add(
      day,
      originalWolves.filter((id) => alive.includes(id)),
      ActionWindow.OnPreVote,
      null,
    );
    add(day, alive, "voting", (old) => ({
      name: "vote",
      args: {
        target_id: old === n.exile || n.exile === null ? null : map(n.exile),
        abstain: n.exile === null || old === n.exile,
      },
    }));
    if (n.exile !== null)
      add(day, [n.exile], "last_words", { name: "speak", args: { text: "Words" } });
  }
  const ordinary = list(originalWolves),
    maid = map(1),
    count = map(2);
  for (const turn of turns.get(maid)!) turn.currentTeammateIds = [...ordinary];
  const names: Partial<Record<Role, [string, string]>> = {
    [Role.Wolf]: ["狼人", "Werewolf"],
    [Role.Villager]: ["平民", "Villager"],
    [Role.Seer]: ["预言家", "Seer"],
    [Role.Witch]: ["女巫", "Witch"],
    [Role.Dreamer]: ["摄梦人", "Dreamer"],
    [Role.RadiantCount]: ["流光伯爵", "Radiant Count"],
    [Role.EclipseMaid]: ["蚀日侍女", "Eclipse Maid"],
  };
  const scenario: TransportGameScenario = {
    board,
    seed,
    roles,
    turns,
    promptAssertions(actor, locale) {
      const role = roles[actor - 1]!;
      return {
        expectedIdentityMarker:
          locale === "en"
            ? `your true role is ${names[role]![1]}.`
            : `你的真实身份是${names[role]![0]}。`,
        requiredCurrentMarkers:
          role === Role.EclipseMaid
            ? [
                locale === "en"
                  ? "Current role: Eclipse Maid; alignment: Werewolves."
                  : "本轮身份：蚀日侍女；阵营：狼人。",
              ]
            : [],
        expectedTeammateIds:
          role === Role.EclipseMaid
            ? ordinary
            : role === Role.Wolf
              ? ordinary.filter((id) => id !== actor)
              : [],
        requiredSystemMarkers:
          role === Role.EclipseMaid
            ? [
                locale === "en"
                  ? "Borrowed stocks are independent and never written back"
                  : "借用库存独立、不写回原主",
              ]
            : role === Role.RadiantCount
              ? [
                  locale === "en"
                    ? "A suppressed night is not a recorded pass"
                    : "被封禁的夜晚不算一次放弃",
                ]
              : [],
      };
    },
  };
  return {
    ...scenario,
    name,
    mapping,
    maid,
    count,
    ordinary,
    nightDeaths,
    alive: list(plan.alive.at(-1)!),
    winner: plan.winner === "good" ? Camp.Good : Camp.Wolf,
    plan,
  };
}
